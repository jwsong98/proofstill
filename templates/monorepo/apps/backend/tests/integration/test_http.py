import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
import urllib.error


def start_server(folder, database_url):
    ready = Path(folder) / 'ready.json'
    ready.unlink(missing_ok=True)
    proc = subprocess.Popen([sys.executable, 'infra/server.py', '--port', '0', '--ready-file', str(ready)],
                            env=dict(os.environ, DATABASE_URL=database_url, PYTHONDONTWRITEBYTECODE='1'),
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    for _ in range(200):
        if ready.exists(): return proc, json.loads(ready.read_text())['baseUrl']
        if proc.poll() is not None: raise RuntimeError(proc.stderr.read())
        time.sleep(.025)
    proc.terminate(); proc.wait(timeout=5)
    raise RuntimeError('Server did not become ready')


def stop_server(proc):
    proc.terminate(); proc.wait(timeout=5)
    if proc.stderr: proc.stderr.close()


def request(url, method='GET', body=None):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as response:
        expected_status = 201 if method == 'POST' else 200
        if response.status != expected_status:
            raise AssertionError(f'{method} expected HTTP {expected_status}, got {response.status}')
        return response.status, json.load(response)


class MemoryHTTPTests(unittest.TestCase):
    def test_seeded_memory_http_and_server_isolation(self):
        # Explicitly ignore a developer's external DATABASE_URL for pre-E2E checks.
        with tempfile.TemporaryDirectory() as folder:
            proc, url = start_server(folder, 'sqlite+pysqlite:///:memory:')
            try:
                _, seeded = request(url + '/tasks/seed-planning')
                self.assertFalse(seeded['completed'])
                _, changed = request(url + '/tasks/' + seeded['id'], 'PATCH', {'completed': True})
                self.assertTrue(changed['completed'])
                self.assertEqual(request(url + '/tasks/' + seeded['id'])[1], changed)
                code, created = request(url + '/tasks', 'POST', {'title': '새 작업'})
                self.assertEqual(code, 201)
                self.assertEqual(request(url + '/tasks/' + created['id'])[1], created)
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request(url + '/tasks', 'POST', {'title': ''})
                self.assertEqual(error.exception.code, 400)
            finally: stop_server(proc)
            proc, url = start_server(folder, 'sqlite+pysqlite:///:memory:')
            try:
                self.assertFalse(request(url + '/tasks/seed-planning')[1]['completed'])
                with self.assertRaises(urllib.error.HTTPError) as error: request(url + '/tasks/' + created['id'])
                self.assertEqual(error.exception.code, 404)
            finally: stop_server(proc)
