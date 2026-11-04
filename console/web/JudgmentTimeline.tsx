import type { Graph, NodeKind } from '../server/types.ts';
import { evidenceLabel, judgmentTimeline, reviewConnections, reviewTitle } from './reviewFlow.ts';
import { nodeLabels } from './components.tsx';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function JudgmentTimeline({ graph, selectedId, onSelect, hiddenKinds, onlyIncomplete, onShowAll }: {
  graph: Graph; selectedId: string | null; onSelect: (id: string) => void;
  hiddenKinds: Set<NodeKind>; onlyIncomplete: boolean; onShowAll: () => void;
}) {
  const nodes = graph.nodes.filter(node => !hiddenKinds.has(node.kind) && (!onlyIncomplete || node.kind !== 'feature' || node.status !== 'completed'));
  const visible = { nodes, edges: graph.edges };
  const entries = judgmentTimeline(nodes);
  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const day = entry.at > 0 ? dateFormat.format(entry.at) : '시각 미확인';
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(entry);
  }
  return <section className="judgment-timeline" aria-label="판단 기록">
    <header><h2>판단 기록</h2><p className="small">사용자 발언과 결정 기록을 시간순으로 읽어요. 각 항목에서 연결 이유를 확인할 수 있어요.</p></header>
    {!entries.length && <p>표시할 사용자 발언이나 결정이 없어요. {hiddenKinds.size > 0 && <button className="text-button" onClick={onShowAll}>전체 항목 표시하기</button>}</p>}
    {[...days].map(([day, records]) => <section className="judgment-day" key={day}>
      <h3>{day}</h3>
      <ol>{records.map(({ node, at, label }) => {
        const { incoming, outgoing, related, evidence } = reviewConnections(visible, node.id);
        const links = [
          ...outgoing.map(link => ({ ...link, relation: '후속' })),
          ...incoming.map(link => ({ ...link, relation: '선행' })),
          ...related.map(link => ({ ...link, relation: '연관' })),
          ...evidence.map(link => ({ ...link, relation: '연관' })),
        ].sort((a, b) => Number(b.node.kind === 'decision') - Number(a.node.kind === 'decision'));
        const list = (items: typeof links) => <ul>{items.map(link => <li key={link.edge.id}>
          <span className="small">{link.relation} · {evidenceLabel(link.node) ?? nodeLabels[link.node.kind]}</span>
          <button className="text-button" onClick={() => onSelect(link.node.id)}>{reviewTitle(link.node)}</button>
          {link.edge.reason && <span className="small">{link.edge.reason}</span>}
        </li>)}</ul>;
        return <li key={node.id} className="judgment-entry">
          <div className="judgment-time">
            {at > 0 && <time dateTime={new Date(at).toISOString()}>{timeFormat.format(at)}</time>}
            <span>{label}</span>
          </div>
          <button className="judgment-title" aria-pressed={node.id === selectedId} onClick={() => onSelect(node.id)}>{reviewTitle(node, 240)}</button>
          {node.kind === 'decision' && node.body && <p className="judgment-body">{node.body}</p>}
          {list(links.slice(0, 3))}
          {links.length > 3 && <details><summary>연결 {links.length - 3}개 더 보기</summary>{list(links.slice(3))}</details>}
          {!links.length && <p className="small">연결된 항목이 없어요.</p>}
        </li>;
      })}</ol>
    </section>)}
  </section>;
}
