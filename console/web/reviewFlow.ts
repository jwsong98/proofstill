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

const stages = ['발언·근거', '요구사항·이슈', '결정·기능', '작업·결과'] as const;
const stageOf: Record<GraphNode['kind'], number> = {
  evidence: 0, requirement: 1, issue: 1, decision: 2, feature: 2, task: 3, result: 3,
};

export function layoutReviewBoard(nodes: GraphNode[], edges: GraphEdge[] = []) {
  const ordered = nodes.map(node => ({ id: node.id, stage: stageOf[node.kind], at: reviewTime(node).at }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.id.localeCompare(b.id));
  const byId = new Map(ordered.map(entry => [entry.id, entry]));
  const parents = new Map<string, { id: string; stage: number; directed: boolean }>();
  for (const edge of edges) {
    let parent = byId.get(edge.sourceId), child = byId.get(edge.targetId);
    if (!parent || !child) continue;
    const directed = edge.kind === 'precedes';
    if (!directed && parent.stage > child.stage) [parent, child] = [child, parent];
    if (parent.stage >= child.stage) continue;
    const previous = parents.get(child.id);
    // An explicit predecessor wins. Otherwise prefer the nearest role and break ties stably.
    if (!previous || Number(directed) > Number(previous.directed) ||
        (directed === previous.directed && (parent.stage > previous.stage ||
          (parent.stage === previous.stage && parent.id.localeCompare(previous.id) < 0)))) {
      parents.set(child.id, { id: parent.id, stage: parent.stage, directed });
    }
  }

  const children = new Map<string, string[]>();
  for (const entry of ordered) {
    const parent = parents.get(entry.id);
    if (!parent) continue;
    const siblings = children.get(parent.id) ?? [];
    siblings.push(entry.id);
    children.set(parent.id, siblings);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let width = 0;
  const bands = stages.flatMap((label, stage) => {
    const entries = ordered.filter(entry => entry.stage === stage);
    if (!entries.length) return [];
    const count = Math.min(3, entries.length);
    const x = width;
    entries.forEach((entry, index) => {
      positions.set(entry.id, { x: x + Math.floor(index * count / entries.length) * columnStep, y: 0 });
    });
    width += count * columnStep + 24;
    return [{ x, label, width: (count - 1) * columnStep + boardNodeWidth }];
  });

  let nextRow = 0;
  function place(id: string): number {
    const branches = children.get(id);
    const rows = branches?.map(place);
    const row = rows?.length ? (rows[0] + rows[rows.length - 1]) / 2 : nextRow++;
    positions.get(id)!.y = 48 + row * rowStep;
    return row;
  }
  for (const entry of ordered) {
    if (!parents.has(entry.id) && children.has(entry.id)) place(entry.id);
  }
  const columnRows = new Map<number, number>();
  for (const entry of ordered) {
    if (parents.has(entry.id) || children.has(entry.id)) continue;
    const position = positions.get(entry.id)!;
    const row = columnRows.get(position.x) ?? nextRow;
    position.y = 48 + row * rowStep;
    columnRows.set(position.x, row + 1);
  }
  return { positions, bands };
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
