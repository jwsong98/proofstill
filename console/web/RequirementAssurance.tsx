import type { AssuredRow, ReviewEvidence } from '../shared/assurance.ts';
import { criteriaReason, criteriaStatus, judgment } from '../shared/assurance.ts';
import { verificationLabels } from '../shared/progress.ts';
import { VerificationChecks } from './VerificationChecks.tsx';

export function RequirementDecision({ row, currentRead = true }: { row: AssuredRow; currentRead?: boolean }) {
  return <section aria-label="지금 판단할 내용"><h3>지금 판단할 내용</h3><p>{currentRead ? judgment(row) : '최신 조회에 실패해 아래는 이전 자료예요. 현재 상태의 수용 판단을 보류해 주세요.'}</p>
    <h4>잘못 판단할 위험</h4><p>{row.risk || '이 요구의 위험 설명이 아직 연결되지 않았어요.'}</p><h4>이 기준이 필요한 이유</h4><p>{row.rationale || '필요성 설명이 아직 연결되지 않았어요. 검사 통과만으로 판단하지 않아요.'}</p>
    <p className="small">미확인 범위: {row.limitations[0] || '한계가 기록되지 않았어요. 모든 동작의 확인으로 확대하지 않아요.'}</p>
    <p className="small">구현 현재성: {row.implementationCurrent === true ? '현재 코드와 기록이 일치해요.' : row.implementationCurrent === false ? '기록 이후 변경됐거나 근거가 사라졌어요.' : '확인할 버전 근거가 없어요.'}</p>
    {row.issues?.map((issue, index) => <p className="small" key={index}>{issue}</p>)}
    {row.pendingDecisions?.map(decision => <p key={decision.id}>사람 결정 대기: {decision.question}</p>)}
  </section>;
}
export function CriteriaAssurance({ row, onGraphSelect }: { row: AssuredRow; onGraphSelect: (id: string) => void }) {
  const status = criteriaStatus(row);
  return <section aria-label="검증 기준의 적절성"><h3>검증 기준의 적절성 · {verificationLabels[status]}</h3><p>{criteriaReason(row)}</p>
    <p className="small">정상 결과만 통과하는지와 함께, 잘못된 결과를 실제로 거부하는지 확인하는 단계예요. 테스트 개수나 AI의 적절하다는 선언만으로 승인하지 않아요.</p>
    {!!row.verification.criteriaChecks?.length && <><h4>기준을 시험한 부정 사례</h4><VerificationChecks checks={row.verification.criteriaChecks} onGraphSelect={onGraphSelect} /></>}
    <ReviewEvidenceView review={row.verification.criteriaReview} title="독립 기준 검토" />
  </section>;
}
const reviewLabel = (status: ReviewEvidence['status']) => status === 'passed' ? '확인' : status === 'failed' ? '결함 발견' : verificationLabels[status];
export function ReviewEvidenceView({ review, title }: { review?: ReviewEvidence; title: string }) {
  return <div role="group" aria-label={title}><h4>{title} · {reviewLabel(review?.status ?? 'not_run')}</h4><p>{review?.evidence || '현재 요구를 독립적으로 확인한 근거가 없어요.'}</p>
    {review?.gateStatus && review.gateStatus !== review.status && <p className="small">이 요구의 판정과 별도로 작업 전체 게이트는 {verificationLabels[review.gateStatus]} 상태예요.</p>}
    {!!review?.findings?.length && <><h4>{review.status === 'stale' ? '이전 지적 · 현재 재검토 필요' : '현재 남은 지적'}</h4><ul>{review.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul></>}
    {!!review?.limitations?.length && <><h4>이 검토에서 모르는 범위</h4><ul>{review.limitations.map((limit, i) => <li key={i}>{limit}</li>)}</ul></>}
    <details><summary>검토 근거와 이전 지적 펼치기</summary><p className="small">독립 세션: {review?.session || '미확인'}. 이전 판정은 현재 통과 근거가 아니에요. 현재 지적의 해결 여부는 위 재검토 판정·실행과 대조해 주세요.</p>
      {review?.history?.length ? review.history.map((previous, i) => <div key={i}><h4>{previous.label} · {previous.verdict}</h4>{previous.findings.map((finding, j) => <p key={j}>{finding}</p>)}{previous.checks.map((check, j) => <p key={j}>{check.id}: {check.status} · {check.evidence}</p>)}</div>) : <p className="small">보존된 이전 검토 기록이 없어요.</p>}
    </details>
  </div>;
}
export function HumanConfirmation({ row }: { row: AssuredRow }) {
  return <section aria-label="사람이 지금 확인할 행동"><h3>사람이 지금 확인할 행동</h3>
    {row.humanChecks?.length ? row.humanChecks.map((check, i) => <div key={i}><p>{check.action}</p><p className="small">기대하는 결과: {check.expected}</p></div>) : <p>이 요구에 연결된 확인 행동이 아직 없어요. 무엇을 직접 확인할지 정하기 전에는 수용됐다고 판단하지 않아요.</p>}
    <p className="small">원하는 결과와 다르면 해당 요구와 차이를 알려 주세요. 수정 후 영향받는 검사와 독립 리뷰를 다시 확인해요. 이 화면의 통과는 사용자의 YES가 아니에요.</p>
    {row.next && <p>다음 행동: {row.next}</p>}
    <details><summary>사람과 AI가 맡은 범위</summary><p>사람: {row.responsibility?.human || '담당 범위 미기록'}</p><p>AI: {row.responsibility?.ai || '위임 범위 미기록'}</p></details>
  </section>;
}
