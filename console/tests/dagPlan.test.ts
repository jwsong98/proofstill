import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDefinition, ownershipOverlaps, planTasks, readyTasks } from '../server/dagPlan.ts';
import { DagStore } from '../server/dagStore.ts';
import { Store } from '../server/store.ts';
const def = (path: string) => ({ owns: [path], checks: [['node', '--version']] });
function fixture() {
  const store = new Store(), project = store.createProject({ name: 'dag', rootPath: '/tmp/dag' });
  for (const id of ['a', 'b', 'c']) store.createNode(project.id, { id, title: id, kind: 'task' });
  return { store, project, dag: new DagStore(store) };
}
test('path ownership rejects escape/globs and catches parent folder overlap', () => {
  for (const path of ['../a', '/a', '.', 'src/../a', 'src/*', '.git/config', 'src//a']) assert.throws(() => normalizeDefinition(def(path)));
  assert.equal(ownershipOverlaps(['src'], ['src/a.ts']), true);
  assert.equal(ownershipOverlaps(['src/a'], ['src/ab']), false);
});
test('DAG follows precedes through context nodes, parallelizes disjoint owners, rejects cycles', () => {
  const { store, project } = fixture();
  try {
    store.createNode(project.id, { id: 'context', title: 'context', kind: 'requirement' });
    store.createEdge(project.id, { sourceId: 'a', targetId: 'context', kind: 'precedes' });
    store.createEdge(project.id, { sourceId: 'context', targetId: 'c', kind: 'precedes' });
    const definitions = { a: def('src/a'), b: def('src/b'), c: def('src/c') };
    const tasks = planTasks(store.listGraph(project.id), definitions);
    assert.deepEqual(readyTasks(tasks, 2).map(task => task.nodeId), ['a', 'b']);
    tasks[0].status = 'completed'; tasks[1].status = 'running';
    assert.deepEqual(readyTasks(tasks, 2).map(task => task.nodeId), ['c']);
    tasks[2].definition.owns = ['src']; assert.deepEqual(readyTasks(tasks, 2), []);
    const cyclic = store.listGraph(project.id);
    cyclic.edges.push({ id: 'cycle', projectId: project.id, sourceId: 'c', targetId: 'a', kind: 'precedes', reason: '', createdAt: 0 });
    assert.throws(() => planTasks(cyclic, definitions), /순환/);
  } finally { store.close(); }
});
test('SQLite stores definition and interrupted run without inventing completion', () => {
  const { store, project, dag } = fixture();
  try {
    dag.define(project.id, 'a', def('src/a'));
    assert.deepEqual(dag.definitions(project.id).a, def('src/a'));
    const graph = store.listGraph(project.id), tasks = planTasks(graph, { a: def('a'), b: def('b'), c: def('c') });
    tasks[0].status = 'running';
    dag.save({ id: 'run', projectId: project.id, graph, tasks, status: 'running', startedAt: 1, finishedAt: null });
    dag.interruptAbandoned();
    assert.equal(dag.latest(project.id)?.status, 'interrupted');
    assert.equal(dag.latest(project.id)?.tasks[0].commit, null);
    assert.equal(dag.latest(project.id)?.tasks[1].status, 'interrupted');
    assert.equal(store.getNode(project.id, 'a').status, 'unverified');
    store.updateNode(project.id, 'a', { status: 'completed' });
    dag.define(project.id, 'a', def('new/path'));
    assert.equal(store.getNode(project.id, 'a').status, 'pending');
  } finally { store.close(); }
});
