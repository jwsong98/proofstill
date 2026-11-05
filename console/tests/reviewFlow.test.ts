import test from 'node:test';
import assert from 'node:assert/strict';
import type { Graph, GraphNode } from '../server/types.ts';
import { focusedReviewGraph, layoutFocusedReview, highlightedReviewLinks, collapsibleClouds, evidenceLabel, layoutReviewBoard, reviewConnections, reviewTime, reviewTitle } from '../web/reviewFlow.ts';

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
  const { positions } = layoutReviewBoard(nodes);
  const points = [...positions.values()];
  assert.equal(new Set(points.map(({ x, y }) => `${x},${y}`)).size, nodes.length);
  assert.ok(new Set(points.map(({ x }) => x)).size > 1);

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
  const { positions } = layoutReviewBoard([task, later, decision, opinion], [edge('opinion', 'decision', 'related'), edge('decision', 'task', 'precedes')]);
  assert.equal(reviewTitle(opinion), '먼저 확인한 판단 기준');
  assert.deepEqual(reviewTime(opinion), { at: day, label: '발언' });
  assert.deepEqual(reviewTime(later), { at: later.evidence!.capturedAt, label: '보존' });
  assert.ok(positions.get('opinion')!.x < positions.get('decision')!.x);
  assert.equal(positions.get('opinion')!.y, positions.get('decision')!.y);
  assert.equal(positions.get('decision')!.y, positions.get('task')!.y);
  assert.ok(positions.get('later')!.y < positions.get('task')!.y);
  assert.ok(positions.get('decision')!.x < positions.get('task')!.x);
});

test('날짜가 달라도 기능과 작업을 요구별 가지에 모은다', () => {
  const nodes = [node('r1', 'requirement'), node('r2', 'requirement'), node('feature', 'feature'),
    node('older', 'task'), node('newer', 'task'), node('other', 'task')]
    .map((record, index) => ({ ...record, createdAt: 1_700_000_000_000 + index * 86_400_000 }));
  const edges = [edge('feature', 'r1', 'related'), edge('feature', 'older', 'precedes'),
    edge('feature', 'newer', 'precedes'), edge('r2', 'other', 'related')];
  const { positions } = layoutReviewBoard(nodes, edges);
  const point = (id: string) => positions.get(id)!;
  assert.equal(point('r1').y, point('feature').y);
  assert.equal(point('feature').y, (point('older').y + point('newer').y) / 2);
  assert.equal(point('r2').y, point('other').y);
  assert.ok(point('other').y > point('newer').y);
  assert.ok(point('r1').x < point('feature').x && point('feature').x < point('older').x);
  assert.equal(point('older').x, point('newer').x);
  assert.ok(point('older').y < point('newer').y);
  assert.equal(point('feature').x - point('r1').x, point('other').x - point('r2').x);
});

test('종류가 여러 단계 차이 나거나 같아도 직접 연결된 노드는 한 열만 이동한다', () => {
  const nodes = [node('source', 'evidence'), node('task-a', 'task'), node('task-b', 'task'), node('requirement', 'requirement')];
  const direct = edge('source', 'task-a', 'precedes'), next = edge('task-a', 'task-b', 'precedes');
  const cross = edge('requirement', 'task-a', 'related');
  const { positions, branchEdges } = layoutReviewBoard(nodes, [cross, direct, next]);
  assert.deepEqual(branchEdges, new Set([direct.id, next.id]));
  assert.equal(positions.get('task-a')!.x - positions.get('source')!.x,
               positions.get('task-b')!.x - positions.get('task-a')!.x);
  assert.equal(positions.get('source')!.y, positions.get('task-b')!.y);
});

test('대표 연결이 없는 사용자 발언도 작업 가지 밑으로 보내지 않는다', () => {
  const task = node('task', 'task');
  const requirement = node('requirement', 'requirement');
  const opinion = node('opinion', 'evidence', source('message', 'user'));
  const { positions } = layoutReviewBoard([requirement, task, opinion], [
    edge('requirement', 'task', 'precedes'), edge('opinion', 'task', 'related'),
  ]);
  assert.ok(positions.get('opinion')!.y < positions.get('requirement')!.y);
  assert.equal(positions.get('requirement')!.y, positions.get('task')!.y);
});

