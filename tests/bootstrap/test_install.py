import json
import os
import shutil
import tarfile
import re
import urllib.request
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class InstallTests(unittest.TestCase):
    def run_ok(self, argv, cwd, timeout=240):
        result = subprocess.run(list(map(str, argv)), cwd=cwd, capture_output=True, text=True,
                                timeout=timeout, env=dict(os.environ, DATABASE_URL='sqlite+pysqlite:///:memory:', npm_config_audit='false', npm_config_fund='false',
                                                         npm_config_cache=str(self.cache), NPM_CONFIG_CACHE=str(self.cache)))
        self.assertEqual(result.returncode, 0, 'INSTALL_PIPELINE_FAILED: ' + ' '.join(map(str, argv)) + '\n' + result.stdout[-5000:] + result.stderr[-5000:])
        return result.stdout

    def test_clean_tarball_install_export_codegen_build_and_flow_recording(self):
        self.assertTrue((ROOT / 'templates/monorepo/apps/backend/scripts/adapter.mjs').is_file(), 'INSTALL_ADAPTER_MISSING: runnable repository adapters are required')
        self.assertTrue((ROOT / 'package.json').exists(), 'INSTALL_PIPELINE_MISSING: npm package required')
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            self.cache = temp / 'npm-cache'
            cached = Path(os.environ.get('npm_config_cache') or os.environ.get('NPM_CONFIG_CACHE') or Path.home() / '.npm') / '_cacache'
            if cached.exists():
                shutil.copytree(cached, self.cache / '_cacache')
            packed = json.loads(self.run_ok(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], ROOT))[0]
            names = [item['path'] for item in packed['files']]
            manifest = json.loads((ROOT / 'tests/bootstrap/distribution.json').read_text())
            self.assertEqual(set(json.loads((ROOT / 'package.json').read_text())['files']), set(manifest))
            self.assertTrue(all((ROOT / name).is_file() for name in manifest), 'Distribution must enumerate files, not directories')
            self.assertEqual(set(names), set(manifest) | {'package.json', 'README.md'})
            allowed = {'package.json', 'README.md', 'bin', 'bootstrap', 'templates', 'vendor', 'proofstill', '.agents', 'examples'}
            for name in names:
                self.assertIn(name.split('/')[0], allowed, name)
                self.assertFalse(any(part in {'.env', 'auth.json', '.git', '__pycache__'} or part.endswith(('.pem', '.key', '.pyc')) for part in Path(name).parts), name)
            readme = (ROOT / 'README.md').read_text()
            self.assertIn('Node 22.18+와 Python 3.10+', readme)
            tarball = temp / packed['filename']
            delivery = ROOT / ('dist/digitalpresso-proofstill-' + json.loads((ROOT / 'package.json').read_text())['version'] + '.tgz')
            self.assertTrue(delivery.is_file(), 'The deliverable tarball must exist')
            self.assertEqual(delivery.read_bytes(), tarball.read_bytes(), 'Deliverable must match freshly packed sources')
            tarball = delivery
            with tarfile.open(tarball) as archive:
                for item in archive.getmembers():
                    if not item.isfile():
                        continue
                    try:
                        content = archive.extractfile(item).read().decode('utf8')
                    except UnicodeDecodeError:
                        continue
                    self.assertIsNone(re.search(r'/(?:Users|home)/[A-Za-z0-9_.-]+(?:/|\b)', content), item.name)
                    self.assertIsNone(re.search(r'-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|sk-proj-[A-Za-z0-9_-]{16,}', content), item.name)
            consumer = temp / 'consumer'
            consumer.mkdir()
            (consumer / 'package.json').write_text('{"private":true}')
            self.run_ok(['npm', 'install', '--prefer-offline', '--ignore-scripts', tarball], consumer)
            import hashlib
            installed = consumer / 'node_modules/@digitalpresso/proofstill'
            for name, digest in json.loads((ROOT / 'tests/bootstrap/tracker.json').read_text()).items():
                self.assertEqual(hashlib.sha256((installed / name).read_bytes()).hexdigest(), digest, name)
            cli = consumer / 'node_modules/.bin/proofstill'
            project = temp / 'generated project'
            self.run_ok([cli, 'scaffold', project, '--package-manager', 'npm'], consumer)
            self.run_ok(['npm', 'install', '--prefer-offline', '--ignore-scripts'], project)
            self.run_ok(['npm', 'run', 'backend:setup'], project)
            self.run_ok(['npm', 'run', 'test:fast'], project)
            self.run_ok(['npm', 'run', 'db:check'], project)
            self.run_ok(['npm', 'run', 'openapi:export'], project)
            shutil.rmtree(project / 'packages/api/src/generated', ignore_errors=True)
            self.run_ok(['npm', 'run', 'api:generate'], project)
            generated = (project / 'packages/api/src/generated/client.ts').read_text()
            self.assertIn('getHealth', generated)
            self.assertIn('orval', generated.lower())
            orval_package = json.loads((project / 'node_modules/orval/package.json').read_text())
            orval_bin = orval_package['bin']
            if isinstance(orval_bin, dict):
                orval_bin = orval_bin['orval']
            self.run_ok(['node', project / 'node_modules/orval' / orval_bin, '--config', 'orval.config.mjs'], project)
            expected_client = (project / 'packages/api/src/generated/client.ts').read_bytes()
            shutil.rmtree(project / 'packages/api/src/generated')
            self.run_ok(['npm', 'run', 'api:generate'], project)
            self.assertEqual((project / 'packages/api/src/generated/client.ts').read_bytes(), expected_client)
            exporter = project / 'apps/backend/infra/app.py'
            original = exporter.read_text()
            exporter.write_text(original.replace('getHealth', 'getHealthProbe'))
            self.run_ok(['npm', 'run', 'openapi:export'], project)
            self.run_ok(['npm', 'run', 'api:generate'], project)
            self.assertIn('getHealthProbe', (project / 'packages/api/src/generated/client.ts').read_text())
            exporter.write_text(original)
            self.run_ok(['npm', 'run', 'openapi:export'], project)
            self.run_ok(['npm', 'run', 'api:generate'], project)
            self.run_ok(['node', ROOT / 'tests/bootstrap/check_frontend_connection.mjs', project, project / 'apps/backend/.venv/bin/python'], ROOT)
            self.run_ok(['npm', 'run', 'build'], project)
            self.run_ok(['npm', 'run', 'typecheck'], project)
            (project / 'render-smoke.tsx').write_text('''import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Button as JwButton} from '@proofstill/jwdesign';
import {Button as UiButton} from '@proofstill/ui';
import assert from 'node:assert/strict';
const jw = renderToStaticMarkup(<JwButton>Design action</JwButton>);
const ui = renderToStaticMarkup(<UiButton>Shared action</UiButton>);
assert.match(jw, /<button/); assert.match(jw, /jw-btn/); assert.match(jw, /Design action/);
assert.match(ui, /<button/); assert.match(ui, /data-slot="button"/); assert.match(ui, /Shared action/);
''')
            self.run_ok(['node', project / 'node_modules/tsx/dist/cli.mjs', 'render-smoke.tsx'], project)
            (project / 'render-apps.cjs').write_text('''require('tsx/cjs');
require.extensions['.css'] = () => {};
const {renderToStaticMarkup} = require('react-dom/server');
const client = require('react-dom/client');
const assert = require('node:assert/strict');
let html;
client.createRoot = () => ({render: element => { html = renderToStaticMarkup(element); }});
global.document = {getElementById: () => ({})};
require('./apps/app/src/main.tsx');
assert.match(html, /data-slot="button"/);
''')
            self.run_ok(['node', 'render-apps.cjs'], project)
            app_js = '\n'.join(p.read_text() for p in (project / 'apps/app/dist').rglob('*.js'))
            self.assertIn('data-slot', app_js)
            built_css = '\n'.join(p.read_text() for p in (project / 'apps/app/dist').rglob('*.css'))
            self.assertIn('Pretendard', built_css)
            self.assertIn('--accent', built_css)
            self.assertTrue(list((project / 'apps/app/dist').rglob('*.woff2')))
            self.assertIn('@proofstill/ui', (project / 'apps/app/src/features/start/Start.tsx').read_text())
            self.run_ok(['npm', 'run', 'proofstill', '--', '--help'], project)
            plan = json.loads((ROOT / 'examples/orders/feature.json').read_text())
            plan['id'] = 'installed-smoke'
            (project / 'installed-plan.json').write_text(json.dumps(plan))
            shutil.copytree(ROOT / 'examples/orders', project / 'examples/orders')
            self.run_ok(['npm', 'run', 'proofstill', '--', 'init', 'installed-plan.json'], project)
            self.assertTrue((project / '.proofstill/evidence/installed-smoke/plan.json').is_file())
            second = temp / 'pnpm-project'
            self.run_ok([cli, 'scaffold', second, '--package-manager', 'pnpm'], consumer)
            pnpm = project / 'node_modules/pnpm/bin/pnpm.cjs'
            self.run_ok(['node', pnpm, 'install', '--ignore-scripts', '--store-dir', temp / 'pnpm-store'], second)
            self.run_ok(['node', pnpm, 'run', 'backend:setup'], second)
            self.run_ok(['node', pnpm, 'run', 'test:fast'], second)
            self.run_ok(['node', pnpm, 'run', 'db:check', '--'], second)
            scripts = json.loads((second / 'package.json').read_text())['scripts']
            for command in ['backend:setup', 'db:revision', 'db:migrate', 'db:status', 'db:rollback', 'db:seed',
                            'db:reset', 'db:check', 'test:unit', 'test:integration', 'test:fast', 'test:e2e']:
                self.assertEqual(scripts[command], f'node scripts/backend.mjs {command}')
            self.run_ok(['node', pnpm, 'run', 'openapi:export'], second)
            self.run_ok(['node', pnpm, 'run', 'api:generate'], second)
            self.run_ok(['node', pnpm, 'run', 'build'], second)
            self.run_ok(['node', pnpm, 'run', 'typecheck'], second)
            self.run_ok(['npm', 'run', 'api:tracker', '--', 'flow', 'validate'], project)
            tracker = [str(project / 'node_modules/.bin/proofstill'), 'tracker']
            self.run_ok([*tracker, 'app', 'doctor'], project)
            domain = project / 'apps/backend/domain/health.py'
            domain_original = domain.read_text()
            domain.write_text(domain_original.replace('"ok"', '"domain-probe"').replace("'ok'", "'domain-probe'"))
            try:
                probe = json.loads(self.run_ok([*tracker, 'env', 'start'], project))
                with urllib.request.urlopen(probe['data']['baseUrl'] + '/health') as response:
                    self.assertEqual(json.load(response)['status'], 'domain-probe')
            finally:
                self.run_ok([*tracker, 'env', 'stop'], project)
                domain.write_text(domain_original)
            prepared = json.loads(self.run_ok([*tracker, 'env', 'prepare', '--generate-spec'], project))
            base_url = prepared['data']['runtime']['baseUrl']
            with urllib.request.urlopen(base_url + '/health') as response:
                observed = json.load(response)
            self.assertEqual(observed['status'], 'ok')
            self.assertTrue(observed['instance'])
            try:
                self.run_ok([*tracker, 'spec', 'compare'], project)
                shown = self.run_ok([*tracker, 'flow', 'show'], project)
                self.assertIn('할 일 등록', shown)
                self.assertNotIn('session', shown.lower())
                self.run_ok([*tracker, 'flow', 'run'], project)
                flow_record = json.loads((project / '.api-tracker/flow-record.json').read_text())
                steps = flow_record['steps']
                self.assertEqual([step['status'] for step in steps], ['passed'] * 3)
                task_id = steps[0]['attempts'][0]['response']['body']['id']
                logs = [json.loads(line) for line in (project / '.api-tracker/runtime/backend/http.jsonl').read_text().splitlines()]
                for step in steps:
                    attempt = step['attempts'][0]
                    self.assertTrue(step['description'])
                    self.assertTrue(step['expected'])
                    self.assertEqual(attempt['response']['body']['id'], task_id)
                    self.assertTrue(any(log['body'] == attempt['response']['body'] for log in logs))
                self.assertTrue(steps[2]['attempts'][0]['response']['body']['completed'])
                self.assertEqual(steps[1]['attempts'][0]['bindings'][0]['from'], 'create_task')
                self.assertFalse((project / '.api-tracker/sessions').exists())
                self.assertIn(task_id, self.run_ok([*tracker, 'flow', 'show'], project))
                self.run_ok([*tracker, 'flow', 'reset'], project)
                self.assertFalse((project / '.api-tracker/flow-record.json').exists())
                flow_file = project / '.api-tracker/flow.yaml'
                original_flow = flow_file.read_text()
                flow_file.write_text(original_flow.replace('createTask', 'operationNotInSpec'))
                wrong = subprocess.run([*tracker, 'flow', 'validate'], cwd=project, capture_output=True, text=True)
                self.assertNotEqual(wrong.returncode, 0, wrong.stdout)
                flow_file.write_text(original_flow)
                contract = project / 'packages/api/openapi.contract.json'
                spec = json.loads(contract.read_text())
                spec['paths']['/missing'] = {'get': {'operationId': 'missing', 'responses': {'200': {'description': 'missing'}}}}
                contract.write_text(json.dumps(spec))
                result = subprocess.run([*tracker, 'spec', 'compare'], cwd=project, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0, result.stdout)
            finally:
                self.run_ok([*tracker, 'env', 'stop'], project)
            with self.assertRaises(OSError):
                urllib.request.urlopen(base_url + '/health', timeout=2)


if __name__ == '__main__':
    unittest.main()
