"""Generated-project contracts, including an intentionally illegal dependency."""
import ast
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from backend_support import backend_python

ROOT = Path(__file__).resolve().parents[2]


class ArchitectureScaffoldTests(unittest.TestCase):
    def test_generated_boundaries_tdd_and_runtime(self):
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / 'project'
            result = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'scaffold', str(project)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            scripts = json.loads((project / 'package.json').read_text())['scripts']
            self.assertTrue({'test:architecture', 'test:domain', 'test:usecase'} <= scripts.keys(), 'LAYER_COMMANDS_MISSING')
            for relative in ['app/http.py', 'app/tasks.py', 'app/health.py', 'app/schemas.py',
                             'usecase/tasks.py', 'usecase/health.py', 'domain/tasks.py',
                             'infra/task_repository.py', 'scripts/check_architecture.py']:
                self.assertTrue((project / 'apps/backend' / relative).is_file(), relative)
            composition = ast.parse((project / 'apps/backend/infra/app.py').read_text())
            for node in ast.walk(composition):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    for decorator in node.decorator_list:
                        if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                            self.assertNotIn(decorator.func.attr, ['get', 'post', 'patch', 'put', 'delete', 'route'],
                                             'Composition must not implement HTTP handlers')
            env = {**os.environ, 'PROOFSTILL_BACKEND_PYTHON': backend_python(), 'PYTHONDONTWRITEBYTECODE': '1',
                   'DATABASE_URL': 'postgresql+psycopg://unused@127.0.0.1:1/unused'}
            def run(command, *args):
                return subprocess.run(['node', 'scripts/backend.mjs', command, *args], cwd=project, env=env,
                                      capture_output=True, text=True, timeout=120)
            for command in ['test:architecture', 'test:domain', 'test:usecase', 'test:unit', 'test:integration']:
                result = run(command)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('OK', result.stderr)
            required_cases = {
                'domain': ['TaskRulesTests.test_normalizes_title_and_generates_distinct_ids',
                           'TaskRulesTests.test_rejects_invalid_titles_and_completion'],
                'usecase': ['TaskListTests.test_create_update_get', 'TaskListTests.test_invalid_input_never_writes',
                            'TaskListTests.test_missing_task_and_store_failure_are_preserved',
                            'TaskListTests.test_instances_do_not_share_state'],
            }
            for layer, cases in required_cases.items():
                for case in cases:
                    result = run(f'test:{layer}', f'tests.{layer}.test_tasks.{case}')
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertIn('Ran 1 test', result.stderr)
            probe = """
from unittest.mock import patch
from fastapi.testclient import TestClient
from infra.app import create_app
from usecase.tasks import TaskList
from domain.tasks import new_task
application = create_app(database_url='sqlite+pysqlite:///:memory:')
public_routes = [route for route in application.routes if getattr(route, 'path', None) in ['/health', '/tasks', '/tasks/{id}']]
assert len(public_routes) == 4
assert all(route.endpoint.__module__.startswith('app.') for route in public_routes)
with TestClient(application) as client:
    with patch.object(TaskList, 'create', return_value={'id':'injected', 'title':'usecase', 'completed':False}) as call:
        response = client.post('/tasks', json={'title':'input'})
        assert response.status_code == 201 and response.json()['id'] == 'injected'
        call.assert_called_once_with('input')
    with patch('usecase.tasks.new_task', wraps=new_task) as rule:
        response = client.post('/tasks', json={'title':' domain '})
        assert response.status_code == 201 and response.json()['title'] == 'domain'
        rule.assert_called_once_with('domain')
        assert client.get('/tasks/' + response.json()['id']).json() == response.json()
"""
            result = subprocess.run([backend_python(), '-c', probe], cwd=project / 'apps/backend', env=env,
                                    capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            for module in ['domain', 'usecase']:
                result = subprocess.run([backend_python(), '-S', '-m', 'unittest', 'discover', '-s', f'tests/{module}', '-v'],
                                        cwd=project / 'apps/backend', env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            for layer, code in [
                ('domain', 'import infra.task_repository'),
                ('domain', 'import usecase.tasks'),
                ('domain', 'import app.http'),
                ('domain', 'from ..infra import database'),
                ('domain', 'import sqlalchemy'),
                ('usecase', 'import infra.task_repository'),
                ('usecase', 'import app.http'),
                ('usecase', 'from ..app import http'),
                ('usecase', 'import fastapi'),
                ('app', 'import domain.tasks'),
                ('app', 'import infra.database'),
                ('app', 'from ..infra import database'),
                ('infra', 'import usecase.tasks'),
                ('infra', 'import app.http'),
            ]:
                with self.subTest(layer=layer, code=code):
                    bad = project / f'apps/backend/{layer}/illegal.py'
                    bad.write_text(code + '\n')
                    try:
                        result = run('test:fast')
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn(f'{layer}/illegal.py', result.stdout + result.stderr)
                        self.assertNotIn('test_actual_memory_schema', result.stdout + result.stderr)
                    finally:
                        bad.unlink()
            manifest = json.loads((ROOT / 'package.json').read_text())['files']
            self.assertEqual(set(manifest), set(json.loads((ROOT / 'tests/bootstrap/distribution.json').read_text())))
            for directory in ['app', 'usecase', 'domain', 'tests/domain', 'tests/usecase', 'tests/architecture', 'scripts']:
                for file in (project / 'apps/backend' / directory).rglob('*.py'):
                    relative = file.relative_to(project).as_posix()
                    if file.name == '__init__.py' and directory in ['app', 'usecase', 'domain']:
                        continue  # scaffold creates package markers.
                    self.assertIn('templates/monorepo/' + relative, manifest)
            guide = (project / 'AGENTS.md').read_text()
            for instruction in [
                'app → usecase → domain', 'infra → domain',
                'domain/<기능>.py', 'usecase/<기능>.py', 'app/<기능>.py', 'infra/<기능>_repository.py',
                '공유 계약·조립 진입점·migration·lockfile·생성 코드는 한 담당자가 순서대로 통합한다.',
                '실패할 행동 테스트를 먼저 작성하고 해당 테스트의 Red를 확인한 뒤 구현하여 Green으로 만든다.',
            ]:
                self.assertIn(instruction, guide)



if __name__ == '__main__':
    unittest.main()
