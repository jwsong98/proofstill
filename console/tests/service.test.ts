import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConsoleService } from '../server/service.ts';
import { Store } from '../server/store.ts';

class FakeCodex extends EventEmitter {
  starts = 0;
  historyError: string | null = null;
  emptyHistory = false;
  historyTurns: any[] | null = null;
  async start() {}
  async request(method: string, params: any = {}) {
    if (method === 'model/list') return { data: [{ model: 'default', isDefault: true }] };
    if (method === 'thread/start') return { thread: { id: `thread-${++this.starts}` } };
    if (method === 'thread/name/set') return {};
    if (method === 'thread/read') return { thread: { id: params.threadId, name: '가져온 세션', createdAt: 1 } };
    if (method === 'turn/start') return { turn: { id: 'turn-new', status: 'completed' } };
    if (method === 'thread/turns/list') {
      if (this.historyError) throw new Error(this.historyError);
      return { data: this.historyTurns ?? (this.emptyHistory ? [] : [{ id: 'turn-old', startedAt: 2, completedAt: 3, items: [{ id: 'spawn-old', type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed', senderThreadId: params.threadId, receiverThreadIds: ['child-old'], prompt: '과거 작업', agentsStates: {} }] }]), nextCursor: null };
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

test('terminal parent turns preserve incomplete command evidence without claiming command completion', async () => {
  const store = new Store(), codex = new FakeCodex(), service = new ConsoleService(store, codex);
  try {
    const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
    const session = await service.createSession(project.id);
    const emit = (method: string, payload: any) => codex.emit('notification', { method, params: { threadId: session.externalThreadId, ...payload } });
    emit('turn/started', { turn: { id: 'parent' } });
    emit('item/started', { turnId: 'parent', item: { id: 'cmd', type: 'commandExecution', status: 'inProgress', command: 'long command', exitCode: null } });
    emit('item/commandExecution/outputDelta', { turnId: 'parent', itemId: 'cmd', delta: 'observed output\n' });
    assert.equal(store.listGraph(project.id).nodes.filter(node => node.execution).length, 0);
    emit('item/completed', { item: { id: 'spawn', type: 'collabAgentToolCall', receiverThreadIds: ['child'] } });
    emit('turn/completed', { threadId: 'child', turn: { id: 'parent', status: 'interrupted' } });
    assert.equal(store.listGraph(project.id).nodes.filter(node => node.execution).length, 0);
    assert.equal(service.session(session.id).activeTurnId, 'parent');
    emit('turn/completed', { turn: { id: 'parent', status: 'interrupted' } });
    const result = store.listGraph(project.id).nodes.find(node => node.execution)!.execution!;
    assert.equal(result.status, 'interrupted'); assert.equal(result.exitCode, null);
    assert.equal(result.output, 'observed output\n');
    const response = result.response as any;
    assert.equal(response.item.status, 'inProgress'); assert.equal(response.completionObserved, false);
    assert.equal(result.finishedAt, response.terminalTurnEvent.createdAt);
    assert.equal(response.terminalTurnEvent.payload.turn.status, 'interrupted');
    assert.equal(service.session(session.id).events.filter(event => event.method === 'item/completed' && (event.payload as any)?.item?.id === 'cmd').length, 0);
    emit('turn/completed', { turn: { id: 'parent', status: 'interrupted' } });
    assert.equal(store.listGraph(project.id).nodes.filter(node => node.execution).length, 1);
  } finally { service.close(); store.close(); }
});

test('import and sync recover interrupted history once while active commands stay without result nodes', async () => {
  const store = new Store(), codex = new FakeCodex(), service = new ConsoleService(store, codex);
  try {
    const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
    codex.historyTurns = [{ id: 'old', status: 'interrupted', startedAt: 2, completedAt: 4, items: [
      { id: 'incomplete', type: 'commandExecution', status: 'inProgress', command: 'old command', aggregatedOutput: 'partial', exitCode: null },
    ] }, { id: 'active', status: 'inProgress', startedAt: 5, items: [
      { id: 'still-running', type: 'commandExecution', status: 'inProgress', command: 'active command' },
    ] }];
    const imported = await service.importSession(project.id, 'old-thread');
    const local = store.createSession(project.id, { title: '재시작 전 세션', externalThreadId: 'local-old' });
    for (const session of [imported, local]) {
      await service.syncSession(session.id); await service.syncSession(session.id);
      const results = store.listGraph(project.id).nodes.filter(node => node.id.startsWith(`command:${session.id}:`));
      assert.equal(results.length, 1);
      const result = results[0].execution!;
      assert.equal(result.status, 'interrupted'); assert.equal(result.exitCode, null);
      assert.equal(result.startedAt, 2000); assert.equal(result.finishedAt, 4000);
      assert.equal(result.output, 'partial');
      assert.equal((result.response as any).terminalTurnEvent.payload.historySource, 'thread/turns/list');
      assert.equal((result.response as any).item.status, 'inProgress');
      assert.equal(service.session(session.id).events.filter(event => event.method === 'turn/completed').length, 1);
    }
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

test('empty local thread creation provenance survives a service restart', async () => {
  const store = new Store(), firstCodex = new FakeCodex(), first = new ConsoleService(store, firstCodex);
  const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
  const session = await first.createSession(project.id);
  assert.deepEqual(store.listEvents(session.id).find(event => event.method === 'session/created')?.payload,
    { source: 'thread/start', threadId: session.externalThreadId });
  first.close();
  const codex = new FakeCodex(), restarted = new ConsoleService(store, codex);
  try {
    codex.historyError = `invalid paginated history lineage for ${session.externalThreadId}: missing source rollout`;
    const detail = await restarted.syncSession(session.id);
    assert.equal(detail.messages.length, 0);
    assert.equal((detail.events.find(event => event.method === 'history/sync')?.payload as any).observed, false);
    assert.equal(codex.starts, 0);
  } finally { restarted.close(); store.close(); }
});

test('restart fallback requires exact persisted provenance and still rejects any conversation evidence', async t => {
  const scenarios = ['legacy-history', 'no-source', 'other-thread', 'wrong-source', 'wrong-status', 'observed', 'wrong-reason', 'wrong-method', 'wrong-error', 'import', 'message', 'usage', 'turn', 'item', 'message-event', 'other-error'];
  for (const scenario of scenarios) await t.test(scenario, async () => {
    const store = new Store(), previousCodex = new FakeCodex(), previous = new ConsoleService(store, previousCodex);
    const project = store.createProject({ name: '프로젝트', rootPath: '/project' });
    const session = store.createSession(project.id, { title: '기존 빈 세션', externalThreadId: 'persisted-thread', source: scenario === 'import' ? 'import' : 'local' });
    const expectedError = `invalid paginated history lineage for ${session.externalThreadId}: missing source rollout`;
    const provenance: any = { source: 'thread/start', threadId: session.externalThreadId,
      status: 'not_started', observed: false, reason: 'missing_source_rollout', method: 'thread/turns/list', error: expectedError };
    const changes: Record<string, [string, unknown]> = {
      'other-thread': ['threadId', 'unrelated'], 'wrong-source': ['source', 'thread/read'],
      'wrong-status': ['status', 'completed'], observed: ['observed', true],
      'wrong-reason': ['reason', 'transport_error'], 'wrong-method': ['method', 'thread/read'], 'wrong-error': ['error', 'different error'],
    };
    if (changes[scenario]) { const [key, value] = changes[scenario]; provenance[key] = value; }
    if (scenario !== 'no-source') store.appendEvent(session.id, 'history/sync', provenance);
    if (scenario === 'message') store.addMessage(session.id, { role: 'user', content: '기존 대화' });
    if (scenario === 'usage') store.saveUsage(session.id, { turnId: 'old', inputTokens: 1 });
    if (['turn', 'item', 'message-event'].includes(scenario)) store.appendEvent(session.id,
      scenario === 'turn' ? 'turn/started' : scenario === 'item' ? 'item/started' : 'message/created', {});
    previous.close();
    const codex = new FakeCodex(), restarted = new ConsoleService(store, codex);
    codex.historyError = scenario === 'other-error' ? 'transport disconnected' : expectedError;
    try {
      if (scenario === 'legacy-history') {
        const detail = await restarted.syncSession(session.id);
        assert.equal(detail.messages.length, 0);
        assert.equal(detail.events.filter(event => event.method === 'history/sync').length, 2);
      } else {
        await assert.rejects(restarted.syncSession(session.id), error => error instanceof Error && error.message === codex.historyError);
        assert.equal(store.listEvents(session.id).filter(event => event.method === 'history/sync').length, scenario === 'no-source' ? 0 : 1);
      }
    } finally { restarted.close(); store.close(); }
  });
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
