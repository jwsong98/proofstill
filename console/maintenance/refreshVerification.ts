import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {Store} from '../server/store.ts';
import {HandoffService} from '../server/handoff.ts';
import {groups,reconcileCatalog} from './proofstillCatalog.ts';
import {currentHarnessTasks} from './currentHarnessTasks.ts';

export function activateVerifiedRequirements(store:Store,projectId:string,root:string) {
 if(resolve(store.getProject(projectId).rootPath)!==resolve(root))throw new Error('Project root mismatch');
 const plan=JSON.parse(readFileSync(resolve(root,'tests/bootstrap/current-verification.json'),'utf8'));
 const expected=currentHarnessTasks.flatMap(t=>{
  const p=JSON.parse(readFileSync(resolve(root,`.proofstill/evidence/${t.id}/plan.json`),'utf8'));
  return p.requirements.map((r:{id:string})=>`${t.id}:${r.id}`);
 });
 const actual=plan.requirements.map((r:{previous:{taskId:string;requirementId:string}})=>`${r.previous.taskId}:${r.previous.requirementId}`);
 if(JSON.stringify([...expected].sort())!==JSON.stringify([...actual].sort()))throw new Error('Current requirement coverage changed');
 const liveTask=store.db.prepare('SELECT * FROM project_catalog_tasks WHERE project_id=? AND task_id=?').get(projectId,'live-product-validation-v1');
 return store.transaction(()=>{
  store.db.prepare('DELETE FROM project_catalog_tasks WHERE project_id=?').run(projectId);
  store.db.prepare('INSERT INTO project_catalog_tasks(project_id,task_id,title,titles_json) VALUES(?,?,?,?)').run(projectId,plan.id,'','{}');
  store.db.prepare('INSERT INTO project_catalog_tasks(project_id,task_id,title,titles_json) VALUES(?,?,?,?)').run(projectId,liveTask?'live-product-validation-v1':'verification-explanations-v3',liveTask?'실제 모델·제품 사용 시나리오':'검증 결과·웹 표시','{}');
  store.activateCurrentCatalog(projectId);
  return plan;
 });
}
async function main() {
 const root=fileURLToPath(new URL('../../',import.meta.url)),args=process.argv.slice(2);
 if(args.length!==3||args[0]!=='--db'||args[2]!=='--apply')throw new Error('Usage: node console/maintenance/refreshVerification.ts --db /absolute/console.sqlite --apply');
 const database=resolve(args[1]),backupDir=resolve(dirname(database),'backups',`verification-refresh-${Date.now()}`);
 const coreState=JSON.parse(readFileSync(resolve(root,'.proofstill/evidence/runtime-verification-v2/state.json'),'utf8'));
 if(!coreState.runs.some((r:{phase:string})=>r.phase==='green'))throw new Error('Run the current runtime checks first');
 mkdirSync(backupDir,{recursive:true});const original=new DatabaseSync(database,{readOnly:true});await backup(original,resolve(backupDir,'console.sqlite'));original.close();
 const store=new Store(database);
 try{
  const project=store.listProjects().find(p=>resolve(p.rootPath)===resolve(root));if(!project)throw new Error('Project not registered');
  const plan=store.transaction(()=>{reconcileCatalog(store,project.id,root);return activateVerifiedRequirements(store,project.id,root)});
  const declarations=plan.requirements.map((r:{id:string;implementationPaths:string[];previous:{taskId:string;requirementId:string}})=>({id:r.id,paths:r.implementationPaths,note:`현재 버전 기준으로 현행화: ${r.previous.taskId} / ${r.previous.requirementId}. 이전 기준·실행 기록은 보존. 실제 검사와 독립 리뷰 상태는 현재 검증 원본에서 확인.`}));
  const saved=spawnSync('python3',['-c',`import json,sys\nfrom proofstill.workflow import Harness\nh=Harness(sys.argv[1])\nfor r in json.load(sys.stdin):h.implement('runtime-verification-v2',r['id'],'implemented',r['paths'],'',r['note'])`,root],{cwd:root,input:JSON.stringify(declarations),encoding:'utf8'});
  if(saved.status!==0)throw new Error(saved.stderr);
  const observed=[];
  for(const [id,command]of [['console-tests','npm --prefix console test'],['types','npm --prefix console run typecheck'],['build','npm --prefix console run build']]) {
   const startedAt=Date.now();const wrapper=spawnSync('python3',['-m','proofstill','test','verification-explanations-v3','--module',id,'--force'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});const finishedAt=Date.now();
   const state=JSON.parse(readFileSync(resolve(root,'.proofstill/evidence/verification-explanations-v3/state.json'),'utf8'));
   const run=state.runs.filter((r:{check:string;phase:string})=>r.check===id&&r.phase==='green').at(-1);
   if(!run||Date.parse(run.recorded_at)<startedAt)throw new Error(`No fresh result for ${id}: ${wrapper.stderr}`);
   const node=store.recordExecution(project.id,{title:`${id==='console-tests'?'웹 현황·검증 설명 동작 확인':id==='types'?'화면·서버 타입 연결 확인':'웹 화면 배포 파일 생성 확인'}`,command,kind:'test',status:run.accepted?'passed':'failed',exitCode:run.exit_code,output:readFileSync(run.log,'utf8'),startedAt,finishedAt});
   for(const group of groups){const featureId=`ps-feature-${group.id}`;store.observeFeatureCheckResult(project.id,featureId,node.executionId!);if(store.featureAcceptance(project.id,featureId).checks.some(c=>c.command===command))store.createEdge(project.id,{sourceId:featureId,targetId:node.id,kind:'related',reason:'현재 소스에서 실제 실행한 자동 검사. 실제 사용 흐름·모델 확인과 별도.'});}
   observed.push({command,exitCode:run.exit_code});console.log(`${command}: ${run.exit_code}`);
  }
  const snapshot=await new HandoffService(store).snapshot(project.id);
  const audit={backupDir,current:snapshot.rows.filter(r=>!r.historical).length,historical:snapshot.rows.filter(r=>r.historical).length,runtimeRequirements:plan.requirements.length,observed,errors:snapshot.errors};
  writeFileSync(resolve(root,'.proofstill/evidence/verification-explanations-v3/data-audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
  if(observed.some(r=>r.exitCode!==0)||snapshot.errors.length)process.exitCode=1;
 }finally{store.close()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
