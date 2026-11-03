import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from proofstill.contract import HarnessError, validate_plan
from proofstill.handoff import briefing, snapshot
from proofstill.workflow import Harness
from tests.support import make_plan, fake_codex


class CollaborationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.path = make_plan(self.root)
        self.plan = json.loads(self.path.read_text())
        self.plan['collaboration'] = {
            'human': '초기값 요구와 최종 수용을 결정한다.',
            'ai': '카운터 파일 수정과 검사, 인계를 맡는다. 배포는 제외한다.',
            'human_checks': [{'requirement': 'R1', 'action': 'src/counter.py를 열고 tests/check.py를 직접 실행한다.',
                              'expected': 'VALUE는 1이고 CHECK_EXECUTED 출력, 종료 코드 0이다.'}]
        }
        self.path.write_text(json.dumps(self.plan))
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.h.init(self.path)

    def finish(self):
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.implement('counter', 'R1', 'implemented', ['src/counter.py'])
        self.h.checkpoint('counter', '사람이 실행 출력과 원문을 확인하고 YES/NO로 판단', ['합성 카운터 예제'])
        self.h.run('counter')
        self.h.review('counter')

    def test_complete_evidence_is_distinct_from_human_acceptance(self):
        self.finish()
        status = self.h.status('counter')
        self.assertTrue(status['complete'])
        self.assertTrue(status['handoff_ready'])
        self.assertEqual(status['user_acceptance'], 'unconfirmed')
        text = briefing(self.h, 'counter')
        for part in ['최종 수용', '배포는 제외', '직접 실행', 'CHECK_EXECUTED', '사람이 실행 출력', '합성 카운터']:
            self.assertIn(part, text)

    def test_legacy_plan_runs_but_cannot_claim_handoff_ready(self):
        self.plan.pop('collaboration')
        self.plan['id'] = 'legacy'
        path = self.root / 'legacy.json'
        path.write_text(json.dumps(self.plan))
        self.h.init(path)
        status = self.h.status('legacy')
        self.assertFalse(status['handoff_ready'])
        self.assertTrue(any('담당 범위' in reason for reason in status['handoff_reasons']))
        self.assertTrue(any('재개 맥락' in reason for reason in status['handoff_reasons']))

    def test_contract_rejects_missing_scope_action_expected_and_requirement(self):
        for mutation in [lambda c: c.pop('ai'), lambda c: c['human_checks'][0].pop('action'),
                         lambda c: c['human_checks'][0].pop('expected'),
                         lambda c: c['human_checks'][0].update(requirement='unknown'),
                         lambda c: c.update(human_checks=[])]:
            plan = json.loads(self.path.read_text())
            mutation(plan['collaboration'])
            with self.assertRaises(HarnessError):
                validate_plan(self.root, plan)

    def test_pending_decision_survives_save_restart_and_blocks_actions(self):
        self.h.decision('counter', 'D1', '초기값을 1로 확정할까요?')
        self.h.checkpoint('counter', '답변을 확인한다', ['결정 전 구현은 보류'])
        self.h.report('counter')
        h = Harness(self.root, codex=self.h.codex)
        self.assertIn('사람 답변 대기', h.work('counter').joinpath('brief.md').read_text())
        self.assertEqual(h.load('counter')[1]['decisions']['D1']['answer'], '')
        for action in [lambda: h.run('counter'), lambda: h.review('counter', 'criteria'),
                       lambda: h.implement('counter', 'R1', 'implemented', ['src/counter.py'])]:
            with self.assertRaisesRegex(HarnessError, '사람 결정 대기'):
                action()
        with self.assertRaises(HarnessError):
            h.decision('counter', 'D1', '초기값?', '1')
        self.assertFalse(h.status('counter')['complete'])
        self.assertFalse(h.status('counter')['handoff_ready'])

    def test_actual_resolution_invalidates_old_results_and_reaches_review_packet(self):
        self.finish()
        self.h.decision('counter', 'D1', '초기값?', '1을 유지한다', '사용자 답변 메시지 U1 (합성 fixture)')
        status = self.h.status('counter')
        self.assertFalse(status['complete'])
        self.assertFalse(status['handoff_ready'])
        self.h.run('counter')
        self.h.review('counter')
        packet = json.loads((self.root / 'review_packet.json').read_text())['packet']
        self.assertEqual(packet['decisions']['D1']['source'], '사용자 답변 메시지 U1 (합성 fixture)')
        self.assertEqual(self.h.status('counter')['user_acceptance'], 'unconfirmed')

    def test_checkpoint_changes_are_compared_to_actual_files(self):
        self.finish()
        (self.root / 'src/counter.py').write_text('VALUE = 2\n')
        status = self.h.status('counter')
        self.assertFalse(status['handoff_ready'])
        self.assertTrue(any('재개 맥락 이후' in reason for reason in status['handoff_reasons']))
        self.h.checkpoint('counter', '변경한 값을 원래 요구와 대조')
        self.assertEqual(self.h.load('counter')[1]['checkpoint']['assumptions'], ['합성 카운터 예제'])
        self.assertFalse(self.h.status('counter')['handoff_ready'])  # A checkpoint never supplies test evidence.

    def test_declared_implementation_outside_sources_is_also_checked(self):
        other = self.root / 'other.py'
        other.write_text('VALUE = 1')
        self.h.implement('counter', 'R1', 'implemented', ['other.py'])
        self.assertTrue(snapshot(self.h, 'counter')[0]['implementationCurrent'])
        other.write_text('VALUE = 2')
        self.assertFalse(snapshot(self.h, 'counter')[0]['implementationCurrent'])

    def test_cli_checkpoint_decision_brief_and_handoff_use_persistent_state(self):
        def cli(*args):
            return subprocess.run([sys.executable, '-m', 'proofstill', '--root', str(self.root), *args],
                                  capture_output=True, text=True, check=True).stdout
        cli('checkpoint', 'counter', '--next', '파일과 실행 결과 대조', '--assumption', '배포 없음')
        cli('decision', 'counter', 'D1', '--question', '값 정책?')
        text = cli('brief', 'counter')
        self.assertIn('파일과 실행 결과 대조', text)
        self.assertIn('사람 결정 대기 D1', text)
        self.assertEqual(json.loads(cli('handoff', 'counter'))['rows'][0]['implementation']['status'], 'unknown')
        cli('decision', 'counter', 'D1', '--question', '값 정책?', '--answer', '1', '--source', 'fixture 답변')
        self.assertNotIn('사람 결정 대기 D1', cli('brief', 'counter'))

    def test_cli_cannot_cleanup_technically_passed_work_without_context(self):
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter')
        self.h.review('counter')
        self.assertTrue(self.h.status('counter')['complete'])
        self.h.report('counter')
        result = subprocess.run([sys.executable, '-m', 'proofstill', '--root', str(self.root), 'cleanup', 'counter'],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('인계 준비 미완료', result.stderr)
        self.assertTrue(self.h.work('counter').joinpath('brief.md').is_file())
        report = self.h.report('counter').read_text()
        self.assertIn('자동 검사·독립 리뷰: **검증 완료**', report)
        self.assertIn('인계 준비: 보완 필요', report)
        self.h.implement('counter', 'R1', 'implemented', ['src/counter.py'])
        self.h.checkpoint('counter', '사람이 원문과 실제 출력 확인')
        self.h.report('counter')
        self.h.cleanup('counter')
        self.assertFalse(self.h.work('counter').exists())
        self.assertEqual(self.h.status('counter')['user_acceptance'], 'unconfirmed')
