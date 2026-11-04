import { useMemo, useState } from 'react';
import { ReactFlow, Controls, ViewportPortal, Handle, Position, MarkerType, type Node, type NodeProps } from '@xyflow/react';
import type { Graph, GraphNode, NodeKind } from '../server/types.ts';
import { nodeLabels, statusLabels } from './components.tsx';
import { evidenceLabel, flowPositions, reviewConnections, reviewTitle, reviewTime } from './reviewFlow.ts';
import './styles/review-flow.css';

const boardDay = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const nodeTime = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

type FlowNode = Node<{ record: GraphNode }, 'review'>;
function ReviewNode({ data: { record }, selected }: NodeProps<FlowNode>) {
  const status = record.execution ? { passed: '통과', failed: '실패', interrupted: '중단', unverified: '미확인' }[record.execution.status] : statusLabels[record.status];
  const { at, label } = reviewTime(record);
  return <div className={'review-node' + (selected ? ' selected' : '')}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <div className="review-node-meta"><span>{evidenceLabel(record) ?? nodeLabels[record.kind]}</span>{!record.evidence && <span className={record.status === 'failed' || record.execution?.status === 'failed' ? 'danger-text' : ''}>{status}</span>}</div>
    <strong title={reviewTitle(record)}>{reviewTitle(record)}</strong>
    <div className="review-node-time">{at == null ? '시각 미확인' : <time dateTime={new Date(at).toISOString()}>{label} · {nodeTime.format(at)}</time>}</div>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}
const nodeTypes = { review: ReviewNode };
const fitViewOptions = { padding: .16, maxZoom: 1, minZoom: .2 };

export function DirectionalGraph({ graph, selectedId, onSelect, onlyIncomplete, hiddenKinds, onShowAll }: {
  graph: Graph; selectedId: string | null; onSelect: (id: string) => void; onlyIncomplete: boolean; hiddenKinds: Set<NodeKind>; onShowAll: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const visible = useMemo(() => {
    const nodes = graph.nodes.filter(node => !hiddenKinds.has(node.kind) && (!onlyIncomplete || node.kind !== 'feature' || node.status !== 'completed'));
    const ids = new Set(nodes.map(node => node.id));
    return { nodes, edges: graph.edges.filter(edge => ids.has(edge.sourceId) && ids.has(edge.targetId)) };
  }, [graph, hiddenKinds, onlyIncomplete]);
  const center = visible.nodes.find(node => node.id === selectedId);
  const displayed = useMemo(() => {
    if (!focused || !center) return visible;
    const links = Object.values(reviewConnections(visible, center.id)).flat();
    const ids = new Set([center.id, ...links.map(link => link.node.id)]);
    return { nodes: visible.nodes.filter(node => ids.has(node.id)), edges: links.map(link => link.edge) };
  }, [visible, focused, center]);
  const positions = useMemo(() => flowPositions(displayed), [displayed]);
  const days = new Map<string, number>();
  for (const node of displayed.nodes) {
    const { at } = reviewTime(node);
    const day = at == null ? '시각 미확인' : boardDay.format(at);
    days.set(day, Math.min(days.get(day) ?? Infinity, positions.get(node.id)!.y));
  }
  const boardWidth = Math.max(192, ...[...positions.values()].map(({ x }) => x + 192));
  const nodes = displayed.nodes.map((record): FlowNode => ({
    id: record.id, type: 'review', data: { record }, position: positions.get(record.id)!,
    selected: record.id === selectedId, ariaLabel: `${evidenceLabel(record) ?? nodeLabels[record.kind]}: ${reviewTitle(record)}`,
  }));
  const edges = displayed.edges.map(edge => {
    const directed = edge.kind === 'precedes';
    const source = directed || positions.get(edge.sourceId)!.x <= positions.get(edge.targetId)!.x ? edge.sourceId : edge.targetId;
    const active = edge.sourceId === selectedId || edge.targetId === selectedId;
    const color = active ? 'var(--accent-text)' : directed ? 'var(--text-secondary)' : 'var(--border-control)';
    return { id: edge.id, source, target: source === edge.sourceId ? edge.targetId : edge.sourceId, type: 'smoothstep',
      markerEnd: directed ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 } : undefined,
      style: { stroke: color, strokeWidth: active ? 2 : 1.5, strokeDasharray: directed ? undefined : '5 4' },
      ariaLabel: [directed ? '선행 → 후속' : '방향 없는 연관', edge.reason].filter(Boolean).join(' · ') };
  });
  const layoutKey = JSON.stringify([nodes.map(node => node.id), edges.map(edge => edge.id)]);
  return <div className="graph-canvas directional-graph">
    <ReactFlow<FlowNode> key={layoutKey} nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)} fitView fitViewOptions={fitViewOptions}
      minZoom={.2} maxZoom={2} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null}
      colorMode="dark" aria-label="근거와 후속 작업의 흐름">
      <ViewportPortal>
        {[...days].map(([day, y]) => <div key={day} className="graph-day-divider" style={{ top: y - 24, width: boardWidth }}>{day}</div>)}
      </ViewportPortal>
      <Controls showInteractive={false} position="top-left" />
    </ReactFlow>
    <button className="button graph-rearrange" disabled={!focused && !center} onClick={() => setFocused(!focused)} aria-pressed={focused}>{focused ? '전체 흐름 보기' : '선택 항목의 연결 보기'}</button>
    {!nodes.length && <div className="graph-empty-filter" role="status"><p>표시할 노드가 없어요.</p><button className="text-button" onClick={onShowAll}>전체 노드 표시하기</button></div>}
    <div className="graph-legend"><span>{nodes.length}/{graph.nodes.length}개 표시</span><span>→ 등록된 선후 관계</span><span>┄ 방향 없는 연관</span><span>↓ 위에서 아래로 기록 시각</span></div>
  </div>;
}
