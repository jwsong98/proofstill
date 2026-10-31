# Proofstill

Node 22.18+와 Python 3.10+가 필요합니다. GitHub 명령에는 Git, 독립 리뷰에는 로그인한 Codex CLI가 필요합니다.

```sh
npx github:jwsong98/proofstill
```

하네스·8개 스킬·Codex 전역 지침이 **즉시 등록**됩니다. **새 Codex 세션**에서 “Proofstill로 프로젝트 만들어줘”라고 요청하면 됩니다. 기존 모델·인증·개인 스킬·지침을 보존하며 변경하는 지침은 백업합니다. 같은 명령을 다시 실행하면 중복 없이 갱신합니다.

0.5.0은 FastAPI·SQLAlchemy ORM, 독립 리뷰 한 번으로 마무리하는 검증 절차, 메모리 DB 기반 CLI flow 검사, UX 상태머신과 전역 설치를 함께 제공합니다. [공개 릴리스](https://github.com/jwsong98/proofstill/releases/tag/v0.5.0)

직접 수정하려면 다음과 같이 사용합니다.

```sh
git clone https://github.com/jwsong98/proofstill.git
cd proofstill
npm install
node bin/proofstill.mjs setup
```

수정 후 setup을 다시 실행하면 전역 설치본이 갱신됩니다. 설치본은 `CODEX_HOME/proofstill`(기본 `~/.codex/proofstill`)에 보관하며, 스킬은 `~/.agents/skills`에 연결합니다. `setup --codex-home <경로> --skills-dir <경로>`로 위치를 지정할 수 있습니다. 스킬은 자동 감지되며 전역 AGENTS 지침은 새 세션에서 읽습니다. `--help`는 설정을 바꾸지 않습니다.

저장소 검사는 `npm test`, `npm run test:setup`, `npm run test:bootstrap`으로 실행합니다. bootstrap 검사는 먼저 `mkdir -p dist && npm pack --pack-destination dist`로 현재 버전의 tgz를 만든 뒤 실행합니다. Docker가 있는 환경에서는 `npm run test:database`로 Testcontainers까지 확인합니다.

npm으로 설치하는 개발·검증 하네스와 모노레포 스캐폴드입니다. 개인 API 키나 기존 사용자 스킬 폴더 없이 실행합니다. `doctor`는 실행 파일과 버전을 점검하며 Codex 로그인 상태를 보장하지는 않습니다.

```sh
npm install -g https://github.com/jwsong98/proofstill/releases/download/v0.5.0/digitalpresso-proofstill-0.5.0.tgz
proofstill doctor
proofstill scaffold my-project --package-manager npm --install
cd my-project
npm run build
npm run typecheck
npm run dev:backend
# 다른 터미널: npm run dev:app
```

에이전트에게 프로젝트 생성을 요청하면 기획·UX 확인 후 시니어 개발자 인터뷰로 구현 가능성과 아키텍처를 논의합니다. 필요한 사용자 결정을 받은 뒤 개발 스택과 폴더 구조를 확정하며, 제공 템플릿과 맞을 때 위 명령을 실행합니다. CLI 직접 실행은 인터뷰를 자동 수행하거나 차단하지 않습니다.

pnpm이 설치된 환경에서는 `--package-manager pnpm --install`을 사용합니다. 전역 설치 대신 `npm exec --yes --package=https://github.com/jwsong98/proofstill/releases/download/v0.5.0/digitalpresso-proofstill-0.5.0.tgz -- proofstill scaffold my-project --install`도 사용할 수 있습니다. GitHub 공개 Release에서 로그인 없이 내려받습니다. npm registry에는 아직 게시하지 않았습니다. 다운로드한 tgz는 `npm install -g ./digitalpresso-proofstill-0.5.0.tgz`로도 설치할 수 있습니다.

`--apps backend,cli,app,www`로 생성할 앱을 선택합니다. 기존 디렉터리(빈 디렉터리 포함)를 덮어쓰지 않습니다. 기본 백엔드는 FastAPI + Uvicorn + SQLAlchemy 2 ORM/Alembic, 웹 앱은 React/Vite입니다.

- `apps/backend/domain`: 업무 함수. `infra/app.py`: FastAPI 라우트와 Session 의존성. `infra/models.py`: ORM 모델. `infra/schemas.py`: 요청·응답 타입. 서버 실행 후 `/docs`·`/redoc`를 제공합니다.
- `packages/jwdesign`: 실제 컴포넌트·타입·폰트·토큰. 번들러용 React/portal import를 적용합니다.
- `packages/ui`: Radix Slot/CVA 기반 공유 버튼, jwdesign 토큰을 사용하는 shadcn 설정. `npm run ui:add -- card`로 확장합니다.
- `packages/api`: 수용한 계약, 서버 생성 명세, Orval TypeScript 클라이언트.
- `.agents/skills`: jwdesign, design-taste-frontend, proofstill-develop, proofstill-verify, proofstill-interview, proofstill-engineer, proofstill-ux, proofstill-api, proofstill-db.

생성 프로젝트는 하네스 배포본을 `.proofstill-runtime`에 포함해 공개 registry나 개인 경로 없이 다시 설치할 수 있습니다. npm/pnpm lockfile은 첫 설치에서 생성되므로 저장소에 함께 커밋하세요.

```sh
npm run openapi:export
npm run api:generate
npm run api:tracker -- env prepare --generate-spec
npm run api:tracker -- spec compare
npm run api:tracker -- flow validate
npm run api:tracker -- flow show
npm run api:tracker -- flow run
npm run api:tracker -- flow show
npm run api:tracker -- env stop
```

flow는 하나이며 별도 session 이름이나 ID를 선택하지 않습니다. 예제는 **할 일 등록 → 완료 처리 → 저장 결과 확인**입니다. `.api-tracker/flow.yaml`의 각 step에 사용자 행동(title), 목적(description), 기대 결과(expected), OpenAPI operationId를 작성합니다. `flow show`는 실행 전 안내와 실행 후 요청·응답·연결 출처를 함께 보여줍니다.

- `flow run`: 아직 실행하지 않은 단계를 순서대로 실행합니다. 완료 단계는 다시 호출하지 않습니다.
- `flow step create_task`: 다음 단계 하나만 실행합니다. 다른 단계로 건너뛸 수 없습니다.
- `flow retry`: 실패하거나 중단된 다음 단계를 명시적으로 재시도합니다. 서버에 이미 쓰기가 반영됐는지 먼저 확인하세요. 이전 시도는 같은 단계에 보존됩니다.
- `flow reset`: `.api-tracker/flow-record.json`만 제거합니다. 서버 데이터를 되돌리지 않습니다. 정의·명세·서버가 변경됐으면 기존 기록을 확인한 뒤 초기화합니다.

앞 단계의 실제 응답은 `{"from":"create_task","pointer":"/id"}`로 후속 step의 input.path/query/body에 연결합니다. 기대 응답은 expect.status와 expect.body의 JSON Pointer별 값으로 검사합니다. 실패하면 후속 단계는 실행하지 않습니다. 동시에 실행하면 flow.lock으로 중복 호출을 막습니다. 강제 종료로 잠금이 남으면 실행 프로세스 종료와 서버 처리 결과를 확인한 뒤 잠금 파일을 제거하고 명시적으로 재시도합니다.

기본 할 일 데이터는 서버 메모리에 있으며 재시작 시 사라집니다. 다른 서버는 flow의 baseUrl 또는 API_TRACKER_BASE_URL로 지정하고 spec 경로를 설정합니다. 인증은 headers의 `{"Authorization":{"env":"APP_AUTHORIZATION"}}`처럼 환경변수로 연결하며 헤더 값은 기록하지 않습니다. 이 버전은 순차 HTTP JSON 흐름을 지원하며 조건 분기·반복·병렬 실행은 포함하지 않습니다.

`proofstill.config.json`의 `openapi`에는 `command` argv, `file`, `url` 중 하나를 지정합니다. JSON/YAML 입력을 검증하여 JSON으로 내보내며 exporter 명령은 stdout에 명세만 출력해야 합니다. 각 API operation에는 고유한 `operationId`가 필요합니다. 외부 `$ref`는 먼저 하나의 문서로 묶어야 합니다. export는 계약을 자동으로 덮어쓰지 않습니다.

기존 저장소에서는 tgz를 devDependency로 설치한 후 `npx proofstill openapi export --url http://127.0.0.1:8000/openapi.json --output packages/api/openapi.generated.json` 또는 `--file spec.yaml`로 사용합니다. 명시적으로 계약을 가져올 때만 `--output packages/api/openapi.contract.json`을 지정합니다. 기존 저장소의 flow는 생성 예제의 `.api-tracker/flow.yaml`을 가져와 spec·baseUrl·steps를 해당 API에 맞게 연결합니다. 다른 백엔드를 연결할 때는 exporter와 lifecycle adapter를 해당 서버에 맞게 구현해야 합니다.

기존 Python 하네스는 `proofstill harness --help` 또는 생성 저장소의 `npm run proofstill -- --help`로 사용합니다. Python 실행 파일을 바꾸려면 `PROOFSTILL_PYTHON`을 지정합니다. 백엔드와 OpenAPI exporter는 `backend:setup`으로 만든 전용 Python을 함께 사용합니다. 실행 파일을 바꾸려면 `PROOFSTILL_BACKEND_PYTHON`을 지정합니다. Codex 설치·로그인과 Python/Node 자체 설치는 자동 수행하지 않습니다.

서버 lifecycle과 명세 비교는 기존 API Tracker 0.2.0의 배포 파일을 사용합니다(원본 커밋 `d7453f896263e1ed48f8e425613fed00edb4dec0`). jwdesign과 design-taste-frontend는 함께 제공된 원본 스킬·자산을 포함하며 폰트의 OFL 고지를 보존합니다. flow 호출·기록은 이 패키지의 단순한 순차 실행기를 사용합니다. 전체 API 스키마 적합성이나 실제 제품 UI 클릭까지 보증하지 않습니다.

현재 검증 대상은 macOS/POSIX, Node 24와 Python 3.14 환경의 npm/pnpm 설치·빌드·타입 검사·로컬 HTTP 흐름입니다. Windows와 제품 UI 클릭은 검증 범위 밖입니다. 시험 문제·파일·결과물을 외부로 전송하지 않으며 로컬 runtime/flow 기록은 소스 관리에서 제외합니다.

설정 형식의 근거: [shadcn monorepo](https://ui.shadcn.com/docs/monorepo), [Orval configuration](https://orval.dev/docs/reference/configuration/), [npm package files](https://docs.npmjs.com/cli/configuring-npm/package-json/).

## DB 명령과 검증 단계

`npm run backend:setup`으로 Python 의존성을 전용 `.venv`에 설치합니다. `scaffold --install`은 이 과정도 실행합니다. 아래 명령은 npm/pnpm 모두 사용할 수 있습니다.

| 명령 | 동작 |
|---|---|
| `backend:setup` | Python 가상환경과 고정 의존성 설치 |
| `db:check` | SQLite `:memory:`에서 실제 migration·seed 검사 |
| `test:unit` | 메모리 DB의 도메인·SQL 제약·migration·seed 검사 |
| `test:integration` | seed를 적용한 메모리 DB의 실제 HTTP 검사 |
| `test:flow` | CLI 사용자 흐름을 전용 메모리 DB·임의 포트·임시 기록으로 검사 |
| `test:fast` | unit + integration + flow, Docker 불필요 |
| `test:e2e` | PostgreSQL Testcontainers + 실제 HTTP flow + DB 값·지속성·정리 검사 |
| `db:revision -- --message "change"` | migration 생성, `--autogenerate` 지원 |
| `db:migrate` | migration 적용, `--revision`으로 목표 지정 |
| `db:status` | 현재·최신·미적용 revision 확인 |
| `db:rollback` | 한 단계 되돌리기, `--revision` 지정 가능 |
| `db:seed` | 고정 seed의 누락 ID 추가, 기존 수정값 보존 |
| `db:reset -- --yes` | 대상 DB의 전체 downgrade → upgrade → seed |

관리용 db:revision/migrate/status/rollback/seed/reset은 `DATABASE_URL`을 명시해야 합니다. 예를 들어 `export DATABASE_URL='sqlite+pysqlite:///./dev.sqlite'`로 별도 개발 DB를 지정합니다(상대 경로는 apps/backend 기준). PostgreSQL은 `postgresql+psycopg://…` URL을 사용합니다. `db:reset -- --yes`는 대상 DB 데이터를 제거합니다.

기본 서버는 매번 SQLite :memory:에 같은 Alembic migration과 `seed/tasks.json`을 적용합니다. 외부 DATABASE_URL을 지정한 서버는 최신 스키마인지 확인하며 자동으로 migration/seed를 수행하지 않습니다. 먼저 db:migrate와 db:seed를 실행합니다. test:unit/integration/flow/fast와 db:check는 외부 DB 설정을 무시합니다.

test:e2e는 메모리 DB의 unit/integration/flow를 먼저 실행하고 통과한 경우에만 컨테이너 단계로 진행합니다. E2E는 실행 중인 Docker가 필요합니다. Testcontainers가 임시 PostgreSQL을 만들고 migration·seed, 실제 API 사용자 흐름, SQL 행 일치와 서버 재시작 지속성까지 확인한 뒤 컨테이너를 제거합니다. Docker 오류는 실패이며 메모리 DB로 대체하거나 건너뛰지 않습니다. 성공 결과는 `.proofstill/test-results/e2e.json`에 남고, 다음 E2E 시작 시 오래된 결과를 제거합니다. 브라우저 클릭은 이 API E2E의 범위에 포함하지 않습니다.

구성 근거: [Alembic 연결 공유](https://alembic.sqlalchemy.org/en/latest/cookbook.html#sharing-a-connection-across-one-or-more-programmatic-migration-commands), [Testcontainers PostgreSQL](https://testcontainers-python.readthedocs.io/en/latest/).

## 개발과 최종 리뷰

`init <기능 정의 JSON>` → 구현 및 `test <ID>` → `review <ID>` → `report <ID>` 순서로 진행합니다. test는 기본 Green, review는 기준 적절성과 구현을 함께 보는 최종 독립 리뷰입니다. 사전 criteria 리뷰와 Red 검사는 선택 사항입니다. 테스트 파일을 고치면 같은 작업에서 다시 검사하며 이전 결과는 현재 버전의 근거가 되지 않습니다.

리뷰는 원본 프로젝트를 읽고 대상 경로·해시만 보존합니다. 코드 복사본을 만들지 않으며, 리뷰 중 담당 소스나 테스트가 바뀌면 판정을 무효화합니다. 같은 작업 ID의 명령은 동시에 쓰지 못하게 잠그고, 서로 다른 작업은 담당 sources와 공유 의존성 범위로 검사합니다.

개발 중 `npm run test:integration` 또는 `npm run test:flow`, 통합 시 `npm run test:fast`를 사용합니다. flow 검사는 할 일 등록 → 완료 처리 → 재조회 CLI 흐름을 실행마다 별도 메모리 DB·임의 포트·임시 기록으로 검사합니다. 두 실행을 동시에 돌려 데이터가 섞이지 않는지도 확인합니다. Node/Python 의존성 설치는 필요하지만 Docker와 외부 DB는 필요하지 않습니다. 브라우저 클릭 검사는 포함하지 않습니다.

병렬 구현은 앱·기능별 폴더로 나눕니다. UI 기능은 `apps/{app,www}/src/features/<기능>`에 두고, 백엔드는 domain의 기능 파일 및 대응 infra·테스트 파일을 담당합니다. API 계약·생성 코드·공유 UI·migration·package/lockfile·진입점 연결은 한 담당자가 통합합니다. Git worktree는 이러한 경계와 실행별 자원 분리로 해결되지 않을 때만 고려합니다.

ORM 필드 추가 → `db:revision -- --message "change" --autogenerate` → migration 검토·적용 → 라우트 추가의 실행 예제는 [생성 프로젝트 안내](templates/monorepo/README.md#모델에서-api까지-확장하기)에 있습니다. OpenAPI는 수동 명세 대신 실제 FastAPI 앱에서 생성하며 export는 DB에 접속하지 않습니다. 구성 근거: [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/), [SQLAlchemy declarative models](https://docs.sqlalchemy.org/en/20/orm/declarative_tables.html).
