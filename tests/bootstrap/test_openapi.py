import json
import copy
import http.server
import threading
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'bin/proofstill.mjs'
SPEC = {'openapi': '3.0.3', 'info': {'title': 'Fixture', 'version': '1'}, 'paths': {'/ping': {'get': {'operationId': 'ping', 'responses': {'200': {'description': 'OK'}}}}}}


class OpenAPITests(unittest.TestCase):
    def call(self, root, *args):
        self.assertTrue((ROOT / 'bootstrap/openapi.mjs').is_file(), 'OPENAPI_EXPORT_MISSING: exporter implementation is required')
        self.assertTrue(CLI.is_file(), 'OPENAPI_EXPORT_MISSING: npm CLI is required')
        return subprocess.run(['node', str(CLI), 'openapi', 'export', *map(str, args)], cwd=root, capture_output=True, text=True)

    def test_file_export_and_invalid_input_preserve_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source, output = root / 'source.json', root / 'out/spec.json'
            source.write_text(json.dumps(SPEC))
            result = self.call(root, '--file', source, '--output', output)
            self.assertEqual(result.returncode, 0, 'OPENAPI_EXPORT_MISSING: ' + result.stderr)
            self.assertEqual(json.loads(output.read_text()), SPEC)
            before = output.read_bytes()
            for document in [{'openapi': '3.0.3', 'paths': {}}, dict(SPEC, paths={'/bad': {'get': {'operationId': 'bad'}}})]:
                source.write_text(json.dumps(document))
                self.assertNotEqual(self.call(root, '--file', source, '--output', output).returncode, 0)
                self.assertEqual(output.read_bytes(), before)
                self.assertEqual(list(output.parent.iterdir()), [output])
            source.write_text('{broken json')
            self.assertNotEqual(self.call(root, '--file', source, '--output', output).returncode, 0)
            self.assertEqual(output.read_bytes(), before)
            self.assertEqual(list(output.parent.iterdir()), [output])
            self.assertNotEqual(self.call(root, '--file', source, '--url', 'http://127.0.0.1:1', '--output', output).returncode, 0)
            self.assertEqual(output.read_bytes(), before)
            self.assertEqual(list(output.parent.iterdir()), [output])

    def test_openapi_structural_errors_are_rejected(self):
        invalid = []
        for change in [
            lambda d: d.update({'openapi': 'not-a-version'}),
            lambda d: d['info'].update({'title': 123}),
            lambda d: d['info'].update({'version': ['invalid']}),
            lambda d: d['paths']['/ping'].update({'get': 'not-an-operation'}),
            lambda d: d['paths'].update({'bad-path': d['paths'].pop('/ping')}),
            lambda d: d['paths'].update({'/ping': 'not-a-path-item'}),
            lambda d: d['paths']['/ping'].update({'invalidMethod': {}}),
            lambda d: d['paths']['/ping']['get'].update({'responses': {'wrong-status': {'description': 'x'}}}),
            lambda d: d['paths']['/ping']['get'].update({'parameters': [{'name': 'q', 'in': 'unknown', 'schema': {'type': 'string'}}]}),
            lambda d: d['paths']['/ping']['get'].update({'parameters': [{'name': 'q', 'in': 'query', 'schema': {'type': 'invalid-type'}}]}),
            lambda d: d['paths']['/ping']['get'].update({'responses': {'200': {'description': 'x', 'content': {'application/json': {'schema': {'$ref': '#/components/schemas/Missing'}}}}}}),
        ]:
            doc = copy.deepcopy(SPEC)
            change(doc)
            invalid.append(doc)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            output = root / 'out.json'
            output.write_text(json.dumps(SPEC))
            for doc in invalid:
                (root / 'source.json').write_text(json.dumps(doc))
                result = self.call(root, '--file', 'source.json', '--output', output)
                self.assertNotEqual(result.returncode, 0, json.dumps(doc))
                self.assertEqual(json.loads(output.read_text()), SPEC)
                self.assertEqual({p.name for p in root.iterdir()}, {'source.json', 'out.json'})

    def test_standard_schema_validator_is_called_and_failure_is_preserved(self):
        self.assertTrue((ROOT / 'bootstrap/openapi.mjs').is_file(), 'OPENAPI_EXPORT_MISSING: exporter implementation is required')
        self.assertTrue(CLI.is_file(), 'OPENAPI_EXPORT_MISSING: npm CLI is required')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'source.json').write_text(json.dumps(SPEC))
            (root / 'out.json').write_text('existing')
            probe = root / 'probe.mjs'
            probe.write_text("import {createRequire} from 'node:module';\nimport {pathToFileURL} from 'node:url';\n" +
                "const require = createRequire(" + json.dumps(str(ROOT / 'package.json')) + ");\n" +
                "const {default: Parser} = await import(pathToFileURL(require.resolve('@apidevtools/swagger-parser')).href);\n" +
                "Parser.validate = async () => { throw new Error('VALIDATOR_PROBE'); };\n")
            result = subprocess.run(['node', '--import', str(probe), str(CLI), 'openapi', 'export', '--file', 'source.json', '--output', 'out.json'], cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('VALIDATOR_PROBE', result.stderr)
            self.assertEqual((root / 'out.json').read_text(), 'existing')
            self.assertEqual({p.name for p in root.iterdir()}, {'source.json', 'out.json', 'probe.mjs'})

    def test_command_export_and_failure_propagate(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            exporter = root / 'export.py'
            exporter.write_text('import json\nprint(' + repr(json.dumps(SPEC)) + ')\n')
            config = {'openapi': {'command': ['python3', 'export.py'], 'output': 'generated.json'}}
            (root / 'proofstill.config.json').write_text(json.dumps(config))
            result = self.call(root)
            self.assertEqual(result.returncode, 0, 'OPENAPI_EXPORT_MISSING: ' + result.stderr)
            self.assertEqual(json.loads((root / 'generated.json').read_text()), SPEC)
            before_files = {p.relative_to(root) for p in root.rglob('*')}
            exporter.write_text('raise SystemExit(7)\n')
            self.assertNotEqual(self.call(root).returncode, 0)
            self.assertEqual({p.relative_to(root) for p in root.rglob('*')}, before_files)
            self.assertEqual(json.loads((root / 'generated.json').read_text()), SPEC)
            for invalid in ['not JSON', '{"openapi":"3.0.3"}']:
                exporter.write_text('print(' + repr(invalid) + ')\n')
                self.assertNotEqual(self.call(root).returncode, 0)
                self.assertEqual({p.relative_to(root) for p in root.rglob('*')}, before_files)
                self.assertEqual(json.loads((root / 'generated.json').read_text()), SPEC)

    def test_url_export_and_http_failure_preserve_output(self):
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(503 if self.path == '/fail' else 200)
                self.end_headers()
                self.wfile.write(b'not JSON' if self.path == '/invalid' else b'{"openapi":"3.0.3"}' if self.path == '/invalid-spec' else json.dumps(SPEC).encode())
            def log_message(self, *args):
                pass
        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with tempfile.TemporaryDirectory() as folder:
                    root = Path(folder)
                    url = f'http://127.0.0.1:{server.server_port}'
                    result = self.call(root, '--url', url + '/spec', '--output', 'out.json')
                    self.assertEqual(result.returncode, 0, 'OPENAPI_EXPORT_MISSING: ' + result.stderr)
                    before = (root / 'out.json').read_bytes()
                    self.assertNotEqual(self.call(root, '--url', url + '/fail', '--output', 'out.json').returncode, 0)
                    self.assertEqual((root / 'out.json').read_bytes(), before)
                    self.assertEqual({p.name for p in root.iterdir()}, {'out.json'})
                    for suffix in ['/invalid', '/invalid-spec']:
                        self.assertNotEqual(self.call(root, '--url', url + suffix, '--output', 'out.json').returncode, 0)
                        self.assertEqual((root / 'out.json').read_bytes(), before)
                        self.assertEqual({p.name for p in root.iterdir()}, {'out.json'})
            finally:
                server.shutdown()
                thread.join()

    def test_failed_output_commit_leaves_no_temporary_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'source.json').write_text(json.dumps(SPEC))
            (root / 'output.json').mkdir()
            (root / 'output.json/keep').write_text('keep')
            self.assertNotEqual(self.call(root, '--file', 'source.json', '--output', 'output.json').returncode, 0)
            self.assertEqual((root / 'output.json/keep').read_text(), 'keep')
            self.assertEqual({p.name for p in root.iterdir()}, {'source.json', 'output.json'})

    def test_missing_source_and_duplicate_operation_ids_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertNotEqual(self.call(root).returncode, 0)
            spec = json.loads(json.dumps(SPEC))
            spec['paths']['/other'] = spec['paths']['/ping']
            (root / 'source.json').write_text(json.dumps(spec))
            self.assertNotEqual(self.call(root, '--file', 'source.json', '--output', 'out.json').returncode, 0)
            self.assertFalse((root / 'out.json').exists())
            self.assertEqual({p.name for p in root.iterdir()}, {'source.json'})
            (root / 'out.json').write_text('existing')
            self.assertNotEqual(self.call(root, '--file', 'source.json', '--output', 'out.json').returncode, 0)
            self.assertEqual((root / 'out.json').read_text(), 'existing')
            self.assertEqual({p.name for p in root.iterdir()}, {'source.json', 'out.json'})


if __name__ == '__main__':
    unittest.main()
