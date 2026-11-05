import { useMemo, useState } from 'react';
import { ReactFlow, Controls, Handle, Position, MarkerType, type Node, type NodeProps } from '@xyflow/react';
import type { Graph, GraphNode, NodeKind } from '../server/types.ts';
import { nodeLabels, statusLabels } from './components.tsx';
import { collapsibleClouds, evidenceLabel, layoutReviewBoard, reviewConnections, reviewTitle, reviewTime } from './reviewFlow.ts';
import './styles/review-flow.css';

const nodeTime = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

type FlowNode = Node<{ record: GraphNode; historical: boolean; connected: boolean; muted: boolean; cloud?: { count: number; expanded: boolean; toggle: () => void } }, 'review'>;
const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];

function edgeSides(source: { x: number; y: number }, target: { x: number; y: number }) {
  if (source.x < target.x) return [Position.Right, Position.Left];
  if (source.x > target.x) return [Position.Left, Position.Right];
  return source.y < target.y ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}
function ReviewNode({ data: { record, historical, connected, muted, cloud }, selected }: NodeProps<FlowNode>) {
  const status = record.execution ? { passed: '통과', failed: '실패', interrupted: '중단', unverified: '미확인' }[record.execution.status] : statusLabels[record.status];
  const { at, label } = reviewTime(record);
  return <div className={`review-node kind-${record.kind}${selected ? ' selected' : ''}${connected ? ' connected' : ''}${muted ? ' muted' : ''}`}>
    {sides.map(position => <Handle key={position} id={position} type="target" position={position} isConnectable={false} />)}
    <div className="review-node-meta"><span className="review-node-kind">{evidenceLabel(record) ?? nodeLabels[record.kind]}</span>{!record.evidence && <span className={record.status === 'failed' || record.execution?.status === 'failed' ? 'danger-text' : ''}>{historical ? '이전 기록' : status}</span>}</div>
    <strong title={reviewTitle(record)}>{reviewTitle(record)}</strong>
    <div className="review-node-time">{at == null ? '시각 미확인' : <time dateTime={new Date(at).toISOString()}>{label} · {nodeTime.format(at)}</time>}</div>
    {cloud && <button type="button" className="nodrag nopan graph-cloud-toggle" aria-expanded={cloud.expanded}
      onClick={event => { event.stopPropagation(); cloud.toggle(); }}>{cloud.expanded ? '묶음 접기' : `+${cloud.count}개 펼치기`}</button>}
    {sides.map(position => <Handle key={position} id={position} type="source" position={position} isConnectable={false} />)}
  </div>;
}
const nodeTypes = { review: ReviewNode };
const fitViewOptions = { padding: .16, maxZoom: 1, minZoom: .2 };

