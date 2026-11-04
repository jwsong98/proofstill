import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from proofstill.handoff import snapshot
from proofstill.workflow import Harness
from tests.support import make_plan

PROJECT = Path(__file__).resolve().parents[2]


class CheckReuseTests(unittest.TestCase):
    def test_cli_reuses_only_checks_with_current_inputs_and_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            origin = make_plan(root)
            plan = json.loads(origin.read_text())
            shared = root / 'src/shared.py'
            shared.write_text('# shared\n')
            (root / 'src/other.py').write_text('# other\n')
            (root / 'src/counter.py').write_text('VALUE = 1\n')
            (root / 'tests/browser.py').write_text('print("BROWSER_OK")\n')
            plan['sources'].extend(['src/shared.py', 'src/other.py'])
            plan['checks'][0]['sources'] = ['src/counter.py', 'src/shared.py']
            plan['checks'].append({
                'id': 'browser', 'kind': 'integration', 'module': 'browser',
                'files': ['tests/browser.py'], 'sources': ['src/other.py', 'src/shared.py'],
                'argv': [sys.executable, 'tests/browser.py'], 'green_pattern': 'BROWSER_OK',
            })
            plan['requirements'][0]['checks'].append('browser')
            origin.write_text(json.dumps(plan))
            harness = Harness(root)
            harness.init(origin)

            def run(*args):
                result = subprocess.run(
                    [sys.executable, '-m', 'proofstill', '--root', str(root), 'test', 'counter', *args],
                    cwd=PROJECT, capture_output=True, text=True, check=True,
                )
                return json.loads(result.stdout)

            first = run()
            browser = root / 'tests/browser.py'
            browser.write_text(browser.read_text() + '# new browser assertion\n')
            statuses = snapshot(harness, 'counter')[0]['verification']['checks']
            self.assertEqual([check['status'] for check in statuses], ['passed', 'stale'])
            second = run()
            self.assertTrue(second[0]['reused'])
            self.assertEqual(second[0]['receipt'], first[0]['receipt'])
            self.assertNotEqual(second[1]['receipt'], first[1]['receipt'])
            self.assertEqual(len(harness.load('counter')[1]['runs']), 3)

            (root / 'src/other.py').write_text('# other changed\n')
            third = run()
            self.assertTrue(third[0]['reused'])
            self.assertNotEqual(third[1]['receipt'], second[1]['receipt'])

            shared.write_text('# shared changed\n')
            fourth = run()
            self.assertTrue(all('reused' not in record for record in fourth))
            Path(fourth[0]['log']).write_text('tampered\n')
            fifth = run()
            self.assertNotEqual(fifth[0]['receipt'], fourth[0]['receipt'])
            self.assertTrue(fifth[1]['reused'])
            self.assertTrue(all('reused' not in record for record in run('--force')))
