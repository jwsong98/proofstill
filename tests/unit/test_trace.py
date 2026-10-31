import json
import tempfile
import unittest
from pathlib import Path
from proofstill.trace import Flow, TraceError
from proofstill.trace_check import verify_trace


class TraceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'flow.jsonl'

    def test_executes_functions_with_output_and_context_references(self):
        received = []
        with Flow('조회 후 처리', context={'tenant': 'demo', 'multiplier': 2}, path=self.path) as flow:
            found = flow.step('lookup', '대상을 조회한다', lambda: {'items': [{'id': 1, 'amount': 10}]})
            merged = flow.step('merge', '조회 결과와 작업 조건을 합친다',
                               lambda item, multiplier: {'id': item['id'], 'amount': item['amount'] * multiplier},
                               inputs={'item': found.ref('/items/0'), 'multiplier': flow.context_ref('/multiplier')})
            flow.step('execute', '결합한 데이터로 기능을 실행한다', lambda payload: received.append(payload) or payload,
                      inputs={'payload': merged.ref()}, ui={'screen': 'orders', 'action': '처리하기', 'element': '#process'})
        result = verify_trace(self.path)
        self.assertTrue(result['valid'], result['issues'])
        self.assertEqual(received, [{'id': 1, 'amount': 20}])
        self.assertEqual([s['operation'] for s in result['steps']], ['lookup', 'merge', 'execute'])
        self.assertEqual(result['steps'][1]['inputs']['multiplier'], 2)
        self.assertEqual(result['steps'][2]['ui']['element'], '#process')
        self.assertEqual(result['steps'][1]['description'], '조회 결과와 작업 조건을 합친다')
        self.assertGreaterEqual(result['steps'][0]['duration_ms'], 0)

    def test_snapshots_are_not_mutated_by_callers_or_later_steps(self):
        original = {'items': [1]}
        context = {'policy': {'limit': 1}}
        with Flow('snapshots', context=context, path=self.path) as flow:
            first = flow.step('first', '원본 조회', lambda: original)
            original['items'].append(2)
            context['policy']['limit'] = 99
            flow.step('mutator', '별도 복사본에서 처리', lambda data: data['items'].append(3), inputs={'data': first.ref()})
        steps = verify_trace(self.path)['steps']
        self.assertEqual(steps[0]['output'], {'items': [1]})
        self.assertEqual(steps[1]['inputs'], {'data': {'items': [1]}})
        self.assertEqual(steps[0]['context'], {'policy': {'limit': 1}})

    def test_context_versions_and_repeated_operations_are_distinct(self):
        with Flow('repeat', context={'cursor': 0}, path=self.path) as flow:
            flow.step('query', '첫 조회', lambda cursor: cursor, inputs={'cursor': flow.context_ref('/cursor')})
            flow.set_context({'cursor': 1})
            flow.step('query', '현재 컨텍스트로 재조회', lambda cursor: cursor, inputs={'cursor': flow.context_ref('/cursor')})
        result = verify_trace(self.path)
        self.assertTrue(result['valid'], result['issues'])
        first, second = result['steps']
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual([first['output'], second['output']], [0, 1])
        self.assertEqual([first['context_version'], second['context_version']], [0, 1])

    def test_function_failure_is_recorded_and_propagated(self):
        with self.assertRaisesRegex(ValueError, 'BAD_ORDER'):
            with Flow('failure', path=self.path) as flow:
                flow.step('save', '잘못된 주문 저장 시도', lambda: (_ for _ in ()).throw(ValueError('BAD_ORDER')))
        result = verify_trace(self.path)
        self.assertFalse(result['valid'])
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['steps'][0]['error']['type'], 'ValueError')
        self.assertEqual(result['steps'][0]['error']['message'], 'BAD_ORDER')
        expected = {'operations': ['save'], 'status': 'failed', 'assertions': [], 'links': []}
        self.assertTrue(verify_trace(self.path, expected)['valid'])

    def test_foreign_references_and_missing_paths_do_not_execute_function(self):
        other_path = self.path.with_name('other.jsonl')
        with Flow('other', path=other_path) as other:
            foreign = other.step('read', '다른 흐름 조회', lambda: {'id': 1})
        calls = []
        with self.assertRaises(TraceError):
            with Flow('own', path=self.path) as flow:
                flow.step('write', '다른 흐름의 값은 거부', lambda data: calls.append(data), inputs={'data': foreign.ref()})
        self.assertEqual(calls, [])
        self.assertEqual(verify_trace(self.path)['steps'][0]['status'], 'failed')

    def test_does_not_overwrite_trace_or_accept_empty_descriptions(self):
        with Flow('one', path=self.path) as flow:
            flow.step('read', '조회', lambda: None)
        original = self.path.read_bytes()
        with self.assertRaises(TraceError):
            Flow('two', path=self.path)
        self.assertEqual(self.path.read_bytes(), original)
        with Flow('three', path=self.path.with_name('three.jsonl')) as flow:
            with self.assertRaises(TraceError):
                flow.step('read', '', lambda: None)

    def test_missing_reference_path_is_logged_without_calling_function(self):
        calls = []
        with self.assertRaises(TraceError):
            with Flow('missing path', path=self.path) as flow:
                found = flow.step('lookup', '조회', lambda: {'id': 1})
                flow.step('execute', '존재하지 않는 값은 실행하지 않는다', lambda value: calls.append(value), inputs={'value': found.ref('/missing')})
        self.assertEqual(calls, [])
        self.assertEqual(verify_trace(self.path)['steps'][-1]['status'], 'failed')
