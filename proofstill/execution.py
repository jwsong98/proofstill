"""Cooperative deadlines and cancellation shared by a run and its child processes."""
import json
import os
import signal
import subprocess
import tempfile
import time
import uuid
from pathlib import Path


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        temporary = Path(stream.name)
    temporary.replace(path)


def configure(path, *, minutes=None, cancel=False):
    path = Path(path).resolve()
    state = json.loads(path.read_text()) if path.exists() else {'started_epoch': time.time()}
    if minutes is not None:
        if not isinstance(minutes, (int, float)) or not 0 < minutes <= 10080:
            raise ValueError('minutes must be positive and at most 10080')
        state['deadline_epoch'] = state['started_epoch'] + minutes * 60
    if cancel:
        state['cancelled'] = True
    write_json(path, state)
    return state


def stop_process(process):
    # The group may still own a child after its leader has exited.
    for sig, grace in [(signal.SIGINT, .4), (signal.SIGTERM, .4), (signal.SIGKILL, .1)]:
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            break
        try:
            process.wait(timeout=grace)
        except subprocess.TimeoutExpired:
            continue
        # Reap remaining members even if the leader handled the signal first.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        break
    process.wait()


class ExecutionControl:
    def __init__(self, path=None):
        value = path or os.environ.get('PROOFSTILL_RUN_CONTROL')
        self.path = Path(value).resolve() if value else None
        self.record = None
        self.state = {}

    def environment(self):
        return {'PROOFSTILL_RUN_CONTROL': str(self.path)} if self.path else {}

    def reason(self):
        if not self.path:
            return None
        try:
            state = json.loads(self.path.read_text())
            if state.get('cancelled'):
                return 'cancelled'
            if state.get('deadline_epoch') is not None and time.time() >= float(state['deadline_epoch']):
                return 'deadline'
        except (OSError, ValueError, TypeError):
            return 'control_error'
        return None

    def register(self, process, role):
        if self.path:
            self.record = self.path.parent / (self.path.name + '.runs') / (uuid.uuid4().hex + '.json')
            self.state = {'pid': process.pid, 'parent_pid': os.getpid(), 'role': role,
                          'started_epoch': time.time(), 'status': 'running', 'usage': None}
            write_json(self.record, self.state)

    def update(self, **values):
        if self.record:
            self.state.update(values)
            write_json(self.record, self.state)

    def finish(self, reason, exit_code):
        self.update(status=reason or 'finished', exit_code=exit_code, finished_epoch=time.time())
