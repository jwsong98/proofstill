# Project

- 업무 로직은 apps/backend/domain, HTTP·파일·프로세스 연결은 infra가 소유한다. domain은 infra를 import하지 않는다.
- .agents/skills/proofstill-develop과 proofstill-verify로 개발·독립 검증을 수행한다. 실행은 npm run proofstill -- <명령>이다.
- 새 프로젝트나 중요한 기술 변경은 .agents/skills/proofstill-engineer로 구현 가능성·아키텍처를 사용자와 논의한다. 필요한 사용자 결정을 받은 뒤 스택·폴더 구조를 확정하고 생성·구현한다. 기존 합의는 재사용한다.
- UI는 jwdesign 토큰과 컴포넌트를 우선한다. design-taste-frontend는 화면 구성에 적용하고 충돌 시 jwdesign 규칙을 따른다. packages/ui는 공유 컴포넌트, packages/api는 계약과 생성 클라이언트를 소유한다.
- OpenAPI/Orval/API Tracker 작업은 .agents/skills/proofstill-api를 따른다. 계약과 서버 생성 명세를 분리하고 생성 코드를 직접 고치지 않는다.
- 현재 목표·제약·미정 결정·다음 행동은 .proofstill/work/<ID>/brief.md에 짧게 유지한다. 사용자 수용과 에이전트 검증을 구분한다.
- 구현 중에는 test:integration/test:flow, 마무리에는 test:fast 후 `proofstill review <ID>`로 기준과 구현을 한 번에 검토한다. 사전 리뷰·Red·코드 복사본은 필수가 아니다. 리뷰는 원본을 읽고 임시 쓰기는 실행별 TMPDIR에 둔다.
- 병렬 작업은 apps/app/src/features/<기능>, apps/www/src/features/<기능>, backend/domain의 기능 파일과 대응 infra·테스트 파일로 나눈다. 작업별 sources는 담당 파일과 실제 공유 의존성을 포함한다. 화면 진입점 main.tsx, HTTP 라우트 연결, packages/api 계약·생성물, packages/ui·jwdesign, DB migration, package/lockfile은 한 담당자가 순서대로 통합한다.
- 테스트는 실행마다 메모리 DB·seed·임의 포트·임시 flow 기록을 사용한다. 공유 개발 서버나 .api-tracker/flow-record.json으로 병렬 검증하지 않는다. 같은 작업 ID 명령은 순서대로 실행한다. Git worktree는 이 방식으로 해결되지 않는 충돌의 마지막 수단이다.
- 기존 파일을 임의로 덮어쓰지 않는다. 도구·모델의 개인 키를 저장하지 않는다. 시험 문제·파일·결과물을 외부로 전송하지 않는다.

- DB 변경은 proofstill-db 스킬을 따른다. E2E 전에는 test:fast의 메모리 DB+seed로 검증하고, test:e2e에서 실제 PostgreSQL Testcontainers를 사용한다. Docker 오류를 건너뛰거나 메모리 성공으로 대체하지 않는다.
