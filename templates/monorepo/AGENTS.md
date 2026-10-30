# Project

- 업무 로직은 apps/backend/domain, HTTP·파일·프로세스 연결은 infra가 소유한다. domain은 infra를 import하지 않는다.
- .agents/skills/proofstill-develop과 proofstill-verify로 개발·독립 검증을 수행한다. 실행은 npm run proofstill -- <명령>이다.
- UI는 jwdesign 토큰과 컴포넌트를 우선한다. design-taste-frontend는 화면 구성에 적용하고 충돌 시 jwdesign 규칙을 따른다. packages/ui는 공유 컴포넌트, packages/api는 계약과 생성 클라이언트를 소유한다.
- OpenAPI/Orval/API Tracker 작업은 .agents/skills/proofstill-api를 따른다. 계약과 서버 생성 명세를 분리하고 생성 코드를 직접 고치지 않는다.
- 현재 목표·제약·미정 결정·다음 행동은 .proofstill/work/<ID>/brief.md에 짧게 유지한다. 사용자 수용과 에이전트 검증을 구분한다.
- 기존 파일을 임의로 덮어쓰지 않는다. 도구·모델의 개인 키를 저장하지 않는다. 시험 문제·파일·결과물을 외부로 전송하지 않는다.

- DB 변경은 proofstill-db 스킬을 따른다. E2E 전에는 test:fast의 메모리 DB+seed로 검증하고, test:e2e에서 실제 PostgreSQL Testcontainers를 사용한다. Docker 오류를 건너뛰거나 메모리 성공으로 대체하지 않는다.
