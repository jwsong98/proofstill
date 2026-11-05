import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/store.ts';
import { HandoffService } from '../server/handoff.ts';
import { writeHandoffDocuments } from '../server/handoffDocuments.ts';
import type { HandoffSnapshot } from '../server/types.ts';

const execute = promisify(execFile);
try {
  const { values } = parseArgs({ options: { root: { type: 'string' }, output: { type: 'string' }, db: { type: 'string' } } });
  const runtime = fileURLToPath(new URL('../../', import.meta.url));
  const root = await realpath(resolve(values.root || runtime));
  const output = resolve(values.output || resolve(root, 'handoff', new Date().toISOString().replace(/[:.]/g, '-')));
  const db = resolve(values.db || resolve(process.env.PROOFSTILL_CONSOLE_DATA_DIR || resolve(homedir(), '.local/share/proofstill/console'), 'console.sqlite'));
  let snapshot: HandoffSnapshot | undefined;
  let name = root.split('/').pop() || root;
  const notes: HandoffSnapshot['errors'] = [];
  let exists = false;
  try { await access(db); exists = true; } catch { /* No console DB: harness records are still available. */ }
  if (exists) {
    const store = new Store(db);
    try {
      const projects = [];
      for (const project of store.listProjects()) {
        if (await realpath(project.rootPath).catch(() => '') === root) projects.push(project);
      }
      if (projects.length > 1) throw new Error('같은 경로의 콘솔 프로젝트가 여러 개입니다');
      if (projects.length) { name = projects[0].name; snapshot = await new HandoffService(store).snapshot(projects[0].id); }
      else notes.push({ taskId: 'console', message: '이 경로의 콘솔 프로젝트가 없어 하네스 기록만 포함했습니다.' });
    } finally { store.close(); }
  } else notes.push({ taskId: 'console', message: '콘솔 DB가 없어 하네스 기록만 포함했습니다.' });
  if (!snapshot) {
    const result = await execute(process.env.PROOFSTILL_PYTHON || 'python3', ['-m', 'proofstill', '--root', root, 'handoff'], {
      cwd: runtime, timeout: 60000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    snapshot = { ...JSON.parse(result.stdout), generatedAt: new Date().toISOString() };
  }
  snapshot!.errors.push(...notes);
  await mkdir(dirname(output), { recursive: true });
  const result = await writeHandoffDocuments(root, output, snapshot!, name);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || !result.rows) process.exitCode = 2;
} catch (error) {
  console.error(`handoff: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
