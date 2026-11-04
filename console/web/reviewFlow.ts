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
  const ordered = graph.nodes.map(node => ({ node, at: reviewTime(node).at }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.node.id.localeCompare(b.node.id));
  const lastRow = new Map<number, number>();
  let row = 0, dayGap = 0, previousDay: string | undefined;
  return new Map(ordered.map(({ node, at }) => {
    const day = at == null ? 'unknown' : new Date(at).toDateString();
    if (previousDay !== undefined && day !== previousDay) {
      row++;
      dayGap += 24;
    }
    previousDay = day;
    const column = rank(node.id);
    // Share a row across columns while keeping older records above newer ones.
    row = Math.max(row, (lastRow.get(column) ?? -1) + 1);
    lastRow.set(column, row);
    return [node.id, { x: column * 256, y: row * 120 + dayGap }];
  }));
}

export function reviewTitle(node: GraphNode, limit = 120): string {
  if (node.evidence?.sourceKind !== 'message') return node.title;
  const excerpt = node.evidence.content.replace(/\s+/g, ' ').trim();
  if (!excerpt) return '내용이 비어 있는 대화';
  return excerpt.length > limit ? excerpt.slice(0, limit - 1).trimEnd() + '…' : excerpt;
}

export function reviewTime(node: GraphNode): { at: number | null; label: string } {
  const valid = (at: unknown): at is number => typeof at === 'number' && at > 0 && Number.isFinite(new Date(at).getTime());
  const evidence = node.evidence;
  if (evidence?.sourceKind === 'message' && valid(evidence.source.createdAt)) {
    return { at: evidence.source.createdAt, label: '발언' };
  }
  if (evidence) {
    return { at: valid(evidence.capturedAt) ? evidence.capturedAt : null, label: '보존' };
  }
  return { at: valid(node.createdAt) ? node.createdAt : null, label: '기록' };
}
