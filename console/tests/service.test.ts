import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConsoleService } from '../server/service.ts';
import { Store } from '../server/store.ts';

class FakeCodex extends EventEmitter {
  starts = 0;
  historyError: string | null = null;
  emptyHistory = false;
  async start() {}
  async request(method: string, params: any = {}) {
    if (method === 'model/list') return { data: [{ model: 'default', isDefault: true }] };
    if (method === 'thread/start') return { thread: { id: `thread-${++this.starts}` } };
    if (method === 'thread/name/set') return {};
    if (method === 'thread/read') return { thread: { id: params.threadId, name: '가져온 세션', createdAt: 1 } };
    if (method === 'turn/start') return { turn: { id: 'turn-new', status: 'completed' } };
    if (method === 'thread/turns/list') {
      if (this.historyError) throw new Error(this.historyError);
      return { data: this.emptyHistory ? [] : [{ id: 'turn-old', startedAt: 2, completedAt: 3, items: [{ id: 'spawn-old', type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed', senderThreadId: params.threadId, receiverThreadIds: ['child-old'], prompt: '과거 작업', agentsStates: {} }] }], nextCursor: null };
    }
    throw new Error(`Unexpected ${method}`);
  }
  respond() {}
  close() {}
}

test('service reuses sessions and exposes live/imported sub-agent activity', async () => {
  const store = new Store(), codex = new FakeCodex(), service = new ConsoleService(store, codex);
  try {
    const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
    const node = store.createNode(project.id, { kind: 'feature', title: '기능' });
    const [first, concurrent] = await Promise.all([service.createSession(project.id, { title: '처음', nodeIds: [node.id] }), service.createSession(project.id, { title: '동시 요청', nodeIds: [node.id, node.id] })]);
    assert.equal(concurrent.id, first.id);
    const reused = await service.createSession(project.id, { title: '중복', nodeIds: [node.id, node.id] });
    assert.equal(reused.id, first.id); assert.equal(codex.starts, 1);
    codex.emit('notification', { method: 'item/started', params: { threadId: first.externalThreadId, turnId: 'turn', item: { id: 'spawn', type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'inProgress', senderThreadId: first.externalThreadId, receiverThreadIds: ['child'], prompt: '조사해줘', agentsStates: {} } } });
    assert.equal(service.session(first.id).events.filter(event => (event.payload as any)?.item?.type === 'collabAgentToolCall').length, 1);
    const imported = await service.importSession(project.id, 'old-thread');
    assert.equal(service.session(imported.id).events.filter(event => (event.payload as any)?.item?.type === 'collabAgentToolCall').length, 1);
  } finally { service.close(); store.close(); }
});

test('new local sessions tolerate only an uncreated rollout and retain its unavailable provenance', async () => {
  const store = new Store(), codex = new FakeCodex(), service = new ConsoleService(store, codex);
  try {
    const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
    const session = await service.createSession(project.id);
    codex.emptyHistory = true;
    const empty = await service.syncSession(session.id);
    assert.deepEqual(empty.messages, []);
    assert.equal(empty.events.filter(event => event.method === 'history/sync').length, 0);
    codex.historyError = `invalid paginated history lineage for ${session.externalThreadId}: missing source rollout`;
    const unavailable = await service.syncSession(session.id);
    assert.deepEqual(unavailable.messages, []);
    assert.deepEqual(unavailable.events.find(event => event.method === 'history/sync')?.payload, {
      status: 'not_started', observed: false, source: 'thread/start', reason: 'missing_source_rollout',
      method: 'thread/turns/list', threadId: session.externalThreadId, error: codex.historyError,
    });
    codex.historyError = null;
    codex.emptyHistory = false;
    const recovered = await service.syncSession(session.id);
    assert.equal(recovered.events.filter(event => event.method === 'item/completed').length, 1);
    codex.historyError = `invalid paginated history lineage for ${session.externalThreadId}: missing source rollout`;
    await assert.rejects(service.syncSession(session.id), error => error instanceof Error && error.message === codex.historyError);
  } finally { service.close(); store.close(); }
});

test('history errors remain errors for existing history, imported sessions, and other failures', async t => {
  for (const scenario of ['message', 'turn-event', 'import', 'previous-local', 'sent-turn', 'other-error', 'other-thread']) {
    await t.test(scenario, async () => {
      const store = new Store(), codex = new FakeCodex(), service = new ConsoleService(store, codex);
      try {
        const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
        const session = scenario === 'import' || scenario === 'previous-local'
          ? store.createSession(project.id, { title: '기존 세션', externalThreadId: 'existing', source: scenario === 'import' ? 'import' : 'local' })
          : await service.createSession(project.id);
        if (scenario === 'message') store.addMessage(session.id, { role: 'assistant', content: '기존 대화' });
        if (scenario === 'turn-event') store.appendEvent(session.id, 'turn/started', { turnId: 'old-turn' });
        if (scenario === 'sent-turn') await service.sendMessage(session.id, '대화 시작');
        codex.historyError = scenario === 'other-error' ? 'transport disconnected'
          : `invalid paginated history lineage for ${scenario === 'other-thread' ? 'unrelated' : session.externalThreadId}: missing source rollout`;
        await assert.rejects(service.syncSession(session.id), error => error instanceof Error && error.message === codex.historyError);
        assert.equal(store.listEvents(session.id).filter(event => event.method === 'history/sync').length, 0);
      } finally { service.close(); store.close(); }
    });
  }
});
