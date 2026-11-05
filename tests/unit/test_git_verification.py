"""Git versions replace source fingerprints and copied submission archives."""
import json
import unittest
from pathlib import Path
from unittest.mock import patch
from proofstill.contract import digest, inventory
from proofstill.workflow import Harness

ROOT = Path(__file__).resolve().parents[2]


class GitVerificationTests(unittest.TestCase):
    def test_git_is_only_a_version_reference(self):
        clean = inventory(ROOT, ['proofstill/trace.py'])
        self.assertEqual(clean['git']['status'], 'committed')
        self.assertEqual(len(clean['git']['commit']), 40)
        with patch('proofstill.contract.subprocess.run') as run:
            run.return_value.returncode = 128
            run.return_value.stdout = ''
            unknown = inventory(ROOT, ['proofstill/trace.py'])

    def test_criteria_are_compared_as_data_without_custom_hash(self):
        self.assertEqual(json.loads(digest({'expected': 1})), {'expected': 1})

    def test_receipt_must_match_observed_result(self):
        run = {'pending': False, 'receipt': '/receipt.json', 'log': '/output.log', 'accepted': True}
        with patch('proofstill.workflow.read_json', return_value=run.copy()), patch.object(Path, 'is_file', return_value=True):
            self.assertTrue(Harness.evidence_current(run))
        with patch('proofstill.workflow.read_json', return_value={'accepted': True}), patch.object(Path, 'is_file', return_value=True):
            self.assertFalse(Harness.evidence_current(run))

    def test_source_version_does_not_gate_an_observed_run(self):
        from unittest.mock import Mock
        h = Harness(ROOT)
        h.evidence_current = Mock(return_value=True)
        run = {'criteria_digest': 'criteria', 'source_digest': 'old-source', 'phase': 'green'}
        self.assertTrue(h.run_current({}, {}, {}, run, 'criteria', 'different-source'))
