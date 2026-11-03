import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from '../../console/server/store.ts';
import { createApi } from '../../console/server/api.ts';

class UnusedCodex extends EventEmitter {
  async start() {}
  async request(method) {
    if (method === 'model/list') return {data:[]};
    if (method === 'account/read') return {account:{type:'fixture'}};
    throw new Error('브라우저 인계 검사는 모델 turn을 실행하지 않아요.');
  }
  close() {}
}
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const store = new Store();
for (const project of config.projects) store.createProject(project);
const app = createApi({store, codex:new UnusedCodex(), distDir:resolve('console/dist')});
app.server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:app.server.address().port,projects:store.listProjects()})));
async function close(){await app.close();store.close();process.exit(0);}
process.once('SIGINT',close);process.once('SIGTERM',close);
