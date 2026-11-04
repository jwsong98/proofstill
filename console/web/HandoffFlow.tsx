import type { Graph, GraphNode, HandoffRow } from '../server/types.ts';
import { implementationLabels, nextAction, verificationLabels } from '../shared/progress.ts';
import { nodeLabels, statusLabels } from './components.tsx';
import { evidenceLabel, reviewConnections } from './reviewFlow.ts';
import './styles/handoff-flow.css';

const emptyLinks: ReturnType<typeof reviewConnections> = { incoming: [], outgoing: [], related: [], evidence: [] };

export function HandoffFlow({ row, graph, currentRead, onSelect }: {
  row: HandoffRow; graph: Graph; currentRead: boolean; onSelect: (id: string) => void;
}) {
  const links = row.nodeId ? reviewConnections(graph, row.nodeId) : emptyLinks;
  const evidence = [...new Map([...links.evidence, ...links.incoming.filter(link => evidenceLabel(link.node))].map(link => [link.node.id, link])).values()];
  const upstream = links.incoming.filter(link => !evidenceLabel(link.node));
  const checkResults = new Set(row.verification.checks.flatMap(check => check.nodeId ? [check.nodeId] : []));
  const decisions = links.outgoing.filter(link => link.node.kind === 'decision');
  const work = links.outgoing.filter(link => link.node.kind === 'task');
  const followUps = links.outgoing.filter(link => !['decision', 'task', 'result'].includes(link.node.kind));
  const visited = new Set<string>();
  const queue = [...links.outgoing];
  for (const { node } of queue) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    if (node.kind === 'result') checkResults.add(node.id);
    if (node.kind === 'decision' || node.kind === 'task') queue.push(...reviewConnections(graph, node.id).outgoing);
  }
  const resultNodes = graph.nodes.filter(node => node.kind === 'result' && checkResults.has(node.id));
  const linkedStatus = (node: GraphNode) => node.execution ? ({ passed: '통과', failed: '실패', interrupted: '중단', unverified: '미확인' } as const)[node.execution.status] : statusLabels[node.status];
  const label = (node: GraphNode) => evidenceLabel(node) ?? nodeLabels[node.kind];
  const linkList = (items: typeof links.outgoing) => <ul className="handoff-flow-links">{items.map(({ node, edge }) => <li key={edge.id}>
    <button className="text-button" onClick={() => onSelect(node.id)}>{label(node)} · {node.title}</button>
    <small>{[node.evidence ? '' : linkedStatus(node), edge.reason].filter(Boolean).join(' · ')}</small>
  </li>)}</ul>;
  const afterChecks = resultNodes.map(node => ({ node, outgoing: reviewConnections(graph, node.id).outgoing })).filter(result => result.outgoing.length);
  return <ol className="handoff-flow" aria-label="근거에서 후속 작업까지">
    <li><h3>어디서 시작됐나요?</h3>
      {row.origin && <details><summary>{row.source === 'harness' ? '하네스에 기록된 원래 요구 보기' : '기록된 출처 내용 보기'}</summary><pre>{row.origin}</pre></details>}
      {!!evidence.length && linkList(evidence)}
      {!row.origin && !evidence.length && <p className="small">연결된 원문이나 대화가 없어요.</p>}
    </li>
    <li><h3>무엇을 하기로 했나요?</h3><p>{row.description || row.title}</p>
      {row.rationale && <p><span className="small">판단 이유 · </span>{row.rationale}</p>}
      {!!upstream.length && <><h4>선행 판단·작업</h4>{linkList(upstream)}</>}
      {!!decisions.length && <><h4>이 요구에서 이어진 결정</h4>{linkList(decisions)}</>}
      {!!links.related.length && <details><summary>함께 참고한 항목 · 방향 없는 연관</summary>{linkList(links.related)}</details>}
      {!!row.pendingDecisions?.length && <ul>{row.pendingDecisions.map(decision => <li key={decision.id}>{decision.question} · 결정 대기</li>)}</ul>}
    </li>
    <li><h3>어떻게 구현했나요?</h3><p><strong>{currentRead ? implementationLabels[row.implementation.status] : '최신 상태 확인 필요'}</strong></p>
      <p>{row.implementation.note || '구현 방식이 아직 기록되지 않았어요.'}</p>
      {!!work.length && <><h4>연결된 구현 작업</h4>{linkList(work)}</>}
      {!!row.implementation.paths.length && <p className="small">구현 위치 · {row.implementation.paths.join(', ')}</p>}
    </li>
    <li><h3>무엇을 확인했나요?</h3>
      <p>{currentRead ? `등록 검사 · ${verificationLabels[row.verification.status]} / 독립 리뷰 · ${verificationLabels[row.verification.review.status]}` : '최근 검사 상태를 다시 불러와 주세요.'}</p>
      {!!resultNodes.length && <ul className="handoff-flow-links">{resultNodes.map(node => <li key={node.id}><button className="text-button" onClick={() => onSelect(node.id)}>{node.title} · {linkedStatus(node)}</button></li>)}</ul>}
      {!!row.verification.checks.length && <details><summary>검사별 목적과 결과 · {row.verification.checks.length}개</summary>
        <ul className="handoff-flow-links">{row.verification.checks.map(check => <li key={check.id}><strong>{check.label} · {currentRead ? verificationLabels[check.status] : '이전 조회'}</strong>
          {(check.purpose || check.rationale) && <small>{check.purpose || check.rationale}</small>}
        </li>)}</ul>
      </details>}
    </li>
    <li><h3>다음에 무엇을 하나요?</h3>
      <p>{currentRead ? (row.pendingDecisions?.length ? '대기 중인 결정을 먼저 확인해 주세요.' : nextAction(row)) : '새로고침 후 다음 행동을 판단해 주세요.'}</p>
      {!!followUps.length && <><h4>이 항목에서 이어지는 항목</h4>{linkList(followUps)}</>}
      {afterChecks.map(({ node, outgoing }) => <div key={node.id}><h4><button className="text-button" onClick={() => onSelect(node.id)}>{node.title}</button> 이후</h4>{linkList(outgoing)}</div>)}
      {!followUps.length && !afterChecks.length && <p className="small">등록된 후속 연결이 없어요.</p>}
    </li>
  </ol>;
}
