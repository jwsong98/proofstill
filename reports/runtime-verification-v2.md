# 하네스 0.5.0 현재 버전 실검증 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| bootstrap:R1: 개인 파일 없이 npm 패키지 설치 | 구현 완료 | 통과 | 통과 | 미기록 |
| bootstrap:R2: 앱 선택·npm/pnpm 모노레포 생성 | 구현 완료 | 통과 | 통과 | 미기록 |
| bootstrap:R3: 디자인 시스템·스킬·UI 패키지 포함 | 구현 완료 | 통과 | 통과 | 미기록 |
| bootstrap:R4: OpenAPI 검증·내보내기·클라이언트 생성 | 구현 완료 | 통과 | 통과 | 미기록 |
| bootstrap:R5: 실제 API flow와 응답 출처 연결 | 구현 완료 | 통과 | 통과 | 미기록 |
| database:R1: DB 관리 명령·revision·확인 절차 | 구현 완료 | 통과 | 통과 | 미기록 |
| database:R2: 메모리 DB·seed·HTTP 격리 검사 | 구현 완료 | 통과 | 통과 | 미기록 |
| database:R3: PostgreSQL 컨테이너·지속성 검사 | 구현 완료 | 통과 | 통과 | 미기록 |
| database:R4: DB 코드·명령·검사를 배포 패키지에 포함 | 구현 완료 | 통과 | 통과 | 미기록 |
| fastapi:R1: FastAPI 요청 검증·문서·격리 | 구현 완료 | 통과 | 통과 | 미기록 |
| fastapi:R2: SQLAlchemy 모델·CRUD·rollback | 구현 완료 | 통과 | 통과 | 미기록 |
| fastapi:R3: 라우트에서 OpenAPI·클라이언트 생성 | 구현 완료 | 통과 | 통과 | 미기록 |
| fastapi:R4: 설치·빌드·DB·API 회귀 검증 | 구현 완료 | 통과 | 통과 | 미기록 |
| global-setup:R1: 짧은 명령으로 runtime·스킬 등록 | 구현 완료 | 통과 | 통과 | 미기록 |
| global-setup:R2: 기존 설정·키·지침·사용자 스킬 보존 | 구현 완료 | 통과 | 통과 | 미기록 |
| global-setup:R3: 설치 실패·원본 제거 후 runtime 유지 | 구현 완료 | 통과 | 통과 | 미기록 |
| global-setup:R4: 배포 패키지·설치 안내 일치 | 구현 완료 | 통과 | 통과 | 미기록 |
| single-flow:R1: 단일 flow 실행·조회·재시도 | 구현 완료 | 통과 | 통과 | 미기록 |
| single-flow:R2: 사용자 행동·목적·실측 결과 표시 | 구현 완료 | 통과 | 통과 | 미기록 |
| single-flow:R3: 응답 출처 연결·실패 중단·동시 실행 차단 | 구현 완료 | 통과 | 통과 | 미기록 |
| single-flow:R4: 설치한 프로젝트에서 flow 실행 | 구현 완료 | 통과 | 통과 | 미기록 |
| ux-machine:R1: 앱 snapshot과 UX 전이 ID 연결 | 구현 완료 | 통과 | 통과 | 미기록 |
| ux-machine:R2: 허용 전이·필드·수명·필수 경로 검사 | 구현 완료 | 통과 | 통과 | 미기록 |
| ux-machine:R3: UX 계약·Trace·스킬·예제 연결 | 구현 완료 | 통과 | 통과 | 미기록 |
| ux-machine:R4: 기존 Trace·하네스 회귀 유지 | 구현 완료 | 통과 | 통과 | 미기록 |
| engineer-interview:R1: 중요 기술 선택은 사용자 답변으로 결정 | 구현 완료 | 통과 | 통과 | 미기록 |
| engineer-interview:R2: 스택·구조 합의 후 프로젝트 생성 | 구현 완료 | 통과 | 통과 | 미기록 |
| engineer-interview:R3: 개발·검증 스킬을 설치·생성에 연결 | 구현 완료 | 통과 | 통과 | 미기록 |
| requirements-first:R1: 원문·조건·구현·검사를 요구 ID로 연결 | 구현 완료 | 통과 | 통과 | 미기록 |
| requirements-first:R2: 명확한 요구는 구현, 미정 정책만 질문 | 구현 완료 | 통과 | 통과 | 미기록 |
| requirements-first:R3: 선택 이유·검사·한계를 실제 근거로 설명 | 구현 완료 | 통과 | 통과 | 미기록 |
| requirements-first:R4: 저장소·생성 프로젝트·설치 지침 일치 | 구현 완료 | 통과 | 통과 | 미기록 |
| direct-review:R1: 원본 소스에서 최종 독립 리뷰 | 구현 완료 | 통과 | 통과 | 미기록 |
| direct-review:R2: 작업별 검사 격리·동일 작업 중복 차단 | 구현 완료 | 통과 | 통과 | 미기록 |
| direct-review:R3: 메모리 DB에서 CLI·HTTP flow 검사 | 구현 완료 | 통과 | 통과 | 미기록 |
| direct-review:R4: 공유 통합 책임·휴대 가능한 스캐폴드 | 구현 완료 | 통과 | 통과 | 미기록 |
| remove-baseline:R1: 초기 코드 복사본·보고 링크 제외 | 구현 완료 | 통과 | 통과 | 미기록 |
| remove-baseline:R2: 변경 감지·검사·리뷰·보고 유지 | 구현 완료 | 통과 | 통과 | 미기록 |
| scaffold-jwt:JWT-1: 임의 JSON 데이터 JWT 발급·검증 | 구현 완료 | 통과 | 통과 | 미기록 |
| scaffold-jwt:JWT-2: Bearer 인증 실패·설정 누락 구분 | 구현 완료 | 통과 | 통과 | 미기록 |
| scaffold-jwt:JWT-3: 고유 키 생성·재실행 보존·환경 로딩 | 구현 완료 | 통과 | 통과 | 미기록 |
| scaffold-cors:CORS-1: 허용 출처·인증 헤더·오류 응답 CORS | 구현 완료 | 통과 | 통과 | 미기록 |
| scaffold-cors:CONNECT-1: Vite 프록시·API 주소로 실제 flow 연결 | 구현 완료 | 통과 | 통과 | 미기록 |
| scaffold-cors:AUTH-REGRESSION: 환경 설정 변경 후 JWT·HTTP 회귀 유지 | 구현 완료 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 사용자가 오래된 기준을 현재 버전에 맞추고 DB·스캐폴드·하네스를 실제 검사하며 실패 수정·독립 리뷰·웹 결과 및 남은 일 반영을 요청했다.
- 업무 맥락: 기존 현재 12개 작업 44개 요구를 빠짐없이 대응한다. 버전 조건은 현재 package.json의 0.5.0, 스킬 수는 실제 설치 목록 9개로 현행화한다. remove-baseline의 리뷰 복사본은 이후 합의한 원본 독립 리뷰 정책으로 대체한다. 기존 원문·plan·실행·검토는 수정하지 않는다. 공개 패키지 다운로드는 허용되며 미리 채워진 개인 npm 캐시를 필수로 가정하지 않는다. 전역 설치 검사는 임시 사용자 폴더에서만 수행한다. 기존 개발 DB를 사용하거나 배포·공개·실제 사용자 설치를 변경하지 않는다. FastAPI 요구는 저장돼 있던 v6보다 이후 명세 tests/bootstrap/fastapi.json(v7)의 조건을 보존한다. 요구별 previous와 implementationPaths는 원래 요구와 코드 진입점 대응이며 검사 통과 선언이 아니다. 각 검사는 무엇을·왜·통과 조건을 설명하고 실제 실행 결과와 독립 리뷰를 구분한다. 실제 모델 turn이나 제품 UI 전체는 별도 범위다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/plan.json)
- 기준 버전: `0c261fe2c25d6c13e483a77f664a1a6a88ad1737ac14ca0a1e16d9a5ea56a6d5`
- 소스 버전: `0f1e5eb5c88e0f4a74dd195452eb8ca94d2189bf0bdf855a91fbe5532b4dd94c`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| bootstrap:R1: npm tgz에 지정한 실행 소스·템플릿·공개 도구/스킬 자산만 포함하고 작업 기록·키·개인 절대경로 없이 별도 디렉터리에 설치한다. 설치본에서 기존 Python 하네스를 실행하며 Node 22.18+, Python 3.10+, Codex CLI 로그인 전제를 명시한다. 키 검사는 개인키 PEM 및 sk-proj 패턴, 경로 검사는 /Users 또는 /home의 사용자 절대경로를 대상으로 한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| bootstrap:R2: domain은 infra/HTTP/DB 모듈을 import하지 않으며 infra에서 domain을 사용한다. 선택 가능한 apps와 packages/jwdesign/ui/api 및 npm/pnpm workspace를 생성하고 양쪽 설치·빌드를 실행한다. 기존 디렉터리/symlink와 알 수 없는/빈/중복 앱 선택을 거부한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| bootstrap:R3: 기존 jwdesign 컴포넌트/폰트/토큰과 요청한 두 디자인 스킬 및 하네스 스킬은 원본/이식 hash로 확인해 함께 설치한다. 새로 작성할 UI 패키지는 SSR 렌더링과 앱 번들 소비를, 새 API 사용 안내 스킬은 export/generate/flow/spec 사용 안내를 검토한다. 신규 UI/API 스킬은 비교할 원본 자산이 없다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| bootstrap:R4: JSON OpenAPI file/exporter argv/URL을 npm 명령으로 export한다. 유효성·중복 operationId 검사, 오류 시 기존 산출물 보존 및 검증·exporter·HTTP·저장 실패 후 임시 파일 정리를 확인한다. 실제 Python exporter operationId 변경을 Orval 생성 TypeScript 클라이언트에 반영한다. 스키마 유효성은 @apidevtools/swagger-parser에 위임하고 해당 validate 함수 호출과 실패 전파를 probe로 확인한다. 라이브러리 전체 스키마 규칙을 자체 구현하지 않는다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| bootstrap:R5: 기존 API Tracker를 포함하고 생성 저장소에 실행 가능한 adapter와 flow를 설치한다. 실제 HTTP 호출/flow 기록, 명세 차이 실패, 서버 종료를 검증한다. 실제 HTTP 응답 instance와 구조화된 기록을 대조하고 종료 후 접속 실패를 확인한다. 후속 action은 첫 응답의 관측 ID를 입력으로 전달한다. 잘못된 순서, 누락/잘못된/허용 observedAs 그룹 밖의 입력이 HTTP 호출 전에 거부되는지 확인한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| database:R1: npm/pnpm에서 backend:setup, db:revision/migrate/status/rollback/seed/reset/check, test:unit/integration/fast/e2e를 실제 실행할 수 있다. 관리용 URL 누락/잘못된 revision/reset 확인 누락은 실패한다. 생성 revision SQL을 실제 upgrade/downgrade한다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| database:R2: E2E 전 단위·통합 검사는 실제 SQLite :memory: DB에서 Alembic migration과 고정 seed를 적용한다. seed 재적용은 중복/기존 수정 덮어쓰기를 만들지 않으며 DB/서버 간 격리, 실제 SQL 제약/서비스 검증, HTTP 상태/값, migration 실패 후 버전 미진행을 확인한다. 외부 DATABASE_URL에 의존하지 않는다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| database:R3: E2E 명령은 실제 PostgreSQL Testcontainer를 띄워 같은 migration/seed를 적용한다. 실제 HTTP 단일 flow 출력과 PostgreSQL 행의 일치, 재시작 후 지속성, downgrade/upgrade와 종료 후 컨테이너 제거를 확인한다. Docker 오류를 실패로 보고하고 메모리 fallback이나 오래된 성공 보고를 남기지 않는다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/output.log) |
| database:R4: DB 코드·migration·seed·테스트·설치 의존성·사용 안내가 0.5.0 tgz에 포함된다. 전달 tgz와 새 pack의 일치, 별도 npm/pnpm 설치·빌드·빠른 DB검사, 기존 API flow/OpenAPI/하네스 회귀를 확인한다. domain이 infra를 import하지 않는 경계를 유지한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| fastapi:R1: 기본 scaffold가 FastAPI+Uvicorn이며 typed request/response, /docs·/redoc를 제공하고 기존 task/health 동작·400/404·소유권을 유지한다. 잘못된 JSON/타입·큰 body를 거부하고 memory 서버와 동시 요청이 격리된다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| fastapi:R2: SQLAlchemy 2 declarative Task 모델과 Session CRUD/rollback이 실제 ORM으로 동작하고 기존 SQL 제약·Alembic metadata·migration/seed/DB 명령을 유지한다. 개발용 model→migration→endpoint 경로를 안내한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [database](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/output.log) |
| fastapi:R3: 명세는 실제 FastAPI 라우트에서 자동 생성하며 앱 import/export가 DB를 열지 않는다. managed Python에서 export하고 서버 openapi.json·contract와 일치하며 route 변경→export→Orval 생성이 연결된다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| fastapi:R4: npm/pnpm 설치·빌드·타입 검사·메모리 unit/integration·실제 PostgreSQL Testcontainers E2E·API Tracker lifecycle/flow/기존 하네스 검사가 통과하고 새 파일·고정 의존성이 로컬 tgz에 포함된다. Docker 오류는 실패하고 stale E2E 결과를 제거한다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| global-setup:R1: 추가 명령 없는 실행으로 Codex 전역 runtime, 9개 스킬, 전역 지침을 등록하고 낯선 환경에서 사용할 짧은 npx GitHub 명령과 자연어 사용 예를 안내한다. --help는 설치하지 않는다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| global-setup:R2: 기존 config/auth, 사용자 AGENTS 본문과 override, 동명 사용자 스킬을 보존하고 관리 블록은 재실행해도 중복하지 않는다. 변경 전 지침 백업이 남는다. CODEX_HOME 및 명시 대상 옵션을 지원한다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| global-setup:R3: npm 캐시/다운로드 원본을 제거해도 설치 runtime에서 harness/scaffold/flow 명령과 스킬 상대 자산이 사용 가능하다. 의존성 설치 실패는 실패 종료하고 이전 설치를 보존한다. 관리 경로 충돌·잘못된 마커·지침 symlink를 덮어쓰지 않는다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| global-setup:R4: 0.5.0 패키지에 전역 설치 코드를 포함하고 기존 npm/pnpm 스캐폴드/OpenAPI/Orval/DB fast/flow와 Python 하네스 회귀를 유지한다. 설치 즉시 등록과 새 세션 적용의 차이를 안내한다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| single-flow:R1: 설치 CLI는 session 선택 없이 단일 flow run/step/show/validate/reset/retry를 제공하고 session 관련 명령/옵션을 거부한다. 현재 기록은 flow-record.json 하나다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| single-flow:R2: 할 일 등록→완료→결과 확인을 실제 서버에서 수행한다. 사용자 행동·목적·기대 결과가 정의/조회/실행 기록에 표시되고 요청·응답 결과도 함께 읽을 수 있다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| single-flow:R3: 이전 성공 응답 ID를 후속 요청에 자동 연결하고 출처를 기록한다. 순서 오류·잘못된 정의/참조·누락 출력은 해당 HTTP 호출 전에 차단한다. 실패 시 중단/기록, 명시 재시도 이력, 완료 재실행 방지, 정의변경 거부, 동시 실행 잠금·중단 running 재실행 방지를 검사한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| single-flow:R4: 변경 CLI/템플릿/안내/스킬 의존성이 npm 패키지에 포함되고 별도 설치 후 npm/pnpm 빌드와 실제 flow가 동작한다. 기존 OpenAPI export 및 Python 하네스 회귀를 검사한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| ux-machine:R1: UX 상태·전이 ID를 실제 앱 snapshot과 Flow.transition에 기록하고 같은 화면의 편집/저장 중/실패를 구별한다. 앱 상태 소유는 유지한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| ux-machine:R2: 초기 상태·허용 전이·operation·화면/기능 소유·허용 필드와 preserve/drop을 검사하고 ID 누락·잘못된 경로·실제 관측 누락을 거부한다. 필수 전이 미실행은 거부하고 미실행 분기를 보고한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| ux-machine:R3: 기획/UX/개발/검증 스킬이 확정한 UX 흐름→상태머신 계약→실제 Trace를 같은 ID로 연결하고 설계와 UI 실행 증거를 구분한다. 예제가 스캐폴드 runtime에도 포함되어 CLI 수집·검사되며 명령 성공만으로 틀린 상태머신을 통과시키지 않는다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| ux-machine:R4: 기존 상태 계약·Trace·CLI 하네스의 회귀 검사를 유지한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| engineer-interview:R1: 시니어 개발자 인터뷰가 구현 가능성·아키텍처의 중요한 선택을 사용자와 논의하고 실제 답변·명시적 위임으로 결정하도록 한다. 추천·무응답을 사용자 선택으로 대체하지 않는다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| engineer-interview:R2: 결정 이후 스택·폴더 구조를 확정하고 생성한다. 미정 결정에 의존하는 설치·생성·구현을 보류하며 기존 합의와 사용자의 직접 CLI 선택을 존중한다. 템플릿 불일치를 조용히 덮지 않는다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| engineer-interview:R3: 기획·UX·개발·독립 검증과 새 스킬을 연결하고 패키지 배포 목록·전역 설치·스캐폴드에 포함한다. 기존 파일 보존·선택 앱·설치 이식성 검사를 유지한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log), [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| requirements-first:R1: 긴 제공 명세를 원문 근거와 요구 ID·조건·구현/검사·상태로 모아 보존하고 담당자 실제 답변과 추가 요청을 변경 영향 단위로 반영한다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| requirements-first:R2: 명확한 범위를 즉시 구현하고 인터뷰·전체 사전 설계·Trace를 불필요한 관문으로 만들지 않는다. 미정 업무 결정과 연락 권한을 임의 확정하지 않는다. 필수 검사와 최종 독립 리뷰를 유지한다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| requirements-first:R3: 사람이 조건·로직·데이터 흐름·선택 이유와 AI 수정·검증·조치를 실제 코드/검사 근거로 설명하도록 하고 데이터 변경 검사 및 미검증 한계를 드러낸다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| requirements-first:R4: 저장소·생성 프로젝트 지침·설치 전달을 일관되게 유지하고 실제 시간 단축·통근버스 검증·전역 설치 갱신을 수행했다고 주장하지 않는다. | 자동 검사 통과 | [setup](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) |
| direct-review:R1: 사전 리뷰/Red 없이 검사 후 한 번의 독립 리뷰를 수행하며 코드 복사본을 만들지 않는다. 원본 변경과 오래된 결과를 감지한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| direct-review:R2: 서로 다른 작업은 독립 기록으로 동시에 검사하고 동일 작업의 중복 명령은 상태를 덮어쓰지 못한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| direct-review:R3: 생성 프로젝트 test:flow와 test:fast가 외부 DB·Docker 없이 CLI/HTTP/메모리 DB를 검사하며 동시 실행과 실패 정리에서 공유 기록을 보존한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| direct-review:R4: 스캐폴드는 앱/기능별 파일과 공유 통합 책임을 구분하고 새 스킬·명령·파일을 휴대 가능하게 생성한다. worktree는 자동 사용하지 않는다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| remove-baseline:R1: init은 초기 코드 복사본을 만들지 않고 보고서도 해당 링크를 생성하지 않는다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| remove-baseline:R2: 기존 변경 감지, Red/Green, 원본 소스 독립 리뷰, 보고 및 정리 동작을 유지한다. 이후 direct-review-v1에서 정한 원본 리뷰 정책을 따르며 리뷰용 코드 복사본을 만들지 않는다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) |
| scaffold-jwt:JWT-1: 임의 JSON 객체를 발급·검증하고 데이터 구조를 고정하지 않으며 만료/발급 시각을 관리한다. 변조·다른 키·다른 알고리즘·누락·만료 토큰을 거부한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| scaffold-jwt:JWT-2: FastAPI Bearer 의존성은 유효한 토큰의 사용자 데이터를 반환하며 누락·잘못된 인증은 401, 설정 누락은 503이다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| scaffold-jwt:JWT-3: 생성 스캐폴드에 .env.example과 auth:setup을 제공하고 고유 키 생성·재실행 보존·환경 로딩을 실제 명령으로 확인한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| scaffold-cors:CORS-1: 루트 env와 환경변수로 허용 출처·credentials를 설정한다. 로컬 기본값과 JSON/Bearer preflight를 제공하며 미허용출처·헤더를 거부하고 정상·400·401·404 API응답에 CORS 헤더를 제공한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| scaffold-cors:CONNECT-1: Vite 전체 /api 프록시와 생성클라이언트 runtime base URL을 연결한다. 프록시 및 절대 API주소 두 모드에서 생성함수로 등록→수정→조회가 동작한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |
| scaffold-cors:AUTH-REGRESSION: env 설정을 공유해도 기존 JWT 발급·검증·키 보존과 백엔드 저장/HTTP 동작이 유지된다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) |

