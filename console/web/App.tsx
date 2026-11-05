import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Graph, GraphContext, GraphNode, NodeKind, Project, Session } from '../server/types.ts';
import { api, type RemoteThread, type SessionDetail } from './api.ts';
import { ErrorNotice, Icon, Loading, Modal, nodeLabels, statusLabels, timeLabel } from './components.tsx';
import { reviewTitle } from './reviewFlow.ts';
import { GraphCanvas } from './GraphCanvas.tsx';
import { DagPanel } from './DagPanel.tsx';
import { HandoffView } from './HandoffView.tsx';
import { DocumentContent } from './DocumentContent.tsx';
import { SessionChat } from './SessionChat.tsx';

type Dialog = { kind: 'project' | 'file' | 'remote' } | null;
const boardKinds = (Object.keys(nodeLabels) as NodeKind[]).filter(kind => kind !== 'result');
const emptyGraph: Graph = { nodes: [], edges: [] };
const json = (value: unknown) => JSON.stringify(value, null, 2);
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
function fields(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); }

function SourcePanel({ node, onOpenOriginal, onSelect }: { node: GraphNode; onOpenOriginal: (sessionId: string, messageId: string) => void; onSelect?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [node.id]);
  if (node.execution) {
    const result = node.execution;
    return <><div><span className="small">실행 원문 · 읽기 전용</span><h2>{node.title}</h2></div><div className="row between"><span className="small">{new Date(result.startedAt).toLocaleString('ko-KR')}</span><span className={'badge ' + (result.status === 'passed' ? 'positive' : result.status === 'failed' ? 'negative' : '')}>{statusLabels[node.status]}</span></div>
      {result.command && <section><h3>실행한 명령</h3><pre>{result.command}</pre></section>}
      {result.request != null && <section><h3>실제 요청</h3><DocumentContent content={json(result.request)} filename="request.json" /></section>}
      {result.response != null && (result.command ? <details><summary>실행 원본 데이터</summary><DocumentContent content={json(result.response)} filename="response.json" /></details> : <section><h3>실제 응답</h3><DocumentContent content={json(result.response)} filename="response.json" /></section>)}
      <section><h3>실제 출력</h3><pre>{result.output || '(출력 없음)'}</pre></section><span className="small">종료 코드: {result.exitCode ?? '미확인'}</span></>;
  }
  const evidence = node.evidence;
  if (!evidence) return <p>이 근거의 원문을 찾을 수 없어요.</p>;
  const source = evidence.source;
  const before = typeof source.contextBefore === 'string' ? source.contextBefore : '';
  const after = typeof source.contextAfter === 'string' ? source.contextAfter : '';
  const lines = (text: string) => text.replace(/\r?\n$/, '').split(/\r?\n/);
  const start = Number(source.startLine) || 1;
  const messageSource = evidence.sourceKind === 'message' && typeof source.sessionId === 'string' && typeof source.messageId === 'string';
  const location = evidence.sourceKind === 'file' ? `${String(source.path ?? '')} · ${String(source.startLine)}-${String(source.endLine)}줄` : `${source.role ? String(source.role) + ' · ' : ''}${typeof source.createdAt === 'number' && source.createdAt > 0 ? new Date(source.createdAt).toLocaleString('ko-KR') : '원문 시각 미확인'}`;
  const provenance = `${reviewTitle(node)} · ${location} · 읽기 전용 · 보존 시각 ${new Date(evidence.capturedAt).toLocaleString('ko-KR')}`;
  return <><header className="citation-toolbar" aria-label="인용 출처와 조작">
    <span className="citation-source" title={provenance}>{reviewTitle(node)}<span className="small"> · {location}</span></span>
    <div className="citation-actions">
      {evidence.sourceKind === 'file' && (before || after) && <button className="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '인용만' : '앞뒤 문맥'}</button>}
      {messageSource && <button className="text-button" onClick={() => onOpenOriginal(source.sessionId as string, source.messageId as string)}>원문 확인<Icon name="arrow-right" size={14} /></button>}
      {onSelect && <button className="text-button" onClick={onSelect}>근거 보기</button>}
    </div>
  </header>
    <DocumentContent content={evidence.content} filename={evidence.sourceKind === 'file' ? String(source.path ?? '') : undefined}
      original={evidence.sourceKind === 'file' ? <div className="source-lines">{expanded && before && lines(before).map((line, i, all) => <div className="source-line" key={'before-' + i}><span>{start - all.length + i}</span><code>{line || ' '}</code></div>)}
      {lines(evidence.content).map((line, i) => <div className="source-line cited" key={i}><span>{start + i}</span><code>{line || ' '}</code></div>)}
      {expanded && after && lines(after).map((line, i) => <div className="source-line" key={'after-' + i}><span>{Number(source.endLine) + i + 1}</span><code>{line || ' '}</code></div>)}
    </div> : <pre className="raw-content">{evidence.content}</pre>} />

  </>;
}

function EvidenceReferences({ nodes, onSelect, onOpenOriginal }: {
  nodes: GraphNode[]; onSelect: (id: string) => void; onOpenOriginal: (sessionId: string, messageId: string) => void;
}) {
  return <section className="detail-section evidence-references" aria-label="연결된 인용 원문"><h3 className="sr-only">연결된 인용 원문</h3>
    {nodes.length ? nodes.map(node => <article className="inline-evidence" key={node.id} aria-label={`${node.title} 인용 원문`}>
      <SourcePanel node={node} onOpenOriginal={onOpenOriginal} onSelect={() => onSelect(node.id)} />
    </article>) : <p className="small">직접 연결된 원문 근거가 없어요.</p>}
  </section>;
}

function SessionContext({ project, session, onSelect, onOpenOriginal }: {
  project: Project; session: Session; onSelect: (id: string) => void;
  onOpenOriginal: (sessionId: string, messageId: string) => void;
}) {
  const [context, setContext] = useState<GraphContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const ids = JSON.stringify(session.contextNodeIds);
  useEffect(() => {
    let disposed = false;
    setContext(null); setError(null);
    if (session.contextNodeIds.length) void api.context(project.id, session.contextNodeIds)
      .then(data => { if (!disposed) setContext(data); })
      .catch(error => { if (!disposed) setError(errorText(error)); });
    return () => { disposed = true; };
  }, [project.id, session.id, ids, retry]);
  const selectedIds = new Set(session.contextNodeIds);
  const selectedNodes = context?.nodes.filter(node => selectedIds.has(node.id)) ?? [];
  const evidenceIds = new Set(context?.edges.flatMap(edge => [selectedIds.has(edge.sourceId) ? edge.targetId : '', selectedIds.has(edge.targetId) ? edge.sourceId : '']) ?? []);
  const evidence = context?.nodes.filter(node => node.evidence && evidenceIds.has(node.id) && !selectedIds.has(node.id)) ?? [];
  return <details className="node-details" aria-label="세션 컨텍스트" key={`${project.id}:${session.id}:${ids}`}>
    <summary>세션 컨텍스트 · 선택 항목 {session.contextNodeIds.length}개 · 작업 폴더</summary>
    <p className="small">작업 폴더 <code>{project.rootPath}</code></p>
    {!session.contextNodeIds.length ? <p className="small">프로젝트 루트 세션이에요. 선택한 노드 컨텍스트는 포함하지 않아요.</p>
      : <><ErrorNotice message={error} />{error ? <button className="text-button" onClick={() => setRetry(value => value + 1)}>컨텍스트 다시 불러오기</button> : !context ? <Loading /> : <>
        {selectedNodes.map(node => <section className="detail-section" key={node.id}><h3>{node.title}</h3>{node.evidence || node.execution ? <SourcePanel node={node} onOpenOriginal={onOpenOriginal} /> : <DocumentContent content={node.body || '아직 내용이 없어요.'} />}</section>)}
        <EvidenceReferences nodes={evidence} onSelect={onSelect} onOpenOriginal={onOpenOriginal} />
      </>}</>}
  </details>;
}

function ImportSessions({ projectId, onImport }: { projectId: string; onImport: (ids: string[]) => Promise<void> }) {
  const [items, setItems] = useState<RemoteThread[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [preview, setPreview] = useState<RemoteThread | null>(null);
  const loadingRef = useRef(false);
  const load = useCallback(async (next?: string | null) => {
    if (loadingRef.current) return; loadingRef.current = true; setLoading(true); setError(null);
    try { const page = await api.remoteThreads(projectId, next); setItems(current => next ? [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))] : page.items); setCursor(page.nextCursor); setLoaded(true); }
    catch (error) { setError(errorText(error)); }
    finally { loadingRef.current = false; setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  return <><p className="small">이름을 확인하고 가져올 Codex 세션을 선택해요.</p><ErrorNotice message={error} />
    <div className="remote-list" onScroll={event => { const target = event.currentTarget; if (cursor && !loading && target.scrollTop + target.clientHeight >= target.scrollHeight - 80) void load(cursor); }}>
      {items.map(item => <div className="remote-row" key={item.id}><input type="checkbox" aria-label={`${item.name || item.title || '이름 없는 세션'} 가져오기`} checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><button className="remote-preview" onClick={() => setPreview(item)}><strong>{item.name || item.title || '이름 없는 세션'}</strong><span className="small">{timeLabel(item.lastConversationAt ?? item.recencyAt)}{item.cwd ? ' · ' + item.cwd : ''}</span></button></div>)}
      {loading && <Loading />}{loaded && !items.length && <p className="empty-inline">가져올 세션이 없어요.</p>}{loaded && items.length > 0 && !cursor && <p className="small list-end">마지막 세션이에요.</p>}
    </div>
    {preview && <div className="import-preview"><h3>{preview.name || preview.title || '이름 없는 세션'}</h3><p>{preview.preview || '미리보기가 없는 세션이에요.'}</p></div>}
    <div className="row between modal-actions"><button className="text-button" disabled={loading} onClick={() => void load()}>목록 다시 불러오기</button><button className="button primary" disabled={!selected.length || loading} onClick={async () => { setLoading(true); try { await onImport(selected); } catch (error) { setError(errorText(error)); } finally { setLoading(false); } }}>선택한 {selected.length || ''}개 세션 가져오기</button></div>
  </>;
}

function NodeDetails({ node, graph, boardGraph, currentNodeIds, projectId, busy, sessions, onStart, onSelect, onOpenOriginal, onHandoff }: {
  node: GraphNode; graph: Graph; boardGraph: Graph; currentNodeIds: Set<string>; projectId: string; busy: boolean; sessions: Session[];
  onStart: (node: GraphNode) => void; onSelect: (id: string) => void; onOpenOriginal: (sessionId: string, messageId: string) => void; onHandoff: (id: string) => void;
}) {
  const historical = !currentNodeIds.has(node.id);
  const relevantEdges = boardGraph.edges.filter(edge => edge.sourceId === node.id || edge.targetId === node.id);
  const connectedIds = new Set(relevantEdges.map(edge => edge.sourceId === node.id ? edge.targetId : edge.sourceId));
  const connectedNodes = boardGraph.nodes.filter(record => connectedIds.has(record.id));
  const citedEvidence = graph.nodes.filter(record => record.evidence && connectedIds.has(record.id));
  return <aside className="detail-panel" aria-label="선택 항목 상세">
        {node.evidence || node.execution ? <SourcePanel node={node} onOpenOriginal={onOpenOriginal} /> : <><header className="node-toolbar" aria-label="노드 제목·상태·작업">
          <h2 title={`${nodeLabels[node.kind]} · ${node.title}`} aria-label={`${nodeLabels[node.kind]}: ${node.title}`}>{node.title}</h2>
          <span className={'badge ' + (node.status === 'failed' ? 'negative' : node.status === 'completed' ? 'positive' : '')}>{statusLabels[node.status]}</span>
          {!historical && <button className="button primary" disabled={busy} onClick={() => onStart(node)}>{sessions.some(session => session.role === null && session.source === 'local' && session.contextNodeIds.length === 1 && session.contextNodeIds[0] === node.id) ? '세션 이어가기' : '세션 시작하기'}</button>}
          <a className="icon-button" aria-label="컨텍스트 내보내기" title="컨텍스트 내보내기" href={api.contextUrl(projectId, [node.id])} download><Icon name="download-simple" size={16} /></a>
        </header>{historical && <p className="small">이전 기록 · 현재 항목에 통합된 결정 또는 작업이에요.</p>}{['feature', 'requirement'].includes(node.kind) && <button className="text-button" onClick={() => { onHandoff(node.id); }}>구현·검증 현황에서 보기</button>}{node.kind === 'feature' && node.acceptance && node.acceptance.total > 0 && <section className="detail-section"><h3>정해진 검사</h3><p>{node.acceptance.passed}/{node.acceptance.total} 통과{node.acceptance.fulfilled ? ' · 등록 검사 통과' : ' · 미충족'}</p></section>}<details key={`${node.id}:body`} className="node-details"><summary>상세 내용</summary><DocumentContent content={node.body || '아직 내용이 없어요.'} /></details>
          <details key={`${node.id}:evidence`} className="node-details"><summary>원문 근거 · {citedEvidence.length}개</summary><EvidenceReferences nodes={citedEvidence} onSelect={onSelect} onOpenOriginal={onOpenOriginal} /></details>
          {!!node.mergedRecords?.length && <details key={`${node.id}:merged`} className="node-details"><summary>통합 전 논의·작업 · {node.mergedRecords.length}개</summary><p className="small">이전 기록을 보존한 내용이에요. 현재 결함이나 미완료 판정과는 별개예요.</p>{node.mergedRecords.map(record => <details key={record.id}><summary>{record.title}</summary><p className="node-body">{record.body}</p></details>)}</details>}


        </>}
      {node && <section className="detail-section"><h3>연결된 항목</h3>
        {connectedNodes.map(node => <div className="relation-row" key={node.id}><button className="source-link" onClick={() => onSelect(node.id)}>{node.title}</button></div>)}
        {!connectedNodes.length && <p className="small">아직 연결된 근거나 항목이 없어요.</p>}
      </section>}
      </aside>;
}

type WorkspaceTab = { key: string; kind: 'session' | 'node'; targetId: string; title: string; projectId: string; messageTarget?: string | null };

export default function App() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const [detailWidth, setDetailWidth] = useState<number | null>(null);
  const resizeDetail = (percent: number) => setDetailWidth(Math.round(Math.max(25, Math.min(70, percent))));
  const [projects, setProjects] = useState<Project[]>([]), [projectId, setProjectId] = useState<string>('');
  const [graph, setGraph] = useState<Graph>(emptyGraph), [selectedId, setSelectedId] = useState<string | null>(null);
  const [handoffNodeId, setHandoffNodeId] = useState<string | null>(null);
  const [view, setView] = useState<'graph' | 'session' | 'results' | 'handoff'>('handoff');

  const [sessions, setSessions] = useState<Session[]>([]), [sessionsCursor, setSessionsCursor] = useState<string | null>(null), [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false), [activeSessionId, setActiveSessionId] = useState<string | null>(null), [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Dialog>(null), [files, setFiles] = useState<string[]>([]), [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [hiddenKinds, setHiddenKinds] = useState<Set<NodeKind>>(() => new Set<NodeKind>());
  const [resultFilter, setResultFilter] = useState<'all' | 'passed' | 'failed' | 'other'>('all');
  const [codexStatus, setCodexStatus] = useState<string>('Codex 연결 확인 중');
  const sessionLoadingRef = useRef<string | null>(null), currentProject = useRef(projectId); currentProject.current = projectId;
  const currentSession = useRef(activeSessionId); currentSession.current = activeSessionId;
  const project = projects.find(item => item.id === projectId);
  const [boardHistory, setBoardHistory] = useState<Graph | null>(null);
  const currentNodeIds = useMemo(() => new Set(graph.nodes.map(node => node.id)), [graph.nodes]);
  const boardSource = boardHistory ?? graph;
  const boardGraph = useMemo(() => {
    const nodes = boardSource.nodes.filter(node => node.kind !== 'result' && (
      currentNodeIds.has(node.id) || node.kind === 'decision' || node.kind === 'task'
    ));
    const ids = new Set(nodes.map(node => node.id));
    return { nodes, clouds: boardSource.clouds, edges: boardSource.edges.filter(edge => ids.has(edge.sourceId) && ids.has(edge.targetId)) };
  }, [boardSource, currentNodeIds]);
  const selected = [...boardGraph.nodes, ...graph.nodes].find(node => node.id === selectedId) ?? null;
  const readProjects = useCallback(async () => {
    const list = await api.projects(); setProjects(list);
    if (!projectId && list.length) setProjectId(list.find(item => item.id === localStorage.getItem('proofstill:project'))?.id ?? list[0].id);
    setLoading(false);
  }, [projectId]);
  useEffect(() => { void readProjects().catch(error => { setError(errorText(error)); setLoading(false); }); }, []);
  useEffect(() => { void api.codexStatus().then(status => setCodexStatus(status.connected ? 'Codex 연결됨' : status.error || 'Codex 연결 안 됨')).catch(() => setCodexStatus('Codex 연결 안 됨')); }, []);
  const refreshGraph = useCallback(async () => {
    if (!projectId) return; const id = projectId; const [data, history] = await Promise.all([api.graph(id), api.boardHistory(id)]);
    if (currentProject.current === id) {
      setGraph(data);
      setBoardHistory(history);
    }
    return data;
  }, [projectId]);
  const loadSessions = useCallback(async (cursor?: string | null) => {
    if (!projectId || sessionLoadingRef.current === projectId) return;
    const id = projectId; sessionLoadingRef.current = id; setSessionLoading(true);
    try { const page = await api.sessions(id, cursor); if (currentProject.current !== id) return; setSessions(current => cursor ? [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))] : page.items); setSessionsCursor(page.nextCursor); }
    catch (error) { if (currentProject.current === id) setError(errorText(error)); }
    finally { if (sessionLoadingRef.current === id) { sessionLoadingRef.current = null; setSessionLoading(false); } }
  }, [projectId]);
  useEffect(() => {
    setTabs([]); setActiveTabKey(null); setSelectedId(null); setActiveSessionId(null); setSessionDetail(null); setGraph(emptyGraph); setBoardHistory(null); setSessions([]); setSessionsCursor(null); setView('handoff'); setHiddenKinds(new Set<NodeKind>()); setResultFilter('all');
    if (projectId) { localStorage.setItem('proofstill:project', projectId); void refreshGraph().catch(error => setError(errorText(error))); void loadSessions(); }
  }, [projectId]);
  async function perform(action: () => Promise<void>) { setBusy(true); setError(null); try { await action(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); } }
  function activateTab(tab: WorkspaceTab) {
    setActiveTabKey(tab.key);
    if (tab.kind === 'session') {
      setActiveSessionId(tab.targetId); setSessionDetail(null); setView('session'); setSessionsOpen(true);
    } else {
      setSelectedId(tab.targetId); setView('graph');
    }
  }
  function openTab(tab: WorkspaceTab) {
    setTabs(current => current.some(item => item.key === tab.key)
      ? current.map(item => item.key === tab.key ? { ...item, ...tab } : item) : [...current, tab]);
    activateTab(tab);
  }
  function openSession(session: Session, target: string | null = null) {
    openTab({ key: 'session:' + session.id, kind: 'session', targetId: session.id, title: session.title, projectId: session.projectId, messageTarget: target });
  }
  function openNode(id: string) {
    const node = [...boardSource.nodes, ...graph.nodes].find(record => record.id === id);
    if (node) openTab({ key: 'node:' + id, kind: 'node', targetId: id, title: node.title, projectId });
  }
  function closeTab(key: string) {
    const index = tabs.findIndex(tab => tab.key === key);
    const remaining = tabs.filter(tab => tab.key !== key);
    setTabs(remaining);
    const closing = tabs[index];
    if (key !== activeTabKey || view !== (closing?.kind === 'session' ? 'session' : 'graph')) return;
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) {
      activateTab(next);
      requestAnimationFrame(() => document.getElementById('tab-' + next.key)?.focus());
    }
    else { setActiveTabKey(null); setActiveSessionId(null); setView('graph'); }
  }
  async function startProjectSession() {
    if (!project || busy) return;
    const target = project;
    await perform(async () => {
      const session = await api.createSession(target.id, { title: `${target.name} · 프로젝트`, nodeIds: [] });
      if (currentProject.current !== target.id) return;
      await loadSessions();
      if (currentProject.current === target.id) openSession(session);
    });
  }
  async function startSession(targetNode: GraphNode) {
    if (!projectId) return;
    const targetProject = projectId;
    const existing = sessions.find(session => session.role === null && session.source === 'local' && session.contextNodeIds.length === 1 && session.contextNodeIds[0] === targetNode.id);
    if (existing) { openSession(existing); return; }
    await perform(async () => {
      const session = await api.createSession(targetProject, { title: targetNode.title, nodeIds: [targetNode.id] });
      if (currentProject.current !== targetProject) return;
      await loadSessions();
      if (currentProject.current === targetProject) openSession(session);
    });
  }
  async function captureMessage(sessionId: string, messageId: string) {
    const node = await api.captureMessage(projectId, sessionId, messageId); await refreshGraph(); openTab({ key: 'node:' + node.id, kind: 'node', targetId: node.id, title: node.title, projectId });
  }
  const results = useMemo(() => graph.nodes.filter(node => node.kind === 'result' && node.execution).sort((a, b) => (b.execution?.startedAt ?? 0) - (a.execution?.startedAt ?? 0)), [graph.nodes]);
  const resultCounts = useMemo(() => ({
    all: results.length,
    passed: results.filter(node => node.execution?.status === 'passed').length,
    failed: results.filter(node => node.execution?.status === 'failed').length,
    other: results.filter(node => !['passed', 'failed'].includes(node.execution?.status ?? '')).length,
  }), [results]);
  const visibleResults = useMemo(() => results.filter(node => resultFilter === 'all' || (resultFilter === 'other' ? !['passed', 'failed'].includes(node.execution?.status ?? '') : node.execution?.status === resultFilter)), [resultFilter, results]);
  function openOriginal(id: string, messageId: string) { void perform(async () => {
    const targetProject = projectId;
    const original = await api.session(id);
    if (currentProject.current !== targetProject) return;
    if (original.session.projectId !== targetProject) throw new Error('원래 대화가 현재 프로젝트에 속하지 않아요.');
    openSession(original.session, messageId);
  }); }
  function choose(id: string) { openNode(id); }
  const openTabs = tabs.filter(tab => tab.projectId === projectId);
  const tabVisible = (tab: WorkspaceTab) => tab.key === activeTabKey && view === (tab.kind === 'session' ? 'session' : 'graph');
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>proofstill</div><span className="small">{codexStatus}</span></header>
    <div className="app-body"><aside className="sidebar"><div className="project-picker"><label className="small" htmlFor="project-select">프로젝트</label><div className="row"><select id="project-select" value={projectId} onChange={event => setProjectId(event.target.value)}>{!projects.length && <option value="">프로젝트 없음</option>}{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="icon-button" aria-label="프로젝트 추가" onClick={() => { setError(null); setModal({ kind: 'project' }); }}><Icon name="plus" /></button></div></div>
      <nav className="navigation" aria-label="프로젝트 탐색"><button className={'nav-button ' + (view === 'handoff' ? 'active' : '')} disabled={!project} onClick={() => setView('handoff')}><Icon name="check-circle" />구현·검증 현황</button><button className={'nav-button ' + (view === 'graph' ? 'active' : '')} disabled={!project} onClick={() => setView('graph')}><Icon name="share-network" />관계 그래프</button>
        <button className={'nav-button ' + (view === 'session' ? 'active' : '')} disabled={!project} aria-expanded={sessionsOpen} aria-controls="session-menu" onClick={() => { setView('session'); setSessionsOpen(true); void loadSessions(); }}><Icon name="chat-circle" />Codex 세션<Icon name={sessionsOpen ? 'caret-up' : 'caret-down'} size={14} /></button>
        <button className="nav-subaction project-session" disabled={!project || busy} title={project ? `${project.rootPath}에서 새 Codex 세션 열기` : '프로젝트를 선택해 주세요.'} onClick={() => void startProjectSession()}><Icon name="plus" size={14} />프로젝트 세션 열기</button>
        {sessionsOpen && <div className="session-menu" id="session-menu" aria-label="Codex 세션 목록 · 최근 대화 순" onScroll={event => { const list = event.currentTarget; if (sessionsCursor && !sessionLoading && list.scrollTop + list.clientHeight >= list.scrollHeight - 80) void loadSessions(sessionsCursor); }}>
          {sessions.map(session => <button className={'session-option ' + (session.id === activeSessionId && view === 'session' ? 'active' : '')} key={session.id} onClick={() => openSession(session)}><span>{session.title}</span><small>{session.lastConversationAt === null ? '대화 없음' : timeLabel(session.lastConversationAt)}</small></button>)}
          {sessionLoading && <Loading />}{!sessions.length && !sessionLoading && <span className="small list-end">아직 세션이 없어요.</span>}{sessions.length > 0 && !sessionsCursor && !sessionLoading && <span className="small list-end">마지막 세션이에요.</span>}
        </div>}
        {sessionsOpen && <button className="nav-subaction" onClick={() => { setError(null); setModal({ kind: 'remote' }); }}><Icon name="download-simple" size={16} />기존 세션 가져오기</button>}
        <button className={'nav-button ' + (view === 'results' ? 'active' : '')} disabled={!project} onClick={() => { setView('results'); void refreshGraph().catch(error => setError(errorText(error))); }}><Icon name="check-circle" />실행 결과</button>
      </nav><div className="sidebar-footer">localhost:7777</div></aside>
      <main className="main-area"><header className="page-header"><div><p className="breadcrumb">{project?.name ?? '프로젝트'}{view === 'session' && sessionDetail?.session.id === activeSessionId ? ' / ' + sessionDetail.session.title : ''}</p><h1>{view === 'handoff' ? '구현·검증 현황' : view === 'graph' ? '관계 그래프' : view === 'session' ? sessionDetail?.session.id === activeSessionId ? sessionDetail.session.title : sessions.find(session => session.id === activeSessionId)?.title ?? 'Codex 세션' : '실행 결과'}</h1></div>
        {project && view === 'graph' && <div className="toolbar"><button className="button" disabled={busy} onClick={() => { setError(null); setModal({ kind: 'file' }); void api.files(projectId).then(result => setFiles(result.items)).catch(error => setError(errorText(error))); }}><Icon name="file-text" size={16} />근거 가져오기</button></div>}
      </header>
      {error && !modal && <div className="global-error"><ErrorNotice message={error} /><button className="icon-button" aria-label="오류 닫기" onClick={() => setError(null)}><Icon name="x" size={16} /></button></div>}
      {loading ? <Loading /> : !project ? <div className="empty-page"><Icon name="folder-open" size={32} /><h2>어떤 프로젝트를 살펴볼까요?</h2><p>로컬 프로젝트를 등록하면 문서 근거와 Codex 대화를 연결할 수 있어요.</p><button className="button primary" onClick={() => setModal({ kind: 'project' })}>프로젝트 등록하기</button></div> : <div className="persistent-workspace" style={detailWidth === null ? undefined : { '--detail-width': `${detailWidth}%` } as React.CSSProperties}>
      <section className="center-panel graph-side-panel" aria-label="상시 관계 그래프">
        <div className="row graph-side-heading"><strong>관계 그래프</strong>{selected && view !== 'graph' && <button className="text-button" onClick={() => openNode(selected.id)}>선택 항목 상세 보기</button>}</div>
        <><div className="graph-toolbar"><span className="small">전체 노드 {boardGraph.nodes.length}개 · 연결 {boardGraph.edges.length}개</span><label className="check-label"><input type="checkbox" checked={onlyIncomplete} onChange={event => setOnlyIncomplete(event.target.checked)} />미완료 기능·작업</label></div>
          <div className="node-filters" role="group" aria-label="노드 종류 표시">{boardKinds.map(kind => <button key={kind} className="node-filter" aria-pressed={!hiddenKinds.has(kind)} aria-label={`${nodeLabels[kind]} 노드 표시`} onClick={() => setHiddenKinds(current => { const next = new Set(current); if (next.has(kind)) next.delete(kind); else next.add(kind); return next; })}>{nodeLabels[kind]}<span>{boardGraph.nodes.filter(node => node.kind === kind).length}</span></button>)}{hiddenKinds.size > 0 && <button className="text-button" onClick={() => setHiddenKinds(new Set())}>전체 표시</button>}</div>
          <DagPanel key={projectId + ":dag"} projectId={projectId} graph={graph} onSelect={openNode} onGraphUpdated={() => void refreshGraph().catch(error => setError(errorText(error)))} />
          {boardGraph.nodes.length ? <GraphCanvas onRestoreSelection={setSelectedId} key={projectId} graph={boardGraph} currentNodeIds={currentNodeIds} selectedId={selectedId} onSelect={openNode} onlyIncomplete={onlyIncomplete} hiddenKinds={hiddenKinds} onShowAll={() => { setHiddenKinds(new Set()); setOnlyIncomplete(false); }} onMove={(id, x, y) => void perform(async () => { await api.updateNode(projectId, id, { x, y }); await refreshGraph(); })} /> : <div className="empty-page"><Icon name="share-network" size={32} /><h2>아직 연결된 자료가 없어요.</h2><p>가져온 근거와 기록된 관계를 여기에서 확인해요.</p><button className="text-button" onClick={() => { setModal({ kind: 'file' }); void api.files(projectId).then(result => setFiles(result.items)).catch(error => setError(errorText(error))); }}>문서 근거 가져오기<Icon name="arrow-right" /></button></div>}</>
      </section><section className="persistent-content">
        <div className="detail-resize" role="separator" aria-label="상세 패널 너비" aria-orientation="vertical"
          aria-valuemin={25} aria-valuemax={70} aria-valuenow={detailWidth ?? 55} tabIndex={0}
          onPointerDown={event => {
            if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const handle = event.currentTarget;
            if (!handle.hasPointerCapture(event.pointerId)) return;
            const bounds = handle.closest('.persistent-workspace')!.getBoundingClientRect();
            if (bounds.width) resizeDetail((bounds.right - event.clientX) / bounds.width * 100);
          }}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const width = detailWidth ?? 55;
            resizeDetail(width + (event.key === 'ArrowLeft' ? 5 : -5));
          }} />

        {!!openTabs.length && <div className="workspace-tabs" role="tablist" aria-label="오른쪽 작업 탭">
          {openTabs.map(tab => {
            const title = tab.kind === 'session' ? sessions.find(session => session.id === tab.targetId)?.title ?? tab.title
              : boardSource.nodes.find(node => node.id === tab.targetId)?.title ?? tab.title;
            return <div className="workspace-tab" key={tab.key} data-active={tabVisible(tab)}>
              <button type="button" role="tab" id={'tab-' + tab.key} aria-controls={'panel-' + tab.key} aria-selected={tabVisible(tab)}
                tabIndex={tabVisible(tab) || !openTabs.some(tabVisible) ? 0 : -1} title={title}
                onClick={() => activateTab(tab)} onKeyDown={event => {
                  const index = openTabs.indexOf(tab);
                  const target = event.key === 'ArrowRight' ? (index + 1) % openTabs.length : event.key === 'ArrowLeft'
                    ? (index + openTabs.length - 1) % openTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? openTabs.length - 1 : -1;
                  if (target < 0) return;
                  event.preventDefault(); activateTab(openTabs[target]);
                  document.getElementById('tab-' + openTabs[target].key)?.focus();
                }}><Icon name={tab.kind === 'session' ? 'chat-circle' : 'file-text'} size={14} /><span>{title}</span></button>
              <button type="button" className="workspace-tab-close" aria-label={title + ' 탭 닫기'} onClick={() => closeTab(tab.key)}><Icon name="x" size={12} /></button>
            </div>;
          })}
        </div>}
        <div className="workspace content-workspace">
        {openTabs.map(tab => {
          const node = boardSource.nodes.find(node => node.id === tab.targetId) ?? graph.nodes.find(node => node.id === tab.targetId);
          return <div className="workspace-tab-panel" key={tab.key} id={'panel-' + tab.key} role="tabpanel"
            aria-labelledby={'tab-' + tab.key} hidden={!tabVisible(tab)}>
            {tab.kind === 'session' ? <SessionChat visible={tabVisible(tab)} sessionId={tab.targetId} messageTarget={tab.messageTarget} onActivity={() => void loadSessions()} onGraphUpdated={() => void refreshGraph().catch(error => setError(errorText(error)))} onCapture={captureMessage} onDetail={detail => { if (currentProject.current === detail.session.projectId && currentSession.current === detail.session.id) setSessionDetail(detail); }} renderContext={session => session.projectId === project.id ? <SessionContext key={`${project.id}:${session.id}:${JSON.stringify(session.contextNodeIds)}`} project={project} session={session} onSelect={choose} onOpenOriginal={openOriginal} /> : null} />
              : node ? <NodeDetails node={node} graph={graph} boardGraph={boardSource} currentNodeIds={currentNodeIds} projectId={projectId}
                  busy={busy} sessions={sessions} onStart={node => void startSession(node)} onSelect={choose} onOpenOriginal={openOriginal}
                  onHandoff={id => { setHandoffNodeId(id); setView('handoff'); }} />
                : <p>이 노드를 찾을 수 없어요.</p>}
          </div>;
        })}
        <section className="center-panel" hidden={openTabs.some(tabVisible)}>
        {view === 'handoff' && <HandoffView key={projectId} projectId={projectId} graph={graph} initialNodeId={handoffNodeId} onGraphSelect={id => { const targetProject = projectId; void refreshGraph().then(data => { if (currentProject.current === targetProject) openTab({ key: 'node:' + id, kind: 'node', targetId: id, title: data?.nodes.find(node => node.id === id)?.title ?? id, projectId: targetProject }); }).catch(error => setError(errorText(error))); }} />}

        {view === 'graph' && !openTabs.some(tab => tabVisible(tab)) && <div className="empty-page"><p>그래프에서 노드를 선택하면 상세 내용을 볼 수 있어요.</p></div>}
        {view === 'session' && !openTabs.some(tab => tabVisible(tab)) && <div className="empty-page"><p>Codex 세션 목록에서 대화를 선택해 주세요.</p></div>}
        {view === 'results' && <div className="results-view"><div className="result-summary" aria-label="실행 결과 요약">
          <div><span>전체</span><strong>{resultCounts.all}</strong></div><div><span>통과</span><strong className="success-text">{resultCounts.passed}</strong></div><div><span>실패</span><strong className="danger-text">{resultCounts.failed}</strong></div><div><span>확인 필요</span><strong>{resultCounts.other}</strong></div>
        </div><div className="result-filters" role="group" aria-label="실행 결과 상태 필터">{([['all', '전체'], ['passed', '통과'], ['failed', '실패'], ['other', '확인 필요']] as const).map(([value, label]) => <button key={value} aria-pressed={resultFilter === value} onClick={() => setResultFilter(value)}>{label}<span>{resultCounts[value]}</span></button>)}</div>
          <div className="result-list">{visibleResults.map(node => <button className={'result-row ' + (selectedId === node.id ? 'selected' : '')} key={node.id} onClick={() => openNode(node.id)}><Icon name={node.execution?.status === 'failed' ? 'x-circle' : node.execution?.status === 'passed' ? 'check-circle' : 'warning-circle'} /><span><strong>{node.title}</strong><small>{node.execution?.kind === 'test' ? '테스트' : node.execution?.kind === 'api' ? 'API 요청' : '명령'} · {timeLabel(node.execution?.startedAt)}</small></span><span className={'badge ' + (node.execution?.status === 'failed' ? 'negative' : node.execution?.status === 'passed' ? 'positive' : '')}>{node.execution?.status === 'passed' ? '통과' : node.execution?.status === 'failed' ? '실패' : node.execution?.status === 'interrupted' ? '중단' : '미확인'}</span></button>)}
            {!results.length && <div className="empty-page"><Icon name="check-circle" size={32} /><h2>아직 기록된 실행 결과가 없어요.</h2><p>Codex가 실제 명령이나 API 요청을 실행하면 관찰한 결과가 여기에 시간순으로 쌓여요.</p></div>}
            {!!results.length && !visibleResults.length && <div className="empty-page compact"><p>이 상태에 해당하는 실행 결과가 없어요.</p><button className="text-button" onClick={() => setResultFilter('all')}>전체 결과 보기</button></div>}
          </div></div>}
      </section></div></section></div>}
    </main></div>
    {modal && <Modal title={modal.kind === 'project' ? '어떤 프로젝트를 등록할까요?' : modal.kind === 'file' ? '어떤 문서를 근거로 보존할까요?' : '어떤 Codex 세션을 가져올까요?'} onClose={() => !busy && setModal(null)}><ErrorNotice message={error} />
      {modal.kind === 'project' && <form onSubmit={event => { const input = fields(event); void perform(async () => { const created = await api.createProject({ name: String(input.name), rootPath: String(input.rootPath) }); const list = await api.projects(); setProjects(list); setProjectId(created.id); setModal(null); }); }}><label>프로젝트 이름<input name="name" required placeholder="프로젝트 이름" /></label><label>로컬 폴더 경로<input name="rootPath" required placeholder="/Users/name/project" /></label><button className="button primary" disabled={busy}>{busy ? '등록 중' : '등록하기'}</button></form>}
      {modal.kind === 'file' && <form onSubmit={event => { const input = fields(event); void perform(async () => { const node = await api.captureFile(projectId, { path: String(input.path), ...(input.startLine ? { startLine: Number(input.startLine) } : {}), ...(input.endLine ? { endLine: Number(input.endLine) } : {}) }); await refreshGraph(); openTab({ key: 'node:' + node.id, kind: 'node', targetId: node.id, title: node.title, projectId }); setModal(null); }); }}><label>프로젝트 안의 파일 경로<input name="path" list="project-files" required placeholder="requirements.md" /><datalist id="project-files">{files.map(file => <option key={file} value={file} />)}</datalist></label><div className="form-columns"><label>시작 줄 · 선택<input name="startLine" type="number" min="1" placeholder="처음부터" /></label><label>마지막 줄 · 선택<input name="endLine" type="number" min="1" placeholder="끝까지" /></label></div><p className="small">선택한 원문과 출처를 읽기 전용 근거로 보존해요.</p><button className="button primary" disabled={busy}>{busy ? '가져오는 중' : '근거로 보존하기'}</button></form>}
      {modal.kind === 'remote' && <ImportSessions projectId={projectId} onImport={async ids => { let imported: Session | null = null; for (const id of ids) imported = await api.importSession(projectId, id); await loadSessions(); await refreshGraph(); setModal(null); if (imported) openSession(imported); }} />}
    </Modal>}
  </div>;
}
