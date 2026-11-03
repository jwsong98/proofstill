import json
import hashlib
import ast
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'bin/proofstill.mjs'


class ScaffoldTests(unittest.TestCase):
    def run_cli(self, *args):
        self.assertTrue(CLI.is_file(), 'BOOTSTRAP_MISSING: npm CLI is required')
        return subprocess.run(['node', str(CLI), *map(str, args)], text=True, capture_output=True)

    def test_workspace_and_skills_are_portable(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'new repo'
            result = self.run_cli('scaffold', target, '--package-manager', 'npm')
            self.assertEqual(result.returncode, 0, result.stderr)
            package = json.loads((target / 'package.json').read_text())
            self.assertEqual(package['workspaces'], ['apps/*', 'packages/*'])
            self.assertEqual({p.name for p in (target / 'apps').iterdir()}, {'backend', 'cli', 'app'})
            self.assertNotIn('dev:www', package['scripts'])
            for path in ['apps/backend/domain/health.py', 'apps/backend/infra/server.py',
                         'apps/cli/src/index.mjs', 'apps/app/src/main.tsx',
                         'apps/app/src/features/start/Start.tsx',
                         'packages/jwdesign/src/index.tsx', 'packages/ui/src/button.tsx',
                         'packages/api/openapi.contract.json', 'orval.config.mjs']:
                self.assertTrue((target / path).is_file(), path)
            for skill in ['proofstill-develop', 'proofstill-commit', 'proofstill-verify', 'proofstill-interview', 'proofstill-engineer', 'proofstill-ux', 'jwdesign',
                          'design-taste-frontend', 'proofstill-api', 'proofstill-db']:
                self.assertTrue((target / f'.agents/skills/{skill}/SKILL.md').is_file(), skill)
            for path in target.rglob('*'):
                if path.is_file() and path.suffix in {'.json', '.md', '.mjs', '.py', '.tsx', '.yaml'}:
                    self.assertNotIn('/Users/jwsong', path.read_text(), str(path))
            for relative, digest in json.loads((ROOT / 'tests/bootstrap/assets.json').read_text()).items():
                self.assertEqual(hashlib.sha256((target / relative).read_bytes()).hexdigest(), digest, relative)
            api_skill = (target / '.agents/skills/proofstill-api/SKILL.md').read_text()
            self.assertEqual(api_skill, (ROOT / 'tests/bootstrap/api-skill.md').read_text())
            for command in ['openapi:export', 'api:generate', 'flow show', 'flow run', 'spec compare']:
                self.assertIn(command, api_skill)
            domain = (target / 'apps/backend/domain/health.py').read_text()
            self.assertNotIn('infra', domain)
            for file in (target / 'apps/backend/domain').glob('*.py'):
                for node in ast.walk(ast.parse(file.read_text())):
                    if isinstance(node, (ast.Import, ast.ImportFrom)):
                        imports = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or '']
                        self.assertTrue(all(item.split('.')[0] in {'typing', 'dataclasses', 'enum', 'decimal', 'datetime', 'uuid', 'collections', 'math', '__future__', 'domain'} for item in imports), imports)
            component = (target / 'packages/jwdesign/src/index.tsx').read_text()
            self.assertNotIn('window.React', component)
            self.assertIn('createPortal', component)
            self.assertIn('jwdesign', (target / 'AGENTS.md').read_text())

    def test_default_apps_exclude_www(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'default'
            result = self.run_cli('scaffold', target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual({p.name for p in (target / 'apps').iterdir()}, {'backend', 'cli', 'app'})
            scripts = json.loads((target / 'package.json').read_text())['scripts']
            self.assertNotIn('dev:www', scripts)
            for app in ['backend', 'cli', 'app']:
                self.assertIn(f'dev:{app}', scripts)
            self.assertFalse((target / '.proofstill-runtime/templates/monorepo/apps/www').exists())

    def test_existing_files_and_symlinks_are_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'existing'
            target.mkdir()
            (target / 'keep.txt').write_text('keep')
            result = self.run_cli('scaffold', target)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(target.iterdir()), [target / 'keep.txt'])
            empty = Path(folder) / 'empty'
            empty.mkdir()
            self.assertNotEqual(self.run_cli('scaffold', empty).returncode, 0)
            self.assertEqual(list(empty.iterdir()), [])
            link = Path(folder) / 'linked'
            link.symlink_to(target, target_is_directory=True)
            self.assertNotEqual(self.run_cli('scaffold', link).returncode, 0)
            self.assertEqual((target / 'keep.txt').read_text(), 'keep')

    def test_app_selection_and_validation(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'selected'
            result = self.run_cli('scaffold', target, '--apps', 'backend,cli', '--package-manager', 'pnpm')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual({p.name for p in (target / 'apps').iterdir()}, {'backend', 'cli'})
            self.assertTrue((target / 'pnpm-workspace.yaml').is_file())
            self.assertTrue(json.loads((target / 'package.json').read_text())['packageManager'].startswith('pnpm@'))
            bad = Path(folder) / 'bad'
            self.assertNotEqual(self.run_cli('scaffold', bad, '--apps', '../oops').returncode, 0)
            self.assertFalse(bad.exists())
            self.assertNotEqual(self.run_cli('scaffold', bad, '--package-manager', 'wrong').returncode, 0)
            for selection in ['', 'unknown', 'backend,backend', 'app,', 'www', 'app,www']:
                self.assertNotEqual(self.run_cli('scaffold', bad, '--apps', selection).returncode, 0)
                self.assertFalse(bad.exists())

    def test_npm_wrapper_preserves_harness_commands(self):
        result = self.run_cli('harness', '--help')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('review', result.stdout)
        self.assertIn('trace', result.stdout)
        result = self.run_cli('doctor')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('python', result.stdout.lower())


if __name__ == '__main__':
    unittest.main()
