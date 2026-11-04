import type { Graph, GraphEdge, GraphNode } from '../server/types.ts';

export function evidenceLabel(node: GraphNode): string | undefined {
  if (node.evidence?.sourceKind === 'file') return '문서 원문';
  if (node.evidence?.sourceKind === 'message') return node.evidence.source.role === 'user' ? '사용자 발언' : '대화 기록';
}

export function reviewConnections(graph: Graph, id: string) {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const incoming: Link[] = [], outgoing: Link[] = [], related: Link[] = [], evidence: Link[] = [];
  for (const edge of graph.edges) {
    if (edge.sourceId !== id && edge.targetId !== id) continue;
    const node = nodes.get(edge.sourceId === id ? edge.targetId : edge.sourceId);
    if (!node) continue;
    const bucket = edge.kind === 'precedes' ? (edge.sourceId === id ? outgoing : incoming) : evidenceLabel(node) ? evidence : related;
    bucket.push({ node, edge });
  }
  return { incoming, outgoing, related, evidence };
}

type Link = { node: GraphNode; edge: GraphEdge };

const stage: Record<GraphNode['kind'], number> = { evidence: 0, requirement: 1, issue: 1, decision: 2, feature: 3, task: 3, result: 4 };

export function flowPositions(graph: Graph) {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const predecessors = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== 'precedes' || !nodes.has(edge.sourceId) || !nodes.has(edge.targetId)) continue;
    const sources = predecessors.get(edge.targetId) ?? [];
    sources.push(edge.sourceId);
    predecessors.set(edge.targetId, sources);
  }
  const ranks = new Map<string, number>(), visiting = new Set<string>();
  function rank(id: string): number {
    if (ranks.has(id)) return ranks.get(id)!;
    const base = stage[nodes.get(id)!.kind];
    // A cycle can't be laid out entirely forward. Keep its return arrow visible.
    if (visiting.has(id)) return -1;
    visiting.add(id);
    const column = (predecessors.get(id) ?? []).reduce((next, source) => Math.max(next, rank(source) + 1), base);
    visiting.delete(id);
    ranks.set(id, column);
    return column;
  }
  const rows = new Map<number, number>();
  return new Map(graph.nodes.map(node => {
    const column = rank(node.id);
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return [node.id, { x: column * 256, y: row * 104 }];
  }));
}
