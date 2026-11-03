import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Evidence, EvidenceInput, Execution, ExecutionInput, FeatureAcceptance, FeatureCheck, FeatureCheckInput, Graph, GraphContext, GraphEdge, GraphNode,
  ImplementationProgress, Message, MessageInput, NodeInput, NodePatch, Page, Project, Session, SessionEvent, SessionInput, Usage, UsageInput,
} from './types.ts';

type Row = Record<string, any>;
const nodeKinds = new Set(['feature', 'requirement', 'issue', 'decision', 'task', 'evidence', 'result']);
const statuses = new Set(['pending', 'active', 'completed', 'failed', 'unverified']);
const uid = () => randomUUID();
const json = (value: unknown) => JSON.stringify(value ?? null);
const decode = (value: string) => JSON.parse(value);
function text(value: unknown, name: string, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new StoreError(`${name} must be a string${allowEmpty ? '' : ' with content'}`);
}
function timestamp(value: unknown, name: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new StoreError(`${name} must be a non-negative epoch millisecond timestamp`);
}
export class StoreError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'StoreError'; this.status = status; }
}

export class Store {
  readonly db: DatabaseSync;
  private transactionDepth = 0;
  constructor(filename: string = ':memory:') {
    if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA recursive_triggers=ON; PRAGMA busy_timeout=5000;');
    if (filename !== ':memory:') this.db.exec('PRAGMA journal_mode=WAL;');
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY) STRICT');
    const migrationDir = fileURLToPath(new URL('./migrations/', import.meta.url));
    for (const name of readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort()) {
      if (!this.db.prepare('SELECT 1 FROM schema_migrations WHERE name=?').get(name)) {
        this.transaction(() => {
          this.db.exec(readFileSync(resolve(migrationDir, name), 'utf8'));
          this.db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
        });
      }
    }
  }
  close() { this.db.close(); }
  transaction<T>(action: () => T): T {
    const depth = this.transactionDepth++, savepoint = `store_${depth}`;
    try {
      this.db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
      try {
        const value = action();
        this.db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
        return value;
      } catch (error) {
        this.db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        if (error instanceof StoreError) throw error;
        if (error instanceof Error && error.message.includes('constraint')) throw new StoreError(error.message, 409);
        throw error;
      }
    } finally { this.transactionDepth--; }
  }
  private required<T>(value: T | undefined, name: string): T {
    if (!value) throw new StoreError(`${name} not found`, 404);
    return value;
  }
  private rowProject(row: Row): Project { return { id: row.id, name: row.name, rootPath: row.root_path, createdAt: row.created_at }; }
  createProject(input: { id?: string; name: string; rootPath: string }): Project {
    text(input.name, 'name'); text(input.rootPath, 'rootPath');
    const project = { id: input.id ?? uid(), name: input.name.trim(), rootPath: resolve(input.rootPath), createdAt: Date.now() };
    text(project.id, 'id');
    const existing = this.db.prepare('SELECT * FROM projects WHERE root_path=?').get(project.rootPath) as Row | undefined;
    if (existing) return this.rowProject(existing);
    this.db.prepare('INSERT INTO projects(id,name,root_path,created_at) VALUES(?,?,?,?)').run(project.id, project.name, project.rootPath, project.createdAt);
    return project;
  }
  listProjects(): Project[] { return (this.db.prepare('SELECT * FROM projects ORDER BY created_at,id').all() as Row[]).map(row => this.rowProject(row)); }
  getProject(id: string): Project { return this.rowProject(this.required(this.db.prepare('SELECT * FROM projects WHERE id=?').get(id) as Row | undefined, 'Project')); }
  private rowEvidence(row: Row): Evidence {
    return { id: row.id, projectId: row.project_id, sourceKind: row.source_kind, source: decode(row.source_json), content: row.content, capturedAt: row.captured_at };
  }
  getEvidence(projectId: string, id: string): Evidence {
    return this.rowEvidence(this.required(this.db.prepare('SELECT * FROM evidence WHERE project_id=? AND id=?').get(projectId, id) as Row | undefined, 'Evidence'));
  }
  private rowExecution(row: Row): Execution {
    return { id: row.id, projectId: row.project_id, kind: row.kind, status: row.status, command: row.command,
      request: decode(row.request_json), response: decode(row.response_json), output: row.output,
      exitCode: row.exit_code, startedAt: row.started_at, finishedAt: row.finished_at };
  }
  getExecution(projectId: string, id: string): Execution {
    return this.rowExecution(this.required(this.db.prepare('SELECT * FROM executions WHERE project_id=? AND id=?').get(projectId, id) as Row | undefined, 'Execution'));
  }
  private rowNode(row: Row): GraphNode {
    const node: GraphNode = { id: row.id, projectId: row.project_id, kind: row.kind, title: row.title, body: row.body,
      status: row.status, x: row.x, y: row.y, evidenceId: row.evidence_id, executionId: row.execution_id,
      createdAt: row.created_at, updatedAt: row.updated_at };
    if (node.evidenceId) node.evidence = this.getEvidence(node.projectId, node.evidenceId);
    if (node.executionId) node.execution = this.getExecution(node.projectId, node.executionId);
    const merged = this.db.prepare('SELECT n.id,n.kind,n.title,n.body FROM nodes n JOIN node_merges m ON m.node_id=n.id WHERE m.project_id=? AND m.target_id=? ORDER BY n.id').all(node.projectId,node.id) as Row[];
    if (merged.length) node.mergedRecords = merged.map(r => ({ id:r.id, kind:r.kind, title:r.title, body:r.body }));
    if (node.kind === 'feature') node.acceptance = this.featureAcceptance(node.projectId, node.id);
    return node;
  }
  getNode(projectId: string, id: string): GraphNode {
    return this.rowNode(this.required(this.db.prepare('SELECT * FROM nodes WHERE project_id=? AND id=?').get(projectId, id) as Row | undefined, 'Node'));
  }
  private insertNode(projectId: string, input: NodeInput, evidenceId: string | null = null, executionId: string | null = null): GraphNode {
    text(input.title, 'title');
    if (!nodeKinds.has(input.kind)) throw new StoreError('Invalid node kind');
    const status = input.status ?? 'pending';
    if (!statuses.has(status)) throw new StoreError('Invalid node status');
    for (const [key, value] of [['x', input.x], ['y', input.y]]) {
      if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) throw new StoreError(`${key} must be finite`);
    }
    text(input.body ?? '', 'body', true);
    const id = input.id ?? uid(); text(id, 'id'); const now = Date.now();
    this.db.prepare(`INSERT INTO nodes(id,project_id,kind,title,body,status,x,y,evidence_id,execution_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, projectId, input.kind, input.title.trim(), input.body ?? '', status,
      input.x ?? null, input.y ?? null, evidenceId, executionId, now, now);
    return this.getNode(projectId, id);
  }
  createNode(projectId: string, input: NodeInput): GraphNode {
    this.getProject(projectId);
    if (input.kind === 'evidence' || input.kind === 'result') throw new StoreError('Capture immutable evidence or record an execution instead');
    return this.insertNode(projectId, input);
  }
  updateNode(projectId: string, id: string, patch: NodePatch): GraphNode {
    const node = this.getNode(projectId, id);
    if (node.kind === 'evidence' || node.kind === 'result') throw new StoreError('Evidence nodes are immutable', 409);
    const allowed = ['title', 'body', 'status', 'x', 'y'];
    if (Object.keys(patch).some(key => !allowed.includes(key))) throw new StoreError('Unknown node patch field');
    const next = { ...node, ...patch };
    text(next.title, 'title'); text(next.body, 'body', true);
    if (!statuses.has(next.status)) throw new StoreError('Invalid node status');
    for (const key of ['x', 'y'] as const) if (next[key] !== null && (typeof next[key] !== 'number' || !Number.isFinite(next[key]))) throw new StoreError(`${key} must be finite or null`);
    if (next.title !== node.title || next.body !== node.body) this.db.prepare('UPDATE nodes SET definition_updated_at=? WHERE project_id=? AND id=?').run(Date.now(), projectId, id);
    this.db.prepare('UPDATE nodes SET title=?,body=?,status=?,x=?,y=?,updated_at=? WHERE project_id=? AND id=?')
      .run(next.title.trim(), next.body, next.status, next.x, next.y, Date.now(), projectId, id);
    return this.getNode(projectId, id);
  }
  deleteNode(projectId: string, id: string): void {
    const node = this.getNode(projectId, id);
    if (node.kind === 'evidence' || node.kind === 'result') throw new StoreError('Evidence nodes are immutable', 409);
    this.transaction(() => {
      this.db.prepare('DELETE FROM edges WHERE project_id=? AND (source_id=? OR target_id=?)').run(projectId, id, id);
      this.db.prepare('DELETE FROM session_context WHERE project_id=? AND node_id=?').run(projectId, id);
      this.db.prepare('DELETE FROM nodes WHERE project_id=? AND id=?').run(projectId, id);
    });
  }
  captureEvidence(projectId: string, input: EvidenceInput): GraphNode {
    this.getProject(projectId); text(input.title, 'title'); text(input.content, 'content', true);
    if (!['file', 'message', 'execution'].includes(input.sourceKind)) throw new StoreError('Invalid evidence source kind');
    if (!input.source || typeof input.source !== 'object' || Array.isArray(input.source)) throw new StoreError('Evidence source must be an object');
    const source = input.source;
    if (input.sourceKind === 'file') {
      text(source.path, 'source.path');
      if (!Number.isSafeInteger(source.startLine) || !Number.isSafeInteger(source.endLine) || (source.startLine as number) < 1 || (source.endLine as number) < (source.startLine as number)) throw new StoreError('Evidence line range is invalid');
    }
    if (input.sourceKind === 'message') { text(source.threadId, 'source.threadId'); text(source.messageId, 'source.messageId'); }
    const capturedAt = input.capturedAt ?? Date.now(); timestamp(capturedAt, 'capturedAt');
    return this.transaction(() => {
      const evidenceId = uid();
      this.db.prepare('INSERT INTO evidence(id,project_id,source_kind,source_json,content,captured_at) VALUES(?,?,?,?,?,?)')
        .run(evidenceId, projectId, input.sourceKind, json(source), input.content, capturedAt);
      return this.insertNode(projectId, { id: input.id, kind: 'evidence', title: input.title, status: 'unverified' }, evidenceId);
    });
  }
  recordExecution(projectId: string, input: ExecutionInput): GraphNode {
    this.getProject(projectId); text(input.title, 'title'); text(input.output, 'output', true);
    if (!['test', 'command', 'api'].includes(input.kind) || !['passed', 'failed', 'interrupted', 'unverified'].includes(input.status)) throw new StoreError('Invalid execution kind/status');
    if (input.command != null) text(input.command, 'command', true);
    if (input.exitCode != null && !Number.isSafeInteger(input.exitCode)) throw new StoreError('Invalid exitCode');
    const startedAt = input.startedAt ?? Date.now(), finishedAt = input.finishedAt ?? null;
    timestamp(startedAt, 'startedAt');
    if (finishedAt !== null) { timestamp(finishedAt, 'finishedAt'); if (finishedAt < startedAt) throw new StoreError('Execution ends before it starts'); }
    return this.transaction(() => {
      const id = uid();
      this.db.prepare(`INSERT INTO executions(id,project_id,kind,status,command,request_json,response_json,output,exit_code,started_at,finished_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id, projectId, input.kind, input.status, input.command ?? null,
        json(input.request), json(input.response), input.output, input.exitCode ?? null, startedAt, finishedAt);
      const status = input.status === 'passed' ? 'completed' : input.status === 'failed' ? 'failed' : 'unverified';
      return this.insertNode(projectId, { id: input.id, kind: 'result', title: input.title, status }, null, id);
    });
  }
  private requireFeature(projectId: string, featureId: string): void {
    const row = this.required(this.db.prepare('SELECT kind FROM nodes WHERE project_id=? AND id=?').get(projectId, featureId) as Row | undefined, 'Feature');
    if (!['feature', 'requirement'].includes(row.kind)) throw new StoreError('Checks require a feature or requirement');
  }
  featureAcceptance(projectId: string, featureId: string): FeatureAcceptance {
    this.requireFeature(projectId, featureId);
    const checks = (this.db.prepare('SELECT * FROM feature_checks WHERE project_id=? AND feature_id=? ORDER BY rowid').all(projectId, featureId) as Row[]).map(row => {
      const check: FeatureCheck = { id: row.id, projectId: row.project_id, featureId: row.feature_id,
        label: row.label, kind: row.kind, command: row.command, files: decode(row.files_json), purpose: row.purpose, rationale: row.rationale, expected: row.expected, executionId: row.execution_id };
      if (check.executionId) check.execution = this.getExecution(projectId, check.executionId);
      return check;
    });
    const passed = checks.filter(check => check.execution?.status === 'passed').length;
    return { checks, total: checks.length, passed, fulfilled: checks.length > 0 && passed === checks.length };
  }
  defineFeatureChecks(projectId: string, featureId: string, checks: FeatureCheckInput[]): FeatureAcceptance {
    this.requireFeature(projectId, featureId);
    if (!Array.isArray(checks) || !checks.length) throw new StoreError('Define at least one scenario or test');
    const ids = new Set<string>();
    for (const check of checks) {
      if (!check || typeof check !== 'object') throw new StoreError('Invalid feature check');
      text(check.id, 'check.id'); text(check.label, 'check.label'); text(check.command, 'check.command');
      for (const field of ['purpose','rationale','expected'] as const) if (check[field] !== undefined) text(check[field], `check.${field}`, true);
      if (check.files !== undefined && (!Array.isArray(check.files) || check.files.some(file => typeof file !== 'string' || !file.trim()))) throw new StoreError('check.files must be a string array');
      if (!['scenario', 'test'].includes(check.kind)) throw new StoreError('Check kind must be scenario or test');
      if (ids.has(check.id)) throw new StoreError('Duplicate feature check ID'); ids.add(check.id);
    }
    return this.transaction(() => {
      this.db.prepare('DELETE FROM feature_checks WHERE project_id=? AND feature_id=?').run(projectId, featureId);
      for (const check of checks) this.db.prepare('INSERT INTO feature_checks(project_id,feature_id,id,label,kind,command,files_json,purpose,rationale,expected) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(projectId, featureId, check.id, check.label, check.kind, check.command, json(check.files ?? []),check.purpose ?? '',check.rationale ?? '',check.expected ?? '');
      this.db.prepare("UPDATE nodes SET status='pending',updated_at=? WHERE project_id=? AND id=?").run(Date.now(), projectId, featureId);
      return this.featureAcceptance(projectId, featureId);
    });
  }
  observeFeatureCheckResult(projectId: string, featureId: string, executionId: string): FeatureAcceptance {
    this.requireFeature(projectId, featureId);
    const execution = this.getExecution(projectId, executionId);
    if (!['test', 'command'].includes(execution.kind)) throw new StoreError('Acceptance requires an observed test or command execution');
    if (execution.command === null) return this.featureAcceptance(projectId, featureId);
    const matching = this.db.prepare('SELECT * FROM feature_checks WHERE project_id=? AND feature_id=? AND command=?').all(projectId, featureId, execution.command) as Row[];
    if (!matching.length) return this.featureAcceptance(projectId, featureId);
    return this.transaction(() => {
      for (const check of matching) {
        if (check.execution_id) {
          const previous = this.getExecution(projectId, check.execution_id);
          const previousTime = previous.finishedAt ?? previous.startedAt, incomingTime = execution.finishedAt ?? execution.startedAt;
          if (incomingTime < previousTime) continue;
          if (incomingTime === previousTime) {
            const previousRow = this.db.prepare('SELECT rowid FROM executions WHERE id=?').get(previous.id) as Row;
            const incomingRow = this.db.prepare('SELECT rowid FROM executions WHERE id=?').get(execution.id) as Row;
            if (incomingRow.rowid < previousRow.rowid) continue;
          }
        }
        this.db.prepare('UPDATE feature_checks SET execution_id=? WHERE project_id=? AND feature_id=? AND id=?').run(executionId, projectId, featureId, check.id);
      }
      const acceptance = this.featureAcceptance(projectId, featureId);
      const status = acceptance.fulfilled ? 'completed' : 'pending';
      this.db.prepare('UPDATE nodes SET status=?,updated_at=? WHERE project_id=? AND id=? AND status!=?').run(status, Date.now(), projectId, featureId, status);
      return acceptance;
    });
  }
  harnessLinks(projectId: string): { nodeId: string; taskId: string; requirementId: string }[] {
    this.getProject(projectId);
    return (this.db.prepare('SELECT * FROM harness_requirement_links WHERE project_id=?').all(projectId) as Row[]).map(r => ({ nodeId: r.node_id, taskId: r.task_id, requirementId: r.requirement_id }));
  }
  linkHarnessRequirement(projectId: string, taskId: string, requirementId: string, title: string): GraphNode {
    const existing = this.harnessLinks(projectId).find(l => l.taskId === taskId && l.requirementId === requirementId);
    if (existing) return this.getNode(projectId, existing.nodeId);
    return this.transaction(() => {
      const node = this.createNode(projectId, { kind: 'requirement', title, body: `하네스 원본: ${taskId} / ${requirementId}. 구현·검증 상태는 현황에서 확인합니다.` });
      this.db.prepare('INSERT INTO harness_requirement_links(project_id,node_id,task_id,requirement_id) VALUES(?,?,?,?)').run(projectId, node.id, taskId, requirementId);
      return node;
    });
  }
  definitionUpdatedAt(projectId: string, nodeId: string): number {
    this.getNode(projectId, nodeId);
    return (this.db.prepare('SELECT definition_updated_at FROM nodes WHERE project_id=? AND id=?').get(projectId, nodeId) as Row).definition_updated_at;
  }
  implementationProgress(projectId: string, nodeId: string): ImplementationProgress {
    this.getNode(projectId, nodeId);
    const row = this.db.prepare('SELECT * FROM implementation_progress WHERE project_id=? AND node_id=?').get(projectId, nodeId) as Row | undefined;
    return row ? { status: row.status, paths: decode(row.paths_json), remaining: row.remaining, note: row.note, updatedAt: row.updated_at }
      : { status: 'unknown', paths: [], remaining: '', note: '' };
  }
  saveImplementationProgress(projectId: string, nodeId: string, input: ImplementationProgress): ImplementationProgress {
    const node = this.getNode(projectId, nodeId);
    if (!['feature', 'requirement'].includes(node.kind)) throw new StoreError('Implementation progress requires a feature or requirement');
    if (Object.keys(input).some(key => !['status', 'paths', 'remaining', 'note'].includes(key))) throw new StoreError('Only implementation fields can be supplied');
    if (!['unknown', 'not_started', 'in_progress', 'partial', 'implemented'].includes(input.status)) throw new StoreError('Invalid implementation status');
    if (!Array.isArray(input.paths) || input.paths.some(path => typeof path !== 'string' || !path.trim())) throw new StoreError('paths must be a string array');
    text(input.remaining, 'remaining', true); text(input.note, 'note', true);
    if (input.status === 'implemented' && !input.paths.length) throw new StoreError('Implementation requires code paths');
    if (input.status === 'partial' && !input.remaining.trim()) throw new StoreError('Partial implementation requires remaining scope');
    this.db.prepare(`INSERT INTO implementation_progress(project_id,node_id,status,paths_json,remaining,note,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(node_id) DO UPDATE SET status=excluded.status,paths_json=excluded.paths_json,remaining=excluded.remaining,note=excluded.note,updated_at=excluded.updated_at`)
      .run(projectId, nodeId, input.status, json(input.paths), input.remaining, input.note, Date.now());
    return this.implementationProgress(projectId, nodeId);
  }
  private rowEdge(row: Row): GraphEdge {
    return { id: row.id, projectId: row.project_id, sourceId: row.source_id, targetId: row.target_id, kind: row.kind, reason: row.reason, createdAt: row.created_at };
  }
  createEdge(projectId: string, input: { id?: string; sourceId: string; targetId: string; kind: GraphEdge['kind']; reason?: string }): GraphEdge {
    this.getNode(projectId, input.sourceId); this.getNode(projectId, input.targetId);
    if (!['related', 'precedes'].includes(input.kind)) throw new StoreError('Invalid relation kind');
    if (input.sourceId === input.targetId) throw new StoreError('A node cannot relate to itself');
    text(input.reason ?? '', 'reason', true);
    const [sourceId, targetId] = input.kind === 'related' ? [input.sourceId, input.targetId].sort() : [input.sourceId, input.targetId];
    const existing = this.db.prepare('SELECT * FROM edges WHERE project_id=? AND kind=? AND source_id=? AND target_id=?').get(projectId, input.kind, sourceId, targetId) as Row | undefined;
    if (existing) return this.rowEdge(existing);
    const id = input.id ?? uid(); text(id, 'id');
    this.db.prepare('INSERT INTO edges(id,project_id,source_id,target_id,kind,reason,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id, projectId, sourceId, targetId, input.kind, input.reason ?? '', Date.now());
    return this.rowEdge(this.db.prepare('SELECT * FROM edges WHERE id=?').get(id) as Row);
  }
  deleteEdge(projectId: string, id: string): void { this.db.prepare('DELETE FROM edges WHERE project_id=? AND id=?').run(projectId, id); }
  hasCurrentCatalog(projectId: string): boolean {
    this.getProject(projectId);
    return !!this.db.prepare('SELECT 1 FROM project_catalogs WHERE project_id=?').get(projectId);
  }
  currentCatalogTasks(projectId: string): { taskId: string; title: string; titles: Record<string, string> }[] {
    this.getProject(projectId);
    return (this.db.prepare('SELECT * FROM project_catalog_tasks WHERE project_id=? ORDER BY task_id').all(projectId) as Row[])
      .map(r => ({ taskId: r.task_id, title: r.title, titles: decode(r.titles_json) }));
  }
  activateCurrentCatalog(projectId: string): void {
    this.getProject(projectId);
    this.db.prepare('INSERT INTO project_catalogs(project_id,updated_at) VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET updated_at=excluded.updated_at').run(projectId, Date.now());
  }
  consolidateNodes(projectId: string, targetId: string, sourceIds: string[], reason: string): void {
    text(reason, 'reason');
    this.transaction(() => {
      const target = this.getNode(projectId, targetId);
      if (!['feature', 'requirement'].includes(target.kind)) throw new StoreError('Consolidation target must be a feature or requirement');
      if (this.db.prepare('SELECT 1 FROM node_merges WHERE node_id=?').get(targetId)) throw new StoreError('Consolidation target is already merged');
      for (const id of new Set(sourceIds)) {
        const source = this.getNode(projectId, id);
        if (id === targetId || ['evidence', 'result'].includes(source.kind)) throw new StoreError('Cannot consolidate a source record or the target itself');
        if (this.db.prepare('SELECT 1 FROM node_merges WHERE target_id=?').get(id)) throw new StoreError('Cannot merge a target with existing sources');
        const prior = this.db.prepare('SELECT target_id FROM node_merges WHERE node_id=?').get(id) as Row | undefined;
        if (prior && prior.target_id !== targetId) throw new StoreError('Node is already consolidated elsewhere');
        this.db.prepare('INSERT OR IGNORE INTO node_merges(project_id,node_id,target_id,reason,created_at) VALUES(?,?,?,?,?)').run(projectId, id, targetId, reason, Date.now());
        const edges = this.db.prepare("SELECT * FROM edges WHERE project_id=? AND kind='related' AND (source_id=? OR target_id=?)").all(projectId, id, id) as Row[];
        for (const edge of edges) {
          const other = edge.source_id === id ? edge.target_id : edge.source_id;
          if (other !== targetId) this.createEdge(projectId, { sourceId: targetId, targetId: other, kind: 'related', reason: edge.reason });
        }
      }
    });
  }
  listGraph(projectId: string, includeMerged = false): Graph {
    this.getProject(projectId);
    const nodes = (this.db.prepare('SELECT * FROM nodes WHERE project_id=? ORDER BY created_at,id').all(projectId) as Row[])
      .filter(row => includeMerged || !this.db.prepare('SELECT 1 FROM node_merges WHERE node_id=?').get(row.id)).map(row => this.rowNode(row));
    const ids = new Set(nodes.map(n => n.id));
    return { nodes, edges: (this.db.prepare('SELECT * FROM edges WHERE project_id=? ORDER BY created_at,id').all(projectId) as Row[])
      .filter(row => ids.has(row.source_id) && ids.has(row.target_id)).map(row => this.rowEdge(row)) };
  }
  buildContext(projectId: string, nodeIds: string[]): GraphContext {
    if (!Array.isArray(nodeIds) || !nodeIds.length || nodeIds.length > 100) throw new StoreError('Select 1 to 100 context nodes');
    const selected = new Set(nodeIds); for (const id of selected) this.getNode(projectId, id);
    const historical = [...selected].some(id => this.db.prepare('SELECT 1 FROM node_merges WHERE node_id=?').get(id));
    const graph = this.listGraph(projectId, historical), included = new Set(selected);
    const byId = new Map(graph.nodes.map(node => [node.id, node]));
    for (let depth = 0; depth < 2; depth++) {
      const frontier = new Set([...included].filter(id => selected.has(id) || byId.get(id)?.kind !== 'feature'));
      for (const edge of graph.edges) {
        const candidates = [frontier.has(edge.sourceId) ? edge.targetId : null, frontier.has(edge.targetId) ? edge.sourceId : null];
        for (const id of candidates) if (id && (depth === 0 || byId.get(id)?.kind !== 'feature' || selected.has(id))) included.add(id);
      }
    }
    const nodes = graph.nodes.filter(node => included.has(node.id));
    const edges = graph.edges.filter(edge => included.has(edge.sourceId) && included.has(edge.targetId));
    const context = nodes.map(node => node.evidence
      ? `EVIDENCE ${node.id} (${node.evidence.sourceKind})\nSOURCE ${json(node.evidence.source)}\nRAW\n${node.evidence.content}`
      : node.execution ? `EXECUTION ${node.id} (${node.execution.kind}, ${node.execution.status})\n${json(node.execution)}`
      : `NODE ${node.id} (${node.kind}, ${node.status}) ${node.title}\n${node.body}`).join('\n\n');
    const relations = edges.map(edge => `${edge.sourceId} ${edge.kind === 'precedes' ? '->' : '--'} ${edge.targetId}${edge.reason ? ': ' + edge.reason : ''}`).join('\n');
    return { projectId, nodeIds: [...selected], nodes, edges, text: `${context}\n\nRELATIONS\n${relations}` };
  }
  private rowSession(row: Row): Session {
    return { id: row.id, projectId: row.project_id, externalThreadId: row.external_thread_id, title: row.title,
      source: row.source, role: row.role, createdAt: row.created_at, lastConversationAt: row.last_conversation_at,
      contextNodeIds: (this.db.prepare('SELECT node_id FROM session_context WHERE session_id=? ORDER BY node_id').all(row.id) as Row[]).map(item => item.node_id) };
  }
  getSession(id: string): Session { return this.rowSession(this.required(this.db.prepare('SELECT * FROM sessions WHERE id=?').get(id) as Row | undefined, 'Session')); }
  findSessionByExternalThreadId(threadId: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE external_thread_id=?').get(threadId) as Row | undefined;
    return row ? this.rowSession(row) : null;
  }
  findReusableSession(projectId: string, role: string | null, contextNodeIds: string[]): Session | null {
    this.getProject(projectId);
    const expected = [...new Set(contextNodeIds)].sort();
    const rows = this.db.prepare(`SELECT * FROM sessions WHERE project_id=? AND source='local' AND role IS ?
      ORDER BY COALESCE(last_conversation_at,created_at) DESC,id DESC`).all(projectId, role) as Row[];
    for (const row of rows) {
      const session = this.rowSession(row);
      if (session.contextNodeIds.length === expected.length && session.contextNodeIds.every((id, index) => id === expected[index])) return session;
    }
    return null;
  }
  createSession(projectId: string, input: SessionInput): Session {
    this.getProject(projectId); text(input.title, 'title');
    if (input.externalThreadId != null) {
      text(input.externalThreadId, 'externalThreadId');
      const existing = this.findSessionByExternalThreadId(input.externalThreadId);
      if (existing) {
        if (existing.projectId !== projectId) throw new StoreError('Thread already belongs to another project', 409);
        return existing;
      }
    }
    const id = input.id ?? uid(); text(id, 'id');
    const source = input.source ?? 'local';
    if (!['local', 'import'].includes(source)) throw new StoreError('Invalid session source');
    const createdAt = input.createdAt ?? Date.now(), lastConversationAt = input.lastConversationAt ?? null;
    timestamp(createdAt, 'createdAt'); if (lastConversationAt !== null) timestamp(lastConversationAt, 'lastConversationAt');
    const contextIds = [...new Set(input.contextNodeIds ?? [])]; for (const nodeId of contextIds) this.getNode(projectId, nodeId);
    return this.transaction(() => {
      this.db.prepare('INSERT INTO sessions(id,project_id,external_thread_id,title,source,role,created_at,last_conversation_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(id, projectId, input.externalThreadId ?? null, input.title.trim(), source, input.role ?? null, createdAt, lastConversationAt);
      for (const nodeId of contextIds) this.db.prepare('INSERT INTO session_context(session_id,project_id,node_id) VALUES(?,?,?)').run(id, projectId, nodeId);
      return this.getSession(id);
    });
  }
  updateSession(id: string, patch: Partial<Pick<Session, 'title' | 'externalThreadId' | 'role'>>): Session {
    const session = this.getSession(id);
    if (Object.keys(patch).some(key => !['title', 'externalThreadId', 'role'].includes(key))) throw new StoreError('Unknown session patch field');
    const next = { ...session, ...patch }; text(next.title, 'title'); if (next.externalThreadId !== null) text(next.externalThreadId, 'externalThreadId');
    this.db.prepare('UPDATE sessions SET title=?,external_thread_id=?,role=? WHERE id=?').run(next.title.trim(), next.externalThreadId, next.role, id);
    return this.getSession(id);
  }
  setSessionContext(sessionId: string, nodeIds: string[]): Session {
    const session = this.getSession(sessionId), ids = [...new Set(nodeIds)];
    for (const id of ids) this.getNode(session.projectId, id);
    return this.transaction(() => {
      this.db.prepare('DELETE FROM session_context WHERE session_id=?').run(sessionId);
      for (const id of ids) this.db.prepare('INSERT INTO session_context(session_id,project_id,node_id) VALUES(?,?,?)').run(sessionId, session.projectId, id);
      return this.getSession(sessionId);
    });
  }
  listSessions(options: { projectId?: string; cursor?: string | null; limit?: number } = {}): Page<Session> {
    const limit = options.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new StoreError('Session page limit must be between 1 and 100');
    if (options.projectId) this.getProject(options.projectId);
    const conditions: string[] = []; const args: (string | number)[] = [];
    if (options.projectId) { conditions.push('project_id=?'); args.push(options.projectId); }
    if (options.cursor) {
      let cursor: any;
      try { cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8')); } catch { throw new StoreError('Invalid session cursor'); }
      if (!cursor || cursor.projectId !== (options.projectId ?? null) || ![0, 1].includes(cursor.rank) || !Number.isSafeInteger(cursor.time) || typeof cursor.id !== 'string') throw new StoreError('Invalid session cursor');
      conditions.push(`((last_conversation_at IS NOT NULL),COALESCE(last_conversation_at,created_at),id) < (?,?,?)`);
      args.push(cursor.rank, cursor.time, cursor.id);
    }
    const rows = this.db.prepare(`SELECT * FROM sessions ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY (last_conversation_at IS NOT NULL) DESC,COALESCE(last_conversation_at,created_at) DESC,id DESC LIMIT ?`).all(...args, limit + 1) as Row[];
    const items = rows.slice(0, limit).map(row => this.rowSession(row)); const last = items.at(-1);
    const nextCursor = rows.length > limit && last ? Buffer.from(json({ projectId: options.projectId ?? null,
      rank: last.lastConversationAt === null ? 0 : 1, time: last.lastConversationAt ?? last.createdAt, id: last.id })).toString('base64url') : null;
    return { items, nextCursor };
  }
  private rowMessage(row: Row): Message {
    return { id: row.id, sessionId: row.session_id, externalId: row.external_id, role: row.role, content: row.content, createdAt: row.created_at, turnId: row.turn_id };
  }
  addMessage(sessionId: string, input: MessageInput): Message {
    this.getSession(sessionId); text(input.content, 'content', true);
    if (!['user', 'assistant', 'system', 'tool'].includes(input.role)) throw new StoreError('Invalid message role');
    const createdAt = input.createdAt ?? Date.now(); timestamp(createdAt, 'createdAt');
    if (input.externalId != null) {
      text(input.externalId, 'externalId');
      const existing = this.db.prepare('SELECT * FROM messages WHERE session_id=? AND external_id=?').get(sessionId, input.externalId) as Row | undefined;
      if (existing) return this.rowMessage(existing);
    }
    const id = input.id ?? uid(); text(id, 'id');
    return this.transaction(() => {
      this.db.prepare('INSERT INTO messages(id,session_id,external_id,role,content,created_at,turn_id) VALUES(?,?,?,?,?,?,?)')
        .run(id, sessionId, input.externalId ?? null, input.role, input.content, createdAt, input.turnId ?? null);
      if (input.trackConversation !== false && (input.role === 'user' || input.role === 'assistant')) this.db.prepare('UPDATE sessions SET last_conversation_at=MAX(COALESCE(last_conversation_at,0),?) WHERE id=?').run(createdAt, sessionId);
      return this.rowMessage(this.db.prepare('SELECT * FROM messages WHERE id=?').get(id) as Row);
    });
  }
  listMessages(sessionId: string): Message[] {
    this.getSession(sessionId);
    return (this.db.prepare('SELECT * FROM messages WHERE session_id=? ORDER BY created_at,rowid').all(sessionId) as Row[]).map(row => this.rowMessage(row));
  }
  appendEvent(sessionId: string, method: string, payload: unknown, createdAt = Date.now()): SessionEvent {
    this.getSession(sessionId); text(method, 'method'); timestamp(createdAt, 'createdAt');
    const result = this.db.prepare('INSERT INTO session_events(session_id,method,payload_json,created_at) VALUES(?,?,?,?)').run(sessionId, method, json(payload), createdAt);
    return { id: Number(result.lastInsertRowid), sessionId, method, payload, createdAt };
  }
  listEvents(sessionId: string, afterId = 0): SessionEvent[] {
    this.getSession(sessionId);
    if (!Number.isSafeInteger(afterId) || afterId < 0) throw new StoreError('Invalid event cursor');
    return (this.db.prepare('SELECT * FROM session_events WHERE session_id=? AND id>? ORDER BY id').all(sessionId, afterId) as Row[])
      .map(row => ({ id: row.id, sessionId: row.session_id, method: row.method, payload: decode(row.payload_json), createdAt: row.created_at }));
  }
  saveUsage(sessionId: string, input: UsageInput): Usage {
    this.getSession(sessionId); const turnId = input.turnId ?? 'latest'; text(turnId, 'turnId');
    const observedAt = input.observedAt ?? Date.now(); timestamp(observedAt, 'observedAt');
    for (const key of ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningOutputTokens', 'modelContextWindow'] as const) {
      const value = input[key]; if (value != null && (!Number.isSafeInteger(value) || value < (key === 'modelContextWindow' ? 1 : 0))) throw new StoreError(`Invalid ${key}`);
    }
    this.db.prepare(`INSERT INTO usage(session_id,turn_id,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens,model_context_window,raw_json,observed_at)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,turn_id) DO UPDATE SET input_tokens=excluded.input_tokens,
      cached_input_tokens=excluded.cached_input_tokens,output_tokens=excluded.output_tokens,reasoning_output_tokens=excluded.reasoning_output_tokens,
      model_context_window=excluded.model_context_window,raw_json=excluded.raw_json,observed_at=excluded.observed_at`).run(sessionId, turnId,
      input.inputTokens ?? null, input.cachedInputTokens ?? null, input.outputTokens ?? null, input.reasoningOutputTokens ?? null,
      input.modelContextWindow ?? null, json(input.raw), observedAt);
    return this.listUsage(sessionId).find(item => item.turnId === turnId)!;
  }
  listUsage(sessionId: string): Usage[] {
    this.getSession(sessionId);
    return (this.db.prepare('SELECT * FROM usage WHERE session_id=? ORDER BY observed_at,turn_id').all(sessionId) as Row[]).map(row => ({ sessionId: row.session_id,
      turnId: row.turn_id, inputTokens: row.input_tokens, cachedInputTokens: row.cached_input_tokens, outputTokens: row.output_tokens,
      reasoningOutputTokens: row.reasoning_output_tokens, modelContextWindow: row.model_context_window, raw: decode(row.raw_json), observedAt: row.observed_at }));
  }
}
