import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend_support import backend_python
ROOT = Path(__file__).resolve().parents[3]


class ContainerE2E(unittest.TestCase):
    def test_generated_command_uses_postgres_and_does_not_fallback_without_docker(self):
        self.assertTrue((ROOT / 'templates/monorepo/apps/backend/tests/e2e/test_e2e.py').is_file(), 'DATABASE_E2E_MISSING')
        python = backend_python()
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / 'project'
            def run(argv, ok=True, extra=None):
                p = subprocess.run(list(map(str, argv)), cwd=project if project.exists() else ROOT,
                                   env=dict(os.environ, PROOFSTILL_BACKEND_PYTHON=python,
                                            PYTHONDONTWRITEBYTECODE='1', npm_config_cache=str(Path(folder)/'npm-cache'),
                                            **(extra or {})), capture_output=True, text=True, timeout=240)
                if ok: self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
                else: self.assertNotEqual(p.returncode, 0, p.stdout + p.stderr)
                return p.stdout + p.stderr
            cached = Path(os.environ.get('npm_config_cache') or os.environ.get('NPM_CONFIG_CACHE') or Path.home()/'.npm')/'_cacache'
            if cached.exists(): shutil.copytree(cached, Path(folder)/'npm-cache/_cacache')
            for manager in ['npm', 'pnpm']:
                project = Path(folder) / manager
                run(['node', ROOT/'bin/proofstill.mjs', 'scaffold', project, '--package-manager', manager])
                run(['npm', 'install', '--offline', '--ignore-scripts', '--prefix', '.proofstill-runtime'])
                output = run([manager, 'run', 'test:e2e'])
                self.assertIn('POSTGRES_E2E_VERIFIED', output)
                record = project / '.proofstill/test-results/e2e.json'
                result = json.loads(record.read_text())
                self.assertEqual(result['database'], 'postgresql')
                self.assertEqual(result['seedCount'], 2)
                self.assertTrue(result['containerRemoved'])
                self.assertTrue(result['persistedAfterServerRestart'])
                self.assertEqual(result['flowSteps'], ['create_task', 'complete_task', 'read_task'])
                self.assertTrue(result['task']['completed'])
                output = run([manager, 'run', 'test:e2e'], ok=False,
                             extra={'DOCKER_HOST': 'unix:///nonexistent-proofstill-docker.sock'})
                self.assertFalse(record.exists(), 'A failed E2E must not leave a stale success report')
                self.assertNotIn('POSTGRES_E2E_VERIFIED', output)



if __name__ == '__main__': unittest.main()
