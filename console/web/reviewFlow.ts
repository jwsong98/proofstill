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

export const boardNodeWidth = 192;
const columnStep = 232;
const rowStep = 116;

export function layoutReviewBoard(nodes: GraphNode[]) {
  const ordered = nodes.map(node => ({ id: node.id, at: reviewTime(node).at }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.id.localeCompare(b.id));
  const groups = new Map<string, typeof ordered>();
  for (const entry of ordered) {
    const day = entry.at == null ? 'unknown' : new Date(entry.at).toDateString();
    const group = groups.get(day) ?? [];
    group.push(entry);
    groups.set(day, group);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const days = [];
  let y = 0;
  for (const entries of groups.values()) {
    // Balance busy dates across both axes, even when many records share a timestamp.
    const rows = Math.ceil(Math.sqrt(entries.length / 2));
    const columns: { x: number; first: number | null; last: number | null }[] = [];
    for (let start = 0; start < entries.length; start += rows) {
      const x = columns.length * columnStep;
      const column = entries.slice(start, start + rows);
      columns.push({ x, first: column[0].at, last: column[column.length - 1].at });
      column.forEach((entry, row) => positions.set(entry.id, { x, y: y + 48 + row * rowStep }));
    }
    days.push({ y, at: entries[0].at, columns, width: columns[columns.length - 1].x + boardNodeWidth });
    y += 56 + rows * rowStep;
  }
  return { positions, days };
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
