import { readFile } from 'node:fs/promises';
let baseUrl = process.env.API_BASE_URL;
if (!baseUrl) {
  try { baseUrl = JSON.parse(await readFile(new URL('../../../.api-tracker/runtime/backend/runtime.json', import.meta.url), 'utf8')).baseUrl; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const response = await fetch(new URL('/health', baseUrl || 'http://127.0.0.1:8000'), { signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error(`HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
