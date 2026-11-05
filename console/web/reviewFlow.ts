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

const stageOf: Record<GraphNode['kind'], number> = {
  evidence: 0, requirement: 1, issue: 1, decision: 2, feature: 2, task: 3, result: 3,
};

export function layoutReviewBoard(nodes: GraphNode[], edges: GraphEdge[] = []) {
  const ordered = nodes.map(node => ({ id: node.id, stage: stageOf[node.kind], at: reviewTime(node).at, user: evidenceLabel(node) === '사용자 발언' }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.id.localeCompare(b.id));
  const byId = new Map(ordered.map(entry => [entry.id, entry]));
  const timeOrder = new Map(ordered.map((entry, index) => [entry.id, index]));
  const parents = new Map<string, { id: string; edgeId: string; stage: number; directed: boolean }>();
  const comesBefore = (a: typeof ordered[number], b: typeof ordered[number]) =>
    a.stage < b.stage || (a.stage === b.stage && timeOrder.get(a.id)! < timeOrder.get(b.id)!);
  for (const edge of edges) {
    let parent = byId.get(edge.sourceId), child = byId.get(edge.targetId);
    if (!parent || !child) continue;
    const directed = edge.kind === 'precedes';
    if (!directed && comesBefore(child, parent)) [parent, child] = [child, parent];
    if (!comesBefore(parent, child)) continue;
    const previous = parents.get(child.id);
    // An explicit predecessor wins. Otherwise prefer the nearest role and break ties stably.
    if (!previous || Number(directed) > Number(previous.directed) ||
        (directed === previous.directed && (parent.stage > previous.stage ||
          (parent.stage === previous.stage && parent.id.localeCompare(previous.id) < 0)))) {
      parents.set(child.id, { id: parent.id, edgeId: edge.id, stage: parent.stage, directed });
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
  let nextRow = 0;
  function place(id: string, depth: number): number {
    const rows = children.get(id)?.map(child => place(child, depth + 1));
    const row = rows?.length ? (rows[0] + rows[rows.length - 1]) / 2 : nextRow++;
    positions.set(id, { x: depth * columnStep, y: row * rowStep });
    return row;
  }

  const roots = ordered.filter(entry => !parents.has(entry.id));
  const isolated = roots.filter(entry => !children.has(entry.id));
  function placeLoose(entries: typeof ordered) {
    entries.forEach((entry, index) => positions.set(entry.id, {
      x: (index % 4) * columnStep, y: (nextRow + Math.floor(index / 4)) * rowStep,
    }));
    nextRow += Math.ceil(entries.length / 4);
  }

  placeLoose(isolated.filter(entry => entry.user));
  const connectedRoots = roots.filter(entry => children.has(entry.id))
    .sort((a, b) => Number(b.user) - Number(a.user) || a.stage - b.stage);
  for (const entry of connectedRoots) {
    place(entry.id, 0);
    nextRow += .25;
  }
  placeLoose(isolated.filter(entry => !entry.user).sort((a, b) => a.stage - b.stage));
  return { positions, branchEdges: new Set([...parents.values()].map(parent => parent.edgeId)) };
}

export function collapsibleClouds(graph: Graph, visibleNodes: GraphNode[]) {
  const visible = new Set(visibleNodes.map(node => node.id));
  const structural = new Set(graph.nodes.filter(node => ['decision', 'feature', 'requirement'].includes(node.kind)).map(node => node.id));
  const groups = new Map<string, string[]>();
  for (const { representativeId, memberIds } of graph.clouds ?? []) {
    if (!visible.has(representativeId)) continue;
    const group = new Set([representativeId, ...memberIds]);
    const protectedIds = new Set<string>();
    for (const { sourceId, targetId } of graph.edges) {
      if (structural.has(sourceId) && !group.has(sourceId)) protectedIds.add(targetId);
      if (structural.has(targetId) && !group.has(targetId)) protectedIds.add(sourceId);
    }
    const members = memberIds.filter(id => visible.has(id) && !structural.has(id) && !protectedIds.has(id));
    if (members.length) groups.set(representativeId, members);
  }
  return groups;
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
