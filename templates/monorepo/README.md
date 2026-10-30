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
# 다른 터미널: npm run dev:app 또는 npm run dev:www
```

pnpm을 선택했다면 위의 npm 대신 pnpm을 사용합니다. `npm run ui:add -- card`로 shadcn 컴포넌트를 추가합니다.
`packages/jwdesign`은 실제 디자인 자산, `packages/ui`는 공유 UI, `packages/api`는 계약과 Orval 생성물을 보관합니다.
backend의 domain에는 순수 함수, infra에는 HTTP와 명세 export가 있습니다. Python 예제를 다른 언어로 교체할 때 proofstill.config.json의 exporter argv 또는 url/file을 변경합니다.

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
| `test:unit` | 메모리 DB의 도메인·SQL 제약·migration·seed 검사 |
| `test:integration` | seed를 적용한 메모리 DB의 실제 HTTP 검사 |
| `test:fast` | unit + integration, Docker 불필요 |
| `test:e2e` | PostgreSQL Testcontainers + 실제 HTTP flow + DB 값·지속성·정리 검사 |
| `db:revision -- --message "change"` | migration 생성, `--autogenerate` 지원 |
| `db:migrate` | migration 적용, `--revision`으로 목표 지정 |
| `db:status` | 현재·최신·미적용 revision 확인 |
| `db:rollback` | 한 단계 되돌리기, `--revision` 지정 가능 |
| `db:seed` | 고정 seed의 누락 ID 추가, 기존 수정값 보존 |
| `db:reset -- --yes` | 대상 DB의 전체 downgrade → upgrade → seed |

관리용 db:revision/migrate/status/rollback/seed/reset은 `DATABASE_URL`을 명시해야 합니다. 예를 들어 `export DATABASE_URL='sqlite+pysqlite:///./dev.sqlite'`로 별도 개발 DB를 지정합니다(상대 경로는 apps/backend 기준). PostgreSQL은 `postgresql+psycopg://…` URL을 사용합니다. `db:reset -- --yes`는 대상 DB 데이터를 제거합니다.

기본 서버는 매번 SQLite :memory:에 같은 Alembic migration과 `seed/tasks.json`을 적용합니다. 외부 DATABASE_URL을 지정한 서버는 최신 스키마인지 확인하며 자동으로 migration/seed를 수행하지 않습니다. 먼저 db:migrate와 db:seed를 실행합니다. test:unit/integration/fast와 db:check는 외부 DB 설정을 무시합니다.

test:e2e는 메모리 DB의 unit/integration을 먼저 실행하고 통과한 경우에만 컨테이너 단계로 진행합니다. E2E는 실행 중인 Docker가 필요합니다. Testcontainers가 임시 PostgreSQL을 만들고 migration·seed, 실제 API 사용자 흐름, SQL 행 일치와 서버 재시작 지속성까지 확인한 뒤 컨테이너를 제거합니다. Docker 오류는 실패이며 메모리 DB로 대체하거나 건너뛰지 않습니다. 성공 결과는 `.proofstill/test-results/e2e.json`에 남고, 다음 E2E 시작 시 오래된 결과를 제거합니다. 브라우저 클릭은 이 API E2E의 범위에 포함하지 않습니다.
