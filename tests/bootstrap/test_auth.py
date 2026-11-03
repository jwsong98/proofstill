import json
import importlib.util
import sys
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from backend_support import backend_python

ROOT = Path(__file__).resolve().parents[2]


class AuthScaffoldTests(unittest.TestCase):
    def test_generated_jwt_setup_and_backend_env_loading(self):
        python = os.environ.get('PROOFSTILL_BACKEND_PYTHON') or (sys.executable if importlib.util.find_spec('jwt') else backend_python())
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / 'project'
            result = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'scaffold', str(project)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((project / '.env.example').is_file())
            self.assertFalse((project / '.env').exists())
            scripts = json.loads((project / 'package.json').read_text())['scripts']
            self.assertEqual(scripts['auth:setup'], 'node scripts/backend.mjs auth:setup')
            env = {key: value for key, value in os.environ.items() if key not in {'JWT_SECRET_KEY', 'JWT_TTL_SECONDS'}}
            env['PROOFSTILL_BACKEND_PYTHON'] = python
            for _ in range(2):
                result = subprocess.run(['npm', 'run', 'auth:setup'], cwd=project, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                content = (project / '.env').read_text()
                self.assertIn('JWT_SECRET_KEY=', content)
                self.assertNotIn(content.split('JWT_SECRET_KEY=')[1].splitlines()[0], result.stdout)
                if _ == 0:
                    original = content
                else:
                    self.assertEqual(content, original)
            # Exercise the generated command with .env loading before Python starts.
            (project / '.env').write_text(original.replace("JWT_TTL_SECONDS='3600'", "JWT_TTL_SECONDS='90'"))
            probe = project / 'apps/backend/tests/unit/test_env_probe.py'
            probe.write_text("import os, unittest\nclass EnvProbe(unittest.TestCase):\n def test_loaded(self):\n  self.assertEqual(os.environ['JWT_TTL_SECONDS'], '90')\n")
            result = subprocess.run(['node', 'scripts/backend.mjs', 'test:unit'], cwd=project, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('test_loaded', result.stderr)


if __name__ == '__main__':
    unittest.main()
