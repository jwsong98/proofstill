import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from tests import proofstill_cli

import docker
from sqlalchemy import inspect, text
from testcontainers.community.postgres import PostgresContainer
from infra.database import create_database, migrate, seed, status
from tests.integration.test_http import start_server, stop_server, request

IMAGE = 'postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
PROJECT = Path(__file__).resolve().parents[4]


class PostgreSQLE2E(unittest.TestCase):
    def test_migrations_seed_real_http_flow_persistence_and_cleanup(self):
        result_file = PROJECT / '.proofstill/test-results/e2e.json'
        result_file.unlink(missing_ok=True)
        client = docker.from_env()
        self.addCleanup(client.close)
        client.ping()  # Missing Docker is a failure, never a skipped or memory-backed E2E.
        container_id = None
        with PostgresContainer(IMAGE, driver='psycopg') as container:
            container_id = container.get_wrapped_container().id
            database_url = container.get_connection_url()
            engine = create_database(database_url)
            try:
                self.assertEqual(engine.dialect.name, 'postgresql')
                self.assertNotIn('tasks', inspect(engine).get_table_names())
                migrate(engine); seed(engine); seed(engine)
                self.assertEqual(status(engine)['current'], ['0001_tasks'])
                self.assertEqual(status(engine)['pending'], [])
                with engine.connect() as conn:
                    self.assertEqual(conn.execute(text('select count(*) from tasks')).scalar(), 2)
                    self.assertTrue(conn.execute(text('select version()')).scalar().startswith('PostgreSQL'))
                with tempfile.TemporaryDirectory() as folder:
                    proc, base = start_server(folder, database_url)
                    try:
                        self.assertFalse(request(base + '/tasks/seed-planning')[1]['completed'])
                        work = Path(folder) / 'flow'; (work / '.api-tracker').mkdir(parents=True)
                        definition = json.loads((PROJECT / '.api-tracker/flow.yaml').read_text())
                        definition['baseUrl'] = base
                        definition['spec'] = str(PROJECT / 'packages/api/openapi.contract.json')
                        (work / '.api-tracker/flow.yaml').write_text(json.dumps(definition))
                        result = subprocess.run(['node', str(proofstill_cli(PROJECT)),
                                                 'tracker', 'flow', 'run'], cwd=work,
                                                capture_output=True, text=True, timeout=30)
                        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                        records = json.loads((work / '.api-tracker/flow-record.json').read_text())
                        self.assertEqual([s['status'] for s in records['steps']], ['passed'] * 3)
                        task = records['steps'][-1]['attempts'][0]['response']['body']
                        self.assertEqual(records['steps'][1]['attempts'][0]['bindings'][0]['value'], task['id'])
                        with engine.connect() as conn:
                            row = conn.execute(text('select id, title, completed from tasks where id=:id'), {'id': task['id']}).mappings().one()
                            self.assertEqual(dict(row), task)
                        request(base + '/tasks/seed-planning', 'PATCH', {'completed': True})
                    finally: stop_server(proc)
                    proc, base = start_server(folder, database_url)
                    try:
                        self.assertEqual(request(base + '/tasks/' + task['id'])[1], task)
                        self.assertTrue(request(base + '/tasks/seed-planning')[1]['completed'])
                    finally: stop_server(proc)
                migrate(engine, 'base', downgrade=True)
                self.assertNotIn('tasks', inspect(engine).get_table_names())
                migrate(engine); seed(engine)
                with engine.connect() as conn: self.assertEqual(conn.execute(text('select count(*) from tasks')).scalar(), 2)
            finally: engine.dispose()
        with self.assertRaises(docker.errors.NotFound): client.containers.get(container_id)
        result_file.parent.mkdir(parents=True, exist_ok=True)
        result_file.write_text(json.dumps({'ok': True, 'database': 'postgresql', 'image': IMAGE,
                                          'containerId': container_id, 'containerRemoved': True,
                                          'migration': '0001_tasks', 'seedCount': 2,
                                          'flowSteps': [s['id'] for s in records['steps']],
                                          'flow': records,
                                          'task': task, 'persistedAfterServerRestart': True}, ensure_ascii=False, indent=2))
        print('POSTGRES_E2E_VERIFIED: migrations + seed + actual HTTP flow + restart persistence + container cleanup')
