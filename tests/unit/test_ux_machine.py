import copy
import json
import tempfile
import unittest
from pathlib import Path
from examples.ux_save.demo import run
from proofstill.trace import Flow, TraceError
from proofstill.trace_check import verify_trace

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / 'examples/ux_save/expected.json').read_text())


class UXMachineTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.path, self.app = run(Path(tmp.name) / 'ux.jsonl')

    def check(self, expected=None):
        return verify_trace(self.path, EXPECTED if expected is None else expected)

    def rewrite(self, mutate):
        records = [json.loads(line) for line in self.path.read_text().splitlines()]
        mutate(records)
        self.path.write_text(''.join(json.dumps(r) + '\n' for r in records))

    def test_same_screen_distinct_ux_states_and_retry_follow_machine(self):
        result = self.check()
        self.assertTrue(result['valid'], result['issues'])
        self.assertEqual(result['state_machine']['unvisited_transitions'], [])
        self.assertEqual(result['steps'][0]['state']['before']['screen'], result['steps'][0]['state']['after']['screen'])
        self.assertEqual(result['steps'][1]['state']['after']['state_id'], 'failed')
        self.assertEqual(result['steps'][2]['transition_id'], 'retry')
        self.assertEqual(self.app.stored, {'name': '수정한 이름'})
        self.assertNotIn('draft', self.app.snapshot()['data'])

    def test_missing_unknown_or_wrong_transition_and_operation_are_rejected(self):
        original = self.path.read_text()
        for field, value in [('transition_id', None), ('transition_id', 'unknown'),
                             ('transition_id', 'retry'), ('operation', 'profile.other')]:
            with self.subTest(field=field, value=value):
                self.path.write_text(original)
                self.rewrite(lambda records: next(r for r in records if r['event'] == 'step.started').update({field: value}))
                self.assertFalse(self.check()['valid'])

    def test_graph_routes_initial_state_ownership_and_data_lifetime_are_enforced(self):
        def wrong_route(c): c['transitions']['submit']['to'] = 'failed'
        def wrong_initial(c): c['initial'] = 'saving'
        def wrong_screen(c): c['states']['saving']['screen'] = 'profile.detail'
        def wrong_owner(c): c['states']['saving']['feature'] = 'other'
        def forbidden_draft(c): c['states']['saving']['required'] = []
        def require_error(c): c['states']['saving']['required'].append('error')
        def lost_preserve(c): c['transitions']['save-succeeded']['preserve'] = ['draft']
        def retained_drop(c): c['transitions']['submit']['drop'] = ['draft']; c['transitions']['submit'].pop('preserve')
        for mutate in [wrong_route, wrong_initial, wrong_screen, wrong_owner, forbidden_draft, require_error, lost_preserve, retained_drop]:
            with self.subTest(case=mutate.__name__):
                expected = copy.deepcopy(EXPECTED)
                mutate(expected['state'])
                self.assertFalse(self.check(expected)['valid'])

    def test_snapshot_without_ux_id_does_not_substitute_screen_name(self):
        self.rewrite(lambda records: [r['state'].pop('state_id') for r in records if r['event'].startswith('step.state.')])
        self.assertFalse(self.check()['valid'])

    def test_unvisited_branches_are_reported_and_required_branches_fail(self):
        expected = copy.deepcopy(EXPECTED)
        expected['state']['transitions']['save-again'] = {'from': 'saved', 'to': 'saved', 'operation': 'profile.again'}
        result = self.check(expected)
        self.assertTrue(result['valid'], result['issues'])
        self.assertEqual(result['state_machine']['unvisited_transitions'], ['save-again'])
        expected['state']['required_transitions'].append('save-again')
        self.assertFalse(self.check(expected)['valid'])

    def test_malformed_graphs_fail_without_crashing(self):
        for patch in [{'initial': []}, {'states': []}, {'transitions': []}, {'required_transitions': 'submit'},
                      {'required_transitions': ['unknown']}, {'screens': {}},
                      {'states': {'editing': {'screen': 'edit'}}},
                      {'transitions': {'bad': {'from': [], 'to': 'saving', 'operation': 'x'}}},
                      {'transitions': {'bad': {'from': 'editing', 'to': 'saving', 'operation': 'x', 'preserve': ['x'], 'drop': ['x']}}}]:
            with self.subTest(patch=patch):
                expected = copy.deepcopy(EXPECTED)
                expected['state'].update(patch)
                self.assertFalse(self.check(expected)['valid'])

    def test_transition_id_cannot_be_attached_to_unobserved_step(self):
        with tempfile.TemporaryDirectory() as tmp:
            with Flow('invalid', path=Path(tmp) / 'invalid.jsonl') as flow:
                with self.assertRaises(TraceError):
                    flow.step('save', '실제 상태 필요', lambda: None, transition_id='submit')
                for bad in ['', 1, [], False]:
                    with self.assertRaises(TraceError):
                        flow.transition('save', '올바른 전이 ID 필요', lambda: None, state=self.app.snapshot, transition_id=bad)

    def test_non_state_steps_do_not_hide_missing_observation(self):
        self.rewrite(lambda records: [r.update(stateful=False) for r in records if r['event'] == 'step.started'])
        self.assertFalse(self.check()['valid'])
