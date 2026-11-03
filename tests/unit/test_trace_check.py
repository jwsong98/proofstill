import json
import tempfile
import unittest
from pathlib import Path
from proofstill.trace import Flow
from proofstill.trace_check import verify_trace


class TraceCheckTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'flow.jsonl'
        with Flow('lineage', context={'limit': 2}, path=self.path) as flow:
            found = flow.step('lookup', '조회', lambda: {'items': [4]})
            flow.step('execute', '조회값과 조건을 사용', lambda value, limit: value * limit,
                      inputs={'value': found.ref('/items/0'), 'limit': flow.context_ref('/limit')})
        self.expected = {
            'operations': ['lookup', 'execute'], 'status': 'completed',
            'assertions': [{'step': 1, 'field': 'output', 'path': '', 'equals': 8}],
            'links': [{'from': 0, 'to': 1, 'output': '/items/0', 'input': '/value'}],
        }

    def rewrite(self, change):
        records = [json.loads(line) for line in self.path.read_text().splitlines()]
        change(records)
        self.path.write_text(''.join(json.dumps(r) + '\n' for r in records))

    def test_expected_sequence_and_outcome_pass_but_wrong_flow_is_rejected(self):
        self.assertTrue(verify_trace(self.path, self.expected)['valid'])
        self.expected['operations'] = ['lookup', 'lookup', 'execute']
        self.assertFalse(verify_trace(self.path, self.expected)['valid'])

    def test_wrong_value_is_rejected_even_if_operations_match(self):
        self.expected['assertions'][0]['equals'] = 999
        self.assertFalse(verify_trace(self.path, self.expected)['valid'])

    def test_tampered_transferred_input_or_context_is_rejected(self):
        def tamper(records):
            event = next(r for r in records if r['event'] == 'step.inputs' and r['inputs'].get('value') == 4)
            event['inputs']['value'] = 999
        self.rewrite(tamper)
        self.assertFalse(verify_trace(self.path)['valid'])

    def test_forged_binding_to_future_or_missing_output_is_rejected(self):
        def tamper(records):
            event = next(r for r in records if r['event'] == 'step.inputs' and r['inputs'].get('value') == 4)
            event['bindings'][0]['step_id'] = 'nonexistent'
        self.rewrite(tamper)
        self.assertFalse(verify_trace(self.path)['valid'])

    def test_missing_finish_duplicate_step_and_invalid_json_are_rejected(self):
        original = self.path.read_text()
        self.path.write_text('\n'.join(original.splitlines()[:-1]) + '\n')
        self.assertFalse(verify_trace(self.path)['valid'])
        self.path.write_text(original + '{bad json}\n')
        self.assertFalse(verify_trace(self.path)['valid'])

    def test_literal_copy_does_not_satisfy_required_data_link(self):
        path = self.path.with_name('literal.jsonl')
        with Flow('literal', context={'limit': 2}, path=path) as flow:
            flow.step('lookup', '조회', lambda: {'items': [4]})
            flow.step('execute', '같은 값이어도 출처 없음', lambda value: value * 2, inputs={'value': 4})
        self.assertFalse(verify_trace(path, self.expected)['valid'])

    def test_context_snapshot_and_duplicate_step_are_checked(self):
        original = self.path.read_text()
        def context_tamper(records):
            event = [r for r in records if r['event'] == 'step.started'][1]
            event['context']['limit'] = 99
        self.rewrite(context_tamper)
        self.assertFalse(verify_trace(self.path)['valid'])
        self.path.write_text(original)
        def duplicate(records):
            starts = [r for r in records if r['event'] == 'step.started']
            starts[1]['step_id'] = starts[0]['step_id']
        self.rewrite(duplicate)
        self.assertFalse(verify_trace(self.path)['valid'])

    def test_future_reference_foreign_trace_and_event_order_are_rejected(self):
        original = self.path.read_text()
        mutations = []
        def future(records):
            first_inputs = next(r for r in records if r['event'] == 'step.inputs')
            second = [r for r in records if r['event'] == 'step.started'][1]
            first_inputs['inputs'] = {'value': 8}
            first_inputs['bindings'] = [{'input': '/value', 'source': 'step', 'step_id': second['step_id'], 'path': ''}]
        def foreign(records):
            records[2]['trace_id'] = 'another-trace'
        def missing_inputs(records):
            records.remove(next(r for r in records if r['event'] == 'step.inputs'))
        def duplicate_inputs(records):
            event = next(r for r in records if r['event'] == 'step.inputs')
            records.insert(records.index(event) + 1, dict(event))
        def finish_before_start(records):
            end = next(r for r in records if r['event'] == 'step.finished')
            records.remove(end)
            records.insert(1, end)
        for mutation in [future, foreign, missing_inputs, duplicate_inputs, finish_before_start]:
            self.path.write_text(original)
            self.rewrite(mutation)
            with self.subTest(mutation=mutation.__name__):
                self.assertFalse(verify_trace(self.path)['valid'])

    def test_non_object_records_and_non_json_numbers_are_invalid_not_crashes(self):
        for content in ['[]\n', 'null\n', '1\n']:
            self.path.write_text(content)
            with self.subTest(content=content):
                self.assertFalse(verify_trace(self.path)['valid'])
        # Non-finite values are not valid JSON and must not enter the UI payload.
        records = []
        other = self.path.with_name('finite.jsonl')
        with Flow('finite', path=other) as flow:
            flow.step('value', '값 조회', lambda: 1)
        records = [json.loads(line) for line in other.read_text().splitlines()]
        next(r for r in records if r['event'] == 'step.finished')['output'] = float('nan')
        self.path.write_text(''.join(json.dumps(r) + '\n' for r in records))
        self.assertFalse(verify_trace(self.path)['valid'])
