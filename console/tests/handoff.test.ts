import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, utimes, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Store } from '../server/store.ts';
import { HandoffService } from '../server/handoff.ts';
import { exportHandoff } from '../server/handoffExport.ts';
const execute = promisify(execFile);
async function fixture(t: any) {
  const root = await mkdtemp(resolve(tmpdir(), 'proofstill-handoff-')), store = new Store();
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  await writeFile(resolve(root, 'code.ts'), 'export const x = 1;');
  const project = store.createProject({ name: '인계', rootPath: root });
  const node = store.createNode(project.id, { kind: 'requirement', title: '중복 차단', body: '동일 입력은 하나만 저장' });
  return { root, store, project, node, service: new HandoffService(store) };
}
test('native requirements distinguish implementation, check outcome, stale source and independent review', async t => {
  const { root, store, project, node, service } = await fixture(t), id = project.id;
  const input = { source: 'console', taskId: node.id, requirementId: node.id, implementation: { status: 'implemented' as const, paths: ['code.ts'], remaining: '', note: '중복 차단 구현' } };
  await service.save(id, input);
  let row = (await service.snapshot(id)).rows[0];
  assert.equal(row.implementation.status, 'implemented'); assert.equal(row.verification.status, 'not_run');
  store.defineFeatureChecks(id, node.id, [{ id: 'dedup', kind: 'test', command: 'npm test', label: '동일 ID 두 번 입력' }, { id: 'invalid', kind: 'test', command: 'npm run invalid', label: '잘못된 ID' }]);
  const time = Date.now() + 1000;
  const record = (command: string, status: 'passed' | 'failed', startedAt = time) => {
    const result = store.recordExecution(id, { title: command, command, kind: 'test', status, output: status === 'passed' ? '1 passed' : 'duplicate saved', exitCode: status === 'passed' ? 0 : 1, startedAt, finishedAt: startedAt + 1 });
    store.observeFeatureCheckResult(id, node.id, result.executionId!);
  };
  record('npm test', 'passed'); row = (await service.snapshot(id)).rows[0]; assert.equal(row.verification.status, 'partial');
  record('npm run invalid', 'failed'); assert.equal((await service.snapshot(id)).rows[0].verification.status, 'failed');
  record('npm run invalid', 'passed', time + 10); row = (await service.snapshot(id)).rows[0]; assert.equal(row.verification.status, 'passed'); assert.equal(row.verification.review.status, 'not_run');
  await utimes(resolve(root, 'code.ts'), (time + 100)/1000, (time + 100)/1000);
  assert.equal((await service.snapshot(id)).rows[0].verification.status, 'stale');
  await rm(resolve(root, 'code.ts')); assert.equal((await service.snapshot(id)).rows[0].verification.status, 'stale');
});
test('unknown legacy state, scoped writes, invalid declarations, source escape and portable export', async t => {
  const { root, store, project, node, service } = await fixture(t);
  assert.equal((await service.snapshot(project.id)).rows[0].implementation.status, 'unknown');
  const input = { source: 'console', taskId: node.id, requirementId: node.id, implementation: { status: 'implemented' as const, paths: [] as string[], remaining: '', note: '' } };
  await assert.rejects(service.save(project.id, input), /코드 경로/);
  input.implementation.status = 'partial' as any; await assert.rejects(service.save(project.id, input), /남은 범위/);
  input.implementation.status = 'implemented'; input.implementation.paths = ['../outside']; await assert.rejects(service.save(project.id, input));
  const second = store.createProject({ name: '다른 프로젝트', rootPath: root + '-second' });
  input.implementation.paths = []; input.implementation.status = 'not_started' as any;
  await assert.rejects(service.save(second.id, input), /not found/);
  await writeFile(resolve(root, '.env'), 'secret'); await symlink(resolve(root, '.env'), resolve(root, 'alias'));
  await assert.rejects(service.code(project.id, 'alias'), /secret/);
  input.implementation.status = 'implemented'; input.implementation.paths = ['code.ts']; input.implementation.note = '<script>alert(1)</script>';
  await service.save(project.id, input);
  const snapshot = await service.snapshot(project.id), code = await service.code(project.id, 'code.ts');
  const html = exportHandoff('처음 보는 사람', snapshot, { 'code.ts': code.content });
  assert.ok(html.includes('export const x = 1')); assert.ok(html.includes('동일 입력은 하나만 저장')); assert.ok(html.includes('미실행'));
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes(root));
});
test('live harness snapshot and implementation edits are shared with CLI and report', async t => {
  const { root, project, service } = await fixture(t);
  const runtime = resolve(import.meta.dirname, '../..');
  const plan = { id: 'shared', title: '공유 요구', intent: '앱과 CLI 동일 상태', context: '합성 fixture', sources: ['code.ts'], requirements: [{ id: 'R1', text: '같은 상태', checks: ['one'] }], checks: [{ id: 'one', kind: 'unit', module: 'fixture', argv: ['python3', '-c', 'print("REAL_CHECK")'], files: ['code.ts'], green_pattern: 'REAL_CHECK' }] };
  await writeFile(resolve(root, 'feature.json'), JSON.stringify(plan));
  const cli = (args: string[]) => execute('python3', ['-m', 'proofstill', '--root', root, ...args], { cwd: runtime });
  await cli(['init', resolve(root, 'feature.json')]);
  await service.save(project.id, { source: 'harness', taskId: 'shared', requirementId: 'R1', implementation: { status: 'partial', paths: ['code.ts'], remaining: '오류 처리', note: '' } });
  const cliRows = JSON.parse((await cli(['handoff'])).stdout).rows;
  const appRows = (await service.snapshot(project.id)).rows.filter(r => r.source === 'harness');
  assert.deepEqual(appRows, cliRows); assert.equal(appRows[0].verification.status, 'not_run');
  const linked = await service.link(project.id, 'shared', 'R1');
  assert.equal((await service.link(project.id, 'shared', 'R1')).id, linked.id);
  const linkedRows = (await service.snapshot(project.id)).rows;
  assert.equal(linkedRows.filter(r => r.requirementId === 'R1').length, 1);
  assert.ok(!linkedRows.some(r => r.source === 'console' && r.nodeId === linked.id));
  assert.equal(linkedRows.find(r => r.requirementId === 'R1')!.nodeId, linked.id);
  await cli(['test', 'shared']);
  assert.equal((await service.snapshot(project.id)).rows.find(r => r.source === 'harness')!.verification.status, 'passed');
  const { readFile: readEvidence } = await import('node:fs/promises');
  const state = JSON.parse(await readEvidence(resolve(root, '.proofstill/evidence/shared/state.json'), 'utf8'));
  await writeFile(state.runs.at(-1).log, 'X'.repeat(100001));
  const longSnapshot = await service.snapshot(project.id);
  const longRow = longSnapshot.rows.find(r => r.source === 'harness')!;
  assert.equal(longRow.verification.checks[0].outputTruncated, true);
  const longHtml = exportHandoff('긴 출력', longSnapshot, {});
  assert.ok(longHtml.includes('이 검사 출력은 생략됐어요'));
  await writeFile(resolve(root, 'code.ts'), 'changed');
  assert.equal((await service.snapshot(project.id)).rows.find(r => r.source === 'harness')!.verification.status, 'stale');
  await cli(['report', 'shared']);
  const { readFile } = await import('node:fs/promises');
  assert.ok((await readFile(resolve(root, 'reports/shared.md'), 'utf8')).includes('일부 구현 | 재검증 필요'));
});

