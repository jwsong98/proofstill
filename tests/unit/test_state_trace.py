import json
import tempfile
import unittest
from pathlib import Path
from proofstill.trace import Flow, TraceError
from proofstill.trace_check import verify_trace


class StateTraceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'state.jsonl'
        self.state = {'feature': 'orders', 'screen': 'list', 'data': {'query': 'pending', 'items': [1]}}

    def test_records_actual_state_and_field_lifetimes_without_owning_state(self):
        def select(identifier):
            self.state['screen'] = 'detail'
            self.state['data'] = {'query': 'pending', 'selected': identifier}
            return {'selected': identifier}
        with Flow('states', path=self.path) as flow:
            result = flow.transition('select', '주문 선택', select, state=lambda: self.state, inputs={'identifier': 7})
        self.state['data']['query'] = 'mutated later'
        trace = verify_trace(self.path)
        self.assertTrue(trace['valid'], trace['issues'])
        recorded = trace['steps'][0]['state']
        self.assertEqual(recorded['before']['data'], {'query': 'pending', 'items': [1]})
        self.assertEqual(recorded['after']['data'], {'query': 'pending', 'selected': 7})
        self.assertEqual(recorded['delta'], {'created': ['selected'], 'retained': ['query'], 'changed': [], 'removed': ['items']})
        self.assertEqual(result.value, {'selected': 7})
        self.assertEqual(trace['steps'][0]['code']['line'], select.__code__.co_firstlineno)

    def test_failure_keeps_after_state_and_original_exception(self):
        def save():
            self.state['data']['error'] = 'offline'
            raise OSError('SAVE_OFFLINE')
        with self.assertRaisesRegex(OSError, 'SAVE_OFFLINE'):
            with Flow('failed-save', path=self.path) as flow:
                flow.transition('save', '저장 실패', save, state=lambda: self.state)
        trace = verify_trace(self.path, {'status': 'failed'})
        self.assertTrue(trace['valid'], trace['issues'])
        self.assertEqual(trace['steps'][0]['state']['after']['data']['error'], 'offline')
        self.assertEqual(trace['steps'][0]['error']['message'], 'SAVE_OFFLINE')

    def test_unobserved_mutation_breaks_state_chain(self):
        with Flow('gap', path=self.path) as flow:
            flow.transition('one', '첫 관찰', lambda: None, state=lambda: self.state)
            self.state['data']['query'] = 'unobserved'
            flow.transition('two', '다음 관찰', lambda: None, state=lambda: self.state)
        self.assertFalse(verify_trace(self.path)['valid'])

    def test_missing_duplicate_or_reordered_state_events_and_forged_delta_are_rejected(self):
        with Flow('tamper', path=self.path) as flow:
            flow.transition('one', '상태 관찰', lambda: self.state['data'].update(query='new'), state=lambda: self.state)
        original = [json.loads(line) for line in self.path.read_text().splitlines()]
        before = next(i for i, r in enumerate(original) if r['event'] == 'step.state.before')
        after = next(i for i, r in enumerate(original) if r['event'] == 'step.state.after')
        variants = [original[:after] + original[after + 1:], original[:before] + [original[before]] + original[before:],
                    original[:before] + [original[after], original[before]] + original[after + 1:]]
        forged = json.loads(json.dumps(original))
        forged[after]['delta']['changed'] = []
        variants.append(forged)
        for index, records in enumerate(variants):
            with self.subTest(index=index):
                for seq, record in enumerate(records):
                    record['sequence'] = seq
                self.path.write_text(''.join(json.dumps(record) + '\n' for record in records))
                self.assertFalse(verify_trace(self.path)['valid'])

    def test_non_json_or_invalid_state_is_a_failed_observation(self):
        for invalid in [[], {'feature': 'orders', 'screen': 'list', 'data': {'bad': object()}},
                        {'feature': 'orders', 'screen': 'list', 'data': {}, 'hidden': 1}]:
            with self.subTest(invalid=repr(invalid)), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / 'bad.jsonl'
                calls = []
                with self.assertRaises(TraceError):
                    with Flow('bad', path=path) as flow:
                        flow.transition('one', '관찰 실패', lambda: calls.append(1), state=lambda: invalid)
                self.assertEqual(calls, [])
                self.assertFalse(verify_trace(path)['valid'])
