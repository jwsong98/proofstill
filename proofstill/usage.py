"""Cumulative Codex usage observations; missing telemetry is never zero consumption."""
import json
import os
import time
from pathlib import Path
from .execution import write_json

FIELDS = ('input_tokens', 'cached_input_tokens', 'output_tokens')


def normalize(value):
    if not isinstance(value, dict) or any(type(value.get(k)) is not int or value[k] < 0 for k in FIELDS):
        return None
    if value['cached_input_tokens'] > value['input_tokens']:
        return None
    return {k: value[k] for k in FIELDS}


class UsageTracker:
    def __init__(self, path, *, sessions=None, thread_id=None):
        self.path = Path(path)
        self.sessions = Path(sessions) if sessions else Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'sessions'
        self.thread_id = thread_id
        self.usage = None
        self.complete = False
        self.source = None
        self.rollout = None
        self.offset = 0
        self.next_poll = 0
        self.persist()

    def observe(self, event):
        if event.get('type') == 'thread.started':
            self.thread_id = event.get('thread_id')
            self.persist()
        if event.get('type') == 'turn.completed':
            usage = normalize(event.get('usage'))
            if usage is not None:
                self.usage, self.complete, self.source = usage, True, 'turn.completed'
                self.persist()

    def poll(self, *, force=False):
        if self.complete or not self.thread_id or (not force and time.monotonic() < self.next_poll):
            return
        self.next_poll = time.monotonic() + 1
        # Exact thread lookup, then incremental reads; no other conversation content is retained.
        if self.rollout is None and self.sessions.is_dir():
            self.rollout = next(self.sessions.glob(f'*/*/*/*{self.thread_id}.jsonl'), None)
        if self.rollout is None:
            return
        try:
            with self.rollout.open() as stream:
                stream.seek(self.offset)
                while True:
                    pos = stream.tell()
                    line = stream.readline()
                    if not line.endswith('\n'):
                        stream.seek(pos)
                        break
                    try:
                        event = json.loads(line)
                    except ValueError:
                        continue
                    payload = event.get('payload', {})
                    if event.get('type') != 'event_msg' or payload.get('type') != 'token_count':
                        continue
                    usage = normalize((payload.get('info') or {}).get('total_token_usage'))
                    if usage is not None:
                        self.usage, self.source = usage, 'local.token_count'
                self.offset = stream.tell()
            self.persist()
        except OSError:
            pass

    def snapshot(self):
        return {'thread_id': self.thread_id, 'semantics': 'thread_cumulative', 'usage': self.usage,
                'status': 'complete' if self.complete else 'partial' if self.usage else 'unknown', 'source': self.source}

    def persist(self):
        write_json(self.path, self.snapshot())


def aggregate_calls(calls):
    """Calls must be in execution order. A later snapshot includes any earlier gaps."""
    previous, totals = {}, {}
    for index, call in enumerate(calls):
        key = call['phase'] + ':' + call['role']
        group = totals.setdefault(key, {**dict.fromkeys(FIELDS, 0), 'completed_calls': 0,
                                        'missing_usage_calls': 0, 'partial_usage_calls': 0, 'running_calls': 0})
        if 'exit_code' in call:
            group['completed_calls'] += 1
        else:
            group['running_calls'] += 1
        observation = call.get('usage_observation') or {}
        raw = observation.get('usage')
        if raw is None and call.get('usage'):
            raw = call['usage'][-1]  # resume emits the thread total, not another charge.
        usage = normalize(raw)
        if usage is None:
            group['missing_usage_calls'] += 1
            continue
        identity = observation.get('thread_id') or call.get('thread_id') or f'unknown-call-{index}'
        before = previous.get(identity, dict.fromkeys(FIELDS, 0))
        if any(usage[k] < before[k] for k in FIELDS):
            group['missing_usage_calls'] += 1
            continue
        for field in FIELDS:
            group[field] += usage[field] - before[field]
        previous[identity] = usage
        if observation.get('status') in ('partial', 'unknown'):
            group['partial_usage_calls'] += 1
    return totals
