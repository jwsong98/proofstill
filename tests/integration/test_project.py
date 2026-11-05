import json
import sys
import tempfile
import unittest
from pathlib import Path
from proofstill.project import Project
from proofstill.workflow import Harness, HarnessError
from tests.support import fake_codex


def definition(root, *, barrier=False):
    (root / 'src').mkdir()
    (root / 'tests').mkdir()
    (root / 'events').mkdir()
    (root / 'contract.json').write_text('{"input":"number","output":"number"}')
    work = []
    for name in ['product', 'logic', 'integration']:
        (root / f'src/{name}.py').write_text('VALUE = 1\n')
        program = ''
        if barrier and name != 'integration':
            other = 'logic' if name == 'product' else 'product'
            program = f'''from pathlib import Path
import time
Path('events/{name}').touch()
until = time.monotonic()+3
while not Path('events/{other}').exists() and time.monotonic() < until: time.sleep(.01)
assert Path('events/{other}').exists(), 'checks did not run concurrently'
'''
        (root / f'tests/{name}.py').write_text(program + f'import runpy; assert runpy.run_path("src/{name}.py")["VALUE"] == 1; print("OK")\n')
        work.append({'id': name, 'kind': name, 'owns': [f'src/{name}.py', f'tests/{name}.py'] + (['contract.json'] if name == 'integration' else []),
            'depends_on': ['product', 'logic'] if name == 'integration' else [],
            'feature': {'title': name, 'sources': [f'src/{name}.py'],
                'requirements': [{'id': name.upper(), 'text': f'{name} returns one', 'checks': [name]}],
                'checks': [{'id': name, 'kind': 'unit', 'module': name, 'argv': [sys.executable, f'tests/{name}.py'],
                            'files': [f'tests/{name}.py'], 'green_pattern': 'OK'}]}})
    value = {'id': 'demo', 'title': 'demo', 'intent': 'product and logic share one contract', 'contracts': ['contract.json'], 'work': work}
    path = root / 'project.json'
    path.write_text(json.dumps(value))
    return path


class ProjectTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.path = definition(self.root, barrier=True)
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.project = Project.create(self.h, self.path)

    def test_parallel_product_logic_then_integrated_flow(self):
        result = self.project.run(jobs=2)
        self.assertEqual(result['blocked'], [])
        self.assertTrue(all(item['passed'] for item in result['work'].values()))
        self.assertFalse(result['status']['submission_ready'])  # Tests alone are not independent approval.
        for row in result['status']['work']:
            self.h.review(row['feature'])
        self.assertTrue(self.project.status()['submission_ready'])

    def test_question_blocks_only_affected_work_and_invalidates_downstream(self):
        self.project.run()
        self.project.question('logic', 'boundary', 'what happens at zero?')
        rows = {r['id']: r for r in self.project.status()['work']}
        self.assertTrue(rows['product']['ready'])
        self.assertFalse(rows['logic']['ready'])
        self.assertFalse(rows['integration']['green'])
        self.project.question('logic', 'boundary', 'what happens at zero?', 'return one', 'actual reply 1')
        runs = self.project.run()['work']
        self.assertTrue(runs['product']['checks'][0]['reused'])
        self.assertFalse(runs['logic']['checks'][0]['reused'])
        self.assertFalse(runs['integration']['checks'][0]['reused'])

    def test_claims_and_packet_preserve_write_boundary(self):
        packet = self.project.claim('product', 'agent-product')
        self.assertEqual(packet['write_paths'], ['src/product.py', 'tests/product.py'])
        self.project.claim('logic', 'agent-logic')
        with self.assertRaises(HarnessError):
            self.project.claim('product', 'another-agent')
        self.assertIn('product', self.project.run()['blocked'])
        self.project.claim('product', 'agent-product', release=True)

    def test_overlapping_ownership_and_cycles_are_rejected(self):
        value = json.loads(self.path.read_text())
        value['work'][0]['owns'] = ['src']
        self.path.write_text(json.dumps(value))
        with self.assertRaisesRegex(HarnessError, '경계 충돌'):
            Project.create(self.h, self.path)
        value['work'][0]['owns'] = ['src/product.py']
        value['work'][0]['depends_on'] = ['integration']
        self.path.write_text(json.dumps(value))
        with self.assertRaisesRegex(HarnessError, '순환'):
            Project.create(self.h, self.path)

    def test_product_requirements_are_resolved_once_for_multiple_work_items(self):
        value = json.loads(self.path.read_text())
        value['requirements'] = {'SHARED': 'one product condition'}
        for item in value['work']:
            item['feature']['requirements'] = [{'id': 'SHARED', 'checks': [item['id']]}]
        self.path.write_text(json.dumps(value))
        project = Project.create(self.h, self.path, reason='consolidate', source='user decision')
        for item in project.load()[0]['work']:
            self.assertEqual(item['feature']['requirements'][0]['text'], 'one product condition')
        value['work'][0]['feature']['requirements'][0]['text'] = 'divergent wording'
        self.path.write_text(json.dumps(value))
        with self.assertRaisesRegex(HarnessError, '제품 정의에만'):
            Project.create(self.h, self.path, reason='edit', source='test')

    def test_single_definition_sync_keeps_unchanged_feature_evidence(self):
        self.project.run()
        value = json.loads(self.path.read_text())
        value['work'][1]['feature']['requirements'][0]['text'] += '; clarified'
        self.path.write_text(json.dumps(value))
        with self.assertRaisesRegex(HarnessError, 'sync'):
            self.project.status()
        Project.create(self.h, self.path, reason='clarification', source='reply 2')
        result = self.project.run()['work']
        self.assertTrue(result['product']['checks'][0]['reused'])
        self.assertFalse(result['logic']['checks'][0]['reused'])
        self.assertFalse(result['integration']['checks'][0]['reused'])
        self.assertIn('LOGIC', self.project.requirements())
