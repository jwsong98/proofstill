import json
import sys
import tempfile
import unittest
from pathlib import Path
from proofstill.workflow import Harness, HarnessError
from proofstill.handoff import snapshot
from tests.support import make_plan, fake_codex


class RevisionTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.path = make_plan(self.root)
        self.plan = json.loads(self.path.read_text())
        (self.root / 'src/counter.py').write_text('VALUE = 1\n')
        (self.root / 'src/other.py').write_text('VALUE = 2\n')
        (self.root / 'tests/other.py').write_text('import runpy; assert runpy.run_path("src/other.py")["VALUE"] == 2; print("OTHER_OK")')
        self.plan['sources'].append('src/other.py')
        self.plan['checks'][0]['sources'] = ['src/counter.py']
        self.plan['checks'].append({'id': 'other', 'kind': 'unit', 'module': 'other',
            'argv': [sys.executable, 'tests/other.py'], 'files': ['tests/other.py'],
            'sources': ['src/other.py'], 'green_pattern': 'OTHER_OK'})
        self.plan['requirements'].append({'id': 'R2', 'text': 'other is two', 'checks': ['other']})
        self.plan['collaboration']['human_checks'].append({'requirement': 'R2', 'action': 'read other', 'expected': 'two'})
        self.path.write_text(json.dumps(self.plan))
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.h.init(self.path)
        self.h.run('counter')
        self.h.implement('counter', 'R1', 'implemented', ['src/counter.py'])
        self.h.implement('counter', 'R2', 'implemented', ['src/other.py'])
        self.h.review('counter')

    def change(self):
        self.plan['requirements'][1]['text'] += ' after clarification'
        self.path.write_text(json.dumps(self.plan))

    def test_revision_preserves_original_and_reuses_only_unchanged_evidence(self):
        self.change()
        with self.assertRaises(HarnessError):
            self.h.run('counter', reuse=True)
        revised = self.h.revise('counter', self.path, 'clarified behavior', 'stakeholder reply 2')
        self.assertEqual(revised['changed_requirements'], ['R2'])
        old = json.loads((Path(revised['archive']) / 'plan.json').read_text())
        self.assertEqual(old['requirements'][1]['text'], 'other is two')
        runs = self.h.run('counter', reuse=True)
        self.assertTrue(runs[0]['reused'])
        self.assertNotIn('reused', runs[1])
        rows = snapshot(self.h, 'counter')
        self.assertTrue(rows[0]['implementationCurrent'])
        self.assertFalse(rows[1]['implementationCurrent'])
        self.assertFalse(self.h.status('counter')['complete'])
        self.h.review('counter')
        packet = json.loads((self.root / 'review_packet.json').read_text())['packet']
        self.assertEqual(packet['delta']['focus_requirements'], ['R2'])
        self.assertEqual(len(packet['plan']['requirements']), 2)

    def test_shared_context_change_invalidates_both_checks(self):
        self.plan['context'] += ' changed domain assumption'
        self.path.write_text(json.dumps(self.plan))
        self.h.revise('counter', self.path, 'new policy', 'user message')
        self.assertTrue(all(not r.get('reused') for r in self.h.run('counter', reuse=True)))

    def test_revision_requires_real_source_and_stable_feature(self):
        self.change()
        with self.assertRaises(HarnessError):
            self.h.revise('counter', self.path, 'reason', '')
        self.plan['id'] = 'other'
        self.path.write_text(json.dumps(self.plan))
        with self.assertRaises(HarnessError):
            self.h.revise('counter', self.path, 'reason', 'reply')
