import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from backend_support import backend_python

ROOT = Path(__file__).resolve().parents[2]


class MemoryFlowCommandTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='proofstill-flow-command-')
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name)
        self.project = self.folder / 'project'
        result = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'scaffold', str(self.project)],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        # Reuse installed JS dependencies, without installing or copying a source tree.
        (self.project / '.proofstill-runtime/node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        self.scratch = self.folder / 'scratch'
        self.scratch.mkdir()
        self.env = dict(os.environ, PROOFSTILL_BACKEND_PYTHON=backend_python(),
                        PYTHONDONTWRITEBYTECODE='1', TMPDIR=str(self.scratch),
                        DATABASE_URL='postgresql+psycopg://invalid@127.0.0.1:1/do-not-use')
        self.record = self.project / '.api-tracker/flow-record.json'
        self.record.write_text('developer-owned-record')

    def launch(self, command='test:flow'):
        return subprocess.Popen(['npm', 'run', command], cwd=self.project, env=self.env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def test_fast_runs_unit_http_and_cli_without_docker_or_external_database(self):
        command = self.launch('test:fast')
        stdout, stderr = command.communicate(timeout=60)
        self.assertEqual(command.returncode, 0, stdout + stderr)
        self.assertIn('MEMORY_FLOW_VERIFIED', stdout)
        self.assertIn('test_seeded_memory_http_and_server_isolation', stderr)
        self.assertEqual(self.record.read_text(), 'developer-owned-record')

    def test_two_commands_use_memory_and_leave_shared_state_untouched(self):
        commands = [self.launch(), self.launch()]
        try:
            for command in commands:
                stdout, stderr = command.communicate(timeout=60)
                self.assertEqual(command.returncode, 0, stdout + stderr)
                self.assertIn('MEMORY_FLOW_VERIFIED', stdout)
        finally:
            for command in commands:
                if command.poll() is None:
                    command.kill(); command.communicate()
        self.assertEqual(self.record.read_text(), 'developer-owned-record')
        self.assertEqual(list(self.scratch.glob('proofstill-flow-*')), [])
        self.assertFalse((self.project / '.api-tracker/flow.lock').exists())

    def test_wrong_expected_response_fails_and_cleans_temporary_state(self):
        flow = self.project / '.api-tracker/flow.yaml'
        definition = json.loads(flow.read_text())
        definition['steps'][0]['expect']['status'] = 418
        flow.write_text(json.dumps(definition))
        command = self.launch()
        stdout, stderr = command.communicate(timeout=60)
        self.assertNotEqual(command.returncode, 0, stdout + stderr)
        self.assertNotIn('MEMORY_FLOW_VERIFIED', stdout)
        self.assertIn('Expected HTTP 418, received 201', stdout + stderr)
        self.assertEqual(list(self.scratch.glob('proofstill-flow-*')), [])
        self.assertEqual(self.record.read_text(), 'developer-owned-record')
