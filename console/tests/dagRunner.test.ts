import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Store } from '../server/store.ts';
import { DagRunner } from '../server/dagRunner.ts';
import type { DagWorker } from '../server/dagWorker.ts';
const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
async function fixture(worker: DagWorker) {
  const root = await mkdtemp(join(tmpdir(), 'dag-runner-test-'));
  git(root, 'init', '-q'); git(root, 'config', 'user.email', 'test@example.invalid'); git(root, 'config', 'user.name', 'DAG test');
  await writeFile(join(root, 'README.md'), 'test'); git(root, 'add', 'README.md'); git(root, 'commit', '-qm', 'initial');
  const store = new Store(), project = store.createProject({ name: 'test', rootPath: root }), runner = new DagRunner(store, worker);
  const task = (id: string, owns = id + '.txt', checks = [['node', '-e', `require('node:assert/strict').equal(require('node:fs').readFileSync('${id}.txt','utf8'),'${id}')`]]) => {
    store.createNode(project.id, { id, kind: 'task', title: id }); runner.data.define(project.id, id, { owns: [owns], checks });
  };
  return { root, store, project, runner, task, async close() { await runner.close(); store.close(); await rm(root, { recursive: true, force: true }); } };
}
test('runner executes disjoint tasks concurrently, gates successor, records real commit/checks and reuses completion', async () => {
  let active = 0, peak = 0, calls = 0;
  let release!: () => void; const bothStarted = new Promise<void>(resolve => { release = resolve; });
  const f = await fixture(async ({root, prompt}) => {
    const data = JSON.parse(prompt.slice(prompt.indexOf('{'))); calls++; active++; peak = Math.max(peak, active);
    if (['a', 'b'].includes(data.task.id)) { if (active === 2) release(); await bothStarted; }
    if (data.task.id === 'c') {
      assert.equal(active, 1); assert.equal(data.predecessors[0].status, 'completed'); assert.match(data.predecessors[0].commit, /^[a-f0-9]{40}$/);
    }
    assert.ok(data.folderStructure.entries.includes('README.md'));
    await writeFile(join(root, data.task.id + '.txt'), data.task.id); active--; return 'implemented ' + data.task.id;
  });
  try {
    f.task('a'); f.task('b'); f.task('c');
    f.store.createEdge(f.project.id, { sourceId: 'a', targetId: 'c', kind: 'precedes' });
    f.store.createEdge(f.project.id, { sourceId: 'b', targetId: 'c', kind: 'precedes' });
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    const run = f.runner.snapshot(f.project.id).run!;
    assert.equal(run.status, 'completed'); assert.equal(peak, 2);
    for (const task of run.tasks) {
      assert.match(task.commit!, /^[a-f0-9]{40}$/); assert.equal(task.checks[0].exitCode, 0);
      assert.equal(git(f.root, 'show', '--pretty=', '--name-only', task.commit!), task.nodeId + '.txt');
      assert.equal(f.store.getNode(f.project.id, task.nodeId).status, 'completed');
    }
    assert.equal(git(f.root, 'status', '--porcelain'), '');
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    assert.equal(calls, 3); assert.equal(f.runner.snapshot(f.project.id).run?.status, 'completed');
  } finally { await f.close(); }
});
test('check failure blocks successors, preserves changes, and prevents new run over dirty work', async () => {
  const f = await fixture(async ({root, prompt}) => {
    const data = JSON.parse(prompt.slice(prompt.indexOf('{'))); await writeFile(join(root, data.task.id + '.txt'), data.task.id); return 'done';
  });
  try {
    f.task('a', 'a.txt', [['node', '-e', 'process.exit(7)']]); f.task('b');
    f.store.createEdge(f.project.id, { sourceId: 'a', targetId: 'b', kind: 'precedes' });
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    const run = f.runner.snapshot(f.project.id).run!;
    assert.equal(run.tasks[0].status, 'failed'); assert.equal(run.tasks[0].commit, null); assert.equal(run.tasks[0].checks[0].exitCode, 7);
    assert.equal(run.tasks[1].status, 'blocked'); assert.equal(await readFile(join(f.root, 'a.txt'), 'utf8'), 'a');
    await assert.rejects(f.runner.start(f.project.id), /기존 변경/);
  } finally { await f.close(); }
});
test('overlapping ownership runs serially and commits are attributed to each task', async () => {
  let active = 0, peak = 0;
  const f = await fixture(async ({root, prompt}) => {
    const data = JSON.parse(prompt.slice(prompt.indexOf('{'))); active++; peak = Math.max(peak, active);
    await writeFile(join(root, 'shared.txt'), data.task.id); active--; return data.task.id;
  });
  try {
    f.task('a', 'shared.txt', [['node', '--version']]); f.task('b', 'shared.txt', [['node', '--version']]);
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    assert.equal(peak, 1); assert.equal(f.runner.snapshot(f.project.id).run?.status, 'completed');
    assert.equal(await readFile(join(f.root, 'shared.txt'), 'utf8'), 'b');
  } finally { await f.close(); }
});
test('stop interrupts active worker and does not mark queued work complete', async () => {
  let begun!: () => void; const started = new Promise<void>(resolve => { begun = resolve; });
  const f = await fixture(async ({signal}) => { begun(); await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })); throw new Error('stopped'); });
  try {
    f.task('a'); f.task('b'); await f.runner.start(f.project.id, 1); await started;
    await assert.rejects(f.runner.start(f.project.id), /이미 실행/);
    f.runner.stop(f.project.id); await f.runner.wait(f.project.id);
    assert.equal(f.runner.snapshot(f.project.id).run?.status, 'interrupted');
    assert.ok(f.runner.snapshot(f.project.id).run?.tasks.every(task => task.status === 'interrupted' && !task.commit));
  } finally { await f.close(); }
});
test('ownership outside the registered union cannot be committed', async () => {
  const f = await fixture(async ({root}) => { await writeFile(join(root, 'outside.txt'), 'outside'); return 'done'; });
  try {
    f.task('a', 'a.txt', [['node', '--version']]); await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    assert.equal(f.runner.snapshot(f.project.id).run?.tasks[0].status, 'failed');
    assert.match(f.runner.snapshot(f.project.id).run?.tasks[0].error ?? '', /소유권 밖/);
  } finally { await f.close(); }
});
test('reverse node order propagates failure through every queued successor', async () => {
  const f = await fixture(async () => { throw new Error('implementation failed'); });
  try {
    f.task('c'); f.task('b'); f.task('a');
    f.store.createEdge(f.project.id, {sourceId:'c',targetId:'b',kind:'precedes'});
    f.store.createEdge(f.project.id, {sourceId:'b',targetId:'a',kind:'precedes'});
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    assert.deepEqual(f.runner.snapshot(f.project.id).run?.tasks.map(task => task.status), ['blocked', 'blocked', 'failed']);
  } finally { await f.close(); }
});
test('restarting overlapping owners does not skip the final owner using an obsolete completion', async () => {
  const calls: string[] = [];
  const f = await fixture(async ({root,prompt}) => {
    const data = JSON.parse(prompt.slice(prompt.indexOf('{'))); calls.push(data.task.id);
    await writeFile(join(root, 'shared.txt'), data.task.id); return data.task.id;
  });
  try {
    f.task('a','shared.txt',[['node','--version']]); f.task('b','shared.txt',[['node','--version']]);
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    await f.runner.start(f.project.id); await f.runner.wait(f.project.id);
    assert.deepEqual(calls, ['a','b','a','b']);
    assert.equal(await readFile(join(f.root,'shared.txt'),'utf8'), 'b');
    assert.equal(f.runner.snapshot(f.project.id).run?.status, 'completed');
  } finally { await f.close(); }
});