test('SQLite migration and implementation records survive restart without inventing legacy progress', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'proofstill-restart-')); t.after(() => rm(root, { recursive: true, force: true }));
  const db = resolve(root, 'state.sqlite'); let store = new Store(db);
  const project = store.createProject({ name: '재개', rootPath: root });
  const node = store.createNode(project.id, { kind: 'requirement', title: '저장' });
  store.saveImplementationProgress(project.id, node.id, { status: 'partial', paths: [], remaining: '재조회', note: '' });
  store.close(); store = new Store(db); t.after(() => store.close());
  assert.equal(store.implementationProgress(project.id, node.id).remaining, '재조회');
  assert.equal(store.featureAcceptance(project.id, node.id).total, 0);
});

test('registered test-file changes and interrupted executions cannot remain passed', async t => {
  const { root, store, project, node, service } = await fixture(t);
  await writeFile(resolve(root, 'check.ts'), 'assert.equal(x,1)');
  store.defineFeatureChecks(project.id, node.id, [{ id: 'one', label: '실제 검사 파일', kind: 'test', command: 'node check.ts', files: ['check.ts'] }]);
  const startedAt = Date.now() + 1000;
  const passed = store.recordExecution(project.id, { title: '통과', kind: 'test', command: 'node check.ts', status: 'passed', exitCode: 0, output: 'OK', startedAt });
  store.observeFeatureCheckResult(project.id, node.id, passed.executionId!);
  assert.equal((await service.snapshot(project.id)).rows[0].verification.status, 'passed');
  await utimes(resolve(root, 'check.ts'), (startedAt + 100) / 1000, (startedAt + 100) / 1000);
  assert.equal((await service.snapshot(project.id)).rows[0].verification.status, 'stale');
  const interrupted = store.recordExecution(project.id, { title: '중단', kind: 'test', command: 'node check.ts', status: 'interrupted', output: 'stopped', startedAt: startedAt + 200 });
  store.observeFeatureCheckResult(project.id, node.id, interrupted.executionId!);
  assert.equal((await service.snapshot(project.id)).rows[0].verification.status, 'interrupted');
});

test('check explanations survive API projection and HTML export without claiming unexecuted success',async t=>{
 const {store,project,node,service}=await fixture(t);
 store.defineFeatureChecks(project.id,node.id,[{id:'database',kind:'test',label:'저장·복구 확인',purpose:'저장한 입력을 다시 조회해요.',rationale:'재시작 때 데이터가 사라지는 문제를 찾기 위해 필요해요.',expected:'다시 연 DB에서도 원래 값이 남아 있어야 해요.',command:'npm test',files:['code.ts']}]);
 const snapshot=await service.snapshot(project.id),check=snapshot.rows[0].verification.checks[0];
 assert.equal(check.purpose,'저장한 입력을 다시 조회해요.');assert.ok(check.rationale?.includes('재시작'));assert.equal(check.status,'not_run');assert.equal(check.exitCode,null);
 const html=exportHandoff('test',snapshot,{});
 assert.ok(html.includes('확인할 내용'));assert.ok(html.includes('필요한 이유'));assert.ok(html.includes('통과 조건'));assert.ok(html.includes('저장·복구 확인'));assert.ok(html.includes('실행 근거 보기'));
 const {checkTitle,statusReason}=await import('../shared/verification.ts');
 assert.equal(checkTitle({id:'database',label:'database'}),'설명이 등록되지 않은 검사');assert.ok(statusReason('stale').includes('다시 확인'));assert.ok(statusReason('not_run').includes('실행 기록이 없어'));
});
