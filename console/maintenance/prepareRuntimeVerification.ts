import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentHarnessTasks} from './currentHarnessTasks.ts';

const root=fileURLToPath(new URL('../../',import.meta.url));
const version=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
const requirements=[];
const sources=new Set(['package.json','package-lock.json','bin','bootstrap','templates','vendor','proofstill','.agents/skills','AGENTS.md','README.md','examples','tests',`dist/digitalpresso-proofstill-${version}.tgz`]);
for(const task of currentHarnessTasks) {
 const original=task.id==='fastapi-v6' ? JSON.parse(readFileSync(resolve(root,'tests/bootstrap/fastapi.json'),'utf8')) : JSON.parse(readFileSync(resolve(root,`.proofstill/evidence/${task.id}/plan.json`),'utf8'));
 for(let i=0;i<original.requirements.length;i++) {
  const req=original.requirements[i];
  let text=req.text.replace(/0\.[34]\.0/g,version).replace('8개 스킬','9개 스킬');
  if(task.id==='remove-baseline-v2'&&req.id==='R2') text='기존 변경 감지, Red/Green, 원본 소스 독립 리뷰, 보고 및 정리 동작을 유지한다. 이후 direct-review-v1에서 정한 원본 리뷰 정책을 따르며 리뷰용 코드 복사본을 만들지 않는다.';
  const checks=[...new Set<string>(req.checks.map((id:string)=>{
    const check=original.checks.find((c:{id:string})=>c.id===id);
    if(!check)throw new Error(`Missing original check: ${task.id}/${id}`);
    const command=check.argv.join(' ');
    if(command.includes('run_database_checks.py'))return 'database';
    if(command.includes('tests/setup')||command.includes('tests.setup.'))return 'setup';
    if(command.includes('tests/bootstrap')||command.includes('templates/monorepo/apps/backend'))return 'bootstrap';
    return 'harness';
  }))];
  requirements.push({id:`${task.id.replace(/-v\d+$/,'')}:${req.id}`,title:task.titles[i],group:task.title,text,checks,previous:{taskId:task.id,requirementId:req.id},implementationPaths:task.paths[i]});
 }
}
const checks=[
 {id:'database',module:'database',kind:'integration',label:'실제 DB 저장·재시작·복구 확인',purpose:'메모리 DB에서 migration·seed·HTTP를 검사하고 임시 PostgreSQL에서 실제 저장값, 서버 재시작 후 유지와 컨테이너 정리를 확인해요.',rationale:'메모리 검사만으로는 실제 DB의 제약이나 재시작 후 데이터 유실을 발견할 수 없어 실제 PostgreSQL에서도 확인해야 해요.',expected:'메모리 검사와 npm/pnpm PostgreSQL 흐름이 모두 통과하고 재시작 후 값이 유지돼야 해요. 테스트 컨테이너를 정리하고 Docker 실패를 정상 결과로 바꾸지 않아야 해요.',scope:'격리된 SQLite와 PostgreSQL의 migration·seed·실제 HTTP 흐름·지속성·정리. 제품 화면은 포함하지 않음.',argv:['python3','tests/bootstrap/run_database_checks.py'],files:['tests/bootstrap/test_database.py','tests/bootstrap/e2e','tests/bootstrap/run_database_checks.py','tests/bootstrap/backend_support.py','tests/bootstrap/db-fixtures','tests/bootstrap/db-requirements.txt'],timeout:900},
 {id:'bootstrap',module:'bootstrap',kind:'integration',label:'새 프로젝트 생성·설치·API 연결 확인',purpose:'새 npm/pnpm 프로젝트를 생성해 설치·빌드·타입 검사와 FastAPI·ORM·JWT·CORS·OpenAPI·생성 클라이언트·API 흐름을 실제 실행해요.',rationale:'개발 중인 저장소에서만 동작하고 새로 설치한 사용자의 프로젝트에서는 실패하는 문제를 찾기 위해 필요해요.',expected:'현재 배포용 tgz가 소스와 일치하고 개인 파일 없이 설치돼야 해요. 생성한 프로젝트의 테스트·빌드·API 흐름이 통과하고 잘못된 입력과 기존 폴더 덮어쓰기는 거부해야 해요.',scope:'임시 저장소에서 npm/pnpm 설치, 생성 코드, JWT/CORS, 프런트 API 연결과 CLI/API 흐름 검사. 실제 제품 UI 클릭은 제외.',argv:['python3','-m','unittest','discover','-s','tests/bootstrap','-v'],files:['tests/bootstrap'],timeout:1800},
 {id:'harness',module:'harness',kind:'unit',label:'핵심 하네스의 기준·실행·리뷰 회귀 확인',purpose:'요구·검사 기준 고정, 실제 명령 결과 수집, 오래된 근거 감지, 작업 격리, Trace·UX 상태·인계·리뷰 연결을 검사해요.',rationale:'검사 실패나 미실행을 완료로 표시하거나, 다른 작업의 결과를 잘못 연결하는 오류를 막기 위해 필요해요.',expected:'핵심 하네스 검사가 모두 통과해야 해요. 잘못된 기준·출처·상태는 거부하고 실패·중단·오래된 결과를 통과로 표시하지 않아야 해요.',scope:'핵심 Python 하네스 단위·통합 회귀. 리뷰 실행기는 fixture로 검사하며 실제 독립 검토는 별도 단계.',argv:['python3','-m','unittest','discover','-s','tests','-q'],files:['tests/unit','tests/integration','tests/support.py'],timeout:300},
 {id:'setup',module:'setup',kind:'integration',label:'설치 후 실행·기존 사용자 파일 보존 확인',purpose:'격리된 사용자 폴더에서 9개 스킬과 runtime을 설치하고 재설치·원본 제거·실패·경로 충돌을 확인해요.',rationale:'설치나 갱신이 기존 설정·인증·사용자 스킬을 덮어쓰거나, 다운로드 원본이 사라진 뒤 실행되지 않는 문제를 막기 위해 필요해요.',expected:'9개 스킬과 runtime이 동작하고 기존 사용자 파일과 키를 보존해야 해요. 실패 시 이전 설치를 유지하고 관리 블록을 중복 생성하지 않아야 해요.',scope:'임시 CODEX_HOME과 스킬 디렉터리만 사용. 실제 사용자 전역 설치는 변경하지 않음.',argv:['python3','-m','unittest','discover','-s','tests/setup','-v'],files:['tests/setup'],timeout:900}
].map(c=>({...c,green_pattern:'(?s)Ran [1-9][0-9]* tests.*\\nOK'}));
const plan={id:'runtime-verification-v2',title:`하네스 ${version} 현재 버전 실검증`,intent:'사용자가 오래된 기준을 현재 버전에 맞추고 DB·스캐폴드·하네스를 실제 검사하며 실패 수정·독립 리뷰·웹 결과 및 남은 일 반영을 요청했다.',context:'기존 현재 12개 작업 44개 요구를 빠짐없이 대응한다. 버전 조건은 현재 package.json의 0.5.0, 스킬 수는 실제 설치 목록 9개로 현행화한다. remove-baseline의 리뷰 복사본은 이후 합의한 원본 독립 리뷰 정책으로 대체한다. 기존 원문·plan·실행·검토는 수정하지 않는다. 공개 패키지 다운로드는 허용되며 미리 채워진 개인 npm 캐시를 필수로 가정하지 않는다. 전역 설치 검사는 임시 사용자 폴더에서만 수행한다. 기존 개발 DB를 사용하거나 배포·공개·실제 사용자 설치를 변경하지 않는다. FastAPI 요구는 저장돼 있던 v6보다 이후 명세 tests/bootstrap/fastapi.json(v7)의 조건을 보존한다. 요구별 previous와 implementationPaths는 원래 요구와 코드 진입점 대응이며 검사 통과 선언이 아니다. 각 검사는 무엇을·왜·통과 조건을 설명하고 실제 실행 결과와 독립 리뷰를 구분한다. 실제 모델 turn이나 제품 UI 전체는 별도 범위다.',sources:[...sources],context_files:['tests/bootstrap/current-verification.json'],requirements,checks,limitations:['macOS/POSIX·현재 Node/Python·npm/pnpm 환경에서 검증한다. Windows와 실제 모델 turn·제품 전체 UI는 검증 범위 밖이다.'],artifacts:[{label:'현재 버전 로컬 배포 패키지',path:`dist/digitalpresso-proofstill-${version}.tgz`}]};
writeFileSync(resolve(root,'tests/bootstrap/current-verification.json'),JSON.stringify(plan,null,2)+'\n');
console.log(`Prepared ${requirements.length} requirements, ${checks.length} checks for ${version}`);
