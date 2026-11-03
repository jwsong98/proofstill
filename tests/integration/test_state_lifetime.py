import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from examples.order_workspace.demo import run_workspace
from examples.order_workspace.workspace import Workspace
from proofstill.trace import Flow
from proofstill.trace_check import verify_trace

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / 'examples/order_workspace/expected.json').read_text())


class StateLifetimeTests(unittest.TestCase):
    def database(self):
        connection = sqlite3.connect(':memory:')
        self.addCleanup(connection.close)
        connection.execute('CREATE TABLE orders (id INTEGER PRIMARY KEY, amount INTEGER, status TEXT)')
        connection.executemany('INSERT INTO orders VALUES (?, ?, ?)', [(1, 10, 'open'), (2, 20, 'open'), (3, 100, 'closed')])
        connection.commit()
        return connection

    def test_sqlite_save_requery_and_actual_state_trace_follow_frozen_contract(self):
        connection = self.database()
        statements = []
        connection.set_trace_callback(statements.append)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'states.jsonl'
            result = run_workspace(connection, path)
            connection.set_trace_callback(None)
            trace = verify_trace(path, EXPECTED)
            self.assertTrue(trace['valid'], trace['issues'])
            self.assertEqual(len(trace['steps']), 16)
            self.assertEqual(result['final'], {'feature': 'home', 'screen': 'home', 'data': {}})
            self.assertEqual(connection.execute('SELECT id, amount FROM orders ORDER BY id').fetchall(), [(1, 35), (2, 20), (3, 100)])
            queries = [s for s in statements if s.startswith('SELECT') or s.startswith('UPDATE')]
            self.assertIn("status='open'", queries[0])
            self.assertIn('OFFSET 1', queries[0])
            self.assertEqual(sum(s.startswith('UPDATE') for s in queries), 1)
            self.assertRegex(next(s for s in queries if s.startswith('UPDATE')), r'WHERE\s+id\s*=\s*1\b')
            detail_queries = [s for s in queries if s.startswith('SELECT') and 'status=' not in s]
            self.assertEqual(len(detail_queries), 4)
            for statement, identifier in zip(detail_queries, [1, 1, 2, 1]):
                self.assertRegex(statement, rf'WHERE\s+id\s*=\s*{identifier}\b')
            self.assertGreaterEqual(sum("status='open'" in s and 'OFFSET 1' in s for s in queries), 2)
            self.assertEqual(trace['steps'][13]['state']['delta']['changed'], [])
            self.assertEqual(trace['steps'][15]['state']['after']['data'], {})

    def test_wrong_implementations_leaking_draft_or_losing_query_fail_same_contract(self):
        class Leak(Workspace):
            def back_to_list(self):
                super().back_to_list()
                self._state['data']['draft'] = {'amount': 999}
        class LoseQuery(Workspace):
            def back_to_list(self):
                super().back_to_list()
                self._state['data']['query'] = ''
        for broken in [Leak, LoseQuery]:
            with self.subTest(broken=broken.__name__), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / 'states.jsonl'
                run_workspace(self.database(), path, workspace_type=broken)
                self.assertFalse(verify_trace(path, EXPECTED)['valid'])

    def test_save_failure_and_explicit_cancel_are_traced_without_losing_draft(self):
        from examples.order_workspace.store import OrderStore
        class Offline(OrderStore):
            def save(self, identifier, amount):
                raise OSError('SAVE_OFFLINE')
        connection = self.database()
        app = Workspace(Offline(connection))
        app.search('open', 1)
        ticket = app.begin_detail(1); app.accept_detail(ticket, app.store.get(1))
        app.begin_edit(); app.change_amount(77)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'failure.jsonl'
            with Flow('保存失败', path=path) as flow:
                with self.assertRaises(OSError):
                    flow.transition('save', '저장 실패 시 초안 유지', app.save, state=app.snapshot)
                flow.transition('cancel', '명시 취소 시 초안 제거', app.cancel_edit, state=app.snapshot)
            expected = {'status': 'failed', 'state': {'screens': EXPECTED['state']['screens'], 'transitions': [
                {'step': 0, 'from': 'orders.edit', 'to': 'orders.edit', 'preserve': ['draft', 'query', 'page', 'selected_id']},
                {'step': 1, 'from': 'orders.edit', 'to': 'orders.detail', 'drop': ['draft', 'error'], 'preserve': ['query', 'page', 'selected_id']}
            ]}}
            checked = verify_trace(path, expected)
            self.assertTrue(checked['valid'], checked['issues'])
            self.assertEqual(checked['steps'][0]['state']['after']['data']['draft'], {'amount': 77})
            self.assertEqual(app.snapshot()['data']['detail']['amount'], 10)
            self.assertEqual(connection.execute('SELECT amount FROM orders WHERE id=1').fetchone()[0], 10)

    def test_harness_rejects_green_command_when_frozen_state_contract_fails(self):
        from proofstill.workflow import Harness
        from tests.support import make_plan, fake_codex
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            definition = make_plan(root)
            plan = json.loads(definition.read_text())
            plan['checks'][0]['trace_expectation'] = 'tests/state.json'
            definition.write_text(json.dumps(plan))
            (root / 'tests/state.json').write_text(json.dumps({'state': {
                'screens': {'home': {'feature': 'home', 'required': []}},
                'transitions': [{'step': 0, 'from': 'home', 'to': 'home'}]}}))
            (root / 'tests/check.py').write_text(
                f'import sys; sys.path.insert(0, {str(ROOT)!r})\n'
                'from pathlib import Path\nfrom proofstill.trace import Flow\n'
                'state={"feature":"home","screen":"home","data":{}}\n'
                'def action():\n'
                '    if Path("leak").exists(): state["data"]["draft"]={"amount":99}\n'
                'with Flow("state-gate") as flow:\n'
                '    flow.transition("leave", "기능 종료", action, state=lambda: state)\n'
                'assert "VALUE = 1" in Path("src/counter.py").read_text(), "EXPECTED_VALUE_ONE"\n'
                'print("CHECK_EXECUTED")\n')
            harness = Harness(root, codex=fake_codex(root))
            harness.init(definition); harness.review('counter', 'criteria')
            self.assertTrue(harness.run('counter', 'red')[0]['accepted'])
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            self.assertTrue(harness.run('counter', 'green')[0]['accepted'])
            (root / 'leak').touch()
            run = harness.run('counter', 'green')[0]
            self.assertEqual(run['exit_code'], 0)
            self.assertFalse(run['accepted'])
            self.assertFalse(run['traces'][0]['valid'])
