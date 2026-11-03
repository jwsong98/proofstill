import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from '../server/store.ts';
import {HandoffService} from '../server/handoff.ts';
import {exportHandoff} from '../server/handoffExport.ts';
import {groups,requirementRows,reconcileCatalog} from '../maintenance/proofstillCatalog.ts';
import {registerCurrentHarnessTasks,currentHarnessTasks} from '../maintenance/currentHarnessTasks.ts';
import {activateVerifiedRequirements} from '../maintenance/refreshVerification.ts';
import {nextAction,filterHandoffRows} from '../shared/progress.ts';

const root=resolve(import.meta.dirname,'../..');
test('consolidation preserves originals and old session context, projects relations, and rejects unsafe merges',t=>{
 const s=new Store();t.after(()=>s.close());const p=s.createProject({name:'merge',rootPath:'/merge'}),other=s.createProject({name:'other',rootPath:'/other'});
 const target=s.createNode(p.id,{kind:'feature',title:'현재 기능'}),source=s.createNode(p.id,{kind:'requirement',title:'조건',body:'원래 조건'}),foreign=s.createNode(other.id,{kind:'requirement',title:'다른 프로젝트'});
 const raw=s.captureEvidence(p.id,{title:'원문',sourceKind:'message',source:{threadId:'t',messageId:'m'},content:'불변 원문'});
 const edge=s.createEdge(p.id,{sourceId:source.id,targetId:raw.id,kind:'related'});
 const session=s.createSession(p.id,{title:'이전 세션',contextNodeIds:[source.id]});
 const before=s.getNode(p.id,source.id);
 assert.throws(()=>s.consolidateNodes(p.id,target.id,[source.id,foreign.id],'invalid'),/not found/);
 assert.ok(s.listGraph(p.id).nodes.some(n=>n.id===source.id),'failed merge must roll back');
 assert.throws(()=>s.consolidateNodes(p.id,target.id,[raw.id],'invalid'),/source record/);
 assert.throws(()=>s.consolidateNodes(p.id,target.id,[target.id],'invalid'),/target itself/);
 s.consolidateNodes(p.id,target.id,[source.id],'같은 기능으로 통합');s.consolidateNodes(p.id,target.id,[source.id],'idempotent');
 assert.deepEqual(s.getNode(p.id,source.id),before);
 assert.equal(s.getNode(p.id,target.id).mergedRecords?.[0].body,'원래 조건');
 assert.equal(s.listGraph(p.id).nodes.some(n=>n.id===source.id),false);
 assert.ok(s.listGraph(p.id,true).edges.some(e=>e.id===edge.id));
 assert.ok(s.listGraph(p.id).edges.some(e=>[e.sourceId,e.targetId].includes(target.id)&&[e.sourceId,e.targetId].includes(raw.id)));
 assert.deepEqual(s.getSession(session.id).contextNodeIds,[source.id]);
 assert.ok(s.buildContext(p.id,[source.id]).text.includes('원래 조건'));
 assert.ok(!s.buildContext(p.id,[target.id]).nodes.some(n=>n.id===source.id));
});
test('all current WC conditions and H1-H5 survive consolidation into eight functions with idempotent evidence and no invented pass',async t=>{
 const s=new Store();t.after(()=>s.close());const p=s.createProject({name:'proofstill',rootPath:root});
 for(const g of groups){s.createNode(p.id,{id:`ps-feature-${g.id}`,kind:'feature',title:g.id});for(const name of g.merge)s.createNode(p.id,{id:`ps-${name}`,kind:name.split('-')[0] as any,title:name,body:'이전 논의'});for(const n of g.requirements.filter(n=>n<=18))s.createNode(p.id,{id:`ps-wc-${String(n).padStart(2,'0')}`,kind:'requirement',title:`WC-${n}`});}
 const result=reconcileCatalog(s,p.id,root);assert.equal(result.merged,43);assert.equal(result.requirements,35);
 let graph=s.listGraph(p.id);assert.equal(graph.nodes.filter(n=>n.kind==='feature').length,8);assert.equal(graph.nodes.filter(n=>n.kind==='requirement').length,0);assert.equal(graph.nodes.filter(n=>n.kind==='evidence').length,1);
 const rows=requirementRows(readFileSync(resolve(root,'requirements.md'),'utf8'));
 for(const [id,row] of rows)assert.ok(graph.nodes.some(n=>n.body.includes(`WC-${String(id).padStart(2,'0')}\n${row.condition}`)),`WC-${id} condition preserved`);
 for(let i=1;i<=5;i++)assert.ok(s.getNode(p.id,'ps-feature-handoff').body.includes(`H${i}\n`));
 const snapshot=await new HandoffService(s).snapshot(p.id);
 assert.equal(snapshot.rows.filter(r=>r.source==='console').length,8);
 for(const r of snapshot.rows.filter(r=>r.source==='console')){assert.equal(r.implementation.status,'implemented');assert.equal(r.verification.status,'not_run');assert.equal(r.verification.review.status,'not_run');assert.ok(r.verification.checks.some(c=>c.kind==='scenario'));assert.ok(r.description);}
 const counts=[graph.nodes.length,graph.edges.length];reconcileCatalog(s,p.id,root);graph=s.listGraph(p.id);assert.deepEqual([graph.nodes.length,graph.edges.length],counts);
 assert.throws(()=>requirementRows(readFileSync(resolve(root,'requirements.md'),'utf8').replace('| WC-33 |','| WC-36 |')),/coverage/);
});
test('current task metadata covers every selected requirement and historical export never contaminates current remaining work',async t=>{
 const s=new Store();t.after(()=>s.close());const p=s.createProject({name:'proofstill',rootPath:root});
 const records=registerCurrentHarnessTasks(s,p.id,root);s.activateCurrentCatalog(p.id);
 assert.equal(s.currentCatalogTasks(p.id).length,12);assert.equal(records.length,currentHarnessTasks.reduce((n,t)=>n+t.titles.length,0));
 for(const r of records){assert.ok(r.paths.length);if(r.status==='partial')assert.ok(r.remaining);}
 const snapshot=await new HandoffService(s).snapshot(p.id);
 assert.ok(snapshot.rows.some(r=>r.historical));assert.ok(snapshot.rows.some(r=>r.source==='harness'&&!r.historical));
 const current=snapshot.rows.find(r=>r.taskId==='bootstrap-v14')!;assert.equal(current.title,'개인 파일 없이 npm 패키지 설치');assert.ok(current.description?.includes('npm tgz'));
 const old=snapshot.rows.find(r=>r.taskId==='bootstrap-v1')!;assert.equal(old.historical,true);
 const html=exportHandoff('test',snapshot,{});const currentPart=html.split('<details><summary>이전 작업 기록')[0];assert.ok(!currentPart.includes('harness:bootstrap-v1:R1'));assert.ok(html.includes('이전 작업 기록'));
 const sample={...current,implementation:{status:'implemented' as const,paths:['code.ts'],remaining:'',note:''},verification:{status:'partial' as const,checks:[{id:'ui',kind:'scenario',label:'화면에서 조건 확인',scope:'화면에서 조건 확인',command:'manual',status:'not_run' as const,output:'',exitCode:null,files:[]}],review:{status:'not_run' as const,evidence:''}}};
 assert.equal(nextAction(sample),'화면에서 조건 확인');assert.equal(nextAction({...sample,implementation:{...sample.implementation,status:'partial',remaining:'기준 버전 갱신'}}),'기준 버전 갱신');
});

