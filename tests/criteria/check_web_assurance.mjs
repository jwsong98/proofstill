import assert from 'node:assert/strict';
import { criteriaStatus, criteriaReason, judgment } from '../../console/shared/assurance.ts';
const row = {
  implementation: { status: 'implemented', paths: [], remaining: '', note: '' }, implementationCurrent: true,
  humanChecks: [{requirement:'R1',action:'직접 조회',expected:'기대값'}],
  verification: { status:'passed', review:{status:'passed',evidence:'실제 근거'}, criteriaReview:{status:'passed',evidence:'실제 기준 검토'},
    criteriaChecks:[{id:'negative',status:'passed'}] },
};
assert.equal(criteriaStatus(row), 'passed');
for (const status of ['partial', 'unverified', 'not_run', 'stale', 'failed', 'interrupted', 'unknown', undefined]) {
  const changed = structuredClone(row); changed.verification.criteriaChecks[0].status = status;
  assert.notEqual(criteriaStatus(changed), 'passed', `미완료/알 수 없는 부정 검사 상태가 승인됨: ${status}`);
  assert.ok(!judgment(changed).startsWith('등록한 범위의 기술 근거가 있어요.'));
}
const failed=structuredClone(row); failed.verification.criteriaChecks=[]; failed.verification.criteriaReview.status='failed';
assert.equal(criteriaStatus(failed),'failed','부정 검사 연결이 없어도 독립 검토의 실패 지적이 가려지면 안 됨');
assert.ok(criteriaReason(failed).includes('문제'));
const generalFinding=structuredClone(row); generalFinding.verification.criteriaReview.findings=['현재 일반 지적'];
assert.equal(criteriaStatus(generalFinding),'failed');
generalFinding.verification.criteriaReview.status='stale';assert.equal(criteriaStatus(generalFinding),'stale');
const absent=structuredClone(row); delete absent.verification.criteriaReview;
assert.notEqual(criteriaStatus(absent),'passed');
const unlinked=structuredClone(row); unlinked.verification.criteriaChecks=[];
assert.notEqual(criteriaStatus(unlinked),'passed');
const taskFailed=structuredClone(row); taskFailed.verification.review.gateStatus='failed';
assert.ok(!judgment(taskFailed).startsWith('등록한 범위의 기술 근거가 있어요.'));
console.log('WEB_ASSURANCE_BOUNDARY_OK: 부분·누락·알 수 없는 상태·실패 지적·작업 게이트를 승인으로 확대하지 않음');
