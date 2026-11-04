import json
import tempfile
import unittest
from pathlib import Path
from proofstill.usage import UsageTracker, aggregate_calls


def usage(i, c, o):
    return dict(input_tokens=i, cached_input_tokens=c, output_tokens=o)


def call(thread, counts, phase='exam', **extra):
    return dict(thread_id=thread, phase=phase, role='stakeholder', exit_code=0,
                usage=[counts] if counts else [], **extra)


class UsageTests(unittest.TestCase):
    def test_resume_counts_deltas_and_excludes_setup(self):
        out = aggregate_calls([call('a', usage(100, 60, 10), 'setup'),
                               call('a', usage(150, 90, 20)), call('a', usage(180, 110, 25)),
                               call('b', usage(20, 0, 3))])
        self.assertEqual({k: out['exam:stakeholder'][k] for k in usage(0, 0, 0)}, usage(100, 50, 18))
        self.assertEqual(out['setup:stakeholder']['input_tokens'], 100)

    def test_missing_duplicate_and_decreasing_observations(self):
        out = aggregate_calls([call('a', usage(100, 60, 10)), call('a', None),
                               call('a', usage(100, 60, 10)), call('a', usage(90, 50, 9)),
                               call('a', usage(150, 90, 15))])['exam:stakeholder']
        self.assertEqual(out['input_tokens'], 150)
        self.assertEqual(out['missing_usage_calls'], 2)

    def test_partial_usage_is_a_lower_bound(self):
        out = aggregate_calls([call('a', None, usage_observation={
            'thread_id': 'a', 'status': 'partial', 'usage': usage(10, 0, 2)})])['exam:stakeholder']
        self.assertEqual(out['partial_usage_calls'], 1)
        self.assertEqual(out['input_tokens'], 10)

    def test_tracker_recovers_cancelled_turn_without_storing_conversation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            session = root / 'sessions/2026/11/04/rollout-thread-1.jsonl'
            session.parent.mkdir(parents=True)
            token = {'type': 'event_msg', 'payload': {'type': 'token_count', 'info': {'total_token_usage': usage(100, 50, 10)}}}
            session.write_text(json.dumps({'type': 'secret', 'text': 'do not retain'}) + '\n' + json.dumps(token) + '\n')
            tracker = UsageTracker(root / 'usage.json', sessions=root / 'sessions')
            tracker.observe({'type': 'thread.started', 'thread_id': 'thread-1'})
            tracker.poll(force=True)
            record = json.loads((root / 'usage.json').read_text())
            self.assertEqual(record['status'], 'partial')
            self.assertEqual(record['usage'], usage(100, 50, 10))
            self.assertNotIn('do not retain', (root / 'usage.json').read_text())
            tracker.observe({'type': 'turn.completed', 'usage': usage(150, 80, 20)})
            tracker.poll(force=True)
            self.assertEqual(tracker.snapshot()['status'], 'complete')
            self.assertEqual(tracker.usage, usage(150, 80, 20))

    def test_absent_rollout_is_unknown(self):
        with tempfile.TemporaryDirectory() as temp:
            tracker = UsageTracker(Path(temp) / 'usage.json', sessions=Path(temp) / 'missing', thread_id='a')
            tracker.poll(force=True)
            self.assertIsNone(tracker.usage)
            self.assertEqual(tracker.snapshot()['status'], 'unknown')

    def test_live_call_reports_observed_usage_without_marking_complete(self):
        item = call('a', None, usage_observation={'thread_id': 'a', 'status': 'partial', 'usage': usage(12, 2, 1)})
        del item['exit_code']
        out = aggregate_calls([item])['exam:stakeholder']
        self.assertEqual(out['completed_calls'], 0)
        self.assertEqual(out['running_calls'], 1)
        self.assertEqual(out['input_tokens'], 12)
