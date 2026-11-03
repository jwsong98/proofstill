import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
for (const app of ['app']) {
  if (!existsSync(`apps/${app}/package.json`)) continue;
  const result = spawnSync(process.execPath, [vite, 'build'], { cwd: `apps/${app}`, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
