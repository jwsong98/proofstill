import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSession, type SessionDetail } from '../web/api.ts';
import { sessionActivities } from '../web/sessionActivities.ts';
import type { SessionEvent } from '../server/types.ts';
const event = (id: number, method: string, payload: unknown): SessionEvent => ({ id, method, payload, sessionId: 'session', createdAt: id });
test('legacy server detail defaults omitted arrays so sessions can render', () => {
  const detail = normalizeSession({ session: { id: 's' } } as SessionDetail);
  assert.deepEqual([detail.events.length, detail.messages.length, detail.usage.length, detail.pending.length], [0, 0, 0, 0]);
});
test('command activity retains streaming output then uses authoritative completion once', () => {
  const start = event(1, 'item/started', { turnId: 't', item: { id: 'cmd', type: 'commandExecution', status: 'inProgress', command: 'npm test' } });
  const delta = event(2, 'item/commandExecution/outputDelta', { itemId: 'cmd', delta: 'running\n' });
  assert.equal(sessionActivities([start, delta])[0].item.aggregatedOutput, 'running\n');
  const complete = event(3, 'item/completed', { turnId: 't', item: { id: 'cmd', type: 'commandExecution', status: 'completed', exitCode: 1, aggregatedOutput: 'failed\n' } });
  const rows = sessionActivities([start, delta, complete]);
  assert.equal(rows.length, 1); assert.equal(rows[0].createdAt, 1); assert.equal(rows[0].item.exitCode, 1); assert.equal(rows[0].item.aggregatedOutput, 'failed\n');
});

test('interrupted or failed turns end only their unfinished command display without changing raw evidence', () => {
  const start = event(1, 'item/started', { turnId: 't', item: { id: 'cmd', type: 'commandExecution', status: 'inProgress', exitCode: null, aggregatedOutput: 'started' } });
  const other = event(2, 'item/started', { turnId: 'other', item: { id: 'other-cmd', type: 'commandExecution', status: 'inProgress' } });
  for (const status of ['interrupted', 'failed']) {
    const end = event(3, 'turn/completed', { turn: { id: 't', status } });
    const events = [start, other, end], original = JSON.stringify(events);
    const rows = sessionActivities(events);
    assert.equal(rows[0].displayStatus, status === 'interrupted' ? 'interrupted' : 'unverified');
    assert.deepEqual(rows[0].turnEnd, { status, eventId: 3 });
    assert.equal(rows[0].item.status, 'inProgress');
    assert.equal(rows[0].item.exitCode, null);
    assert.equal(rows[0].item.aggregatedOutput, 'started');
    assert.equal(rows[1].displayStatus, undefined);
    assert.equal(JSON.stringify(events), original);
    const completed = event(4, 'item/completed', { turnId: 't', item: { id: 'cmd', type: 'commandExecution', status: 'completed', exitCode: 7 } });
    assert.equal(sessionActivities([...events, completed])[0].displayStatus, undefined);
    assert.equal(sessionActivities([...events, completed])[0].item.exitCode, 7);
  }
});

test('child terminal events cannot end parent commands, even when turn IDs collide', () => {
  const parent = event(1, 'item/started', { turnId: 't', item: { id: 'parent-cmd', type: 'commandExecution', status: 'inProgress' } });
  const child = event(2, 'item/started', { turnId: 't', agentThreadId: 'child', item: { id: 'child-cmd', type: 'commandExecution', status: 'inProgress' } });
  const childEnd = event(3, 'turn/completed', { agentThreadId: 'child', turn: { id: 't', status: 'interrupted' } });
  const rows = sessionActivities([parent, child, childEnd]);
  assert.equal(rows[0].displayStatus, undefined);
  assert.equal(rows[1].displayStatus, 'interrupted');
  const parentEnd = event(3, 'turn/completed', { turn: { id: 't', status: 'failed' } });
  const reversed = sessionActivities([parent, child, parentEnd]);
  assert.equal(reversed[0].displayStatus, 'unverified');
  assert.equal(reversed[1].displayStatus, undefined);
  assert.equal(sessionActivities([parent, event(4, 'turn/completed', { turn: { id: 't', status: 'completed' } })])[0].displayStatus, undefined);
});
test('agent states retain every receiver result and child assistant output', () => {
  const rows = sessionActivities([
    event(1, 'item/completed', { item: { id: 'wait', type: 'collabAgentToolCall', tool: 'wait', agentsStates: { a: { status: 'completed', message: 'A 결과' }, b: { status: 'errored', message: 'B 오류' } } } }),
    event(2, 'item/completed', { item: { id: 'answer', type: 'subAgentResult', agentThreadId: 'a', text: '실제 결과' } }),
  ]);
  assert.equal(rows.length, 2); assert.equal(rows[0].item.agentsStates.b.message, 'B 오류'); assert.equal(rows[1].item.text, '실제 결과');
});

test('child turn events cannot change the parent composer state', async () => {
  const { isParentTurnEvent } = await import('../web/sessionActivities.ts');
  assert.equal(isParentTurnEvent(event(1, 'turn/completed', { agentThreadId: 'child' })), false);
  assert.equal(isParentTurnEvent(event(2, 'turn/completed', { threadId: 'parent' })), true);
});

test('consecutive execution activities collapse together without absorbing conversation messages', async () => {
  const { groupSessionTimeline } = await import('../web/sessionActivities.ts');
  const activities = sessionActivities([
    event(2, 'item/completed', { item: { id: 'a', type: 'commandExecution' } }),
    event(3, 'item/completed', { item: { id: 'b', type: 'collabAgentToolCall' } }),
    event(5, 'item/completed', { item: { id: 'c', type: 'commandExecution' } }),
  ]);
  const message = (id: string, createdAt: number) => ({ id, createdAt, sessionId: 's', externalId: null, role: 'assistant' as const, content: id, turnId: null });
  const groups = groupSessionTimeline([message('first', 1), message('progress', 4), message('final', 6)], activities);
  assert.deepEqual(groups.map(g => g.kind), ['message', 'activities', 'message', 'activities', 'message']);
  assert.equal(groups[1].kind === 'activities' && groups[1].activities.length, 2);
  const updated = groupSessionTimeline([message('first', 1)], [...activities]);
  assert.equal(updated[1].key, groups[1].key);
  assert.equal(groupSessionTimeline([], []).length, 0);
});
