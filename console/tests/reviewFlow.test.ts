import test from 'node:test';
import assert from 'node:assert/strict';
import type { Graph, GraphNode } from '../server/types.ts';
import { evidenceLabel, layoutReviewBoard, reviewConnections, reviewTime, reviewTitle } from '../web/reviewFlow.ts';

function node(id: string, kind: GraphNode['kind'], evidence?: GraphNode['evidence']): GraphNode {
  return { id, kind, evidence, projectId: 'p', title: id, body: '', status: 'pending', x: null, y: null, evidenceId: null, executionId: null, createdAt: 0, updatedAt: 0 };
}
function edge(sourceId: string, targetId: string, kind: Graph['edges'][number]['kind']) {
  return { id: sourceId + targetId, projectId: 'p', sourceId, targetId, kind, reason: '근거', createdAt: 0 };
}
const source = (sourceKind: 'file' | 'message', role?: string) => ({ id: 'source', projectId: 'p', sourceKind, source: { role }, content: '원문', capturedAt: 0 } as const);

test('원문과 발언을 구분하고 연관 기록에서 선후를 추정하지 않는다', () => {
  const requirement = node('r', 'requirement'), document = node('z', 'evidence', source('file'));
  const opinion = node('a', 'evidence', source('message', 'user')), assistant = node('b', 'evidence', source('message', 'assistant'));
  const graph = { nodes: [requirement, document, opinion, assistant, node('t', 'task')], edges: [
    edge('r', 'z', 'related'), edge('a', 'r', 'related'), edge('b', 'r', 'related'), edge('r', 't', 'precedes'),
  ] };
  const links = reviewConnections(graph, 'r');
  assert.deepEqual(links.evidence.map(link => evidenceLabel(link.node)), ['문서 원문', '사용자 발언', '대화 기록']);
  assert.equal(links.incoming.length, 0);
  assert.deepEqual(links.outgoing.map(link => link.node.id), ['t']);
});

test('같은 시각의 여러 종류 노드를 가로와 세로로 나눠 겹치지 않게 배치한다', () => {
  const kinds = ['decision', 'task', 'requirement'] as const;
  const nodes = Array.from({ length: 24 }, (_, index) => ({
    ...node(String(index), kinds[index % kinds.length]), createdAt: 1_700_000_000_000,
  }));
  const { positions, days } = layoutReviewBoard(nodes);
  const points = [...positions.values()];
  assert.equal(days.length, 1);
  assert.equal(new Set(points.map(({ x, y }) => `${x},${y}`)).size, nodes.length);
  assert.ok(new Set(points.map(({ x }) => x)).size > 1);
  const requirements = nodes.filter(node => node.kind === 'requirement').map(node => positions.get(node.id)!);
  const decisions = nodes.filter(node => node.kind === 'decision').map(node => positions.get(node.id)!);
  assert.ok(new Set(requirements.map(({ x }) => x)).size > 1);
  assert.ok(Math.max(...requirements.map(({ x }) => x)) < Math.min(...decisions.map(({ x }) => x)));
});

test('보드 배치는 발언 시각과 나중에 기록된 발언도 결정과 작업 왼쪽에 둔다', () => {
  const day = new Date(2026, 10, 4, 9).getTime();
  const opinion = node('opinion', 'evidence', {
    ...source('message', 'user'), content: '  먼저 확인한\n  판단 기준  ',
    source: { role: 'user', createdAt: day }, capturedAt: day + 4 * 86_400_000,
  });
  const decision = { ...node('decision', 'decision'), createdAt: day + 3_600_000 };
  const task = { ...node('task', 'task'), createdAt: day + 86_400_000 };
  const later = node('later', 'evidence', { ...source('message', 'user'), capturedAt: day + 86_400_000 });
  const { positions } = layoutReviewBoard([task, later, decision, opinion]);
  assert.equal(reviewTitle(opinion), '먼저 확인한 판단 기준');
  assert.deepEqual(reviewTime(opinion), { at: day, label: '발언' });
  assert.deepEqual(reviewTime(later), { at: later.evidence!.capturedAt, label: '보존' });
  assert.ok(positions.get('opinion')!.x < positions.get('decision')!.x);
  assert.equal(positions.get('opinion')!.y, positions.get('decision')!.y);
  assert.ok(positions.get('decision')!.y < positions.get('task')!.y);
  assert.equal(positions.get('task')!.y, positions.get('later')!.y);
  assert.equal(positions.get('opinion')!.x, positions.get('later')!.x);
  assert.ok(positions.get('later')!.x < positions.get('decision')!.x);
  assert.ok(positions.get('decision')!.x < positions.get('task')!.x);
});
