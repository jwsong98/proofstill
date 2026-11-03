import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Store } from '../server/store.ts';

export const currentHarnessTasks = [
  {id:'bootstrap-v14',title:'프로젝트 생성·OpenAPI',titles:['개인 파일 없이 npm 패키지 설치','앱 선택·npm/pnpm 모노레포 생성','디자인 시스템·스킬·UI 패키지 포함','OpenAPI 검증·내보내기·클라이언트 생성','실제 API flow와 응답 출처 연결'],paths:[['package.json','bin/proofstill.mjs'],['bootstrap/scaffold.mjs','templates/monorepo'],['bootstrap/scaffold.mjs','vendor/skills'],['bootstrap/openapi.mjs','templates/monorepo/orval.config.mjs'],['bootstrap/flow.mjs','vendor/api-tracker']],gaps:{}},
  {id:'database-v5',title:'DB migration·검증',titles:['DB 관리 명령·revision·확인 절차','메모리 DB·seed·HTTP 격리 검사','PostgreSQL 컨테이너·지속성 검사','DB 코드·명령·검사를 배포 패키지에 포함'],paths:[['templates/monorepo/apps/backend/infra/manage.py','templates/monorepo/scripts/backend.mjs'],['templates/monorepo/apps/backend/infra/database.py','templates/monorepo/apps/backend/seed'],['templates/monorepo/apps/backend/tests/e2e','templates/monorepo/scripts/backend.mjs'],['package.json','bootstrap/scaffold.mjs']],gaps:{R4:'기준의 0.3.0 전달 패키지는 과거 버전입니다. 현재 0.5.0 패키지 기준으로 배포 검사를 갱신해야 합니다.'}},
  {id:'fastapi-v6',title:'FastAPI·SQLAlchemy',titles:['FastAPI 요청 검증·문서·격리','SQLAlchemy 모델·CRUD·rollback','라우트에서 OpenAPI·클라이언트 생성','설치·빌드·DB·API 회귀 검증'],paths:[['templates/monorepo/apps/backend/infra/app.py','templates/monorepo/apps/backend/infra/schemas.py'],['templates/monorepo/apps/backend/infra/models.py','templates/monorepo/apps/backend/infra/task_repository.py'],['templates/monorepo/apps/backend/export_openapi.py','bootstrap/openapi.mjs'],['templates/monorepo/scripts/backend.mjs','tests/bootstrap/test_fastapi.py']],gaps:{R4:'기준의 0.3.0 패키지 경로를 현재 배포 버전 기준으로 정리하고 설치·전체 통합 검사를 다시 실행해야 합니다.'}},
  {id:'global-setup-v1',title:'전역 설치·기존 설정 보존',titles:['짧은 명령으로 runtime·스킬 등록','기존 설정·키·지침·사용자 스킬 보존','설치 실패·원본 제거 후 runtime 유지','배포 패키지·설치 안내 일치'],paths:[['bin/proofstill.mjs','bootstrap/setup.mjs'],['bootstrap/setup.mjs'],['bootstrap/setup.mjs','bootstrap/scaffold.mjs'],['package.json','README.md']],gaps:{R1:'기준은 8개 스킬이지만 현재 설치 코드에는 9개가 있습니다. 스킬 개수 기준과 안내를 현재 코드에 맞춰 정리해야 합니다.',R4:'기준의 0.4.0 패키지 조건과 현재 0.5.0 배포 안내를 대조해 최신 기준으로 갱신해야 합니다.'}},
  {id:'single-flow-v4',title:'단일 API 사용자 흐름',titles:['단일 flow 실행·조회·재시도','사용자 행동·목적·실측 결과 표시','응답 출처 연결·실패 중단·동시 실행 차단','설치한 프로젝트에서 flow 실행'],paths:[['bootstrap/flow.mjs','bin/proofstill.mjs'],['bootstrap/flow.mjs','templates/monorepo/.api-tracker/flow.yaml'],['bootstrap/flow.mjs'],['bootstrap/scaffold.mjs','package.json']],gaps:{}},
  {id:'ux-machine-v1',title:'UX 상태·Trace 검증',titles:['앱 snapshot과 UX 전이 ID 연결','허용 전이·필드·수명·필수 경로 검사','UX 계약·Trace·스킬·예제 연결','기존 Trace·하네스 회귀 유지'],paths:[['proofstill/trace.py','examples/ux_save'],['proofstill/trace_check.py'],['.agents/skills/proofstill-ux/SKILL.md','bootstrap/scaffold.mjs'],['proofstill/trace_check.py','tests/unit/test_ux_machine.py']],gaps:{}},
  {id:'engineer-interview-v1',title:'기술 결정·프로젝트 생성',titles:['중요 기술 선택은 사용자 답변으로 결정','스택·구조 합의 후 프로젝트 생성','개발·검증 스킬을 설치·생성에 연결'],paths:[['.agents/skills/proofstill-engineer/SKILL.md'],['.agents/skills/proofstill-engineer/SKILL.md','bootstrap/scaffold.mjs'],['bootstrap/setup.mjs','bootstrap/scaffold.mjs']],gaps:{}},
  {id:'requirements-first-v2',title:'요구 근거 중심 개발',titles:['원문·조건·구현·검사를 요구 ID로 연결','명확한 요구는 구현, 미정 정책만 질문','선택 이유·검사·한계를 실제 근거로 설명','저장소·생성 프로젝트·설치 지침 일치'],paths:[['.agents/skills/proofstill-develop/SKILL.md'],['.agents/skills/proofstill-interview/SKILL.md','.agents/skills/proofstill-develop/SKILL.md'],['.agents/skills/proofstill-develop/SKILL.md','.agents/skills/proofstill-verify/SKILL.md'],['AGENTS.md','templates/monorepo/AGENTS.md','bootstrap/setup.mjs']],gaps:{}},
  {id:'direct-review-v1',title:'독립 리뷰·작업 격리',titles:['원본 소스에서 최종 독립 리뷰','작업별 검사 격리·동일 작업 중복 차단','메모리 DB에서 CLI·HTTP flow 검사','공유 통합 책임·휴대 가능한 스캐폴드'],paths:[['proofstill/reviewer.py','proofstill/workflow.py'],['proofstill/workflow.py'],['templates/monorepo/scripts/backend.mjs','templates/monorepo/apps/backend/tests/flow'],['bootstrap/scaffold.mjs','.agents/skills/proofstill-develop/SKILL.md']],gaps:{}},
  {id:'remove-baseline-v2',title:'초기 코드 복사본 제외',titles:['초기 코드 복사본·보고 링크 제외','변경 감지·검사·리뷰·보고 유지'],paths:[['proofstill/workflow.py','proofstill/report.py'],['proofstill/workflow.py','proofstill/reviewer.py','proofstill/report.py']],gaps:{R2:'고정 기준의 “리뷰 복사본”은 이후 direct-review-v1의 원본 리뷰 정책으로 대체됐습니다. 나머지 회귀는 유지하고 오래된 문구를 갱신해야 합니다.'}},
  {id:'scaffold-jwt-v1',title:'JWT 발급·인증 설정',titles:['임의 JSON 데이터 JWT 발급·검증','Bearer 인증 실패·설정 누락 구분','고유 키 생성·재실행 보존·환경 로딩'],paths:[['templates/monorepo/apps/backend/infra/auth.py'],['templates/monorepo/apps/backend/infra/auth.py'],['templates/monorepo/apps/backend/infra/auth_setup.py','templates/monorepo/scripts/backend.mjs']],gaps:{}},
  {id:'scaffold-cors-v2',title:'CORS·프런트 API 연결',titles:['허용 출처·인증 헤더·오류 응답 CORS','Vite 프록시·API 주소로 실제 flow 연결','환경 설정 변경 후 JWT·HTTP 회귀 유지'],paths:[['templates/monorepo/apps/backend/infra/settings.py','templates/monorepo/apps/backend/infra/app.py'],['templates/monorepo/apps/app/vite.config.ts','templates/monorepo/packages/api'],['templates/monorepo/apps/backend/infra/auth.py','templates/monorepo/apps/backend/infra/settings.py']],gaps:{}},
];
export function registerCurrentHarnessTasks(store: Store, projectId: string, root: string) {
  return store.transaction(() => {
    store.db.prepare('DELETE FROM project_catalog_tasks WHERE project_id=?').run(projectId);
    const records:{taskId:string;requirementId:string;status:string;paths:string[];remaining:string;note:string}[]=[];
    for(const task of currentHarnessTasks) {
      const plan=JSON.parse(readFileSync(resolve(root,`.proofstill/evidence/${task.id}/plan.json`),'utf8'));
      if(plan.requirements.length!==task.titles.length) throw new Error(`Unmapped requirement in ${task.id}`);
      const titles:Record<string,string>={};
      plan.requirements.forEach((r:{id:string;text:string},i:number)=>{
        for(const path of task.paths[i]) if(!existsSync(resolve(root,path))) throw new Error(`Missing path: ${path}`);
        titles[r.id]=task.titles[i];
        const remaining=(task.gaps as Record<string,string>)[r.id] || '';
        records.push({taskId:task.id,requirementId:r.id,status:remaining?'partial':'implemented',paths:task.paths[i],remaining,note:`코드 대조: ${task.paths[i].join(', ')}. 해당 요구의 구현 진입점과 검사 파일을 확인했습니다. 자동 검사·독립 리뷰 상태는 하네스 원본의 현재 결과를 따릅니다. 이번 정리는 기존 검사 결과를 갱신하거나 통과를 선언하지 않습니다.`});
      });
      store.db.prepare('INSERT INTO project_catalog_tasks(project_id,task_id,title,titles_json) VALUES(?,?,?,?)').run(projectId,task.id,task.title,JSON.stringify(titles));
    }
    return records;
  });
}
