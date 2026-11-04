import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

from proofstill.execution import configure, ExecutionControl
from proofstill.workflow import Harness
from tests.support import make_plan, fake_codex


class ExecutionControlTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.control = self.root / 'control.json'
        configure(self.control, minutes=10)

    def test_deadline_change_uses_original_start(self):
        before = json.loads(self.control.read_text())
        after = configure(self.control, minutes=.001)
        self.assertEqual(after['started_epoch'], before['started_epoch'])
        time.sleep(.07)
        self.assertEqual(ExecutionControl(self.control).reason(), 'deadline')

    def test_cancel_running_check_preserves_output_and_registry(self):
        timer = threading.Timer(.25, lambda: configure(self.control, cancel=True))
        timer.start()
        self.addCleanup(timer.join)
        result = Harness(self.root, run_control=self.control).execute(
            [sys.executable, '-c', 'import time; print("started", flush=True); time.sleep(10)'], 10)
        self.assertEqual(result['stop_reason'], 'cancelled')
        self.assertIn('started', result['stdout'])
        record = json.loads(next(self.root.glob('control.json.runs/*.json')).read_text())
        self.assertEqual(record['status'], 'cancelled')
        with self.assertRaises(ProcessLookupError):
            os.kill(record['pid'], 0)

    def test_missing_control_does_not_start_process(self):
        result = Harness(self.root, run_control=self.root / 'missing').execute([sys.executable, '-c', 'raise Exception()'], 1)
        self.assertEqual(result['stop_reason'], 'control_error')

    def test_parent_termination_cleans_review_group(self):
        path = make_plan(self.root)
        launcher = Path(fake_codex(self.root))
        launcher.write_text(launcher.read_text().replace('settings_path =',
            'import time\n(root / "child.pid").write_text(str(os.getpid()))\ntime.sleep(30)\nsettings_path ='))
        Harness(self.root).init(path)
        p = subprocess.Popen([sys.executable, str(Path(__file__).resolve().parents[2] / 'bin/proofstill'), '--root', str(self.root),
                              '--codex', str(launcher), '--run-control', str(self.control),
                              'review', 'counter', 'criteria'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(lambda: p.kill() if p.poll() is None else None)
        until = time.monotonic() + 3
        while not (self.root / 'child.pid').exists() and time.monotonic() < until:
            time.sleep(.02)
        self.assertTrue((self.root / 'child.pid').exists())
        child = int((self.root / 'child.pid').read_text())
        p.terminate()
        self.assertEqual(p.wait(timeout=3), 130)
        with self.assertRaises(ProcessLookupError):
            os.kill(child, 0)
