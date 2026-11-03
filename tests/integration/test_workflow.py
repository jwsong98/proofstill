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
            report = Path(call('report', 'counter').strip())
            call('cleanup', 'counter')
            self.assertIn('검증 완료', report.read_text())
