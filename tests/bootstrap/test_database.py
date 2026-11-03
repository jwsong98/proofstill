import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from backend_support import backend_python

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'bin/proofstill.mjs'
COMMANDS = {'backend:setup', 'db:revision', 'db:migrate', 'db:status', 'db:rollback', 'db:seed',
            'db:reset', 'db:check', 'test:unit', 'test:integration', 'test:flow', 'test:fast', 'test:e2e'}


class DatabaseBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue((ROOT / 'templates/monorepo/apps/backend/infra/database.py').is_file(), 'DATABASE_BOOTSTRAP_MISSING')
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / 'project'
        self.python = backend_python()
        self.call(['node', CLI, 'scaffold', self.project], cwd=ROOT)
        self.backend = self.project / 'apps/backend'

    def call(self, argv, cwd=None, ok=True, env=None):
        p = subprocess.run(list(map(str, argv)), cwd=cwd or self.project,
                           env={**os.environ, 'PROOFSTILL_BACKEND_PYTHON': self.python,
                                'PYTHONDONTWRITEBYTECODE': '1', **(env or {})},
                           capture_output=True, text=True, timeout=180)
        if ok: self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        else: self.assertNotEqual(p.returncode, 0, p.stdout + p.stderr)
        return p.stdout + p.stderr

    def use_manager(self, manager):
        self.manager = manager
        self.project = Path(self.temp.name) / manager
        self.call(['node', CLI, 'scaffold', self.project, '--package-manager', manager], cwd=ROOT)
        (self.project / '.proofstill-runtime/node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        self.backend = self.project / 'apps/backend'

    def npm(self, name, *args, **kwargs):
        return self.call([getattr(self, 'manager', 'npm'), 'run', name, '--', *args], **kwargs)

    def test_scripts_memory_seed_fixture_and_no_external_database_dependency(self):
        scripts = json.loads((self.project / 'package.json').read_text())['scripts']
        self.assertTrue(COMMANDS <= scripts.keys())
        for command in COMMANDS:
            self.assertEqual(scripts[command], f'node scripts/backend.mjs {command}')
        for file in [ROOT / 'README.md', self.project / 'README.md',
                     self.project / '.agents/skills/proofstill-db/SKILL.md']:
            guide = file.read_text()
            for term in [*COMMANDS, 'DATABASE_URL', '--yes', ':memory:', 'PostgreSQL', 'Testcontainers']:
                self.assertIn(term, guide, str(file))
        self.assertEqual((self.backend / 'requirements.txt').read_bytes(), (ROOT / 'tests/bootstrap/db-requirements.txt').read_bytes())
        for name, directory in [('test_database.py','unit'),('test_http.py','integration'),('test_e2e.py','e2e')]:
            self.assertEqual((self.backend / 'tests' / directory / name).read_bytes(),
                             (ROOT / 'tests/bootstrap/db-fixtures' / name).read_bytes())
        bad_external = {'DATABASE_URL': 'postgresql+psycopg://nobody:nothing@127.0.0.1:1/must_not_connect'}
        for manager in ['npm', 'pnpm']:
            self.use_manager(manager)
            self.assertIn('OK', self.npm('test:unit', env=bad_external))
            self.assertIn('OK', self.npm('test:fast', env=bad_external))
            self.assertIn('OK', self.npm('test:integration', env=bad_external))
            result = self.npm('db:check', env=bad_external)
            self.assertIn('MEMORY_DB_VERIFIED', result)
            self.assertIn('seed-planning', result)
            self.assertIn('seed-done', result)

    def test_admin_commands_migration_revision_seed_rollback_and_reset(self):
        for manager in ['npm', 'pnpm']:
            self.use_manager(manager)
            db = Path(self.temp.name) / f'local-{self.manager}.sqlite'
            env = {'DATABASE_URL': 'sqlite+pysqlite:///' + str(db)}
            self.assertIn('0001_tasks', self.npm('db:status', env=env))
            self.npm('db:migrate', env=env)
            self.npm('db:seed', env=env); self.npm('db:seed', env=env)
            probe = "import sqlite3,json; c=sqlite3.connect(%r); print(json.dumps(c.execute('select id,title,completed from tasks order by id').fetchall()))" % str(db)
            rows = json.loads(self.call([self.python, '-c', probe]))
            self.assertEqual(len(rows), 2)
            self.assertEqual({row[0] for row in rows}, {'seed-planning', 'seed-done'})
            before = set((self.backend / 'migrations/versions').glob('*.py'))
            self.npm('db:revision', '--message', 'next migration', env=env)
            added = set((self.backend / 'migrations/versions').glob('*.py')) - before
            self.assertEqual(len(added), 1)
            # Populate the created revision to prove migrate/rollback executes its SQL.
            file = added.pop(); revision = file.read_text()
            revision = revision.replace('def upgrade()', 'def upgrade()')
            revision = revision.replace('    pass\n', "    op.create_table('migration_probe', sa.Column('id', sa.Integer(), primary_key=True))\n", 1)
            revision = revision.replace('    pass\n', "    op.drop_table('migration_probe')\n", 1)
            file.write_text(revision)
            self.npm('db:migrate', env=env)
            tables = "import sqlite3; c=sqlite3.connect(%r); print(c.execute(\"select name from sqlite_master where type='table'\").fetchall())" % str(db)
            self.assertIn('migration_probe', self.call([self.python, '-c', tables]))
            self.npm('db:rollback', env=env)
            self.assertNotIn('migration_probe', self.call([self.python, '-c', tables]))
            self.npm('db:migrate', '--revision', 'unknown_revision', env=env, ok=False)
            self.npm('db:reset', env=env, ok=False)
            self.assertEqual(json.loads(self.call([self.python, '-c', probe])), rows)
            self.npm('db:reset', '--yes', env=env)
            self.assertEqual(json.loads(self.call([self.python, '-c', probe])), rows)
            self.assertIn('migration_probe', self.call([self.python, '-c', tables]))
            for command, arguments in [('db:revision', ['--message', 'no target']), ('db:migrate', []),
                                       ('db:status', []), ('db:rollback', []), ('db:seed', []), ('db:reset', ['--yes'])]:
                error = self.npm(command, *arguments, env={'DATABASE_URL': ''}, ok=False)
                self.assertIn('DATABASE_URL', error)
    
            file.unlink()

    def test_setup_creates_managed_venv_and_installs_dependencies(self):
        self.npm('backend:setup')
        python = self.backend / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        self.assertTrue(python.is_file())
        self.call([python, '-c', 'import fastapi, uvicorn, httpx, sqlalchemy, alembic, psycopg; from testcontainers.community.postgres import PostgresContainer'])
        self.npm('test:unit', env={'PROOFSTILL_BACKEND_PYTHON': str(python)})
        self.use_manager('pnpm')
        self.npm('backend:setup')
        self.assertTrue((self.backend / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')).is_file())


if __name__ == '__main__': unittest.main()
