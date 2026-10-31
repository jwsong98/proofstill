import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import urllib.request

from backend_support import backend_python

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'bin/proofstill.mjs'


class SingleFlowTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue((ROOT / 'bootstrap/flow.mjs').is_file(), 'SINGLE_FLOW_MISSING')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / 'project'
        self.call('scaffold', str(self.project), cwd=ROOT)
        self.flow_file = self.project / '.api-tracker/flow.yaml'
        self.record_file = self.project / '.api-tracker/flow-record.json'
        self.flow = json.loads(self.flow_file.read_text())
        # Use the generated Python server directly; installed adapter wiring is covered by test_install.
        ready = Path(self.temp.name) / 'ready.json'
        self.log = Path(self.temp.name) / 'http.jsonl'
        import time
        self.server = subprocess.Popen([backend_python(), 'apps/backend/infra/server.py', '--port', '0',
                                       '--ready-file', str(ready), '--request-log', str(self.log)],
                                      cwd=self.project, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                      env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1', DATABASE_URL='sqlite+pysqlite:///:memory:'))
        self.addCleanup(self.stop_server)
        for _ in range(100):
            if ready.exists(): break
            time.sleep(.02)
        self.base_url = json.loads(ready.read_text())['baseUrl']
        self.flow['baseUrl'] = self.base_url
        self.save_flow()

    def stop_server(self):
        self.server.terminate()
        self.server.wait(timeout=5)

    def save_flow(self):
        self.flow_file.write_text(json.dumps(self.flow, ensure_ascii=False))

    def call(self, *args, cwd=None, ok=True):
        p = subprocess.run(['node', str(CLI), *args], cwd=cwd or self.project,
                           capture_output=True, text=True, timeout=30)
        if ok: self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        else: self.assertNotEqual(p.returncode, 0, p.stdout + p.stderr)
        return p.stdout + p.stderr

    def track(self, *args, **kwargs):
        return self.call('tracker', *args, **kwargs)

    def records(self):
        return json.loads(self.record_file.read_text())

    def calls(self):
        return self.log.read_text() if self.log.exists() else ''

    def test_narrative_step_resume_and_actual_output_links(self):
        shown = self.track('flow', 'show')
        self.assertNotIn('session', shown.lower())
        self.assertEqual(len(self.flow['steps']), 3)
        for step in self.flow['steps']:
            for key in ['title', 'description', 'expected']:
                self.assertTrue(step[key].strip())
                self.assertIn(step[key], shown)
        self.track('flow', 'validate')
        self.track('flow', 'step', 'complete_task', ok=False)
        self.assertEqual(self.calls(), '')
        self.track('flow', 'step', 'create_task')
        first = self.records()['steps'][0]
        task_id = first['attempts'][0]['response']['body']['id']
        self.assertEqual(first['status'], 'passed')
        before = self.calls()
        self.track('flow', 'step', 'create_task', ok=False)
        self.assertEqual(self.calls(), before)
        self.track('flow', 'run')
        records = self.records()['steps']
        self.assertEqual([s['status'] for s in records], ['passed'] * 3)
        self.assertEqual([s['id'] for s in records], ['create_task', 'complete_task', 'read_task'])
        for step, record in zip(self.flow['steps'], records):
            self.assertEqual(record['title'], step['title'])
            self.assertEqual(record['description'], step['description'])
            self.assertEqual(record['expected'], step['expected'])
        for record in records[1:]:
            attempt = record['attempts'][0]
            self.assertIn(task_id, attempt['request']['url'])
            self.assertEqual(attempt['bindings'], [{'target': '/path/id', 'from': 'create_task', 'pointer': '/id', 'value': task_id}])
            self.assertEqual(attempt['response']['body']['id'], task_id)
            self.assertTrue(attempt['response']['body']['completed'])
        logs = [json.loads(line) for line in self.calls().splitlines()]
        self.assertEqual([v['method'] for v in logs], ['POST', 'PATCH', 'GET'])
        for record, logged in zip(records, logs):
            self.assertEqual(record['attempts'][0]['response']['body'], logged['body'])
        before = self.calls()
        self.track('flow', 'run')
        self.assertEqual(self.calls(), before, 'Completed steps must not be replayed')
        shown = self.track('flow', 'show')
        self.assertIn('완료', shown)
        self.assertIn(task_id, shown)
        for step in self.flow['steps']:
            for key in ['title', 'description', 'expected']:
                self.assertIn(step[key], shown)
        for detail in ['POST', '/tasks', '201', 'create_task', '/id',
                       '"title": "발표 자료 준비"', '"completed": true']:
            self.assertIn(detail, shown)
        self.assertFalse((self.project / '.api-tracker/sessions').exists())
        self.assertEqual({p.name for p in (self.project / '.api-tracker').iterdir()},
                         {'config.yaml', 'flow.yaml', 'flow-record.json'})
        self.track('flow', 'reset')
        self.assertFalse(self.record_file.exists())
        self.assertEqual(self.calls(), before, 'Reset clears local records, not backend data')

    def test_rejects_session_surface_and_malformed_definitions_before_http(self):
        help_text = self.track('flow', '--help')
        self.assertIn('flow {run|step <id>|show|validate|reset|retry}', help_text)
        self.assertNotIn('session', help_text.lower())
        for args in [('session', 'list'), ('view', 'session'), ('flow', 'run', '--session', 'x'),
                     ('flow', 'run', '--session=x'), ('flow', 'run', '-s', 'x'), ('flow', 'start'),
                     ('action', 'run'), ('scenario', 'run'), ('replay',), ('flow', 'inputs'),
                     ('flow', 'unknown'), ('flow', 'show', '--unknown')]:
            self.track(*args, ok=False)
        original = json.loads(json.dumps(self.flow))
        mutations = [lambda f: f['steps'][0].update(description=''),
                     lambda f: f['steps'][1].update(id='create_task'),
                     lambda f: f['steps'][0].update(operationId='missing'),
                     lambda f: f['steps'][0].update(input={'path': {'id': {'from': 'read_task', 'pointer': '/id'}}}),
                     lambda f: f['steps'][1].update(input={'path': {'id': {'from': 'unknown', 'pointer': '/id'}}})]
        for mutate in mutations:
            self.flow = json.loads(json.dumps(original)); mutate(self.flow); self.save_flow()
            self.track('flow', 'run', ok=False)
            self.assertEqual(self.calls(), '')

    def test_response_mismatch_stops_and_explicit_retry_preserves_failure(self):
        self.flow['steps'][0]['expect']['body']['/completed'] = True
        self.save_flow()
        self.track('flow', 'run', ok=False)
        state = self.records()
        self.assertEqual([s['status'] for s in state['steps']], ['failed', 'pending', 'pending'])
        self.assertIn('response', state['steps'][0]['attempts'][0])
        before = self.calls()
        self.track('flow', 'run', ok=False)
        self.assertEqual(self.calls(), before, 'Failed writes require explicit retry')
        self.track('flow', 'retry', ok=False)
        self.assertEqual(len(self.records()['steps'][0]['attempts']), 2)
        self.assertEqual(len(self.calls().splitlines()), 2)

    def test_missing_observed_value_and_changed_definition_fail_closed(self):
        self.flow['steps'][1]['input']['path']['id']['pointer'] = '/notThere'
        self.save_flow()
        self.track('flow', 'run', ok=False)
        self.assertEqual(len(self.calls().splitlines()), 1)
        self.assertEqual(self.records()['steps'][1]['status'], 'failed')
        self.flow['steps'][1]['input']['path']['id']['pointer'] = '/id'
        self.save_flow()
        before = self.calls()
        self.assertIn('reset', self.track('flow', 'run', ok=False))
        self.assertEqual(self.calls(), before)

    def test_lock_and_interrupted_attempt_are_never_silently_replayed(self):
        lock = self.project / '.api-tracker/flow.lock'
        lock.write_text('busy')
        self.track('flow', 'run', ok=False)
        self.track('flow', 'reset', ok=False)
        self.assertEqual(self.calls(), '')
        lock.unlink()
        self.track('flow', 'step', 'create_task')
        state = self.records(); state['steps'][1]['status'] = 'running'
        self.record_file.write_text(json.dumps(state))
        before = self.calls()
        self.track('flow', 'run', ok=False)
        self.assertEqual(self.calls(), before)

    def test_network_failure_is_recorded_and_readable(self):
        self.stop_server()
        self.track('flow', 'run', ok=False)
        record = self.records()['steps'][0]
        self.assertEqual(record['status'], 'failed')
        self.assertTrue(record['attempts'][0]['error'])
        self.assertIn('실패', self.track('flow', 'show'))

    def test_overlapping_processes_only_one_can_call_and_record(self):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        import threading
        entered, release = threading.Event(), threading.Event()
        calls = []
        class Slow(BaseHTTPRequestHandler):
            def do_POST(handler):
                calls.append(handler.path)
                entered.set()
                release.wait(15)
                body = b'{"id":"concurrent-task","title":"test","completed":false}'
                handler.send_response(201)
                handler.send_header('Content-Length', str(len(body)))
                handler.end_headers(); handler.wfile.write(body)
            def log_message(self, *args): pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Slow)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        self.flow['baseUrl'] = f'http://127.0.0.1:{server.server_port}'; self.save_flow()
        first = subprocess.Popen(['node', str(CLI), 'tracker', 'flow', 'step', 'create_task'],
                                 cwd=self.project, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertTrue(entered.wait(10), 'First process must reach real HTTP')
            self.track('flow', 'step', 'create_task', ok=False)
            self.assertEqual(len(calls), 1)
        finally:
            release.set()
            stdout, stderr = first.communicate(timeout=20)
            server.shutdown(); server.server_close(); thread.join()
        self.assertEqual(first.returncode, 0, stdout + stderr)
        self.assertEqual(len(self.records()['steps'][0]['attempts']), 1)
        self.assertFalse((self.project / '.api-tracker/flow.lock').exists())


if __name__ == '__main__':
    unittest.main()
