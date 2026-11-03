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
for (const input of config.projects) {
  const project=store.createProject({name:input.name,rootPath:input.rootPath});
  if(input.currentTasks){store.activateCurrentCatalog(project.id);for(const task of input.currentTasks)store.db.prepare('INSERT INTO project_catalog_tasks(project_id,task_id,title,titles_json) VALUES(?,?,?,?)').run(project.id,task.taskId,task.title,JSON.stringify(task.titles));}
  if(input.unrelatedTitle)store.createNode(project.id,{kind:'requirement',title:input.unrelatedTitle,body:'이번 저장·조회 작업과 무관한 현재 요구. 구현·검증·확인 행동은 미기록으로 유지해요.'});
}
const app = createApi({store, codex:new UnusedCodex(), distDir:resolve('console/dist')});
app.server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:app.server.address().port,projects:store.listProjects()})));
async function close(){await app.close();store.close();process.exit(0);}
process.once('SIGINT',close);process.once('SIGTERM',close);
