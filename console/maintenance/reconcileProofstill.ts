import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Store } from '../server/store.ts';
import { HandoffService } from '../server/handoff.ts';
import { groups, reconcileCatalog } from './proofstillCatalog.ts';
import { currentHarnessTasks, registerCurrentHarnessTasks } from './currentHarnessTasks.ts';

const root=fileURLToPath(new URL('../../',import.meta.url)), args=process.argv.slice(2);
if(args.length!==3 || args[0]!=='--db' || args[2]!=='--apply') throw new Error('Usage: node console/maintenance/reconcileProofstill.ts --db /absolute/console.sqlite --apply');
JSON.parse(readFileSync(resolve(root,'.proofstill/evidence/current-catalog-v1/state.json'),'utf8'));
const database=resolve(args[1]), backupDir=resolve(dirname(database),'backups',`current-catalog-${Date.now()}`);
mkdirSync(backupDir,{recursive:true});
const original=new DatabaseSync(database,{readOnly:true});
await backup(original,resolve(backupDir,'console.sqlite'));original.close();
for(const task of currentHarnessTasks) writeFileSync(resolve(backupDir,`${task.id}-state.json`),readFileSync(resolve(root,`.proofstill/evidence/${task.id}/state.json`)));
const store=new Store(database);
try {
  const project=store.listProjects().find(p=>resolve(p.rootPath)===resolve(root));
  if(!project) throw new Error('Register this repository as a project first');
  const preservedTables=['evidence','executions','sessions','session_context','messages','session_events'];
  const before=Object.fromEntries(preservedTables.map(t=>[t,store.db.prepare(`SELECT * FROM ${t}`).all()]));
  const existingNodes=store.listGraph(project.id,true).nodes;
  const originalEdges=store.db.prepare('SELECT * FROM edges').all();
  let records:ReturnType<typeof registerCurrentHarnessTasks>=[];
  const result=store.transaction(()=>{
    const summary=reconcileCatalog(store,project.id,root);
    records=registerCurrentHarnessTasks(store,project.id,root);
    for(const [table,rows] of Object.entries(before)) {
      for(const row of rows as Record<string,unknown>[]) {
        const entries=Object.entries(row);
        const match=store.db.prepare(`SELECT 1 FROM ${table} WHERE ${entries.map(([k])=>`${k} IS ?`).join(' AND ')}`).get(...entries.map(([,v])=>v as string|number|null));
        if(!match) throw new Error(`Original ${table} row changed`);
      }
    }
    for(const edge of originalEdges as {id:string}[]) if(!store.db.prepare('SELECT 1 FROM edges WHERE id=?').get(edge.id)) throw new Error('Original relation removed');
    return summary;
  });
  const implementationWriter=spawnSync('python3',['-c',`import sys,json\nfrom proofstill.workflow import Harness\nh=Harness(sys.argv[1])\nfor r in json.load(sys.stdin):\n h.implement(r['taskId'],r['requirementId'],r['status'],r['paths'],r['remaining'],r['note'])\nprint('implementation records saved')`,root],{cwd:root,input:JSON.stringify(records),encoding:'utf8'});
  if(implementationWriter.status!==0) throw new Error(`Implementation record update failed; restore from ${backupDir}: ${implementationWriter.stderr}`);
  const commands=[['console-tests','npm --prefix console test'],['types','npm --prefix console run typecheck'],['build','npm --prefix console run build']];
  const runs=[];
  for(const [checkId,command] of commands) {
    const startedAt=Date.now();
    const wrapper=spawnSync('python3',['-m','proofstill','--root',root,'test','current-catalog-v1','--module',checkId],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
    const finishedAt=Date.now();
    const state=JSON.parse(readFileSync(resolve(root,'.proofstill/evidence/current-catalog-v1/state.json'),'utf8'));
    const run=state.runs.filter((r:{check:string;phase:string})=>r.check===checkId&&r.phase==='green').at(-1);
    if(!run || Date.parse(run.recorded_at)<startedAt || !run.log) throw new Error(`No new observed check for ${checkId}: ${wrapper.stderr}`);
    const output=readFileSync(run.log,'utf8'),r={status:run.exit_code};
    const node=store.recordExecution(project.id,{title:`현재 요구 확인 · ${command}`,command,kind:'test',status:r.status===0?'passed':'failed',output,exitCode:r.status,startedAt,finishedAt});
    for(const group of groups) {
      const id=`ps-feature-${group.id}`;
      store.observeFeatureCheckResult(project.id,id,node.executionId!);
      if(store.featureAcceptance(project.id,id).checks.some(c=>c.command===command)) store.createEdge(project.id,{sourceId:id,targetId:node.id,kind:'related',reason:'현재 코드에서 실제 실행한 검사. 화면/모델 검증과 별개.'});
    }
    runs.push({command,exitCode:r.status,nodeId:node.id});
    process.stdout.write(`${command}: ${r.status}\n`);
  }
  const snapshot=await new HandoffService(store).snapshot(project.id);
  const active=store.listGraph(project.id).nodes, audit={...result,backupDir,originalNodes:existingNodes.length,activeKinds:active.reduce<Record<string,number>>((a,n)=>(a[n.kind]=(a[n.kind]||0)+1,a),{}),currentRows:snapshot.rows.filter(r=>!r.historical).length,historicalRows:snapshot.rows.filter(r=>r.historical).length,preserved:preservedTables,runs,errors:snapshot.errors};
  writeFileSync(resolve(root,'.proofstill/evidence/current-catalog-v1/data-audit.json'),JSON.stringify(audit,null,2));
  console.log(JSON.stringify(audit,null,2));
  if(runs.some(r=>r.exitCode!==0)||snapshot.errors.length) process.exitCode=1;
} finally {store.close()}