## 재현 명령과 검사 결과

### database · integration · database

```sh
python3 tests/bootstrap/run_database_checks.py
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/d336b1ccaf4e/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/test_database.py)
- [테스트 test_postgres.py](/Users/jwsong/tools/proofstill/tests/bootstrap/e2e/test_postgres.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/run_database_checks.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/backend_support.py)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/tests/bootstrap/db-fixtures/test_database.py)
- [테스트 test_e2e.py](/Users/jwsong/tools/proofstill/tests/bootstrap/db-fixtures/test_e2e.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/tests/bootstrap/db-fixtures/test_http.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/db-requirements.txt)
### bootstrap · integration · bootstrap

```sh
python3 -m unittest discover -s tests/bootstrap -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/54ad1bb14731/result.json)
- [테스트 api-skill.md](/Users/jwsong/tools/proofstill/tests/bootstrap/api-skill.md)
- [테스트 assets.json](/Users/jwsong/tools/proofstill/tests/bootstrap/assets.json)
- [테스트 auth-feature.json](/Users/jwsong/tools/proofstill/tests/bootstrap/auth-feature.json)
- [테스트 backend_support.py](/Users/jwsong/tools/proofstill/tests/bootstrap/backend_support.py)
- [테스트 check_frontend_connection.mjs](/Users/jwsong/tools/proofstill/tests/bootstrap/check_frontend_connection.mjs)
- [테스트 cors-feature.json](/Users/jwsong/tools/proofstill/tests/bootstrap/cors-feature.json)
- [테스트 current-verification.json](/Users/jwsong/tools/proofstill/tests/bootstrap/current-verification.json)
- [테스트 database.json](/Users/jwsong/tools/proofstill/tests/bootstrap/database.json)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/tests/bootstrap/db-fixtures/test_database.py)
- [테스트 test_e2e.py](/Users/jwsong/tools/proofstill/tests/bootstrap/db-fixtures/test_e2e.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/tests/bootstrap/db-fixtures/test_http.py)
- [테스트 db-requirements.txt](/Users/jwsong/tools/proofstill/tests/bootstrap/db-requirements.txt)
- [테스트 distribution.json](/Users/jwsong/tools/proofstill/tests/bootstrap/distribution.json)
- [테스트 test_postgres.py](/Users/jwsong/tools/proofstill/tests/bootstrap/e2e/test_postgres.py)
- [테스트 fastapi.json](/Users/jwsong/tools/proofstill/tests/bootstrap/fastapi.json)
- [테스트 feature.json](/Users/jwsong/tools/proofstill/tests/bootstrap/feature.json)
- [테스트 run_database_checks.py](/Users/jwsong/tools/proofstill/tests/bootstrap/run_database_checks.py)
- [테스트 single-flow.json](/Users/jwsong/tools/proofstill/tests/bootstrap/single-flow.json)
- [테스트 test_auth.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_auth.py)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_database.py)
- [테스트 test_fastapi.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_fastapi.py)
- [테스트 test_flow.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_flow.py)
- [테스트 test_install.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_install.py)
- [테스트 test_memory_flow.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_memory_flow.py)
- [테스트 test_openapi.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_openapi.py)
- [테스트 test_scaffold.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_scaffold.py)
- [테스트 tracker-input-contract.ts](/Users/jwsong/tools/proofstill/tests/bootstrap/tracker-input-contract.ts)
- [테스트 tracker.json](/Users/jwsong/tools/proofstill/tests/bootstrap/tracker.json)
### harness · unit · harness

