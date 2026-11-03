import copy
import tempfile
import unittest
from pathlib import Path
from proofstill.trace import Flow
from proofstill.trace_check import verify_trace


class StateContractTests(unittest.TestCase):
    def make_trace(self, root, before=None, after=None):
        state = before or {'feature': 'orders', 'screen': 'edit', 'data': {'query': 'open', 'draft': {'amount': 8}}}
        after = after or {'feature': 'orders', 'screen': 'list', 'data': {'query': 'open', 'items': []}}
        path = root / 'flow.jsonl'
        with Flow('states', path=path) as flow:
            flow.transition('cancel', '수정 취소', lambda: (state.clear(), state.update(copy.deepcopy(after)), None)[-1], state=lambda: state)
        return path

    def contract(self):
        return {'state': {
            'screens': {'edit': {'feature': 'orders', 'required': ['query', 'draft']},
                        'list': {'feature': 'orders', 'required': ['query', 'items']},
                        'home': {'feature': 'home', 'required': []}},
            'transitions': [{'step': 0, 'from': 'edit', 'to': 'list', 'preserve': ['query'], 'drop': ['draft']}]
        }}

    def test_screen_ownership_preservation_and_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.make_trace(Path(tmp))
            result = verify_trace(path, self.contract())
            self.assertTrue(result['valid'], result['issues'])

    def test_leaked_fields_wrong_feature_missing_required_and_lost_query_fail(self):
        cases = [
            {'feature': 'orders', 'screen': 'list', 'data': {'query': 'open', 'items': [], 'draft': {'amount': 8}}},
            {'feature': 'home', 'screen': 'list', 'data': {'query': 'open', 'items': []}},
            {'feature': 'orders', 'screen': 'list', 'data': {'query': 'open'}},
            {'feature': 'orders', 'screen': 'list', 'data': {'query': '', 'items': []}},
            {'feature': 'home', 'screen': 'home', 'data': {'query': 'open'}},
        ]
        for after in cases:
            with self.subTest(after=after), tempfile.TemporaryDirectory() as tmp:
                self.assertFalse(verify_trace(self.make_trace(Path(tmp), after=after), self.contract())['valid'])

    def test_missing_transition_coverage_and_malformed_rules_do_not_silently_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.make_trace(Path(tmp))
            for broken in [None, {}, {'screens': {}, 'transitions': []},
                           {'screens': self.contract()['state']['screens'], 'transitions': []},
                           {'screens': self.contract()['state']['screens'], 'transitions': [{'step': 0, 'from': 'edit', 'to': 'list', 'preserve': 'query'}]}]:
                with self.subTest(broken=broken):
                    self.assertFalse(verify_trace(path, {'state': broken})['valid'])

    def test_state_contract_requires_observation_not_ordinary_output_claim(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'ordinary.jsonl'
            with Flow('fake', path=path) as flow:
                flow.step('cancel', '출력은 상태 관측을 대체하지 않는다', lambda: {'state': {'screen': 'list'}})
            self.assertFalse(verify_trace(path, self.contract())['valid'])

    def test_wrong_routes_and_explicit_drop_fail_independently_of_screen_shape(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.make_trace(Path(tmp))
            for key in ['from', 'to']:
                contract = self.contract()
                contract['state']['transitions'][0][key] = 'home'
                self.assertFalse(verify_trace(path, contract)['valid'])
        before = {'feature': 'orders', 'screen': 'edit', 'data': {'query': 'open', 'draft': {'amount': 8}, 'request': 1}}
        after = {'feature': 'orders', 'screen': 'list', 'data': {'query': 'open', 'items': [], 'request': 1}}
        with tempfile.TemporaryDirectory() as tmp:
            path = self.make_trace(Path(tmp), before, after)
            contract = self.contract()
            for screen in ['edit', 'list']:
                contract['state']['screens'][screen]['optional'] = ['request']
            self.assertTrue(verify_trace(path, contract)['valid'])
            contract['state']['transitions'][0]['drop'].append('request')
            self.assertFalse(verify_trace(path, contract)['valid'])
