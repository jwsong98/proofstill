import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { CodexClient, CodexRpcError } from '../server/codex.ts';

const fixture = fileURLToPath(new URL('./fixtures/fake-app-server.mjs', import.meta.url));
function client(extra: string[] = [], timeoutMs = 3000, incomingTimeoutMs?: number) {
  return new CodexClient({ command: process.execPath, args: [fixture, ...extra], timeoutMs, incomingTimeoutMs });
}

test('lazy handshake, split JSONL frames and out-of-order replies', async t => {
  const c = client(); t.after(() => c.close());
  const [a, b] = await Promise.all([c.request('echo', { a: 1 }), c.request('echo', { b: 2 })]);
  assert.deepEqual(a, { a: 1 }); assert.deepEqual(b, { b: 2 });
  assert.deepEqual(await c.request('split'), { split: true });
  const order: number[] = [];
  await Promise.all([
    c.request('out-of-order', { value: 1, delay: 40 }).then(x => { order.push(x.value); }),
    c.request('out-of-order', { value: 2, delay: 1 }).then(x => { order.push(x.value); }),
  ]);
  assert.deepEqual(order, [2, 1]);
});

test('notifications are distinct from incoming requests and responses', async t => {
  const c = client(); t.after(() => c.close());
  const notification = once(c, 'notification');
  await c.request('notify');
  assert.deepEqual((await notification)[0], { method: 'item/agentMessage/delta', params: { delta: 'hello' } });
  c.on('request', request => c.respond(request.id, { decision: 'accept' }));
  const response = once(c, 'notification');
  await c.request('ask', { id: 'approval-string-id', method: 'item/commandExecution/requestApproval' });
  assert.deepEqual((await response)[0].params, { id: 'approval-string-id', result: { decision: 'accept' } });
  assert.throws(() => c.respond('approval-string-id', {}), /no longer pending/);
});

test('unhandled requests are safely declined without error-event listeners', async t => {
  const c = client(); t.after(() => c.close());
  let response = once(c, 'notification');
  await c.request('ask', { id: 901, method: 'item/fileChange/requestApproval' });
  assert.equal((await response)[0].params.result.decision, 'decline');
  response = once(c, 'notification');
  await c.request('ask', { id: 902, method: 'item/tool/call' });
  assert.equal((await response)[0].params.result.success, false);
  response = once(c, 'notification');
  await c.request('ask', { id: 903, method: 'unrecognized/request' });
  assert.equal((await response)[0].params.error.code, -32601);
});

test('incoming requests use a separate timeout and emit expiry after safe decline', async t => {
  const c = client([], 3000, 100); t.after(() => c.close());
  c.on('request', () => {});
  const response = once(c, 'notification');
  const expired = once(c, 'requestExpired');
  await c.request('ask', { id: 904, method: 'item/commandExecution/requestApproval' });
  assert.equal((await response)[0].params.result.decision, 'decline');
  assert.deepEqual((await expired)[0], {
    id: 904, method: 'item/commandExecution/requestApproval', params: { threadId: 'thread-1' },
  });
  assert.throws(() => c.respond(904, { decision: 'accept' }), /no longer pending/);
  assert.deepEqual(await c.request('echo', { stillConnected: true }), { stillConnected: true });
});

test('RPC errors are typed and redact credentials', async t => {
  const c = client(); t.after(() => c.close());
  await assert.rejects(c.request('rpc-error'), error => {
    assert.ok(error instanceof CodexRpcError); assert.equal(error.code, -32000);
    assert.ok(!error.message.includes('fake-secret')); assert.ok(!error.message.includes('secret-value'));
    return true;
  });
});

test('timeouts reject without poisoning later calls; init timeout is bounded', async t => {
  const c = client([], 100); t.after(() => c.close());
  await assert.rejects(c.request('hang'), /timed out: hang/);
  assert.deepEqual(await c.request('echo', { recovered: true }), { recovered: true });
  const hanging = client(['--hang-initialize'], 100); t.after(() => hanging.close());
  await assert.rejects(hanging.start(), /timed out: initialize/);
});

test('process exit rejects pending requests without exposing stderr secrets', async t => {
  const c = client(); t.after(() => c.close());
  await c.start();
  const disconnection = once(c, 'disconnected');
  const hung = c.request('hang');
  const exited = c.request('exit');
  const results = await Promise.allSettled([hung, exited]);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.match(result.reason.message, /exited/);
  }
  assert.ok(!(await disconnection)[0].message.includes('secret-token-value'));
});

test('invalid JSON and missing executable fail safely; close is terminal', async t => {
  const c = client(); t.after(() => c.close());
  await assert.rejects(c.request('bad'), /Invalid Codex/);
  const missing = new CodexClient({ command: '/nonexistent/proofstill-codex', timeoutMs: 1000 });
  t.after(() => missing.close());
  await assert.rejects(missing.start(), /Could not start/);
  const closed = client(); await closed.start(); await closed.close(); await closed.close();
  await assert.rejects(closed.request('echo'), /closed/);
});
