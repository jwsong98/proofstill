import json
import tempfile
import unittest
from pathlib import Path
from proofstill.handoff import snapshot
from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.plan = make_plan(self.root)
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.h.init(self.plan)

    def row(self):
        return snapshot(self.h, 'counter')[0]

    def test_implementation_is_not_inferred_from_test_success(self):
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter')
        self.assertEqual(self.row()['implementation']['status'], 'unknown')
        self.assertEqual(self.row()['verification']['status'], 'passed')
        self.assertEqual(self.row()['verification']['review']['status'], 'not_run')

    def test_implemented_but_not_tested_and_partial_remaining_are_persistent(self):
        self.h.implement('counter', 'R1', 'implemented', ['src/counter.py'])
        self.assertEqual(self.row()['implementation']['status'], 'implemented')
        self.assertEqual(self.row()['verification']['status'], 'not_run')
        self.h.implement('counter', 'R1', 'partial', ['src/counter.py'], '저장 경계 미구현')
        self.assertEqual(snapshot(Harness(self.root), 'counter')[0]['implementation']['remaining'], '저장 경계 미구현')
        with self.assertRaises(HarnessError):
            self.h.implement('counter', 'R1', 'implemented', [])
        with self.assertRaises(HarnessError):
            self.h.implement('counter', 'R1', 'partial', [], '')
        with self.assertRaises(HarnessError):
            self.h.implement('counter', 'R1', 'implemented', ['../outside'])

    def test_failed_missing_stale_and_review_are_separate(self):
        self.assertEqual(self.row()['verification']['status'], 'not_run')
        self.h.run('counter')
        self.assertEqual(self.row()['verification']['status'], 'failed')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.assertEqual(self.row()['verification']['status'], 'stale')
        self.h.run('counter')
        self.h.review('counter')
        self.assertEqual(self.row()['verification']['review']['status'], 'passed')
        (self.root / 'src/counter.py').write_text('VALUE = 2\n')
        self.assertEqual(self.row()['verification']['status'], 'stale')
        self.assertEqual(self.row()['verification']['review']['status'], 'stale')

    def test_partial_check_coverage_and_test_change(self):
        plan = json.loads(self.plan.read_text())
        plan['id'] = 'two-checks'
        plan['checks'].append(dict(plan['checks'][0], id='integration', kind='integration'))
        plan['requirements'][0]['checks'].append('integration')
        other = self.root / 'other.json'; other.write_text(json.dumps(plan))
        self.h.init(other)
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('two-checks', kind='unit')
        row = snapshot(self.h, 'two-checks')[0]
        self.assertEqual(row['verification']['status'], 'partial')
        self.assertIn('CHECK_EXECUTED', row['verification']['checks'][0]['output'])
        (self.root / 'tests/check.py').write_text('print("CHANGED")')
        self.assertEqual(snapshot(self.h, 'two-checks')[0]['verification']['status'], 'stale')

    def test_timeout_is_interrupted_not_failed_or_unknown(self):
        from proofstill.workflow import save_json
        self.h.run('counter')
        plan, state = self.h.load('counter')
        state['runs'][-1].update(timed_out=True, exit_code=None, accepted=False)
        save_json(self.h.folder('counter') / 'state.json', state)
        self.assertEqual(self.row()['verification']['status'], 'interrupted')

    def test_long_output_is_marked_and_missing_evidence_invalidates_pass(self):
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter')
        _, state = self.h.load('counter')
        log = Path(state['runs'][-1]['log'])
        log.write_text('X' * 100001)
        check = self.row()['verification']['checks'][0]
        self.assertTrue(check['outputTruncated'])
        self.assertIn('출력 생략', check['output'])
        log.unlink()
        self.assertEqual(self.row()['verification']['status'], 'stale')
        self.assertFalse(self.h.status('counter')['complete'])
        self.assertIn('근거를 찾을 수 없습니다', self.row()['verification']['checks'][0]['output'])

    def test_report_uses_same_overview(self):
        self.h.implement('counter', 'R1', 'partial', ['src/counter.py'], '조회 기능')
        report = self.h.report('counter').read_text()
        self.assertIn('| R1: 초기값은 1 | 일부 구현 | 미실행 | 미실행 | 조회 기능 |', report)
        self.assertLess(report.index('구현·검증 현황'), report.index('기준 버전'))
