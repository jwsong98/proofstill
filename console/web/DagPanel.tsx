import { useEffect, useRef, useState } from 'react';
import type { Graph } from '../server/types.ts';
import type { DagRun, TaskDefinition, TaskState } from '../server/dagPlan.ts';
import { request } from './api.ts';
import { ErrorNotice, Modal } from './components.tsx';
import './styles/dag.css';

type Snapshot = { definitions: Record<string, TaskDefinition>; run: DagRun | null };
export const taskStateLabels: Record<TaskState, string> = { pending: '대기', running: '실행 중', completed: '완료', failed: '실패', blocked: '선행·소유권 대기', interrupted: '중단' };
const text = (error: unknown) => error instanceof Error ? error.message : String(error);
export function DagPanel({ projectId, graph, onGraphUpdated, onSelect }: { projectId: string; graph: Graph; onGraphUpdated: () => void; onSelect: (id: string) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [jobs, setJobs] = useState(2);
  const refresh = useRef(onGraphUpdated); refresh.current = onGraphUpdated;
  const lastRun = useRef<string | null>(null);
  const endpoint = `/projects/${encodeURIComponent(projectId)}/dag`;
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await request<Snapshot>(endpoint);
        if (disposed) return;
        const serialized = JSON.stringify(next.run);
        if (lastRun.current !== null && lastRun.current !== serialized) refresh.current();
        lastRun.current = serialized; setSnapshot(next);
      } catch (error) { if (!disposed) setError(text(error)); }
      finally { if (!disposed) timer = setTimeout(() => void load(), 1500); }
    };
    void load(); return () => { disposed = true; clearTimeout(timer); };
  }, [endpoint]);
  const tasks = graph.nodes.filter(node => node.kind === 'task'), running = snapshot?.run?.status === 'running';
  const completed = tasks.filter(task => task.status === 'completed').length;
  const act = async (action: 'start' | 'stop') => {
    setBusy(true); setError(null);
    try {
      await request(endpoint + '/' + action, { method: 'POST', body: action === 'start' ? { jobs } : {} });
      setSnapshot(await request<Snapshot>(endpoint)); refresh.current();
    } catch (error) { setError(text(error)); }
    finally { setBusy(false); }
  };
  if (!tasks.length && !snapshot?.run) return null;
  const configured = tasks.every(task => snapshot?.definitions[task.id]);
  return <section className="dag-toolbar" aria-label="DAG 작업 실행">
    <div className="row between"><button className="text-button" onClick={() => setOpen(true)}>작업 실행 설정 · {completed}/{tasks.length} 완료</button>
      {running ? <button className="button" disabled={busy} onClick={() => void act('stop')}>실행 중단</button>
        : <button className="button primary" disabled={busy || !snapshot || !configured || !tasks.length} onClick={() => void act('start')}>DAG 실행</button>}</div>
    <ErrorNotice message={error} />
    {open && <Modal title="그래프 작업 실행" onClose={() => setOpen(false)}>
      <p className="small">시작 시 작업과 선후 관계를 고정해요. 소유 경로가 겹치지 않는 작업은 함께 실행하고, 검사·빌드 통과 후 작업별로 커밋해요. 시작 전 기존 변경은 커밋해 주세요.</p>
      <label className="dag-jobs">동시 구현 수 <input type="number" min={1} max={8} value={jobs} disabled={running} onChange={event => setJobs(Number(event.target.value))} /></label>
      <ErrorNotice message={error} />
      {!tasks.length && <p>현재 실행할 작업 노드가 없어요.</p>}
      <div className="dag-task-list">{tasks.map(node => <TaskSettings key={node.id} id={node.id} title={node.title} definition={snapshot?.definitions[node.id]} disabled={!!running || busy}
        result={snapshot?.run?.tasks.find(task => task.nodeId === node.id)} onSelect={() => onSelect(node.id)}
        onSave={async definition => {
          setError(null);
          try {
            await request(endpoint + '/tasks/' + encodeURIComponent(node.id), { method: 'PUT', body: definition });
            setSnapshot(await request<Snapshot>(endpoint)); refresh.current();
          } catch (error) { setError(text(error)); throw error; }
        }} />)}</div>
      <p className="small">완료 근거는 실제 커밋과 등록 검사 결과예요. Codex 요약은 작업 설명이며, 사용자 수용과 독립 리뷰는 별도예요.</p>
      {running ? <button className="button" disabled={busy} onClick={() => void act('stop')}>실행 중단</button>
        : <button className="button primary" disabled={busy || !configured || !tasks.length} onClick={() => void act('start')}>DAG 실행</button>}
    </Modal>}
  </section>;
}
function TaskSettings({ id, title, definition, disabled, result, onSelect, onSave }: {
  id: string; title: string; definition?: TaskDefinition; disabled: boolean; result?: DagRun['tasks'][number]; onSelect: () => void; onSave: (definition: TaskDefinition) => Promise<void>;
}) {
  const [owns, setOwns] = useState(definition?.owns.join('\n') ?? ''), [checks, setChecks] = useState(definition?.checks.map(argv => JSON.stringify(argv)).join('\n') ?? '');
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const original = useRef(JSON.stringify(definition));
  useEffect(() => {
    if (original.current === JSON.stringify(definition)) return;
    original.current = JSON.stringify(definition); setOwns(definition?.owns.join('\n') ?? ''); setChecks(definition?.checks.map(argv => JSON.stringify(argv)).join('\n') ?? '');
  }, [definition]);
  const save = async () => {
    setSaving(true); setError(null);
    try { await onSave({ owns: owns.split('\n').map(line => line.trim()).filter(Boolean), checks: checks.split('\n').filter(line => line.trim()).map(line => JSON.parse(line)) }); }
    catch (error) { setError(text(error)); } finally { setSaving(false); }
  };
  return <details className="dag-task" open={result?.status === 'failed' || undefined}>
    <summary>{title} · {result ? '최근 실행 ' + taskStateLabels[result.status] : definition ? '실행 준비' : '설정 필요'}</summary>
    <button className="text-button" onClick={onSelect}>그래프 노드 보기</button>
    <label htmlFor={'owns-' + id}>소유 파일·폴더 · 프로젝트 상대 경로, 한 줄에 하나</label>
    <textarea id={'owns-' + id} value={owns} disabled={disabled || saving} onChange={event => setOwns(event.target.value)} placeholder={'src/orders\ntests/orders.test.ts'} rows={3} />
    <label htmlFor={'checks-' + id}>검사·빌드 명령 · 한 줄에 argv JSON 배열 하나</label>
    <textarea id={'checks-' + id} value={checks} disabled={disabled || saving} onChange={event => setChecks(event.target.value)} placeholder={'["npm","test","--","orders"]\n["npm","run","build"]'} rows={3} />
    <button className="button" disabled={disabled || saving} onClick={() => void save()}>{saving ? '저장 중' : '작업 설정 저장'}</button>
    <ErrorNotice message={error} />
    {result && <section className="dag-evidence" aria-label={title + ' 완료 근거'}>
      <p><strong>최근 실행 · {taskStateLabels[result.status]}</strong>{result.commit && <> · 커밋 <code>{result.commit}</code></>}</p>
      {result.error && <p role="alert">{result.error}</p>}
      {result.summary && <details><summary>Codex 작업 요약</summary><pre>{result.summary}</pre></details>}
      {result.checks.map((check, index) => <details key={index}><summary>{check.exitCode === 0 ? '통과' : '실패·미확인'} · {JSON.stringify(check.argv)}</summary><pre>{check.output || '(출력 없음)'}</pre><span className="small">종료 코드 {check.exitCode ?? '미확인'}</span></details>)}
    </section>}
  </details>;
}
