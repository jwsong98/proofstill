import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { codexWorker } from '../server/dagWorker.ts';
class FakeCodex extends EventEmitter {
  closed = false; calls: string[] = [];
  async start() {}
  respond() {}
  close() { this.closed = true; }
  async request(method: string, params: any) {
    this.calls.push(method);
    if (method === 'model/list') return { data: [{ id: 'account-model', isDefault: true }] };
    if (method === 'thread/start') { assert.equal(params.cwd, '/tmp'); return { thread: { id: 'thread' } }; }
    if (method === 'turn/start') {
      this.emit('notification', { method: 'turn/completed', params: { threadId: 'unrelated', turn: { status: 'completed' } } });
      this.emit('notification', { method: 'item/completed', params: { threadId: 'thread', item: { type: 'agentMessage', text: 'actual summary' } } });
      this.emit('notification', { method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed' } } });
      return { turn: { id: 'turn' } };
    }
  }
}
test('Codex worker waits for its own terminal notification including completion before RPC response', async () => {
  const client = new FakeCodex();
  const result = await codexWorker(() => client)({ root: '/tmp', prompt: 'task', instructions: 'owned files', signal: new AbortController().signal });
  assert.equal(result, 'actual summary\n'); assert.equal(client.closed, true);
  assert.deepEqual(client.calls, ['model/list', 'thread/start', 'turn/start']);
});
