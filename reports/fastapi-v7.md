# FastAPI + SQLAlchemy ORM 기본 백엔드 — 기능 개발 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 그럼 백엔드를 FastAPI 템플릿으로 바꿔줘. 기존 DB랑 OpenAPI, 테스트 구성도 그대로 연결되게 해줘. alchemy 인가 orm 도 같이 넣어서 하네스 사용자가 쉽게 개발을 시작할 수 있어야 함.
- 업무 맥락: 명확한 요청으로 추가 인터뷰 결정 없음. SQLAlchemy Core 기반 기본 Python http.server를 FastAPI + SQLAlchemy 2 ORM 모델·Session으로 교체한다. 기존 API operationId/정상 상태/400 입력 오류/404/health 연결, SQLite memory migration+seed 격리, 외부 DB 명시적 migration/seed, PostgreSQL Testcontainers E2E, npm/pnpm DB 명령·API Tracker 소유권/시작/종료/HTTP 기록을 유지한다. 실제 FastAPI app.openapi()를 서버/오프라인 export/Orval에 연결하고 DB 연결 없이 export한다. backend:setup의 전용 가상환경을 exporter도 사용한다. /docs와 /redoc 기본 제공, README에 모델/스키마/라우트/마이그레이션 시작법을 제공한다. UI 변경·외부 공개 릴리스는 요청 범위 밖. 생성 예제와 로컬 tgz는 갱신한다. 테스트 fixture는 Session 생성/종료에 맞게 갱신하되 원래 DB 검증을 보존한다. 공개 릴리스 업로드 없이 로컬 소스·tgz를 갱신한다. 버전 번호 결정은 구현 방법이며 사용자 수용 기준이 아니다.
- 명령 실행 위치: `/private/tmp/proofstill-fastapi-work-20261031`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/plan.json)
- 기준 버전: `97aa667b878247f0b27660adbfcd625df8a5824bddde49031a5d332d69e325dd`
- 소스 버전: `4213d0d5a85025f35cef0b6c8d0b2abb736fff76d5db6362bb2a8a60a2eff967`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: 기본 scaffold가 FastAPI+Uvicorn이며 typed request/response, /docs·/redoc를 제공하고 기존 task/health 동작·400/404·소유권을 유지한다. 잘못된 JSON/타입·큰 body를 거부하고 memory 서버와 동시 요청이 격리된다. | 자동 검사 통과 | [api](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/d2698687d098/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/0835d845b927/output.log) |
| R2: SQLAlchemy 2 declarative Task 모델과 Session CRUD/rollback이 실제 ORM으로 동작하고 기존 SQL 제약·Alembic metadata·migration/seed/DB 명령을 유지한다. 개발용 model→migration→endpoint 경로를 안내한다. | 자동 검사 통과 | [orm](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/3f05f1af7ac8/output.log), [database](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/4ee289f49850/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/0835d845b927/output.log) |
| R3: 명세는 실제 FastAPI 라우트에서 자동 생성하며 앱 import/export가 DB를 열지 않는다. managed Python에서 export하고 서버 openapi.json·contract와 일치하며 route 변경→export→Orval 생성이 연결된다. | 자동 검사 통과 | [api](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/d2698687d098/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/0835d845b927/output.log) |
| R4: npm/pnpm 설치·빌드·타입 검사·메모리 unit/integration·실제 PostgreSQL Testcontainers E2E·API Tracker lifecycle/flow/기존 하네스 검사가 통과하고 새 파일·고정 의존성이 로컬 tgz에 포함된다. Docker 오류는 실패하고 stale E2E 결과를 제거한다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/4ee289f49850/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/0835d845b927/output.log), [harness](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/badd44bed267/output.log) |

## 재현 명령과 검사 결과

### orm · unit · orm

```sh
python3 -m unittest discover -s tests/bootstrap -p test_fastapi.py -k orm_models -v
```

- Red: 현재 버전에서 무효 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/6e34432e66b6/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/6e34432e66b6/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/3f05f1af7ac8/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/3f05f1af7ac8/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_fastapi.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/backend_support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-requirements.txt)
### api · integration · api

```sh
python3 -m unittest discover -s tests/bootstrap -p test_fastapi.py -k fastapi_lifespan -v
```

- Red: 현재 버전에서 무효 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/d236fbb9ba6b/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/d236fbb9ba6b/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/d2698687d098/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/d2698687d098/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_fastapi.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/backend_support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-requirements.txt)
### database · integration · database

