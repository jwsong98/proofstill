import { criteriaStatus } from './assurance.ts';
import type { VerificationStatus } from '../server/types.ts';

export const implementationLabels = { unknown: '미기록', not_started: '미착수', in_progress: '진행 중', partial: '일부 구현', implemented: '구현 완료' };
export const verificationLabels = { not_run: '미실행', partial: '일부 확인', passed: '통과', failed: '실패', stale: '재검증 필요', unverified: '확인 불가', interrupted: '중단' };
export function verificationStatus(statuses: VerificationStatus[]): VerificationStatus {
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('stale')) return 'stale';
  if (statuses.length && statuses.every(s => s === 'passed')) return 'passed';
  if (statuses.includes('passed')) return 'partial';
  if (statuses.includes('interrupted')) return 'interrupted';
  if (statuses.includes('unverified')) return 'unverified';
  return 'not_run';
}

export function nextAction(row: import('../server/types.ts').HandoffRow): string {
  if (row.implementation.remaining) return row.implementation.remaining;
  if (row.implementation.status === 'unknown') return '코드 대조·구현 기록 필요';
  if (row.implementation.status !== 'implemented') return '남은 구현 범위 확인';
  if (row.implementationCurrent === false) return '현재 코드와 구현 기록 재확인';
  const pending = row.verification.checks.find(c => c.status !== 'passed');
  if (pending) return pending.kind === 'scenario' ? pending.label : `${verificationLabels[pending.status]}: ${pending.label}`;
  if (row.verification.status !== 'passed') return '검사 등록·실행 필요';
  if (row.verification.review.status !== 'passed') return '독립 리뷰 확인 필요';
  if (criteriaStatus(row) !== 'passed') return '기준 적절성·부정 사례 확인 필요';
  if ((row.verification.review.gateStatus && row.verification.review.gateStatus !== 'passed') || (row.verification.criteriaReview?.gateStatus && row.verification.criteriaReview.gateStatus !== 'passed')) return '작업 전체의 남은 검토 확인';
  if (!row.humanChecks?.length) return '사람 확인 행동 연결 필요';
  return '사람 확인 후 수용 판단';
}

export function filterHandoffRows(rows: import('../server/types.ts').HandoffRow[], scope: string, filter: string, search: string) {
  const query = search.trim().toLowerCase();
  return rows.filter(row => {
    if (scope !== 'all' && (scope === 'history' ? !row.historical : row.historical)) return false;
    if (filter === 'remaining' && row.implementation.status === 'implemented' && !row.implementation.remaining) return false;
    if (filter === 'verification' && row.verification.status === 'passed' && row.verification.review.status === 'passed' && criteriaStatus(row) === 'passed' && row.implementationCurrent === true) return false;
    if (filter === 'failed' && row.verification.status !== 'failed' && row.verification.review.status !== 'failed' && !row.verification.checks.some(c => c.exitCode !== null && c.exitCode > 0)) return false;
    return `${row.title} ${row.group} ${row.requirementId} ${row.description || row.origin} ${row.implementation.note} ${row.implementation.remaining}`.toLowerCase().includes(query);
  });
}
