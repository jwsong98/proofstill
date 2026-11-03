import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Controls, Handle, Position, MarkerType, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Graph, GraphNode, NodeKind } from '../server/types.ts';
import { nodeLabels, statusLabels } from './components.tsx';
import { useGraphLayout } from './useGraphLayout.ts';

type DotData = { record: GraphNode };
type Dot = Node<DotData, 'dot'>;
function DotNode({ data, selected }: NodeProps<Dot>) {
  const record = data.record;
  return <div className={`graph-dot-node kind-${record.kind} ${selected ? 'selected' : ''}`} aria-label={`${nodeLabels[record.kind]}: ${record.title}`}>
    <Handle type="target" position={Position.Left} isConnectable={false} /><span className="graph-dot" />
    <div className="graph-node-label">{record.title}</div>
    {(record.kind === 'feature' || record.kind === 'task') && <small>{statusLabels[record.status]}</small>}
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}
const nodeTypes = { dot: DotNode };
export function GraphCanvas({ graph, selectedId, onSelect, onMove, onlyIncomplete, hiddenKinds, onShowAll }: {
  graph: Graph; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string, x: number, y: number) => void;
  onlyIncomplete: boolean; hiddenKinds: Set<NodeKind>; onShowAll: () => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const flow = useRef<ReactFlowInstance<Dot> | null>(null);
  const fitPending = useRef(true);
  const flowNodes = useMemo<Dot[]>(() => graph.nodes
    .filter(record => !hiddenKinds.has(record.kind) && (!onlyIncomplete || record.kind !== 'feature' || record.status !== 'completed'))
    .map((record, index): Dot => {
      const angle = index * 2.399963;
      const radius = Math.sqrt(index) * 100;
      return { id: record.id, type: 'dot', ariaLabel: `${nodeLabels[record.kind]}: ${record.title}`, data: { record },
        position: { x: record.x ?? Math.cos(angle) * radius, y: record.y ?? Math.sin(angle) * radius },
        selected: record.id === selectedId, draggable: true };
    }), [graph.nodes, selectedId, hiddenKinds, onlyIncomplete]);
  useEffect(() => setPreviewId(null), [hiddenKinds, onlyIncomplete]);
  const ids = useMemo(() => new Set(flowNodes.map(node => node.id)), [flowNodes]);
  const preview = graph.nodes.find(node => node.id === previewId && node.kind === 'task' && ids.has(node.id));
  const edges = useMemo(() => graph.edges.filter(edge => ids.has(edge.sourceId) && ids.has(edge.targetId)).map(edge => ({ id: edge.id, source: edge.sourceId, target: edge.targetId,
    type: 'straight', markerEnd: edge.kind === 'precedes' ? { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)', width: 16, height: 16 } : undefined,
    style: { stroke: edge.kind === 'precedes' ? 'var(--text-secondary)' : 'var(--border-strong)', strokeWidth: edge.kind === 'precedes' ? 1.5 : 1 },
    ariaLabel: edge.kind === 'precedes' ? '선행 작업에서 후속 작업으로' : '의미적 연관',
  })), [graph.edges, ids]);
  const topology = JSON.stringify([flowNodes.map(node => node.id).sort(), edges.map(edge => [edge.source, edge.target]).sort()]);
  useEffect(() => { fitPending.current = true; }, [topology]);
  const { nodes, onNodesChange, rearrange } = useGraphLayout(flowNodes, edges, () => {
    if (fitPending.current && flow.current) {
      fitPending.current = false;
      void flow.current.fitView({ padding: .2, maxZoom: .85, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240 });
    }
  }, graph.nodes.filter(node => node.x !== null && node.y !== null).map(node => node.id));
  return <div className="graph-canvas" onMouseLeave={() => setPreviewId(null)} onFocusCapture={event => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')?.dataset.id;
    setPreviewId(id && graph.nodes.some(node => node.id === id && node.kind === 'task') ? id : null);
  }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setPreviewId(null); }} onKeyDown={event => { if (event.key === 'Escape') setPreviewId(null); }}>
    <ReactFlow<Dot> nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onInit={instance => { flow.current = instance; }} onNodesChange={onNodesChange}
      onNodeMouseEnter={(_, node) => setPreviewId(node.data.record.kind === 'task' ? node.id : null)}
      onPaneClick={() => setPreviewId(null)} onMoveStart={event => { setPreviewId(null); if (event) fitPending.current = false; }}
      onNodeClick={(_, node) => onSelect(node.id)} onNodeDragStart={() => { fitPending.current = false; setPreviewId(null); }}
      onNodeDragStop={(_, node) => { if (!['evidence', 'result'].includes(node.data.record.kind)) onMove(node.id, node.position.x, node.position.y); }}
      fitView fitViewOptions={{ padding: .2, maxZoom: .85 }} minZoom={.2} maxZoom={2} nodeDragThreshold={4} nodesConnectable={false} deleteKeyCode={null} colorMode="dark" aria-label="기능·요구사항·근거의 관계 그래프">
      <Controls showInteractive={false} position="top-left" />
    </ReactFlow>
    <button className="button graph-rearrange" disabled={!nodes.length} onClick={() => { fitPending.current = true; rearrange(); }}>다시 정렬</button>
    {!nodes.length && <div className="graph-empty-filter" role="status"><p>표시할 노드가 없어요.</p><button className="text-button" onClick={onShowAll}>전체 노드 표시하기</button></div>}
    {preview && <aside className="task-preview nowheel nopan" aria-label="작업 미리보기"><div className="row between"><span className="small">작업</span><span className="badge">{statusLabels[preview.status]}</span></div><h3>{preview.title}</h3><p>{preview.body || '아직 내용이 없어요.'}</p></aside>}
    <div className="graph-legend"><span>{nodes.length}/{graph.nodes.length}개 표시</span><span>드래그로 이동 · 휠로 확대/축소</span><span>─ 의미적 연관</span><span>→ 작업 선후</span></div>
  </div>;
}
