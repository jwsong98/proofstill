import type { HandoffCheck, HandoffRow, VerificationStatus } from '../server/types.ts';

export type EvidenceCase = { operation: string; situation: string; expected: string; observed: string; status: VerificationStatus; recordedAt?: string | null };
export type ReviewEvidence = { status: VerificationStatus; gateStatus?: VerificationStatus; evidence: string; session?: string; findings?: string[]; limitations?: string[]; history?: { verdict: string; findings: string[]; checks: { id: string; status: string; evidence: string }[]; session?: string; label: string }[] };
export type AssuredCheck = HandoffCheck & { cases?: EvidenceCase[] };
export type AssuredRow = HandoffRow & {
  risk?: string; rationale?: string; implementationCurrent?: boolean | null; issues?: string[];
  humanChecks?: { requirement: string; action: string; expected: string }[];
  responsibility?: { human: string; ai: string }; next?: string;
  pendingDecisions?: { id: string; question: string }[];
  verification: HandoffRow['verification'] & { criteriaReview?: ReviewEvidence; criteriaChecks?: AssuredCheck[]; criteriaRequired?: boolean; review: HandoffRow['verification']['review'] & ReviewEvidence };
};
export function criteriaStatus(row: AssuredRow): VerificationStatus {
  const review = row.verification.criteriaReview;
  const checks = Array.isArray(row.verification.criteriaChecks) ? row.verification.criteriaChecks : [];
  if (review?.status === 'failed' || checks.some(check => check?.status === 'failed')) return 'failed';
  if (review?.status === 'stale' || checks.some(check => check?.status === 'stale')) return 'stale';
  if (review?.findings?.length && (!review.gateStatus || review.gateStatus === review.status)) return 'failed';
  if (!review) return 'not_run';
  if (!checks.length) return 'unverified';
  const statuses = ['not_run', 'partial', 'passed', 'failed', 'stale', 'unverified', 'interrupted'];
  if (!statuses.includes(review.status) || checks.some(check => !check || !statuses.includes(check.status))) return 'unverified';
  for (const status of ['interrupted', 'unverified', 'not_run', 'partial'] as const) {
    if (checks.some(check => check.status === status)) return status;
  }
  return checks.every(check => check.status === 'passed') ? review.status : 'unverified';
}
export function criteriaReason(row: AssuredRow): string {
  const status = criteriaStatus(row);
  if (status !== 'failed' && status !== 'stale' && !(row.verification.criteriaChecks?.length)) return '잘못된 결과를 걸러내는 부정 검사 근거가 아직 연결되지 않았어요. 기준이 적절하다고 판단하지 않아요.';
  return { passed: '등록된 부정 사례를 실제로 거부했고, 독립 세션도 현재 기준을 검토했어요. 아래 확인 범위에 한정돼요.', failed: '기준 검증에서 미해결 문제가 발견됐어요. 지적과 실제 실행을 확인하고 판단을 보류해 주세요.', stale: '코드·검사·기준 또는 실행 근거가 바뀌었어요. 이전 기준 검토를 현재 승인으로 사용하지 않아요.', not_run: '독립 기준 검토 또는 부정 검사를 아직 실행하지 않았어요.', unverified: '기준이 잘못된 결과를 걸러내는지 확인할 근거가 부족해요.', partial: '일부 기준만 확인했어요. 남은 범위가 있어 판단을 보류해 주세요.', interrupted: '기준 확인이 중단됐어요. 완료된 판정이 아니에요.' }[status];
}
export function judgmentState(row: AssuredRow) {
  if (row.pendingDecisions?.length) return 'decision';
  if (row.implementation.status !== 'implemented') return 'implementation';
  if (row.implementationCurrent !== true) return 'currentness';
  if (row.verification.status !== 'passed' || row.verification.review.status !== 'passed' || criteriaStatus(row) !== 'passed') return 'evidence';
  if ((row.verification.review.gateStatus && row.verification.review.gateStatus !== 'passed') || (row.verification.criteriaReview?.gateStatus && row.verification.criteriaReview.gateStatus !== 'passed')) return 'gate';
  if (!row.humanChecks?.length) return 'action';
  return 'ready';
}

export function judgment(row: AssuredRow): string {
  return {
    decision: '사람의 정책 결정이 남아 있어요. 답변 전에는 이 작업의 진행을 보류해요.',
    implementation: '남은 구현을 먼저 확인해 주세요. 검사 통과만으로 구현 완료를 추정하지 않아요.',
    currentness: '구현 기록이 현재 코드와 일치하는지 재확인이 필요해요.',
    evidence: '구현 기록은 있지만 검증 근거가 충분하지 않아요. 아래 미확인 범위를 보고 판단을 보류해 주세요.',
    gate: '이 요구가 확인됐더라도 작업 전체의 검토가 끝난 것은 아니에요. 다른 요구의 남은 문제와 작업 전체 게이트를 함께 확인해 주세요.',
    action: '기술 근거는 있지만 사람이 직접 확인할 행동이 아직 연결되지 않았어요.',
    ready: '등록한 범위의 기술 근거가 있어요. 아래 행동으로 원하는 결과와 대조한 뒤 수용 여부를 판단해 주세요. 자동 수용된 상태는 아니에요.',
  }[judgmentState(row)];
}