```sh
python3 -m unittest discover -s tests -q
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/3459aa631a1e/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_contract.py)
- [테스트 test_handoff.py](/Users/jwsong/tools/proofstill/tests/unit/test_handoff.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/tests/unit/test_order_workspace.py)
- [테스트 test_parallel_work.py](/Users/jwsong/tools/proofstill/tests/unit/test_parallel_work.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/tests/unit/test_report.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_view.py)
- [테스트 test_ux_machine.py](/Users/jwsong/tools/proofstill/tests/unit/test_ux_machine.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/tests/integration/test_state_lifetime.py)
- [테스트 test_ux_machine.py](/Users/jwsong/tools/proofstill/tests/integration/test_ux_machine.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
### setup · integration · setup

```sh
python3 -m unittest discover -s tests/setup -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/runs/470201402a17/result.json)
- [테스트 engineer-feature.json](/Users/jwsong/tools/proofstill/tests/setup/engineer-feature.json)
- [테스트 feature.json](/Users/jwsong/tools/proofstill/tests/setup/feature.json)
- [테스트 requirements-first.json](/Users/jwsong/tools/proofstill/tests/setup/requirements-first.json)
- [테스트 test_setup.py](/Users/jwsong/tools/proofstill/tests/setup/test_setup.py)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a1a057-6457-7023-92f1-507873e616e9` · 실행기 `/tmp/proofstill-verification-review.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/reviews/implementation-6db7c5e3c676/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/reviews/implementation-6db7c5e3c676/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/reviews/implementation-6db7c5e3c676/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/reviews/implementation-6db7c5e3c676/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/runtime-verification-v2/reviews/implementation-6db7c5e3c676/manifest.json)
  - bootstrap:R1: pass — bootstrap 31개 검사 통과. 새 pack과 dist 0.5.0 tgz의 바이트 일치, 격리 설치, 허용 파일 목록, 개인키/sk-proj/사용자 절대경로 부재, Node·Python 전제 안내를 확인했다.
  - bootstrap:R2: pass — bootstrap 검사에서 npm/pnpm 스캐폴드 설치·빌드·타입 검사, 앱 선택, 빈/중복/알 수 없는 선택 및 기존 파일·symlink 거부, domain→infra 역참조 방지를 확인했다.
  - bootstrap:R3: pass — 배포 자산 hash, 두 디자인 스킬과 하네스 스킬 이식, jwdesign/UI SSR 렌더링, 앱 번들·폰트·토큰 소비 및 API/DB 안내 스킬 포함 검사가 통과했다.
  - bootstrap:R4: pass — file·argv exporter·URL export, 표준 validator 호출, 중복 operationId와 구조 오류 거부, 실패 시 기존 결과 보존·임시 파일 정리, FastAPI operationId 변경의 Orval 반영 검사가 통과했다.
  - bootstrap:R5: pass — 설치 프로젝트에서 실제 서버 lifecycle과 HTTP flow를 실행했다. 응답과 HTTP 로그 일치, 첫 응답 ID binding, 명세 불일치 실패, 서버 종료 후 접속 실패를 확인했다.
  - database:R1: pass — database 4개 검사와 bootstrap DB 검사가 통과했다. 관리 명령 전체, URL·revision·reset 확인 실패, revision 생성 및 실제 upgrade/downgrade를 실행했다.
  - database:R2: pass — SQLite :memory: migration·고정 seed·재적용, SQL 제약, HTTP 값과 서버 격리, 외부 DATABASE_URL 비의존, 실패 migration의 revision 미진행 검사가 통과했다.
  - database:R3: pass — PostgreSQL 17 Testcontainer를 npm과 pnpm 각각 실제 실행했다. migration/seed, HTTP flow와 DB 행 일치, 서버 재시작 지속성, downgrade/upgrade, 컨테이너 제거 및 Docker 오류 시 stale 결과 제거를 확인했다.
  - database:R4: pass — 0.5.0 tgz와 새 pack 일치, DB 코드·migration·seed·검사·의존성 포함, 별도 npm/pnpm 설치·빌드·fast DB 검사와 API/하네스 회귀가 통과했다.
  - fastapi:R1: pass — FastAPI/Uvicorn, typed schema, docs/redoc, task/health, 400/404·소유권, 잘못된 JSON·타입·대용량 body 거부, 동시 요청 및 memory 서버 격리 검사가 통과했다.
  - fastapi:R2: pass — SQLAlchemy 2 Task 모델, Session CRUD·rollback, SQL 제약, Alembic metadata 일치 및 model→migration→endpoint 문서 예제 실행이 통과했다.
  - fastapi:R3: pass — 앱 import/export 시 DB 미접속, managed Python export, 서버 openapi.json·contract 일치, route 변경 후 export→Orval 생성 연결을 직접 확인했다.
  - fastapi:R4: pass — bootstrap 31개와 database 4개 검사가 모두 통과해 npm/pnpm 설치·빌드·타입 검사·memory 검사·PostgreSQL E2E·Tracker lifecycle·하네스 회귀를 확인했다.
  - global-setup:R1: pass — setup 10개 검사 통과. 무인 기본 실행으로 runtime과 정확히 9개 스킬을 등록하고 --help는 설치하지 않으며 README의 짧은 npx GitHub 명령과 자연어 안내를 확인했다.
  - global-setup:R2: pass — 격리 CODEX_HOME에서 기존 config/auth, AGENTS 본문·override, 동명 사용자 스킬 보존, 관리 블록 멱등성, 백업 및 명시 대상 우선순위를 확인했다.
  - global-setup:R3: pass — 설치 원본 제거 후 runtime의 scaffold/harness 실행과 상대 자산 사용, 의존성 실패 시 이전 설치 보존, 충돌·잘못된 marker·지침 symlink 거부 검사가 통과했다.
  - global-setup:R4: pass — 0.5.0 배포 파일에 setup 코드가 포함되고 setup·bootstrap·harness 전 검사가 통과했다. 설치 직후 등록과 새 세션 적용 차이도 안내에 존재한다.
  - single-flow:R1: pass — run/step/show/validate/reset/retry와 단일 flow-record.json 동작, session 명령·옵션 및 sessions 디렉터리 부재 검사가 통과했다.
  - single-flow:R2: pass — 실제 서버에서 등록→완료→조회 3단계를 실행했고 description·expected·요청·응답 및 실제 task ID가 show와 기록에 나타남을 확인했다.
  - single-flow:R3: pass — 이전 응답 ID binding, 잘못된 정의·순서·관측값·참조의 HTTP 전 차단, 실패 기록·중단·명시 retry, 완료 재실행 방지, 정의 변경·동시 실행·중단 running 차단 검사가 통과했다.
  - single-flow:R4: pass — 설치 tgz에서 npm/pnpm 프로젝트를 생성해 빌드·OpenAPI·flow를 실행했고 Python harness 101개 회귀 검사도 통과했다.
  - ux-machine:R1: pass — harness 101개 검사 통과. 실제 snapshot state_id와 Flow.transition transition_id, 같은 화면의 editing/saving/failed 구분 및 앱 상태 소유를 확인했다.
  - ux-machine:R2: pass — 초기 상태, 허용 전이·operation·소유·화면·필드·preserve/drop·필수 전이와 실제 관측을 검사하며 누락·잘못된 경로·미실행 필수 분기를 거부하는 부정 검사가 통과했다.
  - ux-machine:R3: pass — UX·개발·검증 스킬의 동일 ID 계약과 예제 runtime 포함, CLI 수집 및 틀린 상태머신의 zero-exit 거부 통합 검사가 통과했다.
  - ux-machine:R4: pass — 기존 Trace·상태 계약·CLI를 포함한 전체 harness 101개 검사가 통과했다.
  - engineer-interview:R1: pass — proofstill-engineer 스킬은 실제 사용자 답변·선택·위임만 결정 근거로 인정하고 추천·에이전트 선언·무응답을 배제한다. 설치 및 이식 hash 검사도 통과했다.
  - engineer-interview:R2: pass — 스킬과 AGENTS 지침은 결정 후 스택·폴더 구조를 확정하고 미정 결정 의존 작업을 보류하도록 규정한다. CLI의 직접 앱 선택과 템플릿 불일치 거부 검사도 통과했다.
  - engineer-interview:R3: pass — 기획·UX·개발·검증·engineer 스킬이 배포 목록, 전역 setup 및 scaffold에 연결되며 기존 파일 보존과 설치 이식성 검사가 통과했다.
  - requirements-first:R1: pass — 개발 스킬과 저장소 지침에서 requirements.md에 원문/실제 답변, 요구 ID, 조건, 구현·검사 위치, 상태를 보존하도록 명시하고 설치본에도 동일 지침이 반영됨을 확인했다.
  - requirements-first:R2: pass — interview/develop 스킬은 명확한 요구를 즉시 구현하고 미정 업무 결정만 질문하며 불필요한 인터뷰·Trace 관문을 금지하고 최종 독립 리뷰를 유지한다.
  - requirements-first:R3: pass — develop/verify 스킬이 선택 이유·코드·실행 증거·데이터 변경 검사와 미검증 한계를 분리하도록 규정하며 setup 이식 검사와 독립 실행 검사가 통과했다.
  - requirements-first:R4: pass — 저장소 AGENTS, 생성 프로젝트 AGENTS, setup 관리 블록의 요구 근거 지침이 일치한다. 수행하지 않은 효과나 실제 사용자 적용을 성공으로 주장하는 코드·검사 패턴은 발견되지 않았다.
  - direct-review:R1: pass — harness 검사에서 원본 경로의 새 독립 리뷰 세션, source/test/context 변경 시 stale 판정 및 복사본 미생성을 확인했다. 실행 전후 manifest 502개 파일 hash 불일치가 0개였다.
  - direct-review:R2: pass — 서로 다른 작업의 독립 동시 실행, 동일 작업 lock, 예외 후 lock 해제 및 기존 상태 비덮어쓰기 검사가 통과했다.
  - direct-review:R3: pass — test:fast와 test:flow가 외부 DB·Docker 없이 memory DB·임시 포트·격리 기록으로 실행됐고 동시 실행 및 실패 정리 후 공유 상태 보존 검사가 통과했다.
  - direct-review:R4: pass — scaffold의 앱/기능별 파일과 공유 통합 진입점, 스킬·명령·파일의 휴대성을 확인했다. 개발 스킬은 worktree를 마지막 수단으로만 규정한다.
  - remove-baseline:R1: pass — init과 report가 초기 source 복사본 및 baseline 링크를 만들지 않는 단위 검사가 통과했다.
  - remove-baseline:R2: pass — 변경 감지, Red/Green, 원본 독립 리뷰, 보고·정리 및 source/test/criteria 변경 시 이전 결과 무효화 검사가 통과했다.
  - scaffold-jwt:JWT-1: pass — 생성 프로젝트의 JWT 단위 검사에서 임의 JSON 객체, iat/exp, 변조·다른 키·다른 알고리즘·필드 누락·만료 거부가 실제 PyJWT로 통과했다.
  - scaffold-jwt:JWT-2: pass — FastAPI 인증 통합 검사에서 유효 Bearer의 사용자 데이터 반환, 누락·잘못된 인증 401, 설정 누락 503을 확인했다.
  - scaffold-jwt:JWT-3: pass — 스캐폴드 .env.example과 auth:setup을 실행해 고유 키 생성, 비밀 미출력, 재실행 보존 및 backend 명령의 .env 로딩을 확인했다.
  - scaffold-cors:CORS-1: pass — CORS 통합 검사에서 env 기반 origin·credentials, 로컬 기본값, JSON/Bearer preflight, 미허용 origin/header 거부 및 정상·400·401·404 응답 헤더를 확인했다.
  - scaffold-cors:CONNECT-1: pass — frontend 연결 probe에서 Vite /api 프록시와 생성 클라이언트 base URL을 검사하고 프록시·절대 주소 양쪽에서 등록→수정→조회 flow를 실행했다.
  - scaffold-cors:AUTH-REGRESSION: pass — 공유 settings 적용 상태에서 JWT 발급·검증·키 보존, ORM 저장 및 실제 HTTP 동작 회귀 검사가 통과했다.

## 구현·아티팩트

- [현재 버전 로컬 배포 패키지](/Users/jwsong/tools/proofstill/dist/digitalpresso-proofstill-0.5.0.tgz)

## 한계·남은 사항

- macOS/POSIX·현재 Node/Python·npm/pnpm 환경에서 검증한다. Windows와 실제 모델 turn·제품 전체 UI는 검증 범위 밖이다.
- 검증 환경은 macOS/POSIX, Node v24.14.0, Python 3.14.4, npm 11.9.0, pnpm 10.11.0이다. Windows는 확인하지 않았다.
- 실제 모델 turn과 제품 전체 UI 클릭은 packet의 명시된 범위 밖이라 확인하지 않았다.
- PASS는 manifest로 고정된 현재 소스와 지정된 자동 검사·코드 검토 범위에 한정되며 모든 잠재 결함의 부재를 의미하지 않는다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
