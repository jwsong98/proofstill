# 생성된 프로젝트

Node 22.18+, Python 3.10+, 독립 리뷰용 로그인한 Codex CLI가 필요합니다.

```sh
npm install
npm run backend:setup
npm run openapi:export
npm run api:generate
npm run build
npm run typecheck
npm run dev:backend
# 다른 터미널: npm run dev:app
```

pnpm을 선택했다면 위의 npm 대신 pnpm을 사용합니다. `npm run ui:add -- card`로 shadcn 컴포넌트를 추가합니다.
`packages/jwdesign`은 실제 디자인 자산, `packages/ui`는 공유 UI, `packages/api`는 계약과 Orval 생성물을 보관합니다.
백엔드는 FastAPI + Uvicorn + SQLAlchemy 2 ORM입니다. `npm run dev:backend` 실행 후 [Swagger UI](http://127.0.0.1:8000/docs)와 [ReDoc](http://127.0.0.1:8000/redoc)에서 API를 확인합니다.
백엔드의 import 방향은 `app → usecase → domain`, `infra → domain`입니다.

- `domain/tasks.py`: 업무 규칙과 저장소 계약 `TaskStore`. 프레임워크를 사용하지 않습니다.
- `usecase/tasks.py`: 계약을 통해 등록·완료·조회를 실행합니다.
- `app/tasks.py`, `app/health.py`: HTTP 핸들러. `app/schemas.py`는 요청·응답 타입, `app/http.py`는 공통 HTTP 설정을 담당합니다.
- `infra/task_repository.py`: `TaskStore`의 SQLAlchemy 구현. `infra/models.py`는 ORM 모델입니다.
- `infra/app.py`: 저장소를 유스케이스에 주입하고 HTTP 앱과 DB 수명을 연결하는 조립 진입점입니다.

`npm run test:architecture`가 역방향 의존과 순환 참조를 거부합니다. 동적 import의 모든 형태나 파일 접근을 격리하는 보안 장치는 아닙니다.

## TDD와 병렬 작업

업무 규칙이나 동작을 추가할 때 담당 테스트를 먼저 작성하고 기대한 실패(Red)를 확인합니다. 구현으로 Green을 만든 뒤 중복을 정리하고 관련 검사를 다시 실행합니다.

```sh
npm run test:domain
npm run test:usecase
npm run test:usecase -- tests.usecase.test_tasks.TaskListTests.test_create_update_get
npm run test:architecture
npm run test:fast
```

`apps/backend`에서 `python3 -S -m unittest discover -s tests/domain -v`와 `tests/usecase`를 실행하면 DB·웹 패키지 없이 순수 계층을 검사합니다. usecase 테스트의 `MemoryTaskStore`는 실행별 인스턴스를 사용합니다. DB 구현은 같은 domain 계약과 실제 SQL·HTTP 검사로 확인합니다.

기능 담당자는 자신의 domain/usecase/app/infra 기능 파일과 대응 테스트만 수정합니다. 계층별로 나누면 domain 계약을 먼저 확정하고 저장소 구현과 HTTP 구현은 가짜 저장소를 기준으로 진행합니다. 공유 계약·조립 진입점·migration·lockfile·생성 코드는 한 담당자가 순차 통합합니다. `infra/app.py`에 기능별 라우트나 업무 규칙을 추가하지 않습니다.
OpenAPI는 같은 FastAPI 앱의 `app.openapi()`에서 생성합니다. `openapi:export`는 `backend:setup`으로 설치한 전용 Python을 사용하며 DB 접속이나 서버 실행이 필요 없습니다. Python을 교체할 때는 `PROOFSTILL_BACKEND_PYTHON`에 실행 파일 경로를 지정합니다. 다른 언어의 서버는 proofstill.config.json의 exporter argv 또는 url/file을 변경합니다.

## 모델에서 API까지 확장하기

예를 들어 할 일에 메모를 추가하려면 먼저 별도 개발 DB를 준비합니다. 상대 경로는 `apps/backend` 기준입니다.

```sh
export DATABASE_URL='sqlite+pysqlite:///./dev.sqlite'
npm run db:migrate
```

`infra/models.py`의 `Task` 클래스 안에 `note: Mapped[str | None] = mapped_column(nullable=True)`를 추가하고 아래 명령으로 변경을 적용합니다. 생성된 migration의 SQL을 확인한 뒤 적용하세요.

```sh
npm run db:revision -- --message "add note" --autogenerate
npm run db:migrate
npm run db:seed
```

필드를 API에 노출할 때는 domain의 `TaskData`와 규칙 → usecase 테스트 → `infra/task_repository.py`의 ORM 변환 → `app/schemas.py`의 요청·응답을 함께 맞춥니다. 새 행동은 `app/<기능>.py`에 두고 `app/http.py`에서 등록합니다. DB를 HTTP 핸들러에서 직접 조회하지 않고 domain의 저장소 계약과 usecase를 거칩니다. 필드 추가 후 기존 `/tasks/seed-planning` 조회가 유지되는지는 `test:fast`로 확인합니다.

`npm run dev:backend`로 서버를 시작해 `/docs`에서 확인하고 `npm run openapi:export`, `npm run api:generate`, `npm run test:fast`로 명세·클라이언트·테스트를 갱신합니다. 받아들인 API 변경은 확인 후 `packages/api/openapi.contract.json`에 반영합니다. 자동 재시작이 필요하면 `apps/backend`에서 `.venv/bin/python -m uvicorn infra.app:app --reload`를 사용할 수 있습니다.

```sh
npm run api:tracker -- env prepare --generate-spec
npm run api:tracker -- spec compare
npm run api:tracker -- flow validate
npm run api:tracker -- flow show
npm run api:tracker -- flow run
npm run api:tracker -- flow show
npm run api:tracker -- env stop
```

`.api-tracker/flow.yaml`에는 하나의 사용자 목표와 순서 있는 steps를 작성합니다. 예제는 **할 일 등록 → 완료 처리 → 저장 결과 확인**입니다. 각 단계는 사용자 행동(title), 목적(description), 기대 결과(expected), operationId와 입력·기대 응답을 가집니다. 앞선 응답의 ID는 `{"from":"create_task","pointer":"/id"}`로 자동 연결합니다.

`flow step create_task`는 다음 단계만 실행합니다. `flow run`은 남은 단계를 실행하며 완료한 단계는 반복하지 않습니다. 실패 시 후속 호출을 중단하고 `flow show`에 설명과 실제 요청·응답·출처를 표시합니다. 서버 처리 결과를 확인한 뒤 `flow retry`로 실패한 단계만 재시도합니다. 기록은 `.api-tracker/flow-record.json` 하나에 남습니다.

`flow reset`은 로컬 기록만 초기화하고 서버 데이터를 되돌리지 않습니다. 기본 할 일 데이터는 서버 메모리에 있어 재시작하면 사라집니다. 정의·명세·서버를 바꿨으면 기록을 확인한 뒤 초기화하세요. 강제 종료 후 잠금 파일이 남으면 실행 프로세스 종료를 확인한 뒤 제거합니다.

backend를 선택하지 않은 스캐폴드는 계약 파일을 export하며 tracker의 서버 설정은 생성하지 않습니다. 외부 서버는 flow의 baseUrl과 spec 경로를 설정하고 API 스킬의 steps 형식을 참고합니다.
`.proofstill-runtime`은 npm에 아직 공개하지 않아도 설치본을 재현할 수 있도록 포함한 하네스 배포본입니다. 소스 관리에 함께 넣습니다.

## DB 명령과 검증 단계

`npm run backend:setup`으로 Python 의존성을 전용 `.venv`에 설치합니다. `scaffold --install`은 이 과정도 실행합니다. 아래 명령은 npm/pnpm 모두 사용할 수 있습니다.

| 명령 | 동작 |
|---|---|
| `backend:setup` | Python 가상환경과 고정 의존성 설치 |
| `db:check` | SQLite `:memory:`에서 실제 migration·seed 검사 |
| `test:architecture` | import 방향·순환 참조 검사 |
| `test:domain` | 프레임워크 없는 업무 규칙 검사, 단일 테스트 선택 지원 |
| `test:usecase` | 가짜 저장소 기반 동작 검사, 단일 테스트 선택 지원 |
| `test:unit` | architecture/domain/usecase 뒤 메모리 DB의 SQL 제약·migration·seed 검사 |
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

## 개발과 최종 리뷰

`init <기능 정의 JSON>` → 구현 및 `test <ID>` → `review <ID>` → `report <ID>` 순서로 진행합니다. test는 기본 Green, review는 기준 적절성과 구현을 함께 보는 최종 독립 리뷰입니다. 사전 criteria 리뷰와 Red 검사는 선택 사항입니다. 테스트 파일을 고치면 같은 작업에서 다시 검사하며 이전 결과는 현재 버전의 근거가 되지 않습니다.

리뷰는 원본 프로젝트를 읽고 대상 경로·해시만 보존합니다. 코드 복사본을 만들지 않으며, 리뷰 중 담당 소스나 테스트가 바뀌면 판정을 무효화합니다. 같은 작업 ID의 명령은 동시에 쓰지 못하게 잠그고, 서로 다른 작업은 담당 sources와 공유 의존성 범위로 검사합니다.

개발 중 `npm run test:integration` 또는 `npm run test:flow`, 통합 시 `npm run test:fast`를 사용합니다. flow 검사는 할 일 등록 → 완료 처리 → 재조회 CLI 흐름을 실행마다 별도 메모리 DB·임의 포트·임시 기록으로 검사합니다. 두 실행을 동시에 돌려 데이터가 섞이지 않는지도 확인합니다. Node/Python 의존성 설치는 필요하지만 Docker와 외부 DB는 필요하지 않습니다. 브라우저 클릭 검사는 포함하지 않습니다.

병렬 구현은 앱·기능별 폴더로 나눕니다. UI 기능은 `apps/app/src/features/<기능>`에 두고, 백엔드는 domain의 기능 파일 및 대응 infra·테스트 파일을 담당합니다. API 계약·생성 코드·공유 UI·migration·package/lockfile·진입점 연결은 한 담당자가 통합합니다. Git worktree는 이러한 경계와 실행별 자원 분리로 해결되지 않을 때만 고려합니다.

## JWT 인증 기반

백엔드 선택 시 `npm run backend:setup` 후 `npm run auth:setup`을 실행합니다.
루트 `.env.example`을 `.env`로 복사해 설정할 수 있으며, auth:setup은 비어 있는
`JWT_SECRET_KEY`에 무작위 키를 생성하고 기존 키·다른 설정은 보존합니다. 생성한
`.env`는 커밋하지 않습니다. `JWT_TTL_SECONDS` 기본값은 3600초입니다.
루트 `.env`는 npm/pnpm 백엔드 명령에서 읽으며, 기존 환경 변수가 우선합니다.

로그인 처리에서 자격 확인을 마친 뒤 토큰을 발급합니다. 사용자 데이터 구조는
고정하지 않으며 `data` 객체에 보존합니다. 공통 `iat`·`exp`는 발급기가 관리하고
검증은 HS256 서명과 만료를 필수 확인합니다.

```python
from fastapi import Depends
from infra.auth import TokenService, require_token

# 로그인 서비스에서 자격 확인을 마친 후 호출합니다.
token = TokenService.from_env().issue({'user_id': 'your-user-id'})
data = TokenService.from_env().verify(token)

# create_app 안에서 보호할 라우트에 적용합니다.
@app.get('/account')
def account(data=Depends(require_token)):
    return data
```

요청은 `Authorization: Bearer <token>`을 사용합니다. 잘못되거나 만료된 토큰은
401, 키 설정 누락은 503입니다. 이 기반에는 계정 저장·비밀번호 검사·로그인 API·
refresh/revoke 정책이 포함되지 않습니다. 기존 예제 API는 공개 상태이며 필요한
라우트에 의존성을 붙여 보호합니다. JWT 데이터는 암호화되지 않으므로 비밀번호나
비밀 키를 payload에 넣지 않습니다.

## 프런트엔드와 API 연결

`npm run dev:backend`와 `npm run dev:app`을 각각 실행하면 앱은
`http://127.0.0.1:5173`, API는 `http://127.0.0.1:8000`에서 시작합니다.
생성 클라이언트는 기본 `/api`를 사용하고 Vite가 모든 `/api/*` 요청을 백엔드로
전달합니다. `/health`도 기존처럼 직접 프록시합니다.

루트 `.env.example`을 `.env`로 복사하고 주소를 변경할 수 있습니다.

| 설정 | 기본값 / 용도 |
|---|---|
| `VITE_API_BASE_URL` | `/api`; 별도 서버에 직접 연결할 때 `https://api.example.com` 등으로 변경 |
| `BACKEND_URL` | `http://127.0.0.1:8000`; 개발 프록시의 전달 대상 |
| `CORS_ORIGINS` | localhost·127.0.0.1의 5173/4173 포트; 허용할 출처를 쉼표로 구분, 빈 값은 교차 출처 허용 안 함 |
| `CORS_ALLOW_CREDENTIALS` | `false`; 교차 출처 쿠키 인증을 사용할 때만 `true` |

앱을 배포할 때 `/api`를 사용하려면 배포 서버에도 해당 경로의 역방향 프록시가
필요합니다. 또는 `VITE_API_BASE_URL`을 실제 API 주소로 바꾸고 API의
`CORS_ORIGINS`에 앱의 정확한 출처를 지정합니다. `.env` 변경 후 개발 서버를
재시작하고 배포 빌드는 다시 만듭니다. Vite preview에는 개발 프록시가 없습니다.

생성 함수에 요청별 인증 헤더를 넘길 수 있습니다. 토큰 보관 방식은 앱에서 정합니다.

```ts
import { createTask, getTask } from '@proofstill/api';

const result = await createTask({ title: '첫 기능' }, {
  headers: { Authorization: `Bearer ${token}` },
});
if (result.status === 201) {
  const saved = await getTask(result.data.id);
}
```

JSON·Authorization 헤더와 GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS를 허용합니다.
허용 출처는 `*` 대신 명시하고, CORS는 API의 JWT 인증을 대신하지 않습니다.
쿠키를 사용할 경우 요청의 `credentials: 'include'`도 앱에서 지정합니다.
