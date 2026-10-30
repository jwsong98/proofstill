import argparse
import json
import os
from pathlib import Path
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs, unquote
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from domain.health import health
from domain.tasks import TaskList
from infra.openapi import openapi_document
from infra.database import create_database, is_memory, migrate, seed, require_current
from infra.task_repository import TaskRepository


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--ready-file')
    parser.add_argument('--request-log')
    args = parser.parse_args()
    instance, seen, lock = str(uuid4()), set(), threading.Lock()
    token = os.environ.get('PROOFSTILL_SERVER_TOKEN')
    database = create_database(os.environ.get('DATABASE_URL') or 'sqlite+pysqlite:///:memory:')
    if is_memory(database):
        migrate(database)
        seed(database)
    else:
        require_current(database)
    tasks = TaskList(TaskRepository(database))

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, code, value):
            if args.request_log and not self.path.startswith(('/__proofstill/', '/openapi.json')):
                with open(args.request_log, 'a') as log:
                    log.write(json.dumps({'method': self.command, 'path': self.path, 'status': code, 'body': value}) + '\n')
            body = json.dumps(value).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Connection', 'close')
            self.close_connection = True
            self.end_headers()
            self.wfile.write(body)

        def owned(self):
            return token and self.headers.get('X-Proofstill-Token') == token

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path == '/__proofstill/owner':
                self.send_json(200 if self.owned() else 403, {'instance': instance})
                return
            if url.path == '/openapi.json':
                self.send_json(200, openapi_document())
                return
            if url.path.startswith('/tasks/'):
                self.task_request('get')
                return
            if url.path != '/health':
                self.send_json(404, {'error': 'Not found'})
                return
            previous = parse_qs(url.query).get('previous', [None])[0]
            with lock:
                if previous is not None and previous not in seen:
                    code, body = 400, {'error': 'Unknown previous request'}
                else:
                    code, request_id = 200, str(uuid4())
                    seen.add(request_id)
                    body = {**health(), 'instance': instance, 'requestId': request_id, 'previous': previous}
            self.send_json(code, body)

        def task_request(self, action):
            try:
                data = {}
                if action != 'get':
                    size = int(self.headers.get('Content-Length', '0'))
                    if size <= 0 or size > 1024 * 1024:
                        raise ValueError('Expected a JSON body up to 1 MiB')
                    data = json.loads(self.rfile.read(size))
                    if not isinstance(data, dict):
                        raise ValueError('Expected a JSON object')
                task_id = unquote(urlsplit(self.path).path.removeprefix('/tasks/'))
                with lock:
                    if action == 'create':
                        result = tasks.create(data.get('title'))
                    elif action == 'update':
                        result = tasks.update(task_id, data.get('completed'))
                    else:
                        result = tasks.get(task_id)
                self.send_json(201 if action == 'create' else 200, result)
            except KeyError:
                self.send_json(404, {'error': 'Task not found'})
            except (ValueError, UnicodeDecodeError) as error:
                self.send_json(400, {'error': str(error)})

        def do_PATCH(self):
            if urlsplit(self.path).path.startswith('/tasks/'):
                self.task_request('update')
            else:
                self.send_json(404, {'error': 'Not found'})

        def do_POST(self):
            if urlsplit(self.path).path == '/tasks':
                self.task_request('create')
                return
            if self.path == '/__proofstill/stop' and self.owned():
                self.send_json(200, {'ok': True})
                threading.Thread(target=server.shutdown, daemon=True).start()
            else:
                self.send_json(403, {'error': 'Not owned'})

        def log_message(self, *args):
            pass

    try:
        with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
            ready = {'pid': os.getpid(), 'baseUrl': f'http://127.0.0.1:{server.server_port}'}
            if args.ready_file:
                output = Path(args.ready_file)
                temporary = output.with_suffix('.tmp')
                temporary.write_text(json.dumps(ready))
                temporary.replace(output)
            else:
                print(json.dumps(ready), flush=True)
            server.serve_forever(poll_interval=0.05)
    finally:
        database.dispose()


if __name__ == '__main__':
    main()
