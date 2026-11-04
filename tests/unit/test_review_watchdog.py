import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from proofstill.workflow import Harness, HarnessError
from tests.support import fake_codex, make_plan


class ReviewWatchdogTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.h = Harness(self.root, codex=fake_codex(self.root), review_timeout=3)
        self.h.init(make_plan(self.root))
        launcher = Path(self.h.codex)
        text = launcher.read_text()
        hook = """
from time import sleep
counter = root / 'launch-count'
attempt = int(counter.read_text()) + 1 if counter.exists() else 1
counter.write_text(str(attempt))
if attempt <= s.get('stall_attempts', 0):
    output = Path(sys.argv[sys.argv.index('--output-last-message') + 1])
    output.write_text('partial answer')
    print(json.dumps({'type': 'thread.started', 'thread_id': 'abandoned'}), flush=True)
    sleep(10)
if s.get('silent_thinking'):
    sleep(1.1)
if s.get('long_command'):
    item = {'type': 'command_execution', 'id': 'command-1'}
    print(json.dumps({'type': 'item.started', 'item': item}), flush=True)
    sleep(1.1)
    print(json.dumps({'type': 'item.completed', 'item': item}), flush=True)
"""
        launcher.write_text(text.replace('if s.get("process_fail"):', hook + '\nif s.get("process_fail"):'))

    def review(self, **behavior):
        (self.root / 'review_behavior.json').write_text(json.dumps(behavior))
        self.h.review_idle_timeout = .7
        self.h.review_retries = 1
        return self.h.review('counter', 'criteria')

    def attempts(self):
        record = self.h.load('counter')[1]['reviews']['criteria']
        return json.loads((Path(record['folder']) / 'attempts.json').read_text())

    def test_stall_retries_once_and_preserves_the_interrupted_output(self):
        result = self.review(stall_attempts=1)
        self.assertTrue(result['passed'])
        self.assertNotEqual(result['session'], 'abandoned')
        self.assertEqual([a['timeout'] for a in self.attempts()], ['idle', None])
        self.assertEqual((Path(result['folder']) / 'interrupted-answer.json').read_text(), 'partial answer')

    def test_second_stall_exhausts_the_retry(self):
        with self.assertRaisesRegex(HarnessError, '시간 초과'):
            self.review(stall_attempts=2)
        self.assertEqual([a['timeout'] for a in self.attempts()], ['idle', 'idle'])

    def test_running_command_and_failed_verdict_do_not_trigger_retry(self):
        with self.assertRaises(HarnessError):
            self.review(long_command=True, verdict='fail')
        self.assertEqual([a['timeout'] for a in self.attempts()], [None])

    def test_default_allows_silent_thinking_without_retry(self):
        (self.root / 'review_behavior.json').write_text(json.dumps({'silent_thinking': True}))
        result = self.h.review('counter', 'criteria')
        self.assertTrue(result['passed'])
        self.assertEqual(len(self.attempts()), 1)

    def test_wall_timeout_does_not_retry_by_default(self):
        self.h.review_timeout = .3
        (self.root / 'review_behavior.json').write_text(json.dumps({'stall_attempts': 2}))
        with self.assertRaisesRegex(HarnessError, '시간 초과'):
            self.h.review('counter', 'criteria')
        self.assertEqual([a['timeout'] for a in self.attempts()], ['wall'])
