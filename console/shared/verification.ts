import type { HandoffCheck, VerificationStatus } from '../server/types.ts';

export function checkTitle(check: Pick<HandoffCheck, 'id' | 'label'>) {
  return check.label && check.label !== check.id ? check.label : '설명이 등록되지 않은 검사';
}
export function statusReason(status: VerificationStatus) {
  return {not_run:'아직 실행 기록이 없어 확인하지 못했어요.',partial:'일부 검사는 확인했고 남은 검사가 있어요.',passed:'등록한 범위의 기대 결과를 확인했어요.',failed:'실제 실행 결과가 기대 조건을 충족하지 못했어요.',stale:'코드나 기준이 바뀌어 현재 버전에서 다시 확인해야 해요.',unverified:'근거가 부족해 결과를 판단할 수 없어요.',interrupted:'실행이 중단돼 결과를 확인하지 못했어요.'}[status];
}
