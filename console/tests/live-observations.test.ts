import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const groups=['workspace','evidence','graph','chat','usage','results','desktop','handoff'];
type Artifact={path:string};
type Observation={evidence:string;kind:'json'|'text'|'dom';pointer?:string;equals?:unknown;includes?:string};
type Scenario={id:string;evidence:Artifact[];observations:Observation[];limitations:string[]};
type Manifest={schemaVersion:number;recordValidationOnly:boolean;scenarios:Scenario[]};

function evidenceFile(path:string):string {
  assert.equal(typeof path,'string');
  assert.ok(path.startsWith('.proofstill/evidence/live-product-v1/'),'only this synthetic observation bundle is read');
  assert.ok(!isAbsolute(path));
  const file=realpathSync(resolve(root,path));
  const rel=relative(realpathSync(resolve(root,'.proofstill/evidence/live-product-v1')),file);
  assert.ok(rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel),'evidence must stay in its bundle');
  assert.ok(statSync(file).isFile(),'original evidence must be a regular file');
  assert.ok(statSync(file).size>0,'original evidence must not be empty');
  return file;
}
function pointerValue(value:any,pointer:string):unknown {
  assert.equal(typeof pointer,'string');
  if(pointer==='')return value;
  assert.ok(pointer.startsWith('/'),'JSON pointer must start with /');
  for(const encoded of pointer.slice(1).split('/')) {
    assert.ok(!/~(?![01])/u.test(encoded),'invalid JSON pointer escape');
    const key=encoded.replace(/~1/g,'/').replace(/~0/g,'~');
    assert.ok(value!==null&&typeof value==='object'&&Object.hasOwn(value,key),`missing actual JSON field: ${pointer}`);
    value=value[key];
  }
  return value;
}

test('saved live observations have original records and consistent assertions; this does not rerun or accept product scenarios',()=>{
  const manifest=JSON.parse(readFileSync(resolve(import.meta.dirname,'live-observations.json'),'utf8')) as Manifest;
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.recordValidationOnly,true,'record validation must remain separate from product verification');
  assert.ok(Array.isArray(manifest.scenarios));
  assert.deepEqual(manifest.scenarios.map(s=>s.id).sort(),[...groups].sort(),'exactly eight current scenario groups are required');
  const paths=new Set<string>();
  for(const scenario of manifest.scenarios) {
    assert.ok(Array.isArray(scenario.evidence)&&scenario.evidence.length>0,`${scenario.id}: cite actual evidence`);
    assert.ok(Array.isArray(scenario.limitations)&&scenario.limitations.every(s=>typeof s==='string'&&s.trim()),'limitations must stay explicit strings');
    const records=new Map<string,string>();
    for(const artifact of scenario.evidence) {
      const bytes=readFileSync(evidenceFile(artifact.path));
      assert.ok(!records.has(artifact.path),'duplicate evidence entry');
      records.set(artifact.path,bytes.toString('utf8'));paths.add(artifact.path);
    }
    assert.ok(Array.isArray(scenario.observations)&&scenario.observations.length>0,`${scenario.id}: compare at least one actual value`);
    for(const observation of scenario.observations) {
      assert.ok(records.has(observation.evidence),'each observation must cite its scenario original');
      assert.ok(['json','text','dom'].includes(observation.kind));
      const raw=records.get(observation.evidence)!;
      let actual:unknown=raw;
      if(observation.kind==='json')actual=pointerValue(JSON.parse(raw),observation.pointer??'');
      else assert.equal(observation.pointer,undefined,'text and DOM records use literal saved content');
      const hasEquals=Object.hasOwn(observation,'equals'),hasIncludes=Object.hasOwn(observation,'includes');
      assert.ok(hasEquals||hasIncludes,'an observation must compare an actual value');
      if(hasEquals)assert.deepEqual(actual,observation.equals,`${scenario.id}: ${observation.evidence} ${observation.pointer??''}`);
      if(hasIncludes) {
        assert.equal(typeof observation.includes,'string');assert.ok(observation.includes!.length>0);
        assert.equal(typeof actual,'string');assert.ok((actual as string).includes(observation.includes!),`${scenario.id}: missing observed text`);
      }
    }
  }
  assert.ok(paths.size>=8,'preserve at least eight distinct original observation artifacts');
});

test('record comparisons reject missing fields, wrong values and path escapes without treating absent observations as product passes',()=>{
  assert.throws(()=>pointerValue({turn:{status:'completed'}},'/missing/status'));
  assert.throws(()=>pointerValue({turn:null},'/turn/status'));
  assert.throws(()=>pointerValue({},'/bad~2escape'));
  assert.equal(pointerValue({'a/b':{'~':731}},'/a~1b/~0'),731);
  assert.throws(()=>assert.equal(pointerValue({status:503},'/status'),200));
  assert.throws(()=>evidenceFile('.proofstill/evidence/live-product-v1/../../../../requirements.md'));
});
