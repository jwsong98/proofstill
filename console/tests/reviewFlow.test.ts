import test from 'node:test';
import assert from 'node:assert/strict';
import type { Graph, GraphNode } from '../server/types.ts';
import { evidenceLabel, flowPositions, reviewConnections } from '../web/reviewFlow.ts';

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

test('결과에서 시작되는 후속 작업도 오른쪽으로 이어진다', () => {
  const graph = { nodes: [node('follow', 'task'), node('result', 'result'), node('work', 'task'), node('req', 'requirement')], edges: [
    edge('req', 'work', 'precedes'), edge('work', 'result', 'precedes'), edge('result', 'follow', 'precedes'),
  ] };
  const positions = flowPositions(graph);
  for (const { sourceId, targetId } of graph.edges) assert.ok(positions.get(sourceId)!.x < positions.get(targetId)!.x);
  graph.edges.push(edge('follow', 'work', 'precedes'));
  assert.equal(flowPositions(graph).size, 4);
});
