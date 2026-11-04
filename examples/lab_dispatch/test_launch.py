import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('launch', Path(__file__).with_name('launch.py'))
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)


class LaunchTest(unittest.TestCase):
    def test_one_visible_project_with_preserved_setup_and_resumable_session(self):
        with tempfile.TemporaryDirectory() as folder:
            root = (Path(folder) / 'run').resolve()
            launch.prepare(root)
            database = Path(folder) / 'console.sqlite'
            with sqlite3.connect(database) as db:
                db.executescript('''
                CREATE TABLE projects(id TEXT PRIMARY KEY,root_path TEXT,archived INTEGER DEFAULT 0);
                CREATE TABLE sessions(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id));
                CREATE TABLE session_context(session_id TEXT);
                CREATE TABLE executions(project_id TEXT REFERENCES projects(id),output TEXT);
                ''')
            calls = []
            def api(base, path, payload=None):
                calls.append((path, payload))
                with sqlite3.connect(database) as db:
                    if path == 'health': return {'ok': True}
                    if path == 'projects':
                        pid = 'setup' if payload['rootPath'].endswith('facilitator') else 'main'
                        db.execute('INSERT INTO projects(id,root_path) VALUES(?,?)', (pid, payload['rootPath']))
                        return {'id': pid, **payload}
                    if path.endswith('/evidence/file'):
                        self.assertTrue(path.startswith('projects/main/'))
                        self.assertNotIn('facilitator', payload['path'])
                        return {'id': payload['path']}
                    if path.endswith('/sessions'):
                        db.execute('INSERT INTO sessions VALUES(?,?)', ('session', 'setup'))
                        return {'id': 'session', 'projectId': 'setup'}
                    if path.endswith('/messages'):
                        db.execute('INSERT INTO executions VALUES(?,?)', ('setup', 'private setup output'))
                        return {}
                    if path == 'sessions/session':
                        return {'activeTurnId': None, 'messages': [{'role': 'assistant', 'content': '인사'}]}
                    raise AssertionError(path)
            original = launch.api
            launch.api = api
            try:
                launch.connect(root, 'http://127.0.0.1:7777', database)
                launch.connect(root, 'http://127.0.0.1:7777', database)
            finally:
                launch.api = original
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute('SELECT id FROM projects WHERE archived=0').fetchall(), [('main',)])
                self.assertEqual(db.execute('SELECT project_id FROM sessions').fetchall(), [('main',)])
                self.assertEqual(db.execute('SELECT * FROM executions').fetchall(), [('setup', 'private setup output')])
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
            self.assertEqual(sum(p.endswith('/messages') for p, _ in calls), 1)
            self.assertEqual(sum(p.endswith('/evidence/file') for p, _ in calls), 9)
            self.assertEqual(json.loads((root / launch.STATE_FILE).read_text())['stakeholder_session']['projectId'], 'main')
            self.assertFalse((root / 'workspace/policies.json').exists())
            with self.assertRaises(FileExistsError): launch.prepare(root)


if __name__ == '__main__':
    unittest.main()
