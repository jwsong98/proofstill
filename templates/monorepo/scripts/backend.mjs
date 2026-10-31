import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.join(root, 'apps/backend');
const venv = path.join(backend, '.venv');
const managedPython = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const [command, ...args] = process.argv.slice(2);
if (args[0] === '--') args.shift();
const python = process.env.PROOFSTILL_BACKEND_PYTHON || managedPython;
const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PIP_DISABLE_PIP_VERSION_CHECK: '1' };
function run(executable, argv, environment = env) {
  const result = spawnSync(executable, argv, { cwd: backend, env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
try {
  if (command === 'backend:setup') {
    if (args.length) throw new Error('backend:setup does not take arguments');
    if (!fs.existsSync(managedPython)) run(process.env.PROOFSTILL_PYTHON || 'python3', ['-m', 'venv', venv]);
    run(managedPython, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
  } else {
    if (command === 'test:e2e') {
      fs.rmSync(path.join(root, '.proofstill/test-results/e2e.json'), { force: true });
      if (!env.DOCKER_HOST) {
        const result = spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' });
        if (result.status === 0 && result.stdout.trim()) env.DOCKER_HOST = result.stdout.trim();
      }
    }
    if (!fs.existsSync(python)) throw new Error('Run npm run backend:setup first (or set PROOFSTILL_BACKEND_PYTHON)');
    if (command === 'dev') run(python, ['infra/server.py', ...args]);
    else if (command === 'openapi:export') run(python, ['export_openapi.py', ...args]);
    else if (['db:revision', 'db:migrate', 'db:status', 'db:rollback', 'db:seed', 'db:reset', 'db:check'].includes(command)) {
      run(python, ['-m', 'infra.manage', command.slice(3), ...args]);
    } else if (['test:unit', 'test:integration', 'test:flow', 'test:fast', 'test:e2e'].includes(command)) {
      if (args.length) throw new Error(`${command} does not take arguments`);
      const kinds = command === 'test:e2e' ? ['unit', 'integration', 'flow', 'e2e'] : command === 'test:fast' ? ['unit', 'integration', 'flow'] : [command.slice(5)];
      for (const kind of kinds) {
        const environment = kind === 'e2e' ? env : { ...env, DATABASE_URL: 'sqlite+pysqlite:///:memory:' };
        run(python, ['-m', 'unittest', 'discover', '-s', `tests/${kind}`, '-v'], environment);
      }
    } else throw new Error('Unknown backend command');
  }
} catch (error) {
  console.error(`backend: ${error.message}`);
  process.exitCode = 1;
}
