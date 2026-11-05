import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { api, subscribeSession, type PendingRequest, type SessionDetail } from './api.ts';
import { ErrorNotice, Icon, Loading, timeLabel } from './components.tsx';
import { contextUsageLabel, cumulativeUsageLabel } from './contextUsage.ts';
import { MessageContent } from './MessageContent.tsx';
import type { Session, SessionEvent } from '../server/types.ts';
import { sessionActivities, groupSessionTimeline, isParentTurnEvent, type Activity } from './sessionActivities.ts';
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
const collabLabels: Record<string, string> = { spawnAgent: '서브에이전트 호출', sendInput: '서브에이전트에 추가 지시', resumeAgent: '서브에이전트 다시 시작', wait: '서브에이전트 응답 대기', closeAgent: '서브에이전트 종료', sendMessage: '서브에이전트에 메시지', followupTask: '서브에이전트 후속 작업', interruptAgent: '서브에이전트 중단', listAgents: '서브에이전트 상태 확인' };
function ActivityCard({ activity }: { activity: Activity }) {
  const { item } = activity;
  if (item.type === 'subAgentResult') return <section className="agent-activity agent-result" aria-label="서브에이전트 실행 결과"><strong>서브에이전트 결과</strong><div className="agent-meta"><code>{String(item.agentThreadId)}</code></div><MessageContent content={String(item.text ?? '')} /></section>;
  if (item.type === 'commandExecution') return <section className="agent-activity execution-activity" aria-label="명령 실행 결과">
    <div className="agent-activity-header"><Icon name="check-circle" size={16} /><strong>명령 실행</strong><span className={'badge ' + (!activity.displayStatus && item.exitCode === 0 ? 'positive' : !activity.displayStatus && item.exitCode != null ? 'negative' : '')}>{activity.displayStatus === 'interrupted' ? '중단' : activity.displayStatus === 'unverified' ? '미확인' : item.status === 'inProgress' ? '실행 중' : item.exitCode === 0 ? '통과' : item.exitCode != null ? '실패' : '미확인'}</span><time>{timeLabel(activity.createdAt)}</time></div>
    <pre className="execution-command">{String(item.command ?? '명령 미확인')}</pre>
    {activity.turnEnd && <p className="small">턴이 {activity.turnEnd.status === 'interrupted' ? '중단' : '실패'}되어 실행 중 표시를 종료했어요. 명령 완료는 확인되지 않았어요. 원본 상태: {String(item.status)}</p>}
    <details open={item.exitCode != null && item.exitCode !== 0}><summary>실행 출력{item.exitCode != null ? ` · 종료 코드 ${item.exitCode}` : ''}</summary><pre>{String(item.aggregatedOutput || '(출력 없음)')}</pre></details>
  </section>;
  if (['mcpToolCall', 'dynamicToolCall', 'fileChange'].includes(String(item.type))) return <section className="agent-activity" aria-label="도구 실행 결과"><strong>{item.type === 'fileChange' ? '파일 변경' : `${item.server ?? ''} ${item.tool ?? '도구 실행'}`}</strong><span className="badge">{item.status === 'inProgress' ? '진행 중' : item.status === 'completed' ? '완료' : item.status ?? '미확인'}</span><details><summary>결과 보기</summary><pre>{JSON.stringify(item.result ?? item.error ?? item.changes ?? {}, null, 2)}</pre></details></section>;
  const isCall = item.type === 'collabAgentToolCall';
  const title = isCall ? collabLabels[String(item.tool)] ?? '서브에이전트 작업' : `서브에이전트 ${item.kind === 'completed' ? '완료' : item.kind === 'interrupted' ? '중단' : '활동'}`;
  const states = Object.values(record(item.agentsStates)).map(record);
  const status = isCall ? String(item.status ?? states[0]?.status ?? 'inProgress') : String(item.kind ?? 'started');
  const done = ['completed', 'failed', 'interrupted'].includes(status);
  const agent = item.agentPath || (Array.isArray(item.receiverThreadIds) ? item.receiverThreadIds[0] : null) || item.agentThreadId;
  return <section className="agent-activity" aria-label={title}>
    <div className="agent-activity-header"><span className="agent-icon"><Icon name="users" size={15} /></span><strong>{title}</strong><span className={'badge ' + (done ? '' : 'blue')}>{done ? status === 'completed' ? '완료' : status === 'interrupted' ? '중단' : '종료' : '진행 중'}</span><time>{timeLabel(activity.createdAt)}</time></div>
    {item.prompt && <p>{String(item.prompt)}</p>}
    <div className="agent-meta">{agent && <code title={String(agent)}>{String(agent)}</code>}{item.model && <span>{String(item.model)}</span>}{item.reasoningEffort && <span>{String(item.reasoningEffort)}</span>}</div>
    {Object.entries(record(item.agentsStates)).map(([id, value]) => { const state = record(value); return <div className="agent-result" key={id}><div className="agent-meta"><code title={id}>{id}</code><span>{state.status === 'completed' ? '완료' : state.status === 'running' ? '진행 중' : String(state.status ?? '미확인')}</span></div>{state.message && <MessageContent content={String(state.message)} />}</div>; })}
  </section>;
}
function ActivityGroup({ activities }: { activities: Activity[] }) {
  const [open, setOpen] = useState(false);
  const running = activities.filter(({ item, displayStatus }) => !displayStatus && item.status === 'inProgress').length;
  const interrupted = activities.filter(activity => activity.displayStatus === 'interrupted').length;
  const unknown = activities.filter(activity => activity.displayStatus === 'unverified').length;
  const failed = activities.filter(({ item }) => item.status === 'failed' || (typeof item.exitCode === 'number' && item.exitCode !== 0)).length;
  return <details className="activity-group" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><Icon name="caret-right" size={14} /><span>실행 활동 {activities.length}개</span>{running > 0 && <span className="badge blue">진행 중 {running}개</span>}{failed > 0 && <span className="badge negative">실패 {failed}개</span>}{interrupted > 0 && <span className="badge">중단 {interrupted}개</span>}{unknown > 0 && <span className="badge">미확인 {unknown}개</span>}</summary>
    {open && <div className="activity-group-content">{activities.map(activity => <ActivityCard key={activity.key} activity={activity} />)}</div>}
  </details>;
}
export function SessionChat({ visible = true, sessionId, messageTarget, onActivity, onGraphUpdated, onCapture, onDetail, renderContext }: {
  visible?: boolean; sessionId: string; messageTarget?: string | null; onActivity: () => void; onGraphUpdated: () => void;
  onCapture: (sessionId: string, messageId: string) => Promise<void>; onDetail: (detail: SessionDetail) => void;
  renderContext?: (session: Session) => ReactNode;
}) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const readingPosition = useRef(0);
  useLayoutEffect(() => {
    if (visible && messagesRef.current) messagesRef.current.scrollTop = readingPosition.current;
  }, [visible]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sending, setSending] = useState(false), [active, setActive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState(() => sessionStorage.getItem('proofstill:draft:' + sessionId) ?? '');
  const messageElements = useRef(new Map<string, HTMLElement>());
  const completed = useRef(new Set<string>()), bottom = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onActivity, onGraphUpdated, onDetail });
  callbacks.current = { onActivity, onGraphUpdated, onDetail };
  useEffect(() => {
    let disposed = false;
    const mountedAt = Date.now(), controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = async () => {
      try {
        const data = await api.session(sessionId, controller.signal);
        if (disposed) return;
        completed.current = new Set(data.messages.map(message => message.externalId).filter((id): id is string => !!id));
        setError(null); setDetail(data); callbacks.current.onDetail(data); if (data.activeTurnId !== undefined) setActive(data.activeTurnId !== null);
        setStreaming(current => Object.fromEntries(Object.entries(current).filter(([id]) => !completed.current.has(id))));
      } catch (error) { if (!disposed) setError(error instanceof Error ? error.message : String(error)); }
    };
    void reload();
    setSyncing(true);
    void api.syncSession(sessionId, controller.signal).then(() => {
      if (disposed) return;
      setSyncError(null);
      return reload();
    }).catch(error => { if (!disposed) setSyncError(`기록 갱신 실패: ${error instanceof Error ? error.message : String(error)}`); }).finally(() => { if (!disposed) setSyncing(false); });
    const refreshSoon = () => { if (timer !== undefined) return; timer = setTimeout(() => { timer = undefined; void reload(); }, 80); };
    const receive = (event: SessionEvent) => {
      if (disposed) return;
      const payload = record(event.payload);
      if (event.method === 'item/agentMessage/delta') {
        const id = String(payload.itemId ?? 'stream');
        if (!completed.current.has(id) && typeof payload.delta === 'string') setStreaming(current => ({ ...current, [id]: (current[id] ?? '') + payload.delta }));
      }
      if (isParentTurnEvent(event) && event.method === 'turn/started') setActive(true);
      if (isParentTurnEvent(event) && event.method === 'turn/completed') {
        setActive(false); refreshSoon(); callbacks.current.onActivity();
        if (event.createdAt >= mountedAt && payload.turn?.error?.message) setError(payload.turn.error.message);
      }
      if (event.method === 'item/commandExecution/outputDelta') refreshSoon();
      if (event.method === 'item/started' || event.method === 'item/completed' || event.method === 'thread/tokenUsage/updated' || event.method.startsWith('request/')) refreshSoon();
      if (event.method === 'graph/updated') callbacks.current.onGraphUpdated();
      if (event.method === 'error' && event.createdAt >= mountedAt) { setError(String(payload.message ?? 'Codex 연결에 문제가 생겼어요.')); setActive(false); refreshSoon(); }
    };
    const close = subscribeSession(sessionId, receive, () => { if (!disposed) setError('세션 연결이 끊겼어요. 다시 연결을 시도하고 있어요.'); }, () => { if (!disposed) setError(current => current === '세션 연결이 끊겼어요. 다시 연결을 시도하고 있어요.' ? null : current); });
    return () => { disposed = true; controller.abort(); close(); clearTimeout(timer); };
  }, [sessionId, reloadKey]);
  useEffect(() => { sessionStorage.setItem('proofstill:draft:' + sessionId, draft); }, [draft, sessionId]);
  useEffect(() => { visible && bottom.current?.scrollIntoView({ block: 'nearest' }); }, [detail?.messages.length, detail?.events?.length, Object.values(streaming).join('').length]);
  useEffect(() => { if (visible && messageTarget) messageElements.current.get(messageTarget)?.scrollIntoView({ block: 'center' }); }, [messageTarget, detail?.messages.length]);
  async function send() {
    const content = draft.trim(); if (!content || sending || active) return;
    setSending(true); setError(null);
    try {
      const key = 'proofstill:outbox:' + sessionId;
      let previous: { id: string; content: string } | null = null;
      try { previous = JSON.parse(sessionStorage.getItem(key) ?? 'null'); } catch { /* A malformed local draft does not authorize a duplicate send. */ }
      const clientMessageId = previous?.content === content ? previous.id : crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ id: clientMessageId, content }));
      const result = await api.send(sessionId, content, clientMessageId);
      sessionStorage.removeItem(key);
      setDraft('');
      const data = await api.session(sessionId); setDetail(data); callbacks.current.onDetail(data); if (data.activeTurnId !== undefined) setActive(data.activeTurnId !== null); callbacks.current.onActivity();
      if (data.activeTurnId !== undefined) setActive(data.activeTurnId !== null);
      else { const status = record(result.turn).status; setActive(!['completed', 'interrupted', 'failed'].includes(String(status ?? 'inProgress'))); }
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setSending(false); }
  }
  async function respond(pending: PendingRequest, decision: 'accept' | 'decline' | 'cancel') {
    setError(null);
    try { await api.respond(sessionId, pending.id, decision); const data = await api.session(sessionId); setDetail(data); callbacks.current.onDetail(data); if (data.activeTurnId !== undefined) setActive(data.activeTurnId !== null); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }
  if (!detail) return <div className="chat"><ErrorNotice message={error} /><ErrorNotice message={syncError} />{error || syncError ? <button className="button" onClick={() => setReloadKey(key => key + 1)}>다시 불러오기</button> : <Loading />}</div>;
  const contextUsage = contextUsageLabel(detail.usage.at(-1));
  const timeline = groupSessionTimeline(detail.messages, sessionActivities(detail.events ?? []));
  return <div className="chat"><div className="row between"><span className="small">{detail.session.role === 'graph' ? '그래프 분석' : detail.session.role ?? 'Codex 세션'}</span><span className={'badge ' + (active ? 'blue' : '')}>{active ? '응답 중' : '대화'}</span></div>
    <div className="row between session-controls"><span className="small">{detail.session.role === 'graph' ? '읽기 전용 분석' : '전체 접근 · 승인 요청 없음'}</span><button className="text-button" disabled={syncing} onClick={() => setReloadKey(key => key + 1)}>{syncing ? '기록 갱신 중' : '다시 불러오기'}</button></div>
    <ErrorNotice message={error} />
    <ErrorNotice message={syncError} />
    <div className="messages" aria-live={visible ? 'polite' : 'off'} ref={messagesRef}
      onScroll={event => { if (visible) readingPosition.current = event.currentTarget.scrollTop; }}>
      {renderContext?.(detail.session)}
      {!timeline.length && <div className="empty-chat"><Icon name="chat-circle" size={24} /><p>{detail.session.contextNodeIds.length ? '선택한 컨텍스트로 대화를 시작해요.' : '프로젝트 루트에서 대화를 시작해요.'}</p><span className="small">질문과 판단에 필요한 원문 근거를 함께 확인할 수 있어요.</span></div>}
      {timeline.map(entry => entry.kind === 'activities' ? <ActivityGroup activities={entry.activities} key={entry.key} /> : (() => { const message = entry.message; return <article className={'message ' + (message.role === 'user' ? 'user-message' : '')} key={message.id} ref={element => { if (element) { messageElements.current.set(message.id, element); if (message.externalId) messageElements.current.set(message.externalId, element); } else { messageElements.current.delete(message.id); if (message.externalId) messageElements.current.delete(message.externalId); } }} data-message-id={message.id} data-original-message-id={message.externalId ?? message.id}>
        <div className="row between speaker"><span>{message.role === 'user' ? '나' : message.role === 'assistant' ? 'Codex' : message.role === 'tool' ? '도구' : '시스템'}</span><span>{message.createdAt ? timeLabel(message.createdAt) : '시각 미확인'}</span></div>
        <MessageContent content={message.content} />
        {['user', 'assistant'].includes(message.role) && <button className="text-button save-message" onClick={() => void onCapture(sessionId, message.id).catch(error => setError(String(error)))}><Icon name="bookmark-simple" size={14} />원문 근거로 보존하기</button>}
      </article>; })())}
      {Object.entries(streaming).map(([id, content]) => <article className="message" key={id}><div className="speaker">Codex · 응답 중</div><MessageContent content={content} /></article>)}
      {detail.pending.map(pending => <section className="approval" key={pending.id}>
        <h3>{pending.method.includes('fileChange') ? 'Codex가 파일 변경 승인을 요청했어요.' : 'Codex가 명령 실행 승인을 요청했어요.'}</h3>
        <details><summary>요청 내용 보기</summary><pre>{JSON.stringify(pending.params, null, 2)}</pre></details>
        <div className="row"><button className="button" onClick={() => void respond(pending, 'accept')}>허용하기</button><button className="button" onClick={() => void respond(pending, 'decline')}>거절하기</button></div>
      </section>)}
      <div ref={bottom} />
    </div>
    {detail.session.role === 'graph' ? <div className="composer small">그래프 분석 기록이에요. 기능 노드에서 일반 Codex 세션을 열어 대화할 수 있어요.</div> : <form className="composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor={`chat-input-${sessionId}`} className="sr-only">Codex에게 메시지 보내기</label>
      <textarea id={`chat-input-${sessionId}`} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Codex에게 메시지 보내기" onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void send(); } }} />
      <div className="row between"><span className="small context-usage">{contextUsage}<br />{cumulativeUsageLabel(detail.usage.at(-1))}</span>{active ? <button className="button" type="button" onClick={() => void api.interrupt(sessionId).catch(error => setError(String(error)))}>응답 중단하기</button> : <button className="button primary" disabled={sending || !draft.trim()} type="submit">{sending ? '보내는 중' : '보내기'}<Icon name="paper-plane-tilt" /></button>}</div>
    </form>}
  </div>;
}
