import { useMemo, useState } from 'react';
import { ReactFlow, Controls, Handle, Position, MarkerType, type Node, type NodeProps } from '@xyflow/react';
import type { Graph, GraphNode, NodeKind } from '../server/types.ts';
import { nodeLabels, statusLabels } from './components.tsx';
import { evidenceLabel, flowPositions, reviewConnections } from './reviewFlow.ts';
import './styles/review-flow.css';

type FlowNode = Node<{ record: GraphNode }, 'review'>;
function ReviewNode({ data: { record }, selected }: NodeProps<FlowNode>) {
  const status = record.execution ? { passed: '통과', failed: '실패', interrupted: '중단', unverified: '미확인' }[record.execution.status] : statusLabels[record.status];
  return <div className={'review-node' + (selected ? ' selected' : '')}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <div className="review-node-meta"><span>{evidenceLabel(record) ?? nodeLabels[record.kind]}</span>{!record.evidence && <span className={record.status === 'failed' || record.execution?.status === 'failed' ? 'danger-text' : ''}>{status}</span>}</div>
    <strong title={record.title}>{record.title}</strong>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}
const nodeTypes = { review: ReviewNode };
const fitViewOptions = { padding: .16, maxZoom: 1, minZoom: .55 };

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
  const nodes = displayed.nodes.map((record): FlowNode => ({
    id: record.id, type: 'review', data: { record }, position: positions.get(record.id)!,
    selected: record.id === selectedId, ariaLabel: `${evidenceLabel(record) ?? nodeLabels[record.kind]}: ${record.title}`,
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
      <Controls showInteractive={false} position="top-left" />
    </ReactFlow>
    <button className="button graph-rearrange" disabled={!focused && !center} onClick={() => setFocused(!focused)} aria-pressed={focused}>{focused ? '전체 흐름 보기' : '선택 항목의 연결 보기'}</button>
    {!nodes.length && <div className="graph-empty-filter" role="status"><p>표시할 노드가 없어요.</p><button className="text-button" onClick={onShowAll}>전체 노드 표시하기</button></div>}
    <div className="graph-legend"><span>{nodes.length}/{graph.nodes.length}개 표시</span><span>→ 등록된 선후 관계</span><span>┄ 방향 없는 연관</span><span>노드를 선택하면 상세를 볼 수 있어요.</span></div>
  </div>;
}
