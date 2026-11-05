import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, StoreError } from './store.ts';
import type { HandoffRow, HandoffSnapshot, ImplementationProgress, VerificationStatus } from './types.ts';

const execute = promisify(execFile);
const runtimeRoot = fileURLToPath(new URL('../../', import.meta.url));
import { implementationLabels, verificationStatus } from '../shared/progress.ts';
async function harness(root: string, args: string[]) {
  const entry = args[0] === 'handoff' ? [fileURLToPath(new URL('./handoff_review.py', import.meta.url))] : ['-m', 'proofstill'];
  const { stdout } = await execute(process.env.PROOFSTILL_PYTHON || 'python3', [...entry, '--root', root, ...args], {
    cwd: runtimeRoot, timeout: 60000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  return JSON.parse(stdout);
}
export async function projectFile(rootPath: string, path: string): Promise<string> {
  if (typeof path !== 'string' || !path.trim() || isAbsolute(path)) throw new StoreError('Use a project-relative path');
  const root = await realpath(rootPath), candidate = await realpath(resolve(root, path)).catch(() => { throw new StoreError(`File not found: ${path}`, 404); });
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new StoreError('Path leaves the project', 403);
  if (rel.split(sep).some(part => ['.git', '.proofstill', 'node_modules', '.env'].includes(part)) || rel.split(sep).some(part => part.startsWith('.env.'))) throw new StoreError('Internal or secret paths are not exported', 403);
  return candidate;
}
export class HandoffService {
  readonly store: Store;
  constructor(store: Store) { this.store = store; }
  async snapshot(projectId: string): Promise<HandoffSnapshot> {
    const project = this.store.getProject(projectId), graph = this.store.listGraph(projectId);
    const result: HandoffSnapshot = { rows: [], errors: [], generatedAt: new Date().toISOString() };
    const evidenceDir = resolve(project.rootPath, '.proofstill/evidence');
    let hasHarness = false;
    try { hasHarness = (await stat(evidenceDir)).isDirectory(); } catch (error: any) { if (error.code !== 'ENOENT') result.errors.push({ taskId: 'harness', message: String(error) }); }
    if (hasHarness) {
      try { const data = await harness(project.rootPath, ['handoff']); result.rows.push(...data.rows); result.errors.push(...data.errors); }
      catch (error) { result.errors.push({ taskId: 'harness', message: `하네스 조회 실패. 해당 요구 상태를 확인하지 못했어요: ${error instanceof Error ? error.message : String(error)}` }); }
    }
    const curated = this.store.hasCurrentCatalog(projectId);
    const currentTasks = this.store.currentCatalogTasks(projectId);
    const links = this.store.harnessLinks(projectId);
    for (const row of result.rows) {
      if (curated) {
        const current = currentTasks.find(task => task.taskId === row.taskId);
        row.historical = !current;
        if (current) { row.description = row.description || row.title; row.title = current.titles[row.requirementId] || row.title; row.group = current.title || row.group; }
      }
      const link = links.find(l => l.taskId === row.taskId && l.requirementId === row.requirementId);
      if (link) {
        row.nodeId = link.nodeId;
        row.relatedNodeIds = graph.edges.filter(e => e.sourceId === link.nodeId || e.targetId === link.nodeId).map(e => e.sourceId === link.nodeId ? e.targetId : e.sourceId);
      }
    }
    const linkedNodes = new Set(result.rows.map(r => r.nodeId).filter(Boolean));
    for (const node of graph.nodes.filter(n => ['feature', 'requirement'].includes(n.kind) && !linkedNodes.has(n.id))) {
      const implementation = this.store.implementationProgress(projectId, node.id), acceptance = this.store.featureAcceptance(projectId, node.id);
      const limitations = ['구현 상태는 근거를 붙인 기록이며 사용자 수용과 별개예요.', '실행 당시의 등록 검사 결과예요. 파일 시각·해시·Git 커밋으로 최신성을 자동 판정하지 않아요. 현재 코드와의 관련성은 직접 확인해야 해요.'];
      let missing = false;
      for (const path of implementation.paths) {
        try { await projectFile(project.rootPath, path); }
        catch { missing = true; limitations.push(`구현 경로를 확인할 수 없어요: ${path}`); }
      }
      const checks = await Promise.all(acceptance.checks.map(async check => {
        const e = check.execution;
        let checkMissing = missing;
        for (const file of check.files ?? []) {
          try { await projectFile(project.rootPath, file); }
          catch { checkMissing = true; limitations.push(`검사 경로를 확인할 수 없어요: ${file}`); }
        }
        if (!check.files?.length) limitations.push(`검사 파일 미등록: ${check.label}. 검사 코드 변경은 자동 감지하지 못해요.`);
        const status: VerificationStatus = !e ? 'not_run' : checkMissing ? 'unverified' : e.status === 'passed' && e.exitCode === 0 ? 'passed' : e.status === 'failed' ? 'failed' : e.status === 'interrupted' ? 'interrupted' : 'unverified';
        return { id: check.id, label: check.label, kind: check.kind, purpose:check.purpose, rationale:check.rationale, expected:check.expected, command: check.command, status, output: e?.output ?? '', exitCode: e?.exitCode ?? null,
          recordedAt: e?.finishedAt, files: check.files ?? [], scope: check.label, nodeId: e ? graph.nodes.find(n => n.executionId === e.id)?.id : undefined };
      }));
      const relatedNodeIds = graph.edges.filter(e => e.sourceId === node.id || e.targetId === node.id).map(e => e.sourceId === node.id ? e.targetId : e.sourceId);
      const origins = graph.nodes.filter(n => relatedNodeIds.includes(n.id) && n.evidence).map(n => `${n.title}\n${n.evidence!.content}`);
      result.rows.push({ id: `console:${node.id}`, source: 'console', historical: true, taskId: node.id, requirementId: node.id, nodeId: node.id, relatedNodeIds,
        title: node.title, description: node.body, mergedRecords: node.mergedRecords, group: node.kind === 'feature' ? '앱 기능' : '앱 요구사항', origin: origins.join('\n\n') || node.body,
        implementation, verification: { status: verificationStatus(checks.map(c => c.status)), checks, review: { status: 'not_run', evidence: '앱 실행 결과는 독립 리뷰가 아니에요.' } }, limitations });
    }
    return result;
  }
  async link(projectId: string, taskId: string, requirementId: string) {
    const row = (await this.snapshot(projectId)).rows.find(r => r.source === 'harness' && r.taskId === taskId && r.requirementId === requirementId);
    if (!row) throw new StoreError('하네스 요구를 찾을 수 없어요.', 404);
    return this.store.linkHarnessRequirement(projectId, taskId, requirementId, row.title);
  }
  async save(projectId: string, input: { source: string; taskId: string; requirementId: string; implementation: ImplementationProgress }) {
    if (!input || !['console', 'harness'].includes(input.source) || typeof input.taskId !== 'string' || typeof input.requirementId !== 'string') throw new StoreError('Invalid progress reference');
    const root = this.store.getProject(projectId).rootPath, p = input.implementation;
    if (!p || Object.keys(p).some(k => !['status', 'paths', 'remaining', 'note'].includes(k)) || !Object.hasOwn(implementationLabels, p.status) || !Array.isArray(p.paths) || p.paths.some(path => typeof path !== 'string') || typeof p.remaining !== 'string' || typeof p.note !== 'string') throw new StoreError('Invalid implementation progress');
    for (const path of p.paths) await projectFile(root, path);
    if (p.status === 'implemented' && !p.paths.length) throw new StoreError('구현 완료에는 코드 경로가 필요해요.');
    if (p.status === 'partial' && !p.remaining.trim()) throw new StoreError('일부 구현에는 남은 범위를 적어 주세요.');
    if (input.source === 'console') {
      if (input.taskId !== input.requirementId) throw new StoreError('Mismatched requirement reference');
      return this.store.saveImplementationProgress(projectId, input.taskId, p);
    }
    try { return await harness(root, ['implement', input.taskId, input.requirementId, '--status', p.status, ...p.paths.flatMap(path => ['--path', path]), '--remaining', p.remaining, '--note', p.note]); }
    catch (error) { throw new StoreError(error instanceof Error ? error.message : String(error), 409); }
  }
  async code(projectId: string, path: string) {
    const file = await projectFile(this.store.getProject(projectId).rootPath, path), info = await stat(file);
    if (info.isDirectory()) {
      const chunks: string[] = []; let size = 0, truncated = false;
      const walk = async (folder: string) => {
        for (const child of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
          if (child.isSymbolicLink() || ['node_modules', '.git', '.proofstill', 'dist', '__pycache__', '.pytest_cache'].includes(child.name)) { chunks.push(`생략: ${child.name}`); continue; }
          const item = resolve(folder, child.name), rel = relative(this.store.getProject(projectId).rootPath, item);
          try {
            await projectFile(this.store.getProject(projectId).rootPath, rel);
            if (child.isDirectory()) { await walk(item); continue; }
            const itemSize = (await stat(item)).size;
            if (size + itemSize > 128 * 1024) { truncated = true; chunks.push(`크기 제한으로 생략: ${rel}`); continue; }
            size += itemSize; chunks.push(`--- ${rel} ---\n${await readFile(item, 'utf8')}`);
          } catch { chunks.push(`내용 확인 불가 또는 제외: ${rel}`); }
        }
      };
      await walk(file);
      return { path, content: chunks.join('\n\n') || '빈 폴더', truncated };
    }
    if (!info.isFile()) throw new StoreError('Not a regular file', 400);
    if (info.size > 128 * 1024) return { path, content: '128 KiB를 초과하여 내용을 포함하지 않았어요. 원본 파일을 확인해 주세요.', truncated: true };
    const content = await readFile(file, 'utf8');
    return { path, content, truncated: false };
  }
}
