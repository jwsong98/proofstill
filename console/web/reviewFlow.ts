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

const stages = ['발언·근거', '요구사항·이슈', '결정', '기능·작업'] as const;
const stageOf: Record<GraphNode['kind'], number> = {
  evidence: 0, requirement: 1, issue: 1, decision: 2, feature: 3, task: 3, result: 3,
};

export function layoutReviewBoard(nodes: GraphNode[]) {
  const ordered = nodes.map(node => ({ id: node.id, stage: stageOf[node.kind], at: reviewTime(node).at }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.id.localeCompare(b.id));
  const groups = new Map<string, { at: number | null; lanes: (typeof ordered)[] }>();
  for (const entry of ordered) {
    const day = entry.at == null ? 'unknown' : new Date(entry.at).toDateString();
    const group = groups.get(day) ?? { at: entry.at, lanes: stages.map(() => []) };
    group.lanes[entry.stage].push(entry);
    groups.set(day, group);
  }

  let width = 0;
  const lanes = stages.flatMap((label, index) => {
    const max = Math.max(0, ...[...groups.values()].map(group => group.lanes[index].length));
    if (!max) return [];
    const count = Math.min(3, Math.ceil(Math.sqrt(max / 2)));
    const x = width;
    width += count * columnStep + 24;
    return [{ index, label, x, count }];
  });

  const positions = new Map<string, { x: number; y: number }>();
  const days = [];
  let y = 0;
  for (const group of groups.values()) {
    let height = 0;
    const bands = lanes.flatMap(lane => {
      const entries = group.lanes[lane.index];
      if (!entries.length) return [];
      const rows = Math.ceil(entries.length / lane.count);
      height = Math.max(height, rows);
      const columns: { x: number; first: number | null; last: number | null }[] = [];
      for (let start = 0; start < entries.length; start += rows) {
        const x = lane.x + columns.length * columnStep;
        const column = entries.slice(start, start + rows);
        columns.push({ x, first: column[0].at, last: column[column.length - 1].at });
        column.forEach((entry, row) => positions.set(entry.id, { x, y: y + 68 + row * rowStep }));
      }
      return [{ x: lane.x, label: lane.label, width: lane.count * columnStep - (columnStep - boardNodeWidth), columns }];
    });
    days.push({ y, at: group.at, bands, width: width - 24 - (columnStep - boardNodeWidth) });
    y += 76 + height * rowStep;
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
