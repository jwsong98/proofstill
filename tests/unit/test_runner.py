import json
import tempfile
import unittest
from pathlib import Path
from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.plan = make_plan(self.root)
        self.h = Harness(self.root, codex=fake_codex(self.root))

    def start(self):
        self.h.init(self.plan)
        self.h.review('counter', 'criteria')

    def test_red_does_not_require_criteria_review(self):
        self.h.init(self.plan)
        self.assertTrue(self.h.run('counter', 'red')[0]['accepted'])

    def test_green_does_not_require_red_or_criteria_review(self):
        self.h.init(self.plan)
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.assertTrue(self.h.run('counter')[0]['accepted'])
        self.h.review('counter')
        self.assertTrue(self.h.status('counter')['complete'])

    def test_records_real_assertion_failure_and_passing_command(self):
        self.start()
        red = self.h.run('counter', 'red')
        self.assertTrue(red[0]['accepted'])
        self.assertNotEqual(red[0]['exit_code'], 0)
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        green = self.h.run('counter', 'green')
        self.assertTrue(green[0]['accepted'])
        self.assertEqual(green[0]['exit_code'], 0)
        self.assertEqual(green[0]['argv'], red[0]['argv'])

    def test_infrastructure_error_is_not_red(self):
        plan = json.loads(self.plan.read_text())
        plan['checks'][0]['argv'] = ['/not/a/real/executable']
        self.plan.write_text(json.dumps(plan))
        self.start()
        result = self.h.run('counter', 'red')
        self.assertFalse(result[0]['accepted'])
        self.assertIsNone(result[0]['exit_code'])

    def test_module_filter_does_not_run_other_modules(self):
        plan = json.loads(self.plan.read_text())
        extra = dict(plan['checks'][0], id='other-unit', module='other',
                     argv=['/must/not/execute'])
        plan['checks'].append(extra)
        plan['requirements'][0]['checks'].append('other-unit')
        self.plan.write_text(json.dumps(plan))
        self.start()
        results = self.h.run('counter', 'red', module='counter', kind='unit')
        self.assertEqual([r['check'] for r in results], ['counter-unit'])
        with self.assertRaises(HarnessError):
            self.h.run('counter', 'red', module='absent')

    def test_wrong_failure_or_zero_exit_is_not_red(self):
        for program in ['raise AssertionError("WRONG_REASON")', 'print("CHECK_EXECUTED")']:
            with self.subTest(program=program):
                with tempfile.TemporaryDirectory() as temp:
                    root = Path(temp)
                    plan = make_plan(root)
                    (root / 'tests/check.py').write_text(program)
                    h = Harness(root, codex=fake_codex(root))
                    h.init(plan)
                    h.review('counter', 'criteria')
                    self.assertFalse(h.run('counter', 'red')[0]['accepted'])

    def test_timeout_through_run_is_not_red(self):
        plan = json.loads(self.plan.read_text())
        plan['checks'][0]['timeout'] = 0.05
        self.plan.write_text(json.dumps(plan))
        (self.root / 'tests/check.py').write_text('import time\nprint("AssertionError: EXPECTED_VALUE_ONE", flush=True)\ntime.sleep(2)')
        self.start()
        result = self.h.run('counter', 'red')[0]
        self.assertTrue(result['timed_out'])
        self.assertFalse(result['accepted'])

    def test_green_requires_success_and_execution_marker(self):
        self.start()
        self.h.run('counter', 'red')
        # The same test code fails after implementation until a correct output exists.
        (self.root / 'src/counter.py').write_text('VALUE = 999\n')
        self.assertFalse(self.h.run('counter', 'green')[0]['accepted'])

    def test_missing_green_marker_is_not_pass(self):
        (self.root / 'tests/check.py').write_text(
            'import runpy\nassert runpy.run_path("src/counter.py")["VALUE"] == 1, "EXPECTED_VALUE_ONE"\n')
        self.start()
        self.h.run('counter', 'red')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.assertFalse(self.h.run('counter', 'green')[0]['accepted'])

    def test_next_module_red_after_previous_module_green(self):
        (self.root / 'src/storage.py').write_text('STORED = False\n')
        (self.root / 'tests/storage.py').write_text(
            'import runpy\nassert runpy.run_path("src/storage.py")["STORED"], "EXPECTED_STORAGE"\nprint("STORAGE_EXECUTED")\n')
        plan = json.loads(self.plan.read_text())
        plan['sources'].append('src/storage.py')
        plan['checks'].append(dict(plan['checks'][0], id='storage-integration', kind='integration', module='storage',
                                   argv=['python3', 'tests/storage.py'], files=['tests/storage.py'],
                                   red_pattern='AssertionError: EXPECTED_STORAGE', green_pattern='STORAGE_EXECUTED'))
        plan['requirements'].append({'id': 'R2', 'text': 'storage is written', 'checks': ['storage-integration']})
        plan['collaboration']['human_checks'].append({'requirement': 'R2', 'action': 'tests/storage.py를 실행한다.', 'expected': 'STORAGE_EXECUTED 출력과 종료 코드 0.'})
        self.plan.write_text(json.dumps(plan))
        self.start()
        self.assertTrue(self.h.run('counter', 'red', module='counter')[0]['accepted'])
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.assertTrue(self.h.run('counter', 'green', module='counter')[0]['accepted'])
        self.assertTrue(self.h.run('counter', 'red', module='storage')[0]['accepted'])
        (self.root / 'src/storage.py').write_text('STORED = True\n')
        self.assertTrue(self.h.run('counter', 'green', module='storage')[0]['accepted'])
        with self.assertRaises(HarnessError):
            self.h.review('counter', 'implementation')
        self.h.run('counter', 'green', module='counter')
        self.h.review('counter', 'implementation')

    def test_interrupted_rerun_cannot_leave_old_green_complete(self):
        from unittest.mock import patch
        self.start()
        self.h.run('counter', 'red')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter', 'green')
        self.h.review('counter', 'implementation')
        with patch.object(self.h, 'execute', side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.h.run('counter', 'green')
        self.assertFalse(self.h.status('counter')['complete'])