test('클라우드는 주변 항목만 접고 다른 기능과 연결된 항목을 유지한다', () => {
  const nodes = [node('rep', 'decision'), node('task', 'task'), node('shared', 'task'),
    node('external', 'feature'), node('requirement', 'requirement'), node('statement', 'evidence', source('message', 'user'))];
  const graph = { nodes, edges: [edge('rep', 'task', 'related'), edge('shared', 'external', 'related'), edge('statement', 'external', 'related')],
    clouds: [{ representativeId: 'rep', memberIds: ['task', 'shared', 'requirement', 'statement'] }] };
  assert.deepEqual([...collapsibleClouds(graph, nodes)], [['rep', ['task', 'statement']]]);
  assert.equal(collapsibleClouds(graph, nodes.filter(item => item.id !== 'rep')).size, 0);
  assert.deepEqual(graph.clouds[0].memberIds, ['task', 'shared', 'requirement', 'statement']);
});

test('기능과 작업은 왼쪽 근거를 강조하고 요구는 오른쪽 작업을 강조하지 않는다', () => {
  const nodes = [node('source', 'evidence'), node('r', 'requirement'), node('f', 'feature'), node('t', 'task')];
  const edges = [edge('r', 'f', 'precedes'), edge('t', 'r', 'related'), edge('source', 't', 'related'), edge('f', 'source', 'related')];
  assert.deepEqual(highlightedReviewLinks({ nodes, edges }, 'f').nodeIds, new Set(['r', 'source']));
  assert.deepEqual(highlightedReviewLinks({ nodes, edges }, 't').nodeIds, new Set(['r', 'source']));
  assert.equal(highlightedReviewLinks({ nodes, edges }, 'r').edgeIds.size, 0);
  assert.equal(highlightedReviewLinks({ nodes, edges }, null).edgeIds.size, 0);
});

test('포커스는 선택 기능을 중심으로 근거와 작업을 두 가지로 배치한다', () => {
  const graph = { nodes: [node('e1', 'evidence'), node('e2', 'evidence'), node('r', 'requirement'),
    node('f', 'feature'), node('t', 'task')], edges: [
      edge('e1', 'f', 'related'), edge('e2', 'f', 'related'), edge('r', 'f', 'related'), edge('f', 't', 'precedes'),
    ] };
  const { positions } = layoutFocusedReview(graph, 'f');
  assert.equal(new Set([...positions.values()].map(p => p.x + ',' + p.y)).size, 5);
  for (const id of ['e1', 'e2', 'r']) assert.ok(positions.get(id)!.x < positions.get('f')!.x);
  assert.ok(positions.get('t')!.x > positions.get('f')!.x);
  assert.equal(positions.get('t')!.y, positions.get('f')!.y);
});

test('포커스는 명시된 요구와 결정 순서를 보존하고 순서 없는 작업은 같은 열에 둔다', () => {
  const graph = { nodes: [node('e', 'evidence'), node('r', 'requirement'), node('d1', 'decision'),
    node('d2', 'decision'), node('f', 'feature'), node('f2', 'feature'), node('t1', 'task'), node('t2', 'task')],
    edges: [edge('e', 'r', 'precedes'), edge('r', 'd1', 'precedes'), edge('d1', 'd2', 'precedes'),
      edge('d2', 'f', 'related'), edge('f', 'f2', 'related'), edge('f', 't1', 'related'), edge('f', 't2', 'related')] };
  const focused = focusedReviewGraph(graph, 'f');
  assert.equal(focused.nodes.length, 8);
  assert.equal(focused.edges.length, 7);
  const { positions } = layoutFocusedReview(focused, 'f');
  const x = (id: string) => positions.get(id)!.x;
  assert.ok(x('e') < x('r') && x('r') < x('d1') && x('d1') < x('d2'));
  assert.equal(x('f'), x('f2'));
  assert.equal(x('t1'), x('t2'));
  assert.equal(x('f'), x('t1'));
});
