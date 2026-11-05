import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, StoreError } from '../server/store.ts';

function setup() {
  const store = new Store();
  const project = store.createProject({ name: '실제 프로젝트', rootPath: '/workspace/one' });
  return { store, projectId: project.id };
}

test('empty database and migration survive reopening without seeding fake records', () => {
  const folder = mkdtempSync(join(tmpdir(), 'proofstill-store-'));
  try {
    const path = join(folder, 'data.sqlite');
    let store = new Store(path);
    assert.deepEqual(store.listProjects(), []);
    const project = store.createProject({ name: '프로젝트', rootPath: '/workspace/persistence' });
    const node = store.createNode(project.id, { kind: 'feature', title: '중복 등록 방지' });
    const session = store.createSession(project.id, { title: '논의', contextNodeIds: [node.id] });
    store.addMessage(session.id, { role: 'user', content: '왜 필요한지 설명해줘', createdAt: 42 });
    store.addMessage(session.id, { role: 'assistant', content: '이유 설명', createdAt: 42 });
    store.addMessage(session.id, { role: 'user', content: '추가 질문', createdAt: 42 });
    store.close();
    store = new Store(path);
    assert.equal(store.getNode(project.id, node.id).title, '중복 등록 방지');
    assert.deepEqual(store.getSession(session.id).contextNodeIds, [node.id]);
    assert.deepEqual(store.listMessages(session.id).map(message => message.content), ['왜 필요한지 설명해줘', '이유 설명', '추가 질문']);
    assert.deepEqual(store.listMessages(session.id).map(message => message.createdAt), [42, 42, 42]);
    assert.deepEqual(store.db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map(row => row.name),
      readdirSync(new URL('../server/migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort());
    store.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('evidence is separate raw data, immutable even through direct SQL, with append-only capture', () => {
  const { store, projectId } = setup();
  try {
    const first = store.captureEvidence(projectId, { title: '요구사항.md', sourceKind: 'file',
      source: { path: 'requirements.md', startLine: 4, endLine: 5 }, content: '동일 요청은 한 번만 처리한다.\n실패 시 재시도한다.' });
    assert.equal(first.body, '');
    assert.equal(first.evidence!.sourceKind, 'file');
    assert.throws(() => store.updateNode(projectId, first.id, { body: 'AI가 해석한 의미' }), /immutable/);
    assert.throws(() => store.deleteNode(projectId, first.id), /immutable/);
    assert.throws(() => store.db.prepare('UPDATE evidence SET content=? WHERE id=?').run('덮어쓰기', first.evidenceId!), /immutable/);
    assert.throws(() => store.db.prepare('DELETE FROM evidence WHERE id=?').run(first.evidenceId!), /immutable/);
    assert.throws(() => store.db.prepare('INSERT OR REPLACE INTO evidence SELECT id,project_id,source_kind,source_json,?,captured_at FROM evidence WHERE id=?')
      .run('교체 시도', first.evidenceId!), /immutable/);
    assert.throws(() => store.db.prepare('UPDATE nodes SET title=? WHERE id=?').run('수정', first.id), /immutable/);
    assert.throws(() => store.db.prepare('DELETE FROM nodes WHERE id=?').run(first.id), /immutable/);
    const second = store.captureEvidence(projectId, { title: '요구사항.md', sourceKind: 'file',
      source: { path: 'requirements.md', startLine: 4, endLine: 5 }, content: '원문이 바뀐 새 근거' });
    assert.notEqual(second.evidenceId, first.evidenceId);
    assert.equal(store.getNode(projectId, first.id).evidence!.content, first.evidence!.content);
    const conversation = store.captureEvidence(projectId, { title: '요구사항 인터뷰', sourceKind: 'message',
      source: { threadId: 'thread-original', messageId: 'message-original' }, content: '사용자가 직접 답변한 원문' });
    assert.deepEqual(Object.keys(conversation.evidence!.source), ['threadId', 'messageId']);
    assert.throws(() => store.captureEvidence(projectId, { title: '문서', sourceKind: 'file', source: { path: 'x', startLine: 2, endLine: 1 }, content: 'bad' }), /range/);
  } finally { store.close(); }
});

test('graph semantic relations are symmetric, review flow is directed and acyclic', () => {
  const { store, projectId } = setup();
  try {
    const feature = store.createNode(projectId, { kind: 'feature', title: '기능' });
    const a = store.createNode(projectId, { kind: 'task', title: 'API 수정' });
    const b = store.createNode(projectId, { kind: 'task', title: '결과 검사' });
    const c = store.createNode(projectId, { kind: 'task', title: '확인' });
    const semantic = store.createEdge(projectId, { sourceId: feature.id, targetId: a.id, kind: 'related' });
    assert.equal(store.createEdge(projectId, { sourceId: a.id, targetId: feature.id, kind: 'related' }).id, semantic.id);
    store.createEdge(projectId, { sourceId: a.id, targetId: b.id, kind: 'precedes' });
    store.createEdge(projectId, { sourceId: b.id, targetId: c.id, kind: 'precedes' });
    assert.throws(() => store.createEdge(projectId, { sourceId: c.id, targetId: a.id, kind: 'precedes' }), /cycle/);
    const result = store.recordExecution(projectId, { title: '검사 결과', kind: 'test', status: 'passed', output: 'PASS' });
    const follow = store.createNode(projectId, { kind: 'task', title: '후속 구현' });
    for (const [sourceId, targetId] of [[feature.id, a.id], [c.id, result.id], [result.id, follow.id]]) {
      const link = store.createEdge(projectId, { sourceId, targetId, kind: 'precedes' });
      assert.deepEqual([link.sourceId, link.targetId], [sourceId, targetId]);
    }
    assert.throws(() => store.createEdge(projectId, { sourceId: result.id, targetId: feature.id, kind: 'precedes' }), /cycle/);
    assert.throws(() => store.createEdge(projectId, { sourceId: a.id, targetId: a.id, kind: 'related' }), /itself/);
    assert.throws(() => store.db.prepare('UPDATE nodes SET kind=? WHERE id=?').run('feature', a.id), /immutable/);
    const other = store.createProject({ name: '다른 프로젝트', rootPath: '/workspace/two' });
    const foreign = store.createNode(other.id, { kind: 'task', title: '다른 작업' });
    assert.throws(() => store.createEdge(projectId, { sourceId: a.id, targetId: foreign.id, kind: 'related' }), /not found/);
    assert.throws(() => store.db.prepare('INSERT INTO edges VALUES(?,?,?,?,?,?,?)').run('cross', projectId, a.id, foreign.id, 'precedes', '', 1), /FOREIGN KEY/);
  } finally { store.close(); }
});

test('context follows two actual graph hops and keeps raw source separate from interpretation', () => {
  const { store, projectId } = setup();
  try {
    const feature = store.createNode(projectId, { kind: 'feature', title: '기능', body: '개발 이유' });
    const requirement = store.createNode(projectId, { kind: 'requirement', title: '요구' });
    const evidence = store.captureEvidence(projectId, { title: '인터뷰', sourceKind: 'message',
      source: { threadId: 't', messageId: 'm' }, content: '순수 원문' });
    const unrelated = store.createNode(projectId, { kind: 'issue', title: '연결 없는 문제' });
    const task = store.createNode(projectId, { kind: 'task', title: '여러 기능에서 공유하는 작업' });
    const sibling = store.createNode(projectId, { kind: 'feature', title: '별개의 기능' });
    const siblingRequirement = store.createNode(projectId, { kind: 'requirement', title: '별개 기능의 요구' });
    store.createEdge(projectId, { sourceId: feature.id, targetId: task.id, kind: 'related' });
    store.createEdge(projectId, { sourceId: task.id, targetId: sibling.id, kind: 'related' });
    store.createEdge(projectId, { sourceId: sibling.id, targetId: siblingRequirement.id, kind: 'related' });

    store.createEdge(projectId, { sourceId: feature.id, targetId: requirement.id, kind: 'related' });
    store.createEdge(projectId, { sourceId: requirement.id, targetId: evidence.id, kind: 'related' });
    const context = store.buildContext(projectId, [feature.id]);
    assert.deepEqual(new Set(context.nodes.map(node => node.id)), new Set([feature.id, requirement.id, evidence.id, task.id]));
    assert.ok(!context.text.includes(unrelated.id));
    assert.ok(!context.text.includes(sibling.id));
    assert.ok(!context.text.includes(siblingRequirement.id));
    assert.match(context.text, /RAW\n순수 원문/);
    assert.equal(store.getNode(projectId, evidence.id).body, '');
    const other = store.createProject({ name: '다른 것', rootPath: '/elsewhere' });
    assert.throws(() => store.buildContext(other.id, [feature.id]), /not found/);
  } finally { store.close(); }
});

test('session keyset pagination handles ties; reads and metadata do not bump recency', () => {
  const { store, projectId } = setup();
  try {
    store.createSession(projectId, { id: 'empty', title: '대화 없음', createdAt: 999 });
    for (const id of ['a', 'b', 'c', 'd', 'e']) store.createSession(projectId, { id, title: id, lastConversationAt: 100, createdAt: 10 });
    const page1 = store.listSessions({ projectId, limit: 2 });
    assert.deepEqual(page1.items.map(session => session.id), ['e', 'd']);
    const page2 = store.listSessions({ projectId, cursor: page1.nextCursor, limit: 2 });
    const page3 = store.listSessions({ projectId, cursor: page2.nextCursor, limit: 2 });
    assert.deepEqual([...page1.items, ...page2.items, ...page3.items].map(session => session.id), ['e', 'd', 'c', 'b', 'a', 'empty']);
    assert.equal(page3.nextCursor, null);
    assert.equal(store.getSession('empty').lastConversationAt, null);
    store.getSession('a'); store.updateSession('a', { title: '읽고 이름 수정' });
    assert.equal(store.getSession('a').lastConversationAt, 100);
    store.appendEvent('a', 'turn/completed', { status: 'completed' }, 900);
    store.addMessage('a', { role: 'tool', content: 'log', createdAt: 800 });
    assert.equal(store.getSession('a').lastConversationAt, 100);
    store.addMessage('a', { role: 'user', content: '새 대화', createdAt: 200 });
    assert.equal(store.listSessions({ projectId, limit: 1 }).items[0].id, 'a');
    assert.throws(() => store.listSessions({ projectId, cursor: 'not-json' }), /cursor/);
    const other = store.createProject({ name: '다른 프로젝트', rootPath: '/cursor-other' });
    assert.throws(() => store.listSessions({ projectId: other.id, cursor: page1.nextCursor }), /cursor/);
  } finally { store.close(); }
});

test('reusable local sessions match role and normalized context exactly', () => {
  const { store, projectId } = setup();
  try {
    const a = store.createNode(projectId, { kind: 'feature', title: 'A' });
    const b = store.createNode(projectId, { kind: 'requirement', title: 'B' });
    const root = store.createSession(projectId, { title: '프로젝트', externalThreadId: 'root-thread', contextNodeIds: [] });
    const context = store.createSession(projectId, { title: '컨텍스트', externalThreadId: 'context-thread', contextNodeIds: [b.id, a.id] });
    store.createSession(projectId, { title: '그래프', externalThreadId: 'graph-thread', role: 'graph', contextNodeIds: [a.id, b.id] });
    store.createSession(projectId, { title: '가져온 프로젝트', externalThreadId: 'imported-root', source: 'import', contextNodeIds: [] });
    assert.equal(store.findReusableSession(projectId, null, [])?.id, root.id);
    assert.equal(store.findReusableSession(projectId, null, [a.id, b.id, b.id])?.id, context.id);
    assert.equal(store.findReusableSession(projectId, 'graph', [b.id, a.id])?.role, 'graph');
    assert.equal(store.findReusableSession(projectId, null, [a.id]), null);
  } finally { store.close(); }
});

test('Codex imports are idempotent, preserve original title, message order, events and unknown usage', () => {
  const { store, projectId } = setup();
  try {
    const first = store.createSession(projectId, { title: '원래 세션 이름', externalThreadId: 'codex-original', source: 'import', role: '기획 인터뷰어', createdAt: 10 });
    assert.equal(store.createSession(projectId, { title: '중복 수입', externalThreadId: 'codex-original', source: 'import' }).id, first.id);
    assert.equal(store.listSessions({ projectId }).items.length, 1);
    assert.equal(store.getSession(first.id).title, '원래 세션 이름');
    store.addMessage(first.id, { externalId: 'unknown-time', role: 'system', content: 'timestamp unavailable', createdAt: 0, trackConversation: false });
    store.addMessage(first.id, { externalId: 'unknown-user-time', role: 'user', content: 'time unavailable', createdAt: 0, trackConversation: false });
    assert.equal(store.getSession(first.id).lastConversationAt, null);

    const a = store.addMessage(first.id, { externalId: 'item1', role: 'user', content: '질문', createdAt: 100 });
    assert.equal(store.addMessage(first.id, { externalId: 'item1', role: 'user', content: '중복', createdAt: 200 }).id, a.id);
    store.addMessage(first.id, { externalId: 'item2', role: 'assistant', content: '답변', createdAt: 100 });
    assert.deepEqual(store.listMessages(first.id).filter(message => message.createdAt === 100).map(message => message.content), ['질문', '답변']);
    const event = store.appendEvent(first.id, 'thread/tokenUsage/updated', { total: { inputTokens: 42 } });
    assert.equal(store.listEvents(first.id, event.id).length, 0);
    assert.deepEqual(store.listEvents(first.id)[0].payload, { total: { inputTokens: 42 } });
    const usage = store.saveUsage(first.id, { turnId: 'turn1', inputTokens: 42, outputTokens: 4, raw: { total: 46 } });
    assert.equal(usage.modelContextWindow, null);
    assert.equal(usage.cachedInputTokens, null);
    assert.equal(usage.inputTokens, 42);
    store.saveUsage(first.id, { turnId: 'turn1', inputTokens: 50, raw: { total: 54 } });
    assert.equal(store.listUsage(first.id).length, 1);
    assert.equal(store.listUsage(first.id)[0].inputTokens, 50);
    const other = store.createProject({ name: '다른 것', rootPath: '/imports-other' });
    assert.throws(() => store.createSession(other.id, { title: 'wrong', externalThreadId: 'codex-original' }), /another project/);
  } finally { store.close(); }
});

test('raw execution records are immutable and never complete a feature automatically', () => {
  const { store, projectId } = setup();
  try {
    const feature = store.createNode(projectId, { kind: 'feature', title: '기능' });
    const execution = store.recordExecution(projectId, { title: '실행한 API 응답', kind: 'api', status: 'passed', output: 'HTTP 200', request: { method: 'POST' }, response: { status: 200 }, startedAt: 10, finishedAt: 12 });
    assert.equal(execution.execution!.output, 'HTTP 200');
    assert.equal(execution.status, 'completed');
    store.createEdge(projectId, { sourceId: feature.id, targetId: execution.id, kind: 'related' });
    assert.equal(store.getNode(projectId, feature.id).status, 'pending');
    assert.throws(() => store.updateNode(projectId, execution.id, { status: 'failed' }), /immutable/);
    assert.throws(() => store.db.prepare('UPDATE executions SET output=? WHERE id=?').run('가짜 출력', execution.executionId!), /immutable/);
    assert.throws(() => store.db.prepare('DELETE FROM executions WHERE id=?').run(execution.executionId!), /immutable/);
    assert.throws(() => store.recordExecution(projectId, { title: 'bad time', kind: 'command', status: 'failed', output: '', startedAt: 10, finishedAt: 9 }), /before/);
  } finally { store.close(); }
});

test('multi-operation transactions and failed evidence capture leave no partial state', () => {
  const { store, projectId } = setup();
  try {
    const node = store.createNode(projectId, { id: 'reserved', kind: 'feature', title: 'existing' });
    assert.throws(() => store.captureEvidence(projectId, { id: node.id, title: 'dup', sourceKind: 'message', source: { threadId: 't', messageId: 'm' }, content: 'raw' }), /UNIQUE/);
    assert.equal(store.db.prepare('SELECT count(*) count FROM evidence').get()!.count, 0);
    assert.throws(() => store.transaction(() => {
      store.createSession(projectId, { id: 'rollback', title: 'session' });
      store.captureEvidence(projectId, { title: '문서', sourceKind: 'file', source: { path: 'x', startLine: 1, endLine: 1 }, content: '원문' });
      throw new Error('rollback batch');
    }), /rollback batch/);
    assert.throws(() => store.getSession('rollback'), StoreError);
    assert.equal(store.db.prepare('SELECT count(*) count FROM evidence').get()!.count, 0);
  } finally { store.close(); }
});

function observedCommand(store: Store, projectId: string, command: string, status: 'passed' | 'failed' | 'interrupted' | 'unverified', time: number) {
  return store.recordExecution(projectId, { title: command, kind: 'command', command, status,
    output: status === 'passed' ? 'fixture: command finished successfully' : 'fixture: command did not pass',
    exitCode: status === 'passed' ? 0 : status === 'failed' ? 1 : null, startedAt: time, finishedAt: time + 1 });
}

test('feature acceptance requires a nonempty fixed check set and every observed check passing', () => {
  const { store, projectId } = setup();
  try {
    const feature = store.createNode(projectId, { kind: 'feature', title: '시나리오 기준 완료' });
    assert.deepEqual(store.featureAcceptance(projectId, feature.id), { checks: [], total: 0, passed: 0, fulfilled: false });
    assert.throws(() => store.updateNode(projectId, feature.id, { status: 'completed' }), /all defined checks/);
    assert.throws(() => store.createNode(projectId, { kind: 'feature', title: '완료 주장', status: 'completed' }), /all defined checks/);
    assert.throws(() => store.defineFeatureChecks(projectId, feature.id, []), /at least one/);
    const checks = [
      { id: 'scenario', kind: 'scenario' as const, label: '반복 요청 시나리오', command: 'node scenario.mjs' },
      { id: 'red-test', kind: 'test' as const, label: 'Red에서 정한 테스트', command: 'node --test test.mjs' },
    ];
    assert.equal(store.defineFeatureChecks(projectId, feature.id, checks).total, 2);
    const scenario = observedCommand(store, projectId, checks[0].command, 'passed', 10);
    const first = store.observeFeatureCheckResult(projectId, feature.id, scenario.executionId!);
    assert.equal(first.passed, 1); assert.equal(first.fulfilled, false);
    assert.equal(store.getNode(projectId, feature.id).status, 'pending');
    const tests = observedCommand(store, projectId, checks[1].command, 'passed', 20);
    const all = store.observeFeatureCheckResult(projectId, feature.id, tests.executionId!);
    assert.equal(all.fulfilled, true); assert.equal(all.passed, 2);
    assert.equal(store.getNode(projectId, feature.id).status, 'completed');
    assert.equal(store.listGraph(projectId).nodes.find(node => node.id === feature.id)!.acceptance!.fulfilled, true);
    assert.equal(all.checks[0].execution!.output, scenario.execution!.output);
    const failed = observedCommand(store, projectId, checks[1].command, 'failed', 30);
    assert.equal(store.observeFeatureCheckResult(projectId, feature.id, failed.executionId!).fulfilled, false);
    assert.equal(store.getNode(projectId, feature.id).status, 'pending');
    assert.equal(store.featureAcceptance(projectId, feature.id).checks[1].executionId, failed.executionId);
    assert.equal(store.observeFeatureCheckResult(projectId, feature.id, tests.executionId!).fulfilled, false);
    assert.equal(store.featureAcceptance(projectId, feature.id).checks[1].executionId, failed.executionId, 'older pass cannot overwrite a newer failure');
    const retry = observedCommand(store, projectId, checks[1].command, 'passed', 40);
    assert.equal(store.observeFeatureCheckResult(projectId, feature.id, retry.executionId!).fulfilled, true);
    assert.equal(store.defineFeatureChecks(projectId, feature.id, checks).fulfilled, false);
    assert.ok(store.featureAcceptance(projectId, feature.id).checks.every(check => check.executionId === null));
    assert.equal(store.getNode(projectId, feature.id).status, 'pending');
    assert.throws(() => store.defineFeatureChecks(projectId, feature.id, [checks[0], checks[0]]), /Duplicate/);
    assert.throws(() => store.defineFeatureChecks(projectId, feature.id, [{ ...checks[0], command: ' ' }]), /check.command/);
    assert.equal(store.featureAcceptance(projectId, feature.id).total, 2, 'invalid redefinition preserves existing check set');
  } finally { store.close(); }
});

test('acceptance observes exact commands, rejects API/cross-project claims and treats interrupted or unknown as not passed', () => {
  const { store, projectId } = setup();
  try {
    const feature = store.createNode(projectId, { kind: 'feature', title: '정확한 결과 연결' });
    const noChecks = store.createNode(projectId, { kind: 'feature', title: '미정 기준' });
    const task = store.createNode(projectId, { kind: 'task', title: '작업' });
    const check = { id: 'test', label: '실제 명령', kind: 'test' as const, command: 'node test.mjs' };
    assert.throws(() => store.defineFeatureChecks(projectId, task.id, [check]), /feature or requirement/);
    store.defineFeatureChecks(projectId, feature.id, [check]);
    const whitespace = observedCommand(store, projectId, 'node test.mjs ', 'passed', 10);
    assert.equal(store.observeFeatureCheckResult(projectId, feature.id, whitespace.executionId!).passed, 0);
    assert.equal(store.observeFeatureCheckResult(projectId, noChecks.id, whitespace.executionId!).fulfilled, false);
    assert.equal(store.getNode(projectId, noChecks.id).status, 'pending');
    const api = store.recordExecution(projectId, { title: 'HTTP 성공', kind: 'api', command: check.command, status: 'passed', output: '200 OK' });
    assert.throws(() => store.observeFeatureCheckResult(projectId, feature.id, api.executionId!), /observed test or command/);
    const other = store.createProject({ name: '다른 프로젝트', rootPath: '/acceptance-other' });
    const foreign = observedCommand(store, other.id, check.command, 'passed', 20);
    assert.throws(() => store.observeFeatureCheckResult(projectId, feature.id, foreign.executionId!), /not found/);
    const pass = observedCommand(store, projectId, check.command, 'passed', 30);
    store.observeFeatureCheckResult(projectId, feature.id, pass.executionId!);
    for (const [status, time] of [['interrupted', 40], ['unverified', 50]] as const) {
      const execution = observedCommand(store, projectId, check.command, status, time);
      assert.equal(store.observeFeatureCheckResult(projectId, feature.id, execution.executionId!).fulfilled, false);
      assert.equal(store.getNode(projectId, feature.id).status, 'pending');
    }
    assert.throws(() => store.db.prepare('UPDATE executions SET status=? WHERE id=?').run('passed', pass.executionId!), /immutable/);
    assert.throws(() => store.db.prepare('UPDATE feature_checks SET execution_id=? WHERE feature_id=?').run(api.executionId!, feature.id), /exact observed command/);
    assert.equal(store.featureAcceptance(projectId, feature.id).fulfilled, false);
  } finally { store.close(); }
});

test('feature checks migrate an existing database and persist actual associations across restart', () => {
  const folder = mkdtempSync(join(tmpdir(), 'proofstill-checks-'));
  try {
    const path = join(folder, 'data.sqlite');
    const old = new DatabaseSync(path);
    old.exec('PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(name TEXT PRIMARY KEY) STRICT');
    old.exec(readFileSync(new URL('../server/migrations/001_initial.sql', import.meta.url), 'utf8'));
    old.prepare('INSERT INTO schema_migrations VALUES(?)').run('001_initial.sql');
    old.prepare('INSERT INTO projects VALUES(?,?,?,?)').run('existing-project', '기존 프로젝트', '/existing', 1);
    old.prepare("INSERT INTO nodes(id,project_id,kind,title,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run('existing-feature', 'existing-project', 'feature', '기존 기능', 'completed', 1, 1);
    old.close();
    let store = new Store(path);
    assert.equal(store.getNode('existing-project', 'existing-feature').acceptance!.total, 0);
    assert.equal(store.getNode('existing-project', 'existing-feature').status, 'pending', 'old completed labels without checks are not verification evidence');
    store.defineFeatureChecks('existing-project', 'existing-feature', [{ id: 'fixed', label: '시나리오', kind: 'scenario', command: 'node scenario.mjs' }]);
    const result = observedCommand(store, 'existing-project', 'node scenario.mjs', 'passed', 100);
    store.observeFeatureCheckResult('existing-project', 'existing-feature', result.executionId!);
    store.close();
    store = new Store(path);
    const feature = store.getNode('existing-project', 'existing-feature');
    assert.equal(feature.status, 'completed');
    assert.equal(feature.acceptance!.fulfilled, true);
    assert.equal(feature.acceptance!.checks[0].executionId, result.executionId);
    assert.equal(feature.acceptance!.checks[0].execution!.output, result.execution!.output);
    assert.deepEqual(store.db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map(row => row.name),
      readdirSync(new URL('../server/migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort());
    store.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
