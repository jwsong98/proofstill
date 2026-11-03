import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import inspect
from infra.app import create_app
from infra.database import MEMORY_URL, create_database


class FastAPITests(unittest.TestCase):
    def test_openapi_needs_no_database_and_is_served_by_app(self):
        with patch('infra.app.create_database', side_effect=AssertionError('No DB during export')):
            spec = create_app().openapi()
        self.assertEqual(spec['paths']['/tasks']['post']['operationId'], 'createTask')
        with TestClient(create_app(database_url=MEMORY_URL)) as client:
            self.assertEqual(client.get('/openapi.json').json(), spec)
            self.assertEqual(client.get('/docs').status_code, 200)

    def test_strict_validation_does_not_change_stored_task(self):
        with TestClient(create_app(database_url=MEMORY_URL)) as client:
            task = client.get('/tasks/seed-planning').json()
            for value in ['true', 1, None]:
                self.assertEqual(client.patch('/tasks/' + task['id'], json={'completed': value}).status_code, 400)
            self.assertEqual(client.get('/tasks/' + task['id']).json(), task)
            self.assertEqual(client.post('/tasks', json={'title': '  '}).status_code, 400)
            self.assertEqual(client.post('/tasks', content='{broken', headers={'Content-Type': 'application/json'}).status_code, 400)
            self.assertEqual(client.get('/tasks/missing').json(), {'error': 'Task not found'})

    def test_external_database_needs_explicit_migration(self):
        with tempfile.TemporaryDirectory() as folder:
            url = 'sqlite+pysqlite:///' + str(Path(folder) / 'empty.sqlite')
            with self.assertRaisesRegex(RuntimeError, 'db:migrate'):
                with TestClient(create_app(database_url=url)):
                    self.fail('Unmigrated database must not start')
            engine = create_database(url)
            try:
                self.assertNotIn('tasks', inspect(engine).get_table_names())
            finally:
                engine.dispose()

    def test_oversized_body_is_rejected_before_reading(self):
        with TestClient(create_app(database_url=MEMORY_URL)) as client:
            with patch('starlette.requests.Request.body', side_effect=AssertionError('Body must not be read')):
                response = client.post('/tasks', json={'title': 'x' * (1024 * 1024)})
            self.assertEqual(response.status_code, 400)

    def test_request_logging_preserves_non_json_responses(self):
        from fastapi.responses import PlainTextResponse
        with tempfile.TemporaryDirectory() as folder:
            log = Path(folder) / 'http.jsonl'
            app = create_app(database_url=MEMORY_URL, request_log=str(log))
            @app.get('/text', response_class=PlainTextResponse)
            def text(): return 'hello'
            with TestClient(app) as client:
                response = client.get('/text')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.text, 'hello')
                self.assertEqual(client.get('/tasks/seed-planning').status_code, 200)
            record = json.loads(log.read_text())
            self.assertEqual(record['body']['id'], 'seed-planning')
