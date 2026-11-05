import { useCallback, useEffect, useRef, useState } from 'react';
import type { Graph, HandoffRow, HandoffSnapshot } from '../server/types.ts';
import { implementationLabels, verificationLabels, filterHandoffRows, verificationStatus } from '../shared/progress.ts';
import { CriteriaAssurance, HumanConfirmation, RequirementDecision, RequirementContext, ReviewEvidenceView, decisionLabel } from './RequirementAssurance.tsx';
import { HandoffFlow } from './HandoffFlow.tsx';
import { VerificationChecks } from './VerificationChecks.tsx';
import { api } from './api.ts';
import { ErrorNotice, Loading } from './components.tsx';
import './styles/handoff-guide.css';

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export function HandoffView({ projectId, graph, initialNodeId, onGraphSelect }: { projectId: string; graph: Graph; initialNodeId?: string | null; onGraphSelect: (id: string) => void }) {
  const [data, setData] = useState<HandoffSnapshot | null>(null), [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialNodeId ? `console:${initialNodeId}` : null), [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [scope, setScope] = useState('current');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null), alive = useRef(true);
  const refresh = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try { const next = await api.handoff(projectId, controller.signal); if (!controller.signal.aborted) { setData(next); setError(null); } }
    catch (error) { if (!controller.signal.aborted) setError(errorText(error)); }
    finally { if (!controller.signal.aborted && alive.current) setLoading(false); }
  }, [projectId]);
  useEffect(() => {
    alive.current = true; void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => { alive.current = false; clearInterval(timer); request.current?.abort(); };
  }, [refresh]);
  const rows = data?.rows ?? [], selected = rows.find(r => r.id === selectedId && (scope === 'all' || (scope === 'history' ? r.historical : !r.historical))) ?? (selectedId ? rows.find(r => r.nodeId === initialNodeId && (scope === 'all' || (scope === 'history' ? r.historical : !r.historical))) : undefined);
  const scopedRows = rows.filter(r => scope === 'all' || (scope === 'history' ? r.historical : !r.historical));
  const visible = filterHandoffRows(rows, scope, filter, search);
  const groups = new Map<string, HandoffRow[]>();
  for (const row of visible) {
    const group = groups.get(row.group) ?? [];
    group.push(row);
    groups.set(row.group, group);
  }
  const automaticChecks = selected?.verification.checks.filter(c => c.kind !== 'scenario' && c.surface !== 'browser') ?? [];
  const automaticDetails = automaticChecks.filter(c => !selected?.verification.criteriaChecks?.some(negative => negative.id === c.id));
  const usageChecks = selected?.verification.checks.filter(c => c.kind === 'scenario' || c.surface === 'browser') ?? [];
  return <div className="handoff-view">
    <div className="handoff-toolbar"><span className="small">{scopedRows.length}개 항목 · 목록에서 확인할 항목을 고르세요.</span><div className="row"><button className="button" title="최근 구현 기록과 실제 검사 결과를 다시 읽어요." disabled={loading} onClick={() => void refresh()}>{loading ? '조회 중' : '새로고침'}</button><a className="button" href={api.handoffUrl(projectId)} download>근거 포함 인계 파일 받기</a></div></div>
    <ErrorNotice message={(error && data ? '최신 상태를 읽지 못했어요. 아래는 이전 조회 자료예요. 지금은 통과로 판단하지 마세요. ' + error : error)} />{data?.errors.map((e, i) => <div className="error-notice" role="alert" key={i}>{e.taskId}: {e.message} 이 범위는 현황에 포함되지 않았어요.</div>)}
    {!data && loading ? <Loading /> : <div className="handoff-workspace"><section className="handoff-list" aria-label="구현·검증 현황">
      <div className="handoff-filters"><select aria-label="목록 범위" value={scope} onChange={e => { setScope(e.target.value); setSelectedId(null); }}><option value="current">현재 기능</option><option value="history">이전 작업</option><option value="all">전체 기록</option></select><input aria-label="요구 검색" placeholder="이름으로 찾기 (선택)" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="현황 필터" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체</option><option value="remaining">남은 구현</option><option value="verification">검증 필요</option><option value="failed">실패 발견</option></select></div>
      {!rows.length ? <div className="empty-page"><h2>아직 요구·기능이 없어요.</h2><p>프로젝트 파일에서 하네스 작업을 등록하면 여기에 표시돼요.</p><p className="small">기존 항목의 구현 상태는 자동 추정하지 않고 ‘미기록’으로 표시해요.</p></div> : <><ul className="handoff-flow-index">{[...groups].map(([group, groupRows]) => <li key={group}>
        <h3>{group}</h3><ul>{groupRows.map(row => <li key={row.id}>
          <button aria-pressed={selected?.id === row.id} onClick={() => { setSelectedId(row.id); }}>
            <strong>{row.title}</strong><small>{decisionLabel(row, !error)}</small>
          </button>
        </li>)}</ul>
      </li>)}</ul>{!visible.length && <p className="small">조건에 맞는 항목이 없어요.</p>}</>}
    </section><aside key={selected?.id ?? 'unselected'} className="handoff-detail" aria-label="요구별 구현·검증 상세">
      {selected ? <><header><span className="small">{selected.group} · {selected.requirementId}</span><h2>{selected.title}</h2></header>
        <HandoffFlow row={selected} graph={graph} currentRead={!error} onSelect={onGraphSelect} />
        <RequirementDecision row={selected} currentRead={!error} />
        <details className="handoff-full-detail"><summary>판정 근거</summary>
        <RequirementContext row={selected} />
        {selected.nodeId && <button className="text-button" onClick={() => onGraphSelect(selected.nodeId!)}>관계 그래프에서 보기</button>}
        <HumanConfirmation key={'human-'+selected.id} row={selected} />
        <details><summary>요구 조건</summary><p>{selected.description || selected.origin}</p></details>
        <section><h3>구현 · {implementationLabels[selected.implementation.status]}</h3><p>{selected.implementation.note || '구현 설명 미기록'}</p><p>다음 할 일: {selected.implementation.remaining || (selected.implementation.status === 'implemented' ? '구현 기록상 남은 범위 없음 · 검사·리뷰 상태를 확인해 주세요.' : '미기록')}</p>{selected.implementation.paths.map(path => <CodeEvidence key={path} projectId={projectId} path={path} />)}</section>
        <CriteriaAssurance key={'criteria-'+selected.id} row={selected} onGraphSelect={onGraphSelect} />
        <section><h3>자동 검사 · {verificationLabels[verificationStatus(automaticChecks.map(c=>c.status))]}</h3><p className="small">등록된 동작을 코드와 API로 반복 검사해 회귀를 찾는 단계예요. 실제 화면 사용과 독립 리뷰는 별도로 확인해요.</p>{!automaticChecks.length && <p className="small">등록된 검사가 없어요. 미실행을 통과로 처리하지 않아요.</p>}{!automaticDetails.length && !!automaticChecks.length && <p className="small">실행 결과와 대표 상황은 위 기준 부정 사례에서 함께 확인해 주세요.</p>}<VerificationChecks key={selected.id+'-auto'} checks={automaticDetails} onGraphSelect={onGraphSelect} />
        </section>
        {!!usageChecks.length && <section><h3>실제 사용 확인 · {verificationLabels[verificationStatus(usageChecks.map(c=>c.status))]}</h3><p className="small">자동 검사로 확인하지 못한 화면 조작이나 모델 연결을 실제로 수행해 확인하는 단계예요.</p><VerificationChecks key={selected.id+'-usage'} checks={usageChecks} onGraphSelect={onGraphSelect} /></section>}
        <section><h3>독립 리뷰 · {verificationLabels[selected.verification.review.status]}</h3><p className="small">구현 대화를 전달하지 않은 새 검토 세션이 요구·코드·검사를 대조해요. 자동 검사가 놓친 조건과 연결 오류를 찾기 위한 단계예요.</p><ReviewEvidenceView key={selected.id+'-review'} review={selected.verification.review} title="독립 구현 검토" /></section>
        <details><summary>원래 요구·근거</summary><pre>{selected.origin || '근거 미기록'}</pre>{selected.relatedNodeIds?.map(id => <button key={id} className="text-button" onClick={() => onGraphSelect(id)}>연결 항목 {id.slice(0, 8)} 보기</button>)}</details>
        {!!selected.mergedRecords?.length && <details><summary>통합 전 논의·작업 · {selected.mergedRecords.length}개</summary>{selected.mergedRecords.map(record => <details key={record.id}><summary>{record.title}</summary><p>{record.body}</p></details>)}</details>}
        <details><summary>검증 한계</summary>{selected.limitations.map((l, i) => <p key={i}>{l}</p>)}</details>
        </details>
      </> : <div className="handoff-start">
        <h2>확인할 항목을 골라 주세요</h2>
        <p>목록에서 항목 이름을 누르면 지금 판단할 수 있는 내용, 그 근거, 내가 할 일이 차례로 나와요.</p>
      </div>}
    </aside></div>}
  </div>;
}
function CodeEvidence({ projectId, path }: { projectId: string; path: string }) {
  const [content, setContent] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  return <details onToggle={e => { if (e.currentTarget.open && content === null) void api.code(projectId, path).then(r => setContent(r.content)).catch(e => setError(errorText(e))); }}><summary>구현 근거 · {path}</summary>{error ? <ErrorNotice message={error} /> : <pre>{content ?? '불러오는 중'}</pre>}</details>;
}
