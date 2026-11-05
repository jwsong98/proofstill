import type { Store } from './store.ts';
import { normalizeDefinition, type DagRun, type TaskDefinition } from './dagPlan.ts';

export class DagStore {
  readonly store: Store;
  constructor(store: Store) { this.store = store; }
  definitions(projectId: string): Record<string, TaskDefinition> {
    this.store.getProject(projectId);
    return Object.fromEntries(this.store.db.prepare('SELECT node_id,definition_json FROM task_definitions WHERE project_id=?').all(projectId)
      .map(row => [row.node_id, JSON.parse(String(row.definition_json))]));
  }
  define(projectId: string, nodeId: string, input: unknown) {
    if (this.store.getNode(projectId, nodeId).kind !== 'task') throw new Error('작업 노드만 실행을 설정할 수 있습니다.');
    const definition = normalizeDefinition(input);
    const previous = this.definitions(projectId)[nodeId];
    this.store.db.prepare('INSERT INTO task_definitions(node_id,project_id,definition_json) VALUES(?,?,?) ON CONFLICT(node_id) DO UPDATE SET definition_json=excluded.definition_json')
      .run(nodeId, projectId, JSON.stringify(definition));
    if (JSON.stringify(previous) !== JSON.stringify(definition)) this.store.updateNode(projectId, nodeId, { status: 'pending' });
    return definition;
  }
  save(run: DagRun) {
    this.store.db.prepare('INSERT INTO dag_runs(id,project_id,data_json,started_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json')
      .run(run.id, run.projectId, JSON.stringify(run), run.startedAt);
  }
  latest(projectId: string): DagRun | null {
    this.store.getProject(projectId);
    const row = this.store.db.prepare('SELECT data_json FROM dag_runs WHERE project_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1').get(projectId);
    return row ? JSON.parse(String(row.data_json)) : null;
  }
  interruptAbandoned() {
    for (const row of this.store.db.prepare('SELECT data_json FROM dag_runs').all()) {
      const run: DagRun = JSON.parse(String(row.data_json));
      if (run.status !== 'running') continue;
      run.status = 'interrupted'; run.finishedAt = Date.now();
      for (const task of run.tasks) if (['running', 'pending'].includes(task.status)) {
        task.status = 'interrupted'; task.error = '서버가 종료되어 실행 완료를 확인하지 못했습니다. 자동 재실행하지 않습니다.'; task.finishedAt = run.finishedAt;
        try { this.store.updateNode(run.projectId, task.nodeId, { status: 'unverified' }); } catch { /* A deleted node does not erase execution history. */ }
      }
      this.save(run);
    }
  }
}
