import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from tests.support import make_plan, fake_codex

PROJECT = Path(__file__).resolve().parents[2]


class WorkflowTests(unittest.TestCase):
    def test_cli_red_green_review_report_cleanup(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            plan = make_plan(root)
            codex = fake_codex(root)
            def call(*args):
                result = subprocess.run(
                    [sys.executable, '-m', 'proofstill', '--root', str(root), '--codex', codex, *args],
                    cwd=PROJECT, capture_output=True, text=True,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                return result.stdout
            call('init', str(plan))
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            call('test', 'counter', '--kind', 'unit', '--module', 'counter')
            call('review', 'counter')
            call('implement', 'counter', 'R1', '--status', 'implemented', '--path', 'src/counter.py')
            call('checkpoint', 'counter', '--next', '사용자가 출력과 원문 대조')
            report = Path(call('report', 'counter').strip())
            call('cleanup', 'counter')
            self.assertIn('검증 완료', report.read_text())

    def test_cli_review_reuses_current_verdict_and_passes_green_receipt(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            plan = make_plan(root)
            codex = fake_codex(root)

            def call(*args):
                return subprocess.run(
                    [sys.executable, '-m', 'proofstill', '--root', str(root), '--codex', codex, *args],
                    cwd=PROJECT, capture_output=True, text=True, check=True,
                ).stdout

            call('init', str(plan))
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            green, = json.loads(call('test', 'counter'))
            first = json.loads(call('review', 'counter'))
            packet = json.loads((root / 'review_packet.json').read_text())['packet']
            self.assertEqual(packet['current_green'][0]['receipt'], green['receipt'])
            second = json.loads(call('review', 'counter'))
            self.assertTrue(second['reused'])
            self.assertEqual(second['session'], first['session'])
            fresh = json.loads(call('review', 'counter', '--force'))
            self.assertNotEqual(fresh['session'], first['session'])

            call('test', 'counter', '--force')
            row, = json.loads(call('handoff', 'counter'))['rows']
            self.assertEqual(row['verification']['review']['gateStatus'], 'stale')
            after_new_evidence = json.loads(call('review', 'counter'))
            self.assertNotEqual(after_new_evidence['session'], fresh['session'])

            (root / 'tests/check.py').write_text((root / 'tests/check.py').read_text() + '# changed check\n')
            call('test', 'counter')
            after_edit = json.loads(call('review', 'counter'))
            self.assertNotIn('reused', after_edit)
            self.assertNotEqual(after_edit['session'], after_new_evidence['session'])
