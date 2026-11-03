import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import tempfile
import unittest
from tests import proofstill_cli
import urllib.error

from tests.integration.test_http import start_server, stop_server, request

PROJECT = Path(__file__).resolve().parents[4]


class MemoryFlowTests(unittest.TestCase):
    def test_parallel_cli_flows_have_separate_servers_data_and_records(self):
        with tempfile.TemporaryDirectory(prefix='proofstill-flow-') as temporary:
            instances = []
            try:
                for name in ['first', 'second']:
                    work = Path(temporary) / name
                    (work / '.api-tracker').mkdir(parents=True)
                    proc, base = start_server(work, 'sqlite+pysqlite:///:memory:')
                    instances.append((proc, base, work))
                    definition = json.loads((PROJECT / '.api-tracker/flow.yaml').read_text())
                    definition['baseUrl'] = base
                    definition['spec'] = str(PROJECT / 'packages/api/openapi.contract.json')
                    (work / '.api-tracker/flow.yaml').write_text(json.dumps(definition))
                self.assertNotEqual(instances[0][1], instances[1][1])

                def run(instance):
                    _, base, work = instance
                    result = subprocess.run(['node', str(proofstill_cli(PROJECT)),
                                             'tracker', 'flow', 'run'], cwd=work,
                                            capture_output=True, text=True, timeout=30)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    record = json.loads((work / '.api-tracker/flow-record.json').read_text())
                    self.assertEqual([step['status'] for step in record['steps']], ['passed'] * 3)
                    created = record['steps'][0]['attempts'][0]['response']['body']
                    saved = record['steps'][2]['attempts'][0]['response']['body']
                    self.assertEqual(saved['id'], created['id'])
                    self.assertTrue(saved['completed'])
                    self.assertEqual(record['steps'][1]['attempts'][0]['bindings'][0]['value'], created['id'])
                    self.assertEqual(request(base + '/tasks/' + saved['id'])[1], saved)
                    self.assertFalse(request(base + '/tasks/seed-planning')[1]['completed'])
                    return saved

                with ThreadPoolExecutor(max_workers=2) as pool:
                    saved = list(pool.map(run, instances))
                for index, (_, base, _) in enumerate(instances):
                    with self.assertRaises(urllib.error.HTTPError) as error:
                        request(base + '/tasks/' + saved[1 - index]['id'])
                    self.assertEqual(error.exception.code, 404)
                print('MEMORY_FLOW_VERIFIED: parallel CLI + real HTTP + seed + isolated data and records')
            finally:
                for proc, _, _ in instances:
                    stop_server(proc)
