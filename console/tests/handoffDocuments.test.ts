import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { verified, writeHandoffDocuments } from '../server/handoffDocuments.ts';
import type { HandoffRow } from '../server/types.ts';

function row(id: string): HandoffRow {
  const check = { id: 'test', label: '저장 후 조회', kind: 'integration', command: 'node --test', status: 'passed' as const,
    output: '실제 출력 ```값```', exitCode: 0, files: ['tests/save.ts'], scope: '저장·조회', purpose: '값 보존 확인', expected: '같은 값' };
  return { id, source: 'harness', taskId: 'save', requirementId: id, title: `저장 ${id}`, group: '제품', origin: '실제 요청',
    implementation: { status: 'implemented', paths: ['src/save.ts'], remaining: '', note: '저장 구현' }, implementationCurrent: true,
    verification: { status: 'passed', checks: [check], review: { status: 'passed', gateStatus: 'passed', evidence: '독립 관측' },
      criteriaReview: { status: 'passed', evidence: '잘못된 값 거부' }, criteriaChecks: [check] }, limitations: ['등록된 저장 범위만 확인'] };
}
test('a passed command alone cannot promote stale, unreviewed, blocked or incomplete requirements', () => {
  assert.equal(verified(row('ok')), true);
  for (const change of [
    (r: HandoffRow) => { r.implementationCurrent = false; },
    (r: HandoffRow) => { r.implementation.status = 'partial'; },
    (r: HandoffRow) => { r.implementation.remaining = '실패 처리'; },
    (r: HandoffRow) => { r.verification.review.status = 'not_run'; },
    (r: HandoffRow) => { r.verification.review.gateStatus = 'failed'; },
    (r: HandoffRow) => { r.verification.criteriaChecks = []; },
    (r: HandoffRow) => { r.verification.checks = []; },
    (r: HandoffRow) => { r.pendingDecisions = [{ id: 'policy', question: '저장 정책?' }]; },
  ]) { const r = row('pending'); change(r); assert.equal(verified(r), false); }
});
test('one folder preserves every requirement, concrete evidence and collection errors without overwriting', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'proofstill-handoff-data-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const passed = row('ok'), stale = row('stale'), old = row('old'), unknown = row('unknown');
  stale.verification.status = 'stale'; stale.verification.checks[0].status = 'stale' as any;
  old.historical = true; old.verification.review.status = 'unverified';
  unknown.implementation.status = 'unknown'; unknown.implementationCurrent = null;
  const output = resolve(root, 'handoff');
  const result = await writeHandoffDocuments(root, output, { generatedAt: '2026-11-05T00:00:00Z', rows: [passed, stale, old, unknown],
    errors: [{ taskId: 'broken', message: '원본 조회 실패' }] }, '제품');
  assert.equal(result.rows, 4); assert.equal(result.implemented, 3); assert.equal(result.verified, 1); assert.equal(result.unverified, 3);
  assert.match(await readFile(resolve(output, 'verified.md'), 'utf8'), /저장 ok/);
  const pending = await readFile(resolve(output, 'unverified.md'), 'utf8');
  for (const text of ['저장 stale', '저장 old', '저장 unknown', '이전 작업', '재검증 필요']) assert.ok(pending.includes(text));
  const details = await readFile(resolve(output, 'details.md'), 'utf8');
  for (const text of ['실제 요청', 'src/save.ts', 'node --test', '실제 출력', '독립 관측', '등록된 저장 범위만 확인']) assert.ok(details.includes(text));
  assert.match(await readFile(resolve(output, 'README.md'), 'utf8'), /원본 조회 실패/);
  const saved = JSON.parse(await readFile(resolve(output, 'snapshot.json'), 'utf8'));
  assert.equal(saved.rows.length, 4); assert.ok(saved.errors.some((e: any) => e.taskId === 'broken'));
  await assert.rejects(writeHandoffDocuments(root, output, saved, '제품'), { code: 'EEXIST' });
});
