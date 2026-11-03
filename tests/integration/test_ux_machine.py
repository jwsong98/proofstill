import copy
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from proofstill.trace_check import verify_trace
from proofstill.workflow import Harness
from tests.support import make_plan

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = json.loads((ROOT / 'examples/ux_save/expected.json').read_text())


class UXMachineIntegrationTests(unittest.TestCase):
    def test_cli_collects_actual_machine_and_rejects_wrong_contract_despite_zero_exit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            definition = make_plan(root)
            plan = json.loads(definition.read_text())
            plan['checks'][0]['trace_expectation'] = 'tests/expected.json'
            definition.write_text(json.dumps(plan))
            (root / 'tests/expected.json').write_text(json.dumps(EXPECTED))
            (root / 'tests/check.py').write_text(
                f'import sys; sys.path.insert(0, {str(ROOT)!r})\n'
                'from examples.ux_save.demo import run\n'
                'run()\nprint("CHECK_EXECUTED")\n')
            harness = Harness(root)
            harness.init(definition)
            passed = harness.run('counter')[0]
            self.assertTrue(passed['accepted'], passed)
            self.assertEqual(passed['traces'][0]['state_machine']['unvisited_transitions'], [])
            # A different, frozen contract must reject the same successful process.
            bad = copy.deepcopy(EXPECTED)
            bad['state']['transitions']['submit']['to'] = 'saved'
            (root / 'tests/expected.json').write_text(json.dumps(bad))
            plan['id'] = 'wrong-machine'
            definition.write_text(json.dumps(plan))
            harness.init(definition)
            rejected = harness.run('wrong-machine')[0]
            self.assertEqual(rejected['exit_code'], 0)
            self.assertFalse(rejected['accepted'])
            self.assertFalse(rejected['traces'][0]['valid'])

    def test_scaffold_runtime_includes_runnable_machine_example(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'project'
            result = subprocess.run(['node', str(ROOT / 'bin/proofstill.mjs'), 'scaffold', str(target), '--apps', 'app'],
                                    text=True, capture_output=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr)
            runtime = target / '.proofstill-runtime'
            trace_dir = Path(tmp) / 'traces'
            result = subprocess.run(['python3', '-m', 'examples.ux_save.demo'], cwd=runtime,
                                    env=dict(os.environ, PROOFSTILL_TRACE_DIR=str(trace_dir)),
                                    text=True, capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stderr)
            path = Path(result.stdout.strip())
            self.assertEqual(path.parent, trace_dir)
            expected = json.loads((runtime / 'examples/ux_save/expected.json').read_text())
            checked = verify_trace(path, expected)
            self.assertTrue(checked['valid'], checked['issues'])
            cli = subprocess.run(['python3', '-m', 'proofstill', 'trace', 'verify', str(path), '--expect',
                                  str(runtime / 'examples/ux_save/expected.json')], cwd=runtime,
                                 text=True, capture_output=True, timeout=20)
            self.assertEqual(cli.returncode, 0, cli.stderr)
            self.assertEqual(json.loads(cli.stdout)['state_machine']['unvisited_transitions'], [])
