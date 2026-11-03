import type { AssuredCheck, AssuredRow, ReviewEvidence } from '../shared/assurance.ts';
import { criteriaStatus, criteriaReason, judgment } from '../shared/assurance.ts';
import { verificationLabels } from '../shared/progress.ts';
type Escape = (value: unknown) => string;
export function caseHtml(check: AssuredCheck, escape: Escape): string {
  return (check.cases ?? []).map(example => `<div class="check-example" data-operation="${escape(example.operation)}"><h4>대표 상황</h4><p>${escape(example.situation)}</p><p>기대 결과: ${escape(example.expected)}</p><h4>실제 관찰 · ${escape(verificationLabels[example.status] ?? '확인 불가')}</h4><p>${escape(example.observed)}</p></div>`).join('');
}
export function reviewHtml(review: ReviewEvidence | undefined, title: string, escape: Escape): string {
  return `<div role="group" aria-label="${escape(title)}"><h4>${escape(title)} · ${escape(review?.status === 'passed' ? '확인' : review?.status === 'failed' ? '결함 발견' : verificationLabels[review?.status ?? 'not_run'] ?? '확인 불가')}</h4><p>${escape(review?.evidence || '현재 요구를 독립적으로 확인한 근거가 없어요.')}</p>
${review?.gateStatus && review.gateStatus !== review.status ? `<p>작업 전체 게이트: ${escape(verificationLabels[review.gateStatus] ?? '확인 불가')}</p>` : ''}
${review?.findings?.length ? `<h4>${review.status === 'stale' ? '이전 지적 · 현재 재검토 필요' : review.gateStatus && review.gateStatus !== review.status ? '작업 전체의 남은 지적 · 이 요구 판정과 구분' : '현재 남은 지적'}</h4><ul>${review.findings.map(f => `<li>${escape(f)}</li>`).join('')}</ul>` : ''}
${review?.limitations?.length ? `<h4>이 검토에서 모르는 범위</h4><ul>${review.limitations.map(l => `<li>${escape(l)}</li>`).join('')}</ul>` : ''}
<details><summary>검토 근거와 이전 지적 펼치기</summary><p>독립 세션: ${escape(review?.session || '미확인')}. 이전 판정은 현재 통과 근거가 아니에요. 현재 해결 여부는 위 재검토 판정·실행과 대조해 주세요.</p>${review?.history?.length ? review.history.map(previous => `<h4>${escape(previous.label)} · ${escape(previous.verdict)}</h4>${previous.findings.map(f => `<p>${escape(f)}</p>`).join('')}${previous.checks.map(c => `<p>${escape(c.id)}: ${escape(c.status)} · ${escape(c.evidence)}</p>`).join('')}`).join('') : '<p>보존된 이전 검토 기록이 없어요.</p>'}</details></div>`;
}
export function assuranceHtml(row: AssuredRow, escape: Escape): string {
  return `<section aria-label="지금 판단할 내용"><h3>지금 판단할 내용</h3><p>${escape(judgment(row))}</p><h4>잘못 판단할 위험</h4><p>${escape(row.risk || '이 요구의 위험 설명이 아직 연결되지 않았어요.')}</p><h4>이 기준이 필요한 이유</h4><p>${escape(row.rationale || '필요성 설명이 아직 연결되지 않았어요.')}</p><p>미확인 범위: ${escape(row.limitations[0] || '한계가 기록되지 않았어요. 모든 동작의 확인으로 확대하지 않아요.')}</p><p>구현 현재성: ${row.implementationCurrent === true ? '현재 코드와 기록이 일치해요.' : row.implementationCurrent === false ? '기록 이후 변경됐거나 근거가 사라졌어요.' : '확인할 버전 근거가 없어요.'}</p>${(row.issues ?? []).map(issue => `<p>${escape(issue)}</p>`).join('')}${(row.pendingDecisions ?? []).map(d => `<p>사람 결정 대기: ${escape(d.question)}</p>`).join('')}</section>
<section aria-label="사람이 지금 확인할 행동"><h3>사람이 지금 확인할 행동</h3>${row.humanChecks?.length ? row.humanChecks.map(c => `<p>${escape(c.action)}</p><p>기대하는 결과: ${escape(c.expected)}</p>`).join('') : '<p>이 요구에 연결된 확인 행동이 아직 없어요. 수용됐다고 판단하지 않아요.</p>'}<p>원하는 결과와 다르면 해당 요구와 차이를 알려 주세요. 수정 후 영향받는 검사와 독립 리뷰를 다시 확인해요. 이 화면의 통과는 사용자의 YES가 아니에요.</p>${row.next ? `<p>다음 행동: ${escape(row.next)}</p>` : ''}<details><summary>사람과 AI가 맡은 범위</summary><p>사람: ${escape(row.responsibility?.human || '담당 범위 미기록')}</p><p>AI: ${escape(row.responsibility?.ai || '위임 범위 미기록')}</p></details></section>
<section aria-label="검증 기준의 적절성"><h3>검증 기준의 적절성 · ${escape(verificationLabels[criteriaStatus(row)])}</h3><p>${escape(criteriaReason(row))}</p><p>정상 결과만 통과하는지와 함께 잘못된 결과를 실제로 거부하는지 확인해요. 테스트 개수나 AI의 선언만으로 승인하지 않아요.</p>${reviewHtml(row.verification.criteriaReview, '독립 기준 검토', escape)}</section>`;
}
