import json
import tempfile
import unittest
from pathlib import Path
from proofstill.contract import HarnessError, validate_plan
from proofstill.workflow import Harness
from proofstill.handoff import snapshot
from tests.support import make_plan, fake_codex


class AssuranceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.path = make_plan(self.root)
        self.h = Harness(self.root, codex=fake_codex(self.root))

    def init(self, **changes):
        plan = json.loads(self.path.read_text())
        plan.update(changes)
        self.path.write_text(json.dumps(plan))
        self.h.init(self.path)

    def test_missing_and_stale_criteria_review_are_not_approval(self):
        self.init(required_reviews=['criteria'])
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter')
        self.h.review('counter')
        self.assertFalse(self.h.status('counter')['complete'])
        self.assertEqual(snapshot(self.h, 'counter')[0]['verification']['criteriaReview']['status'], 'not_run')
        self.h.review('counter', 'criteria')
        self.assertTrue(self.h.status('counter')['complete'])
        self.assertEqual(snapshot(self.h, 'counter')[0]['verification']['criteriaReview']['status'], 'passed')
        (self.root / 'tests/check.py').write_text('print("CHECK_EXECUTED")')
        self.assertEqual(snapshot(self.h, 'counter')[0]['verification']['criteriaReview']['status'], 'stale')
        self.assertFalse(self.h.status('counter')['complete'])

    def test_failed_criteria_findings_remain_visible_after_successful_recheck(self):
        self.init()
        behavior = self.root / 'review_behavior.json'
        behavior.write_text(json.dumps({'verdict': 'fail', 'findings': ['잘못된 기준 수정 필요 (synthetic fixture)']}))
        with self.assertRaises(HarnessError):
            self.h.review('counter', 'criteria')
        behavior.unlink()
        self.h.review('counter', 'criteria')
        summary = snapshot(self.h, 'counter')[0]['verification']['criteriaReview']
        self.assertEqual(summary['status'], 'passed')
        self.assertEqual(summary['history'][0]['verdict'], 'fail')
        self.assertEqual(summary['history'][0]['findings'], ['잘못된 기준 수정 필요 (synthetic fixture)'])
        self.assertIn('이전 판정', summary['history'][0]['label'])

    def test_wrong_mapping_and_ungrounded_case_are_rejected(self):
        original = json.loads(self.path.read_text())
        plan = json.loads(self.path.read_text())
        plan['requirements'][0]['criteria_checks'] = ['unknown']
        with self.assertRaises(HarnessError):
            validate_plan(self.root, plan)
        plan = original
        plan['checks'][0]['cases'] = [{'operation': 'counter', 'situation': '초기 조회', 'expected': '1'}]
        with self.assertRaisesRegex(HarnessError, '흐름 검증 기준'):
            validate_plan(self.root, plan)

    def test_case_observation_requires_current_real_trace_and_output_assertion(self):
        from proofstill.assurance import observations
        from proofstill.trace import Flow
        from proofstill.contract import file_hash
        self.init()
        expected = {'operations': ['counter'], 'assertions': [{'step': 0, 'field': 'output', 'path': '/value', 'equals': 1}]}
        (self.root / 'expected.json').write_text(json.dumps(expected))
        path = self.h.folder('counter') / 'observed.jsonl'
        def read_value():
            value = 1
            return {'value': value, 'summary': f'조회 결과 {value}개'}
        with Flow('대표 조회', path=path) as flow:
            flow.step('counter', '초기값 조회', read_value)
        check = {'trace_expectation': 'expected.json', 'cases': [{'operation': 'counter', 'situation': '초기 조회', 'expected': '1'}]}
        run = {'accepted': True, 'recorded_at': 'fixture', 'traces': [{'path': str(path), 'sha256': file_hash(path)}]}
        self.assertEqual(observations(self.h, 'counter', check, run, True)[0]['observed'], '조회 결과 1개')
        self.assertEqual(observations(self.h, 'counter', check, run, False)[0]['status'], 'stale')
        path.write_text('상수 성공 출력만 남김')
        self.assertEqual(observations(self.h, 'counter', check, run, True)[0]['status'], 'unverified')

    def test_review_evidence_change_does_not_preserve_criteria_approval(self):
        self.init()
        self.h.review('counter', 'criteria')
        _, state = self.h.load('counter')
        folder = Path(state['reviews']['criteria']['folder'])
        (folder / 'answer.json').write_text('{"verdict":"pass"}')
        self.assertEqual(snapshot(self.h, 'counter')[0]['verification']['criteriaReview']['status'], 'stale')

    def test_requirement_explanation_is_projected_and_invalid_text_rejected(self):
        plan = json.loads(self.path.read_text())
        plan['requirements'][0].update(risk='값이 유실되면 잘못된 판단을 해요.', rationale='다시 조회한 실제 값을 비교해야 해요.')
        self.path.write_text(json.dumps(plan))
        self.h.init(self.path)
        row = snapshot(self.h, 'counter')[0]
        self.assertEqual(row['risk'], '값이 유실되면 잘못된 판단을 해요.')
        self.assertEqual(row['rationale'], '다시 조회한 실제 값을 비교해야 해요.')
        plan['requirements'][0]['risk'] = 42
        with self.assertRaises(HarnessError):
            validate_plan(self.root, plan)
