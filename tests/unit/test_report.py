import json
import re
import tempfile
import unittest
from pathlib import Path
from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.plan = make_plan(self.root)
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.h.init(self.plan)

    def finish(self):
        self.h.review('counter', 'criteria')
        self.h.run('counter', 'red')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter', 'green')
        self.h.review('counter', 'implementation')

    def test_init_and_report_do_not_keep_initial_source_copy(self):
        self.assertEqual({p.name for p in self.h.folder('counter').iterdir()},
                         {'plan.json', 'state.json'}, 'INITIAL_COPY_CREATED')
        self.assertNotIn('baseline/manifest.json', self.h.report('counter').read_text())

    def test_report_cannot_claim_complete_without_review(self):
        report = self.h.report('counter')
        self.assertIn('미완료', report.read_text())
        with self.assertRaises(HarnessError):
            self.h.cleanup('counter')

    def test_completed_report_links_survive_work_cleanup(self):
        self.finish()
        report = self.h.report('counter')
        self.assertIn('검증 완료', report.read_text())
        self.assertIn('counter-unit', report.read_text())
        self.assertIn('사용자 수용: 미확인', report.read_text())
        self.h.cleanup('counter')
        self.assertFalse((self.root / '.proofstill/work/counter').exists())
        for target in re.findall(r'\]\(([^)]+)\)', report.read_text()):
            if '://' not in target:
                self.assertTrue(Path(target.split('#')[0]).is_file(), target)

    def test_source_edits_make_old_green_and_verdict_stale(self):
        self.finish()
        (self.root / 'src/counter.py').write_text('VALUE = 999\n')
        self.assertIn('미완료', self.h.report('counter').read_text())
        with self.assertRaises(HarnessError):
            self.h.cleanup('counter')

    def test_fabricated_review_cannot_be_imported_as_session(self):
        (self.root / 'review_behavior.json').write_text('{"no_thread": true}')
        with self.assertRaises(HarnessError):
            self.h.review('counter', 'criteria')

    def test_rejects_incomplete_or_invalid_reviews(self):
        for settings in [
            {'missing': True}, {'duplicate': True}, {'unknown': True},
            {'empty_evidence': True}, {'unverified': True},
            {'invalid_json': True}, {'process_fail': True},
            {'verdict': 'fail'},
        ]:
            with self.subTest(settings=settings):
                (self.root / 'review_behavior.json').write_text(json.dumps(settings))
                with self.assertRaises(HarnessError):
                    self.h.review('counter', 'criteria')
                self.assertIn('미완료', self.h.report('counter').read_text())

    def test_review_packet_and_new_session_arguments(self):
        self.h.review('counter', 'criteria')
        capture = json.loads((self.root / 'review_packet.json').read_text())
        argv = capture['argv']
        self.assertIn('exec', argv)
        self.assertIn('--ephemeral', argv)
        self.assertEqual(argv[argv.index('--sandbox') + 1], 'workspace-write')
        self.assertNotIn('resume', argv)
        self.assertNotIn('fork', argv)
        self.assertEqual(capture['packet']['plan']['intent'], '새 카운터의 값은 1이다.')
        self.assertEqual(capture['packet']['plan']['context'], '로컬 파일 기반 동작을 확인하는 합성 테스트 과제.')
        self.assertEqual(capture['packet']['plan']['checks'][0]['files'], ['tests/check.py'])
        self.assertIn('manifest', capture['packet'])
        self.assertNotIn('snapshot', capture['packet'])
        self.assertFalse((Path(capture['packet']['manifest']).parent / 'snapshot').exists())
        self.assertIn('criteria_digest', capture['packet'])
        self.assertNotIn('developer_conversation', capture['packet'])

    def test_review_session_cannot_be_reused(self):
        (self.root / 'review_behavior.json').write_text('{"thread_id": "fixed-review-session"}')
        self.h.review('counter', 'criteria')
        self.h.run('counter', 'red')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('counter', 'green')
        with self.assertRaises(HarnessError):
            self.h.review('counter', 'implementation')

    def test_report_has_evidence_and_cleanup_keeps_other_work(self):
        self.finish()
        other = self.root / '.proofstill/work/unrelated/brief.md'
        other.parent.mkdir(parents=True)
        other.write_text('still working')
        report = self.h.report('counter')
        content = report.read_text()
        targets = re.findall(r'\]\(([^)]+)\)', content)
        self.assertGreaterEqual(len(targets), 6)
        for word in ['새 카운터의 값은 1', 'R1', 'Red', 'Green', '종료', '한계', '소스', '기준', '리뷰', 'MOCK_REVIEW']:
            self.assertIn(word, content)
        self.h.cleanup('counter')
        self.assertEqual(other.read_text(), 'still working')
        self.assertTrue(report.exists())

    def test_test_or_command_change_invalidates_final_result(self):
        self.finish()
        plan = json.loads(self.plan.read_text())
        plan['checks'][0]['argv'].append('--changed')
        self.plan.write_text(json.dumps(plan))
        self.assertIn('미완료', self.h.report('counter').read_text())

    def test_all_checks_must_be_green_for_same_source(self):
        self.plan.unlink()
        plan_path = self.root / 'another.json'
        plan = json.loads((self.root / '.proofstill/evidence/counter/plan.json').read_text())
        plan['id'] = 'another'
        extra = dict(plan['checks'][0], id='counter-integration', kind='integration')
        plan['checks'].append(extra)
        plan['requirements'][0]['checks'].append('counter-integration')
        plan_path.write_text(json.dumps(plan))
        self.h.init(plan_path)
        self.h.review('another', 'criteria')
        self.h.run('another', 'red')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.h.run('another', 'green', kind='unit')
        with self.assertRaises(HarnessError):
            self.h.review('another', 'implementation')
        (self.root / 'src/counter.py').write_text('VALUE = 1\n# source revision two\n')
        self.h.run('another', 'green', kind='integration')
        with self.assertRaises(HarnessError):
            self.h.review('another', 'implementation')
        self.h.run('another', 'green', kind='unit')
        self.h.review('another', 'implementation')
        self.assertIn('검증 완료', self.h.report('another').read_text())

    def test_developer_session_cannot_review_itself(self):
        self.h = Harness(self.root, codex=str(self.root / 'fake_codex.py'), developer_session='developer-session')
        other_plan = json.loads(self.plan.read_text())
        other_plan['id'] = 'separate'
        self.plan.write_text(json.dumps(other_plan))
        self.h.init(self.plan)
        (self.root / 'review_behavior.json').write_text('{"thread_id": "developer-session"}')
        with self.assertRaises(HarnessError):
            self.h.review('separate', 'criteria')

    def test_context_file_is_available_to_review_and_changes_invalidate(self):
        context = self.root / 'business.txt'
        context.write_text('원래 업무 조건: 값은 1')
        plan = json.loads(self.plan.read_text())
        plan.update(id='contextual', context_files=['business.txt'])
        self.plan.write_text(json.dumps(plan))
        self.h.init(self.plan)
        self.h.review('contextual', 'criteria')
        capture = json.loads((self.root / 'review_packet.json').read_text())
        self.assertIn('business.txt', capture['packet']['plan']['context_files'])
        context.write_text('changed requirement')
        self.h.run('contextual', 'red')
        self.assertNotIn('- 사전 기준 검토 · 선택: 통과', self.h.report('contextual').read_text())

    def test_test_change_after_red_and_after_final_review_is_rejected(self):
        self.finish()
        with (self.root / 'tests/check.py').open('a') as stream:
            stream.write('\n# mutated oracle\n')
        self.h.run('counter', 'green')
        self.assertIn('미완료', self.h.report('counter').read_text())
        with self.assertRaises(HarnessError):
            self.h.cleanup('counter')

    def test_stale_criteria_never_show_current_pass_in_report(self):
        self.finish()
        with (self.root / 'tests/check.py').open('a') as stream:
            stream.write('assert False, "NEW_REQUIRED_CHECK"\n')
        content = self.h.report('counter').read_text()
        row = next(line for line in content.splitlines() if line.startswith('| R1:'))
        self.assertNotIn('자동 검사 통과', row)
        self.assertIn('무효', content)
        self.assertNotIn('- 사전 기준 검토 · 선택: 통과', content)
        self.assertNotIn('- 기준·구현 최종 검토: 통과', content)

    def test_reviewer_uses_original_and_detects_source_test_or_context_mutation(self):
        plan = json.loads(self.plan.read_text())
        plan.update(id='isolation', context_files=['business.txt'])
        (self.root / 'business.txt').write_text('original business context')
        definition = self.root / 'isolation.json'
        definition.write_text(json.dumps(plan))
        self.h.init(definition)
        self.h.review('isolation', 'criteria')
        capture = json.loads((self.root / 'review_packet.json').read_text())
        workspace = Path(capture['packet']['project_root'])
        self.assertEqual(workspace.resolve(), self.root.resolve())
        self.assertEqual(Path(capture['cwd']).resolve(), workspace.resolve())
        argv = capture['argv']
        self.assertEqual(Path(argv[argv.index('--cd') + 1]).resolve(), workspace.resolve())
        self.assertEqual(argv[argv.index('--sandbox') + 1], 'workspace-write')
        for relative in ['tests/check.py', 'src/counter.py', 'business.txt']:
            self.assertEqual((workspace / relative).read_text(), (self.root / relative).read_text())
            original = (self.root / relative).read_text()
            (self.root / 'review_behavior.json').write_text(json.dumps({'mutate_snapshot': True, 'mutate_path': relative}))
            with self.subTest(relative=relative):
                with self.assertRaises(HarnessError):
                    self.h.review('isolation', 'criteria')
                self.assertNotEqual((self.root / relative).read_text(), original)
                self.assertFalse(self.h.load('isolation')[1]['reviews']['criteria']['passed'])
                (self.root / relative).write_text(original)

    def test_direct_review_uses_executable_test_commands(self):
        script = self.root / 'tests/check.sh'
        script.write_text('#!/bin/sh\nprintf "CHECK_EXECUTED\\n"\n')
        script.chmod(0o755)
        plan = json.loads(self.plan.read_text())
        plan['id'] = 'executable'
        plan['checks'][0].update(argv=['./tests/check.sh'], files=['tests/check.sh'])
        definition = self.root / 'executable.json'
        definition.write_text(json.dumps(plan))
        self.h.init(definition)
        self.h.review('executable', 'criteria')
        capture = json.loads((self.root / 'review_packet.json').read_text())
        workspace = Path(capture['packet']['project_root'])
        original = self.h.execute(['./tests/check.sh'], 5)
        copied = self.h.execute(['./tests/check.sh'], 5, cwd=workspace)
        self.assertEqual(original['exit_code'], 0)
        self.assertEqual(copied['exit_code'], 0, copied['stderr'])
        self.assertEqual((workspace / 'tests/check.sh').stat().st_mode & 0o777, script.stat().st_mode & 0o777)

    def test_direct_review_sees_declared_empty_source_directories(self):
        (self.root / 'src/empty').mkdir()
        plan = json.loads(self.plan.read_text())
        plan.update(id='empty-directory', sources=['src/counter.py', 'src/empty'])
        definition = self.root / 'empty-directory.json'
        definition.write_text(json.dumps(plan))
        self.h.init(definition)
        self.h.review('empty-directory', 'criteria')
        capture = json.loads((self.root / 'review_packet.json').read_text())
        self.assertTrue((Path(capture['packet']['project_root']) / 'src/empty').is_dir())
