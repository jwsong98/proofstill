import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const project = path.resolve(process.argv[2]);
const python = path.resolve(process.argv[3]);
// The supplied workspace must be a fresh scaffold of the implementation under review.
for (const relative of ['apps/app/vite.config.ts', 'orval.config.mjs', 'packages/api/src/base-url.ts', 'apps/backend/infra/app.py', 'apps/backend/app/http.py', 'apps/backend/app/health.py', 'apps/backend/app/tasks.py', 'apps/backend/infra/auth.py', 'apps/backend/infra/settings.py', 'apps/backend/infra/server.py']) {
  assert.equal(readFileSync(path.join(project, relative), 'utf8'), readFileSync(path.join(root, 'templates/monorepo', relative), 'utf8'), relative);
}
const require = createRequire(path.join(project, 'package.json'));
const { createServer } = await import(require.resolve('vite'));
const scratch = mkdtempSync(path.join(os.tmpdir(), 'proofstill-connection-'));
const ready = path.join(scratch, 'ready.json');
const nativeFetch = globalThis.fetch;
const backend = spawn(python, ['infra/server.py', '--port', '0', '--ready-file', ready], {
  cwd: path.join(project, 'apps/backend'),
  env: { ...process.env, DATABASE_URL: 'sqlite+pysqlite:///:memory:' }, stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
backend.stderr.on('data', value => { stderr += value; });
const stopped = new Promise(resolve => backend.once('exit', resolve));
try {
  let base;
  for (let i = 0; i < 400; i++) {
    try { base = JSON.parse(await fs.readFile(ready, 'utf8')).baseUrl; break; } catch {}
    assert.equal(backend.exitCode, null, stderr);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(base, 'backend startup timeout');
  process.env.BACKEND_URL = base;
  const generation = spawnSync('npm', ['run', 'api:generate'], {cwd: project, encoding: 'utf8'});
  assert.equal(generation.status, 0, generation.stdout + generation.stderr);
  const results = [];
  for (const apiBase of ['/api', base]) {
    process.env.VITE_API_BASE_URL = apiBase;
    const server = await createServer({root:path.join(project, 'apps/app'), configFile:path.join(project, 'apps/app/vite.config.ts'), server:{port:0}, logLevel:'error'});
    try {
      await server.listen();
      const frontend = `http://127.0.0.1:${server.httpServer.address().port}`;
      const requests = [];
      globalThis.fetch = (url, options) => {
        requests.push(String(url));
        return nativeFetch(new URL(url, frontend), options);
      };
      const api = await server.ssrLoadModule(path.join(project, 'packages/api/src/generated/client.ts'));
      const created = await api.createTask({title:'Generated client connection'}, {headers:{Authorization:'Bearer integration-probe'}});
      assert.equal(created.status, 201);
      assert.equal(requests[0], `${apiBase}/tasks`);
      assert.equal((await api.updateTask(created.data.id, {completed:true})).status, 200);
      const saved = await api.getTask(created.data.id);
      assert.equal(saved.status, 200);
      assert.equal(saved.data.completed, true);
      assert.equal((await api.getTask('missing')).status, 404);
      results.push({mode:apiBase === '/api' ? 'proxy' : 'direct', create:created.status, saved:saved.status});
    } finally {
      globalThis.fetch = nativeFetch;
      await server.close();
    }
  }
  console.log('FRONTEND_CONNECTION_VERIFIED: ' + JSON.stringify(results));
} finally {
  globalThis.fetch = nativeFetch;
  backend.kill();
  await stopped;
  await fs.rm(scratch, {recursive:true, force:true});
}