```sh
python3 tests/bootstrap/run_database_checks.py
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/4ee289f49850/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/4ee289f49850/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_database.py)
- [테스트 test_postgres.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/e2e/test_postgres.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/run_database_checks.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/backend_support.py)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-fixtures/test_database.py)
- [테스트 test_e2e.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-fixtures/test_e2e.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-fixtures/test_http.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-requirements.txt)
### bootstrap · integration · bootstrap

```sh
python3 -m unittest discover -s tests/bootstrap -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/0835d845b927/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/0835d845b927/result.json)
- [테스트 api-skill.md](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/api-skill.md)
- [테스트 assets.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/assets.json)
- [테스트 backend_support.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/backend_support.py)
- [테스트 database.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/database.json)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-fixtures/test_database.py)
- [테스트 test_e2e.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-fixtures/test_e2e.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-fixtures/test_http.py)
- [테스트 db-requirements.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/db-requirements.txt)
- [테스트 distribution.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/distribution.json)
- [테스트 test_postgres.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/e2e/test_postgres.py)
- [테스트 fastapi.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/fastapi.json)
- [테스트 feature.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/feature.json)
- [테스트 run_database_checks.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/run_database_checks.py)
- [테스트 single-flow.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/single-flow.json)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_database.py)
- [테스트 test_fastapi.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_fastapi.py)
- [테스트 test_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_flow.py)
- [테스트 test_install.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_install.py)
- [테스트 test_memory_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_memory_flow.py)
- [테스트 test_openapi.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_openapi.py)
- [테스트 test_scaffold.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/test_scaffold.py)
- [테스트 tracker-input-contract.ts](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/tracker-input-contract.ts)
- [테스트 tracker.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/bootstrap/tracker.json)
### harness · unit · harness

```sh
python3 -m unittest discover -s tests -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/badd44bed267/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/runs/badd44bed267/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_contract.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_order_workspace.py)
- [테스트 test_parallel_work.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_parallel_work.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_report.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/unit/test_trace_view.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/integration/test_state_lifetime.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/tests/__init__.py)

## 독립 리뷰

- 사전 기준 검토 · 선택: 현재 버전에서 무효 · 세션 `미확인` · 실행기 `codex`
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/criteria-6e6d738511ca/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/criteria-6e6d738511ca/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/criteria-6e6d738511ca/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/criteria-6e6d738511ca/manifest.json)
- 기준·구현 최종 검토: 통과 · 세션 `01a18f55-12a1-7630-80d4-a13bcab0343b` · 실행기 `/Users/jwsong/tools/proofstill/.proofstill/work/fastapi-review`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/implementation-3fc02a53b3dd/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/implementation-3fc02a53b3dd/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/implementation-3fc02a53b3dd/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/implementation-3fc02a53b3dd/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/.proofstill/evidence/fastapi-v7/reviews/implementation-3fc02a53b3dd/manifest.json)
  - R1: pass — api 및 bootstrap 직접 실행 통과. FastAPI/Uvicorn, typed schema, /docs·/redoc, 400/404, 소유권, malformed/oversized body, 32개 동시 요청 및 memory DB 격리를 확인했다.
  - R2: pass — orm, database, bootstrap 직접 실행 통과. SQLAlchemy 2 declarative model, Session CRUD/rollback, 제약조건, Alembic metadata, migration/seed/reset, npm·pnpm 명령과 README 개발 경로를 확인했다.
  - R3: pass — api 및 bootstrap 직접 실행 통과. app.openapi() 기반 생성, DB 미접속 import/export, managed Python exporter, 서버 명세·contract 일치, route 변경과 export/codegen 연결을 확인했다.
  - R4: pass — database 4 tests, bootstrap 29 tests, harness 83 tests 모두 OK. PostgreSQL Testcontainers, 설치/build/type/codegen, API Tracker flow, npm·pnpm 및 tgz 설치 검사가 포함됐다. tgz에서 새 backend 파일과 고정 requirements 포함도 확인했다.

## 구현·아티팩트

- [FastAPI 앱](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/templates/monorepo/apps/backend/infra/app.py)
- [ORM 모델](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/templates/monorepo/apps/backend/infra/models.py)
- [시작 안내](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/templates/monorepo/README.md)
- [로컬 패키지](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/dist/digitalpresso-proofstill-0.3.0.tgz)

## 한계·남은 사항

- 로컬 개발 템플릿이며 공개 GitHub 릴리스 업로드는 수행하지 않는다.
- API/DB E2E이며 실제 브라우저 클릭과 운영 배포는 범위 밖. Python 3.10+ 호환 의존성을 고정하되 실제 검증 환경은 macOS Node24 Python3.14이다.
- 실제 브라우저 클릭과 운영 배포는 지정 범위 밖이라 검증하지 않았다.
- 검증 환경은 현재 macOS/Python 3.14/Node 24이며 다른 지원 플랫폼의 실행은 직접 확인하지 않았다.
- manifest 전체 파일 해시를 재확인했으며 불일치는 없었다. PASS는 전달된 기준과 실행 범위에 한정된다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.

## 실제 저장소와 전역 runtime 연결

백엔드 구현·테스트·DB 명령 스크립트·스캐폴더·OpenAPI 계약은 검증 작업본, 실제 저장소, 전역 runtime에서 바이트가 같습니다. 다른 작업에서 변경 중인 하네스 내부·스킬·README·패키지 메타데이터 전체의 동등성을 주장하지 않습니다. [파일 비교](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/backend-match.json).

실제 저장소에서 강화된 메모리 flow 검사 3개를 추가 실행해 통과했습니다. [실행 로그](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/workspace-memory-flow.log). 전역 runtime의 기존 setup 명령과 0.4.0 버전을 보존하면서 FastAPI 템플릿을 반영했습니다. 전역 CLI로 새 프로젝트를 생성하고 의존성 설치·OpenAPI/Orval 생성·test:fast·build·typecheck를 실행해 통과했습니다. [설치 로그](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/installed-scaffold.log), [검사 로그](/Users/jwsong/tools/proofstill/.proofstill/validation/fastapi-v7/installed-checks.log).