test('WC search uses the selected requirement conditions rather than a shared full source document',()=>{
 const row={id:'desktop',source:'console' as const,taskId:'desktop',requirementId:'desktop',title:'읽기 쉬운 화면',group:'앱 기능',description:'WC-33 제목과 상세 접힘',origin:'공유 문서 원문 WC-06 WC-33',implementation:{status:'implemented' as const,paths:[],remaining:'',note:''},verification:{status:'not_run' as const,checks:[],review:{status:'not_run' as const,evidence:''}},limitations:[]};
 const usage={...row,id:'usage',title:'사용량',description:'WC-06 토큰 사용량'};
 const archived={...row,id:'old',historical:true};
 assert.deepEqual(filterHandoffRows([row,usage,archived],'current','all','WC-33').map(r=>r.id),['desktop']);
 assert.deepEqual(filterHandoffRows([row,usage,archived],'history','all','').map(r=>r.id),['old']);
 assert.deepEqual(filterHandoffRows([row,usage],'current','remaining',''),[]);
 assert.equal(filterHandoffRows([row,usage],'current','verification','').length,2);
});

test('refreshed current criteria retain all 44 requirement mappings and display actual check explanations',async t=>{
 const s=new Store();t.after(()=>s.close());const p=s.createProject({name:'proofstill',rootPath:root});
 registerCurrentHarnessTasks(s,p.id,root);
 const plan=activateVerifiedRequirements(s,p.id,root);assert.equal(plan.requirements.length,44);
 assert.deepEqual(s.currentCatalogTasks(p.id).map(t=>t.taskId).sort(),['runtime-verification-v2','verification-explanations-v3']);
 const snapshot=await new HandoffService(s).snapshot(p.id),current=snapshot.rows.filter(r=>!r.historical);
 assert.equal(current.filter(r=>r.taskId==='runtime-verification-v2').length,44);
 assert.ok(snapshot.rows.find(r=>r.taskId==='bootstrap-v14')?.historical);
 for(const row of current)for(const check of row.verification.checks){assert.notEqual(check.label,check.id);assert.ok(check.purpose);assert.ok(check.rationale);assert.ok(check.expected);}
 const other=s.createProject({name:'other',rootPath:'/other'});
 assert.throws(()=>activateVerifiedRequirements(s,other.id,root),/root mismatch/);
});
