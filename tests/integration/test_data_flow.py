import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from proofstill.trace_check import verify_trace

PROJECT = Path(__file__).resolve().parents[2]


class DataFlowTests(unittest.TestCase):
    def test_real_query_context_process_repeat_and_ui_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            trace = Path(tmp) / 'orders.jsonl'
            html = Path(tmp) / 'orders.html'
            result = subprocess.run([sys.executable, 'examples/order_flow.py', '--trace', str(trace)],
                                    cwd=PROJECT, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            summary = json.loads(result.stdout)
            self.assertEqual(summary['processed'], [{'id': 1, 'amount': 20}, {'id': 2, 'amount': 40}])
            expected = json.loads((PROJECT / 'examples/order_flow.expect.json').read_text())
            verified = verify_trace(trace, expected)
            self.assertTrue(verified['valid'], verified['issues'])
            self.assertEqual(len(verified['steps']), 7)
            command = subprocess.run([sys.executable, '-m', 'proofstill', 'trace', 'view', str(trace), '--expect', str(PROJECT / 'examples/order_flow.expect.json'), '--output', str(html)],
                                     cwd=PROJECT, capture_output=True, text=True)
            self.assertEqual(command.returncode, 0, command.stderr)
            self.assertTrue(html.is_file())
            content = html.read_text()
            self.assertIn('orders.lookup', content)
            self.assertIn('order-flow-data', content)
            self.assertNotIn('src="http', content)
            self.assertNotIn('href="http', content)
            bad = dict(expected, operations=['orders.lookup'])
            expected_file = Path(tmp) / 'bad.json'
            expected_file.write_text(json.dumps(bad))
            rejected = subprocess.run([sys.executable, '-m', 'proofstill', 'trace', 'verify', str(trace), '--expect', str(expected_file)], cwd=PROJECT, capture_output=True, text=True)
            self.assertNotEqual(rejected.returncode, 0)

    def test_harness_captures_flow_and_rejects_missing_or_modified_evidence(self):
        from proofstill.workflow import Harness, HarnessError
        from tests.support import make_plan, fake_codex
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plan_path = make_plan(root)
            (root / 'expect.json').write_text(json.dumps({'operations': ['lookup'], 'assertions': [], 'links': []}))
            (root / 'tests/check.py').write_text(
                'from pathlib import Path\n'
                'from proofstill.trace import Flow\n'
                'with Flow("captured") as flow:\n'
                '    flow.step("lookup", "현재 값 조회", lambda: Path("src/counter.py").read_text())\n'
                'assert "VALUE = 1" in Path("src/counter.py").read_text(), "EXPECTED_VALUE_ONE"\n'
                'print("CHECK_EXECUTED")\n')
            plan = json.loads(plan_path.read_text())
            plan['checks'][0].update(argv=[sys.executable, '-c', f'import sys; sys.path.insert(0, {str(PROJECT)!r}); exec(open("tests/check.py").read())'], trace_expectation='expect.json')
            plan_path.write_text(json.dumps(plan))
            h = Harness(root, codex=fake_codex(root))
            h.init(plan_path)
            h.review('counter', 'criteria')
            self.assertTrue(h.run('counter', 'red')[0]['accepted'])
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            green = h.run('counter', 'green')[0]
            self.assertTrue(green['accepted'])
            self.assertEqual(len(green['traces']), 1)
            trace = Path(green['traces'][0]['path'])
            self.assertTrue(trace.is_file())
            h.review('counter', 'implementation')
            report = h.report('counter')
            self.assertIn(str(trace), report.read_text())
            h.cleanup('counter')
            self.assertTrue(trace.is_file())
            trace.write_text('changed evidence')
            self.assertFalse(h.status('counter')['complete'])

    def test_required_trace_missing_cannot_be_green(self):
        from proofstill.workflow import Harness
        from tests.support import make_plan, fake_codex
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = make_plan(root)
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            (root / 'expect.json').write_text(json.dumps({'operations': ['lookup'], 'assertions': [], 'links': []}))
            plan = json.loads(path.read_text())
            plan['checks'][0].update(regression=True, trace_expectation='expect.json')
            path.write_text(json.dumps(plan))
            h = Harness(root, codex=fake_codex(root))
            h.init(path)
            h.review('counter', 'criteria')
            result = h.run('counter', 'green')[0]
            self.assertEqual(result['exit_code'], 0)
            self.assertFalse(result['accepted'])
            self.assertEqual(result['traces'], [])

    def test_sqlite_is_queried_again_after_each_actual_update(self):
        import importlib.util
        import sqlite3
        spec = importlib.util.spec_from_file_location('order_flow', PROJECT / 'examples/order_flow.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            connection = sqlite3.connect(':memory:')
            self.addCleanup(connection.close)
            connection.execute('CREATE TABLE orders (id INTEGER PRIMARY KEY, tenant TEXT, amount INTEGER, status TEXT)')
            connection.executemany('INSERT INTO orders VALUES (?, ?, ?, ?)', [
                (11, 'custom', 5, 'pending'), (42, 'custom', 7, 'pending'),
                (99, 'other', 100, 'pending'), (43, 'custom', 9, 'done')])
            connection.commit()
            statements = []
            connection.set_trace_callback(lambda sql: statements.append(sql))
            path = Path(tmp) / 'sql-flow.jsonl'
            result = module.run_orders(connection, path, {'tenant': 'custom', 'multiplier': 3})
            connection.set_trace_callback(None)
            self.assertEqual(result['processed'], [{'id': 11, 'amount': 15}, {'id': 42, 'amount': 21}])
            actual = [s.strip().split()[0].upper() for s in statements if s.strip().split()[0].upper() in ['SELECT', 'UPDATE']]
            self.assertEqual(actual, ['SELECT', 'UPDATE', 'SELECT', 'UPDATE', 'SELECT'])
            self.assertEqual(connection.execute('SELECT id, amount, status FROM orders ORDER BY id').fetchall(),
                             [(11, 15, 'done'), (42, 21, 'done'), (43, 9, 'done'), (99, 100, 'pending')])
            trace = verify_trace(path)
            self.assertTrue(trace['valid'], trace['issues'])
            self.assertEqual(trace['steps'][3]['inputs']['after'], 11)
            self.assertEqual(trace['steps'][3]['output']['items'][0]['id'], 42)
            self.assertEqual(trace['steps'][6]['output']['items'], [])

    def test_malformed_trace_is_recorded_and_invalidates_previous_complete(self):
        from proofstill.workflow import Harness
        from tests.support import make_plan, fake_codex
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            definition = make_plan(root)
            script = ('import os, sys\nfrom pathlib import Path\n'
                      f'sys.path.insert(0, {str(PROJECT)!r})\n'
                      'from proofstill.trace import Flow\n'
                      'if Path("bad-mode").exists():\n'
                      '    (Path(os.environ["PROOFSTILL_TRACE_DIR"]) / "bad.jsonl").write_text("[]\\n")\n'
                      'else:\n'
                      '    with Flow("captured") as flow:\n'
                      '        flow.step("lookup", "현재 값 조회", lambda: 1)\n'
                      'assert "VALUE = 1" in Path("src/counter.py").read_text(), "EXPECTED_VALUE_ONE"\n'
                      'print("CHECK_EXECUTED")\n')
            (root / 'tests/check.py').write_text(script)
            h = Harness(root, codex=fake_codex(root))
            h.init(definition)
            h.review('counter', 'criteria')
            h.run('counter', 'red')
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            h.run('counter', 'green')
            h.review('counter', 'implementation')
            self.assertTrue(h.status('counter')['complete'])
            (root / 'bad-mode').touch()
            result = h.run('counter', 'green')[0]
            self.assertFalse(result['accepted'])
            self.assertFalse(h.status('counter')['complete'])
            self.assertTrue(Path(result['receipt']).is_file())
            self.assertTrue(Path(result['log']).is_file())
            self.assertFalse(result['traces'][0]['valid'])

    def test_changed_trace_cannot_show_pass_in_report_details(self):
        from proofstill.workflow import Harness
        from tests.support import make_plan, fake_codex
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            definition = make_plan(root)
            (root / 'tests/check.py').write_text(
                f'import sys; sys.path.insert(0, {str(PROJECT)!r})\n'
                'from pathlib import Path\nfrom proofstill.trace import Flow\n'
                'with Flow("evidence") as flow: flow.step("query", "조회", lambda: 1)\n'
                'assert "VALUE = 1" in Path("src/counter.py").read_text(), "EXPECTED_VALUE_ONE"\n'
                'print("CHECK_EXECUTED")\n')
            h = Harness(root, codex=fake_codex(root))
            h.init(definition); h.review('counter', 'criteria'); h.run('counter', 'red')
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            run = h.run('counter', 'green')[0]
            h.review('counter', 'implementation')
            Path(run['traces'][0]['path']).write_text('changed')
            report = h.report('counter').read_text()
            row = next(line for line in report.splitlines() if line.startswith('| R1:'))
            self.assertNotIn('자동 검사 통과', row)
            self.assertNotIn('- Green: 기대 결과 확인', report)
            self.assertNotIn('- 구현: 통과', report)
            self.assertIn('무효', report)
