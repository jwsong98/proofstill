import * as fs from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const runtime = path.join(root, '.api-tracker/runtime/backend');
const ownership = path.join(runtime, 'owned.json');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function read(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function ownerStatus(state) {
  if (!state) return 'stopped';
  try {
    const response = await fetch(new URL('/__proofstill/owner', state.baseUrl), {
      headers: { 'X-Proofstill-Token': state.token, Connection: 'close' }, signal: AbortSignal.timeout(1000),
    });
    await response.arrayBuffer();
    return response.ok ? 'owned' : 'foreign';
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return 'stopped';
    if (['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET'].includes(error.cause?.code)) return 'unknown';
    throw error;
  }
}
async function stop(pid) {
  const state = await read(ownership);
  if (!state) return;
  if (pid && Number(pid) !== state.pid) throw new Error('Refusing a PID not owned by this adapter');
  const status = await ownerStatus(state);
  if (!['owned', 'stopped'].includes(status)) throw new Error('Server ownership could not be confirmed; refusing to stop it');
  if (status === 'owned') {
    const response = await fetch(new URL('/__proofstill/stop', state.baseUrl), {
      method: 'POST', headers: { 'X-Proofstill-Token': state.token, Connection: 'close' }, signal: AbortSignal.timeout(3000),
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Server stop failed: ${response.status}`);
    const deadline = Date.now() + 5000;
    while (await ownerStatus(state) !== 'stopped') {
      if (Date.now() >= deadline) throw new Error('Server did not stop');
      await delay(50);
    }
  }
  await fs.rm(ownership, { force: true });
}
async function start(port, timeout) {
  const old = await read(ownership);
  const status = await ownerStatus(old);
  if (status === 'owned') return { baseUrl: old.baseUrl, pid: old.pid, alreadyRunning: true };
  if (status !== 'stopped') throw new Error('Stored server ownership could not be confirmed; inspect the runtime before starting');
  await fs.mkdir(runtime, { recursive: true });
  const readyFile = path.join(runtime, `${randomUUID()}.ready.json`);
  const token = randomUUID();
  const logPath = path.join(runtime, 'server.log');
  const log = await fs.open(logPath, 'a');
  const child = spawn(process.env.PROOFSTILL_BACKEND_PYTHON || path.join(root, 'apps/backend/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), [
    path.join(root, 'apps/backend/infra/server.py'), '--port', port === 'auto' || !port ? '0' : port,
    '--ready-file', readyFile, '--request-log', path.join(runtime, 'http.jsonl'),
  ], { cwd: root, detached: true, stdio: ['ignore', log.fd, log.fd],
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PROOFSTILL_SERVER_TOKEN: token } });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  child.unref();
  await log.close();
  try {
    const deadline = Date.now() + Math.min(timeout - 1000, 10000);
    let ready;
    while (!(ready = await read(readyFile))) {
      if (spawnError) throw spawnError;
      if (Date.now() >= deadline) throw new Error(`Server startup failed; inspect ${logPath}`);
      await delay(50);
    }
    const state = { ...ready, token };
    if (await ownerStatus(state) !== 'owned') throw new Error('Started server did not confirm ownership');
    const temporary = ownership + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await fs.rename(temporary, ownership);
    return { baseUrl: ready.baseUrl, pid: ready.pid, logPath };
  } catch (error) {
    if (child.pid) child.kill('SIGTERM'); // Only the child created by this invocation.
    throw error;
  } finally {
    await fs.rm(readyFile, { force: true });
  }
}

export async function run(action, args) {
  const option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  try {
    const timeout = Number(option('--timeout-ms') || 15000);
    if (!Number.isFinite(timeout) || timeout < 2000) throw new Error('timeout-ms must be at least 2000');
    let result = {};
    if (action === 'server-start') result = await start(option('--port'), timeout);
    else if (action === 'server-stop') await stop(option('--pid'));
    else if (action === 'server-reset') await stop();
    else if (action === 'server-health') {
      const state = await read(ownership);
      const url = process.env.API_TRACKER_BASE_URL || state?.baseUrl;
      let ready = false;
      if (url) {
        try {
          const response = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(1000) });
          const body = await response.json();
          ready = response.ok && typeof body.instance === 'string';
        } catch { /* An unavailable server is a valid negative readiness result. */ }
      }
      result = { ready };
    } else if (action === 'generate-openapi') {
      const output = option('--output');
      if (!output) throw new Error('generate-openapi requires --output');
      const exported = spawnSync(process.execPath, [path.join(path.dirname(require.resolve('@digitalpresso/proofstill/package.json')), 'bin/proofstill.mjs'), 'openapi', 'export', '--output', output], {
        cwd: root, encoding: 'utf8', timeout: timeout - 1000,
      });
      if (exported.error) throw exported.error;
      if (exported.status !== 0) throw new Error(exported.stderr || 'OpenAPI export failed');
      result = { output };
    } else throw new Error(`Unknown adapter action: ${action}`);
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: { message: error.message, cause: error.cause?.code || error.cause?.message } }));
    process.exitCode = 2;
  }
}
