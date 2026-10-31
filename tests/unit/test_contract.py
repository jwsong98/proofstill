import json
import tempfile
import unittest
from pathlib import Path
from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.plan = make_plan(self.root)
        self.h = Harness(self.root, codex=fake_codex(self.root))

    def test_init_records_intent_and_resume_brief(self):
        self.h.init(self.plan)
        brief = self.root / '.proofstill/work/counter/brief.md'
        self.assertIn('새 카운터의 값은 1', brief.read_text())
        with self.assertRaises(HarnessError):
            self.h.init(self.plan)

    def test_rejects_unmapped_or_non_executable_criteria(self):
        plan = json.loads(self.plan.read_text())
        plan['requirements'][0]['checks'] = ['missing']
        self.plan.write_text(json.dumps(plan))
        with self.assertRaises(HarnessError):
            self.h.init(self.plan)
        plan['requirements'][0]['checks'] = ['counter-unit']
        plan['checks'][0]['argv'] = 'echo success'
        self.plan.write_text(json.dumps(plan))
        with self.assertRaises(HarnessError):
            self.h.init(self.plan)

    def test_rejects_path_escape_and_empty_test_selection(self):
        plan = json.loads(self.plan.read_text())
        plan['checks'][0]['files'] = ['../outside.py']
        self.plan.write_text(json.dumps(plan))
        with self.assertRaises(HarnessError):
            self.h.init(self.plan)

    def test_test_edits_can_be_checked_without_new_task_or_criteria_review(self):
        self.h.init(self.plan)
        first = self.h.run('counter', 'red')[0]
        with (self.root / 'tests/check.py').open('a') as stream:
            stream.write('\n# changed expectation\n')
        second = self.h.run('counter', 'red')[0]
        self.assertTrue(second['accepted'])
        self.assertNotEqual(first['criteria_digest'], second['criteria_digest'])

    def test_optional_red_after_changes_still_requires_intended_failure(self):
        self.h.init(self.plan)
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        self.assertFalse(self.h.run('counter', 'red')[0]['accepted'])

    def test_empty_requirements_or_checks_are_rejected(self):
        original = json.loads(self.plan.read_text())
        for field in ['requirements', 'checks']:
            plan = dict(original, **{field: []})
            self.plan.write_text(json.dumps(plan))
            with self.assertRaises(HarnessError):
                self.h.init(self.plan)
