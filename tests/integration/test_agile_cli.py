import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


class AgileCliTests(unittest.TestCase):
    def test_public_commands_build_compare_and_preserve_partial_submission(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'orders'
            shutil.copytree(REPO / 'examples/agile_product', root, ignore=shutil.ignore_patterns('__pycache__', '.proofstill'))
            def command(*args, code=0):
                result = subprocess.run([sys.executable, str(REPO / 'bin/proofstill'), '--root', str(root), 'project', *args],
                                        capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, code, result.stderr + result.stdout)
                return json.loads(result.stdout)
            command('init', str(root / 'project.json'))
            packet = command('claim', 'pricing', 'product', '--owner', 'product-agent')
            self.assertEqual(packet['write_paths'], ['product.py', 'tests/product.py'])
            command('release', 'pricing', 'product', '--owner', 'product-agent')
            tested = command('test', 'pricing', '--jobs', '2')
            self.assertTrue(all(w['passed'] for w in tested['work'].values()))
            comparison = command('compare', 'pricing', 'rounding')
            rows = {(r['case'], r['candidate']): r['status'] for r in comparison['rows']}
            self.assertEqual(rows['half-cent', 'baseline'], 'invalid')
            self.assertEqual(rows['round-up', 'baseline'], 'invalid')
            self.assertTrue(all(status == 'valid' for (case, candidate), status in rows.items() if candidate == 'candidate'))
            saved = command('snapshot', 'pricing', code=1)
            self.assertEqual(saved['status'], 'partial')
            self.assertTrue(Path(saved['archive']).is_file())
            self.assertEqual(saved['user_acceptance'], 'unconfirmed')
