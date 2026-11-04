import json
import sys
import tempfile
import unittest
from pathlib import Path
from proofstill.comparison import compare
from proofstill.project import Project
from proofstill.workflow import Harness
from tests.integration.test_project import definition


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        path = definition(self.root)
        (self.root / 'cases.json').write_text(json.dumps([{'id': 'ordinary', 'input': 3}, {'id': 'edge', 'input': 0}]))
        (self.root / 'baseline.py').write_text('import json,sys; n=json.load(sys.stdin); print(json.dumps(n if n else -1))')
        (self.root / 'candidate.py').write_text('import json,sys; print(json.dumps(json.load(sys.stdin)))')
        (self.root / 'validator.py').write_text('import json,sys; d=json.load(sys.stdin); print(json.dumps({"valid": d["output"] == d["case"]["input"], "metrics": {"value": d["output"]}}))')
        value = json.loads(path.read_text())
        value['comparisons'] = [{'id': 'boundaries', 'cases': 'cases.json',
            'candidates': [{'id': name, 'argv': [sys.executable, name + '.py'], 'sources': [name + '.py']} for name in ['baseline', 'candidate']],
            'validator': {'argv': [sys.executable, 'validator.py'], 'sources': ['validator.py']}}]
        path.write_text(json.dumps(value))
        self.project = Project.create(Harness(self.root), path)

    def test_same_inputs_expose_edge_failure_without_selecting_invalid_winner(self):
        result = compare(self.project, 'boundaries')
        self.assertTrue(result['comparable'])
        rows = { (r['case'], r['candidate']): r for r in result['rows'] }
        self.assertEqual(rows['edge', 'baseline']['status'], 'invalid')
        self.assertEqual(rows['edge', 'candidate']['status'], 'valid')
        self.assertEqual(rows['edge', 'baseline']['input_hash'], rows['edge', 'candidate']['input_hash'])
        self.assertTrue((Path(result['evidence']) / 'edge/baseline/command.json').is_file())

    def test_command_failure_is_not_an_invalid_domain_result(self):
        (self.root / 'candidate.py').write_text('raise RuntimeError("broken")')
        result = compare(self.project, 'boundaries')
        self.assertFalse(result['comparable'])
        self.assertEqual([r['status'] for r in result['rows'] if r['candidate'] == 'candidate'], ['error', 'error'])

    def test_source_mutation_prevents_comparison_claim(self):
        (self.root / 'candidate.py').write_text('from pathlib import Path; import json,sys; Path("baseline.py").write_text("changed"); print(json.dumps(json.load(sys.stdin)))')
        result = compare(self.project, 'boundaries')
        self.assertFalse(result['source_unchanged'])
        self.assertFalse(result['comparable'])
