import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Store } from '../server/store.ts';
import { createApi } from '../server/api.ts';
class IdleCodex extends EventEmitter { async start() {} async request() { return {}; } respond() {} close() {} }
test('HTTP task configuration is stored, validated, isolated by project and read back', async () => {
  const store = new Store(), a = store.createProject({ name: 'a', rootPath: '/tmp/dag-api-a' }), b = store.createProject({ name: 'b', rootPath: '/tmp/dag-api-b' });
  store.createNode(a.id, { id: 'task-a', title: 'a', kind: 'task' });
  const app = createApi({ store, codex: new IdleCodex(), dagWorker: async () => '' });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address() as { port: number }, base = `http://127.0.0.1:${address.port}/api/projects/`;
  const definition = { owns: ['src/a.ts'], checks: [['node', '--version']] };
  try {
    const save = await fetch(base + a.id + '/dag/tasks/task-a', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(definition) });
    assert.equal(save.status, 200); assert.deepEqual(await save.json(), definition);
    const snapshot = await (await fetch(base + a.id + '/dag')).json(); assert.deepEqual(snapshot.definitions['task-a'], definition); assert.equal(snapshot.run, null);
    const forbidden = await fetch(base + b.id + '/dag/tasks/task-a', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(definition) });
    assert.equal(forbidden.status, 400);
    const invalid = await fetch(base + a.id + '/dag/tasks/task-a', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owns: ['../outside'], checks: [['node']] }) });
    assert.equal(invalid.status, 400);
    assert.deepEqual(app.dag.snapshot(a.id).definitions['task-a'], definition);
  } finally { await app.close(); store.close(); }
});
