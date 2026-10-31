import json
import os
import re
from pathlib import Path
import subprocess
import tempfile
import unittest

from backend_support import backend_python

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'templates/monorepo/apps/backend'


class FastAPITemplateTests(unittest.TestCase):
    def probe(self, code, cwd=BACKEND):
        result = subprocess.run([backend_python(), '-c', code], cwd=cwd, text=True,
                                capture_output=True, timeout=60,
                                env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1',
                                     'DATABASE_URL': 'postgresql+psycopg://unused@127.0.0.1:1/unused'})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_orm_models_sessions_constraints_and_migration_metadata(self):
        self.assertTrue((BACKEND / 'infra/models.py').is_file(), 'ORM_MODEL_MISSING')
        self.probe('''
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from infra.models import Base, Task
from infra.database import create_database, migrate, seed
from infra.task_repository import TaskRepository
from domain.tasks import TaskList
engine = create_database()
try:
    migrate(engine); seed(engine)
    assert inspect(Task).local_table is Base.metadata.tables['tasks']
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    with Session(engine) as session:
        tasks = TaskList(TaskRepository(session))
        task = tasks.create(' ORM 작업 ')
        assert task['title'] == 'ORM 작업'
        assert tasks.update(task['id'], True)['completed'] is True
    with Session(engine) as session:
        row = session.get(Task, task['id'])
        assert isinstance(row, Task) and row.completed
        row.title = 'rollback'; session.rollback()
        assert session.get(Task, task['id']).title == 'ORM 작업'
        session.add(Task(id='invalid', title=' ', completed=False))
        try:
            session.commit()
            raise AssertionError('ORM must retain SQL constraints')
        except IntegrityError:
            session.rollback()
        assert session.get(Task, task['id']).completed
finally:
    engine.dispose()
''')

    def test_fastapi_lifespan_docs_validation_openapi_and_isolation(self):
        self.assertTrue((BACKEND / 'infra/app.py').is_file(), 'FASTAPI_APP_MISSING')
        self.probe('''
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import infra.database as database
with patch('infra.database.create_database', side_effect=AssertionError('import must not open DB')):
    from infra import app as app_module
app_module.create_database = database.create_database
create_app = app_module.create_app
from infra.database import MEMORY_URL
from infra import server
with patch('uvicorn.Server.run', autospec=True) as run, patch('sys.argv', ['server.py']):
    server.main()
    assert run.call_count == 1 and isinstance(run.call_args.args[0].config.app, FastAPI)
with patch('infra.app.create_database', side_effect=AssertionError('export must not open DB')):
    app = create_app()
    assert isinstance(app, FastAPI)
    spec = app.openapi()
    assert set(spec['paths']) == {'/health', '/tasks', '/tasks/{id}'}
    assert spec['paths']['/tasks']['post']['operationId'] == 'createTask'
    def schema(ref): return spec['components']['schemas'][ref['$ref'].split('/')[-1]]
    operation = spec['paths']['/tasks']['post']
    payload = schema(operation['requestBody']['content']['application/json']['schema'])
    assert payload['required'] == ['title'] and payload['properties']['title']['type'] == 'string'
    response = schema(operation['responses']['201']['content']['application/json']['schema'])
    assert set(response['required']) == {'id', 'title', 'completed'}
    assert response['properties']['completed']['type'] == 'boolean'
    patch_body = schema(spec['paths']['/tasks/{id}']['patch']['requestBody']['content']['application/json']['schema'])
    assert patch_body['required'] == ['completed'] and patch_body['properties']['completed']['type'] == 'boolean'
    @app.get('/probe', operation_id='probeRoute')
    def probe(): return {'ok': True}
    app.openapi_schema = None
    assert '/probe' in app.openapi()['paths']
with TestClient(create_app(database_url=MEMORY_URL)) as client:
    assert client.get('/docs').status_code == 200
    assert client.get('/redoc').status_code == 200
    assert client.get('/openapi.json').json() == create_app().openapi()
    first = client.get('/health').json()
    assert client.get('/health', params={'previous': first['requestId']}).json()['previous'] == first['requestId']
    assert client.get('/health?previous=unknown').status_code == 400
    task = client.post('/tasks', json={'title': ' 새 작업 '})
    assert task.status_code == 201
    task = task.json()
    assert task['title'] == '새 작업' and task['completed'] is False
    changed = client.patch('/tasks/' + task['id'], json={'completed': True})
    assert changed.status_code == 200 and changed.json()['completed'] is True
    assert client.get('/tasks/' + task['id']).json() == changed.json()
    for data in [{}, {'title': ''}, {'title': ' '}, {'title': None}, {'title': 3}, []]:
        response = client.post('/tasks', json=data)
        assert response.status_code == 400 and isinstance(response.json()['error'], str), response.text
    for value in ['true', 1, None]:
        response = client.patch('/tasks/' + task['id'], json={'completed': value})
        assert response.status_code == 400, response.text
    assert client.post('/tasks', content='{broken', headers={'Content-Type': 'application/json'}).status_code == 400
    assert client.post('/tasks', json={'title': 'x' * (1024 * 1024)}).status_code == 400
    assert client.post('/tasks', json={'title': 'short', 'padding': 'x' * (1024 * 1024)}).status_code == 400
    assert client.get('/tasks/missing').status_code == 404
    assert client.patch('/tasks/missing', json={'completed': True}).status_code == 404
    assert client.get('/__proofstill/owner').status_code == 403
    assert client.post('/__proofstill/stop').status_code == 403
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(lambda n: client.post('/tasks', json={'title': str(n)}), range(32)))
    assert all(response.status_code == 201 for response in responses)
    assert len({response.json()['id'] for response in responses}) == 32
    for index, response in enumerate(responses):
        task_data = response.json()
        assert task_data['title'] == str(index) and task_data['completed'] is False
        assert client.get('/tasks/' + task_data['id']).json() == task_data
with TestClient(create_app(database_url=MEMORY_URL)) as client:
    assert client.get('/tasks/' + task['id']).status_code == 404
    assert client.get('/tasks/seed-planning').json()['completed'] is False
''')

    def test_generated_export_uses_managed_python_without_database(self):
        self.assertTrue((BACKEND / 'infra/app.py').is_file(), 'FASTAPI_APP_MISSING')
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / 'project'
            scaffolded = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'scaffold', str(project)],
                                        check=True, capture_output=True, text=True)
            self.assertIn('npm run backend:setup', scaffolded.stdout)
            result = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'openapi', 'export'],
                                    cwd=project, capture_output=True, text=True, timeout=60,
                                    env={**os.environ, 'PROOFSTILL_BACKEND_PYTHON': backend_python(),
                                         'DATABASE_URL': 'postgresql+psycopg://unused@127.0.0.1:1/unused'})
            self.assertEqual(result.returncode, 0, result.stderr)
            exported = json.loads((project / 'packages/api/openapi.generated.json').read_text())
            contract = json.loads((project / 'packages/api/openapi.contract.json').read_text())
            self.assertEqual(exported, contract)
            self.probe('''
import json
from pathlib import Path
from infra.app import create_app
assert create_app().openapi() == json.loads(Path('../../packages/api/openapi.generated.json').read_text())
''', project / 'apps/backend')

    def test_generated_development_recipe(self):
        self.assertTrue((BACKEND / 'infra/app.py').is_file(), 'FASTAPI_APP_MISSING')
        guide = (ROOT / 'templates/monorepo/README.md').read_text()
        for path in ['infra/models.py', 'infra/schemas.py', 'infra/app.py', '--autogenerate', '/docs']:
            self.assertIn(path, guide)
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / 'project'
            scaffolded = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'scaffold', str(project)],
                                        check=True, capture_output=True, text=True)
            self.assertIn('npm run backend:setup', scaffolded.stdout)
            model = project / 'apps/backend/infra/models.py'
            original = model.read_text()
            updated = original.replace('class Task(Base):',
                                       'class Task(Base):\n    note: Mapped[str | None] = mapped_column(nullable=True)')
            self.assertNotEqual(updated, original)
            model.write_text(updated)
            environment = {**os.environ, 'PROOFSTILL_BACKEND_PYTHON': backend_python(),
                           'DATABASE_URL': 'sqlite+pysqlite:///' + str(Path(folder) / 'development.sqlite')}
            for command in [('db:migrate',), ('db:revision', '--message', 'add note', '--autogenerate'), ('db:migrate',), ('db:seed',)]:
                result = subprocess.run(['node', 'scripts/backend.mjs', *command], cwd=project,
                                        env=environment, capture_output=True, text=True, timeout=60)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            # Execute the documented route example against the migrated ORM model.
            examples = re.findall(r'```python\n(.*?)\n```', guide, re.DOTALL)
            route_examples = [code for code in examples if "operation_id='getTaskNote'" in code]
            self.assertEqual(len(route_examples), 1, 'README must include the executable note endpoint example')
            app_file = project / 'apps/backend/infra/app.py'
            app_file.write_text(app_file.read_text().replace('    return app', route_examples[0] + '\n    return app'))
            self.probe('''
from sqlalchemy.orm import Session
from infra.models import Task
from infra.database import create_database
import os
engine = create_database(os.environ['DATABASE_URL'])
with Session(engine) as session:
    row = session.get(Task, 'seed-planning')
    row.note = 'migration from ORM'; session.commit()
with Session(engine) as session:
    assert session.get(Task, 'seed-planning').note == 'migration from ORM'
engine.dispose()
'''.replace("os.environ['DATABASE_URL']", repr(environment['DATABASE_URL'])), project / 'apps/backend')
            self.probe('''
from fastapi.testclient import TestClient
from infra.app import create_app
with TestClient(create_app(database_url=DATABASE_URL)) as client:
    assert client.get('/task-notes/seed-planning').json() == {'note': 'migration from ORM'}
    assert client.get('/task-notes/missing').status_code == 404
    assert client.get('/openapi.json').json()['paths']['/task-notes/{id}']['get']['operationId'] == 'getTaskNote'
'''.replace('database_url=DATABASE_URL', 'database_url=' + repr(environment['DATABASE_URL'])), project / 'apps/backend')


if __name__ == '__main__':
    unittest.main()