export function DirectionalGraph({ graph, currentNodeIds, selectedId, onSelect, onlyIncomplete, hiddenKinds, onShowAll }: {
  graph: Graph; currentNodeIds: Set<string>; selectedId: string | null; onSelect: (id: string) => void; onlyIncomplete: boolean; hiddenKinds: Set<NodeKind>; onShowAll: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [cloudPreference, setCloudPreference] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCloud = (id: string, open: boolean) => setExpanded(current => {
    const next = new Set(current);
    if (open) next.add(id);
    else next.delete(id);
    return next;
  });
  const visible = useMemo(() => {
    const nodes = graph.nodes.filter(node => !hiddenKinds.has(node.kind) && (!onlyIncomplete || node.kind !== 'feature' || node.status !== 'completed'));
    const ids = new Set(nodes.map(node => node.id));
    return { nodes, edges: graph.edges.filter(edge => ids.has(edge.sourceId) && ids.has(edge.targetId)) };
  }, [graph, hiddenKinds, onlyIncomplete]);
  const clouds = useMemo(() => collapsibleClouds(graph, visible.nodes), [graph, visible.nodes]);
  const cloudMode = cloudPreference ?? clouds.size > 0;
  const collapsed = useMemo(() => {
    if (!cloudMode) return visible;
    const hidden = new Set<string>();
    for (const [id, members] of clouds) {
      if (!expanded.has(id) && !members.includes(selectedId ?? '')) members.forEach(member => hidden.add(member));
    }
    return { nodes: visible.nodes.filter(node => !hidden.has(node.id)),
      edges: visible.edges.filter(edge => !hidden.has(edge.sourceId) && !hidden.has(edge.targetId)) };
  }, [visible, clouds, cloudMode, expanded, selectedId]);
  const center = visible.nodes.find(node => node.id === selectedId);
  const displayed = useMemo(() => {
    if (!focused || !center) return collapsed;
    const links = Object.values(reviewConnections(visible, center.id)).flat();
    const ids = new Set([center.id, ...links.map(link => link.node.id)]);
    return { nodes: visible.nodes.filter(node => ids.has(node.id)), edges: links.map(link => link.edge) };
  }, [visible, collapsed, focused, center]);
  const { positions, branchEdges } = useMemo(() => layoutReviewBoard(displayed.nodes, displayed.edges), [displayed]);
  const connected = new Set<string>();
  for (const edge of displayed.edges) {
    if (edge.sourceId === selectedId) connected.add(edge.targetId);
    if (edge.targetId === selectedId) connected.add(edge.sourceId);
  }
  const nodes = displayed.nodes.map((record): FlowNode => {
    const members = !focused && cloudMode ? clouds.get(record.id) : undefined;
    const memberSelected = members?.includes(selectedId ?? '') ?? false;
    const isExpanded = expanded.has(record.id) || memberSelected;
    return {
      id: record.id, type: 'review', position: positions.get(record.id)!,
      data: { record, historical: !currentNodeIds.has(record.id), connected: connected.has(record.id), muted: !!center && record.id !== selectedId && !connected.has(record.id),
        cloud: members ? { count: members.length, expanded: isExpanded,
          toggle: () => { if (memberSelected) onSelect(record.id); toggleCloud(record.id, !isExpanded); } } : undefined },
      selected: record.id === selectedId, ariaLabel: `${evidenceLabel(record) ?? nodeLabels[record.kind]}: ${reviewTitle(record)}`,
    };
  });
  const edges = displayed.edges.map(edge => {
    const directed = edge.kind === 'precedes';
    const active = edge.sourceId === selectedId || edge.targetId === selectedId;
    const color = active ? 'var(--graph-edge-highlight)' : directed ? 'var(--text-secondary)' : 'var(--border-control)';
    const [sourceHandle, targetHandle] = edgeSides(positions.get(edge.sourceId)!, positions.get(edge.targetId)!);
    return { id: edge.id, source: edge.sourceId, target: edge.targetId, sourceHandle, targetHandle, type: 'smoothstep',
      className: active ? 'review-edge-highlight' : undefined,
      zIndex: active ? 2 : 0,
      markerEnd: directed ? { type: MarkerType.ArrowClosed, color, width: 16, height: 16 } : undefined,
      style: { stroke: color, strokeWidth: active ? 2.8 : 1.25, opacity: active ? .95 : center ? .18 : branchEdges.has(edge.id) ? .85 : .28, strokeDasharray: directed ? undefined : '5 4' },
      ariaLabel: [directed ? '선행 → 후속' : '방향 없는 연관', edge.reason].filter(Boolean).join(' · ') };
  });
  const layoutKey = JSON.stringify([nodes.map(node => node.id), edges.map(edge => edge.id)]);
  return <div className="graph-canvas directional-graph">
    <ReactFlow<FlowNode> key={layoutKey} nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodeClick={(_, node) => {
        if (node.data.cloud && !node.data.cloud.expanded) toggleCloud(node.id, true);
        onSelect(node.id);
      }} fitView fitViewOptions={fitViewOptions}
      minZoom={.2} maxZoom={2} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null}
      colorMode="dark" aria-label="근거와 후속 작업의 흐름">
      <Controls showInteractive={false} position="top-left" />
    </ReactFlow>
    <button className="button graph-rearrange" disabled={!focused && !center} onClick={() => setFocused(!focused)} aria-pressed={focused}>{focused ? '전체 흐름 보기' : '선택 항목의 연결 보기'}</button>
    {!nodes.length && <div className="graph-empty-filter" role="status"><p>표시할 노드가 없어요.</p><button className="text-button" onClick={onShowAll}>전체 노드 표시하기</button></div>}
    <div className="graph-legend"><button type="button" className="text-button" aria-pressed={cloudMode}
      onClick={() => { setCloudPreference(!cloudMode); setFocused(false); }}>노드 클라우드 (실험)</button>
      {cloudMode && !clouds.size && <span>Codex 채팅에서 노드 클라우드를 만들 수 있어요.</span>}<span>{nodes.length}/{graph.nodes.length}개 표시</span><span>연결된 항목을 가지별로 배치</span><span>화살표는 등록된 선후 관계</span><span>점선은 방향 없는 연관</span></div>
  </div>;
}
