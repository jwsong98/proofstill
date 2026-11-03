# DB migration 명령과 메모리·컨테이너 검증 — 기능 개발 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: Db migration 등등 필요한 기능이 다 명령어로 셋팅 되어 있어야 해. 그리고 실제 e2e 전까지는 메모리 db + seed 데이터로 검증이 되어야 하고 e2e는 테스트컨테이너 기반 테스트가 가능해야 함
- 업무 맥락: 기존 Python 백엔드·단일 API flow를 확장한다. 메모리 객체 대신 SQLAlchemy SQLite :memory: DB와 고정 seed를 사용한다. Alembic migration/revision/status/rollback/seed/reset/check, backend:setup, test:unit/integration/fast/e2e를 npm/pnpm 명령으로 제공한다. 개발 기본 서버와 빠른 검사는 매번 memory DB에 실제 migration과 seed를 적용한다. 외부 DATABASE_URL은 빠른 검사가 사용하지 않는다. 관리용 DB 명령은 사용자가 DATABASE_URL을 명시해야 하며 reset은 --yes가 필요하다. E2E는 기존 실제 HTTP API 사용자 흐름을 기본 범위로 해석한다. 브라우저 범위는 선호 질문을 보냈으나 답변은 없으며, 브라우저 클릭/화면 구현을 이번 확정 동작으로 간주하지 않는다. PostgreSQL Testcontainer에 실제 migration과 seed를 적용하고 같은 HTTP/flow/DB 값·서버 재시작 지속성·downgrade/upgrade·컨테이너 정리를 검사한다. Docker가 없으면 E2E 실패이고 skip/memory fallback/오래된 성공 보고를 허용하지 않는다. SQLAlchemy 2.0.55/Alembic 1.20.1/psycopg 3.3.6/testcontainers 4.15.0을 고정하며 의존성 전체를 requirements fixture에 고정한다. userenv SDK/engine 준비는 backend:setup 및 Docker를 요구한다. package 0.3.0 실제 전달 tgz를 새 npm pack과 바이트 비교해 별도 설치한다. 이번 신규 명령은 backend를 포함한 scaffold에 적용한다. 공개 npm 업로드는 별도 결정이다. v5 실행에서 검사용 Alembic MagicMock이 라이브러리 metaclass와 충돌해 migration까지 도달하지 못한 오류를 발견했다. 동일 실패를 실제 함수로 주입하도록 고쳤다. pnpm 명령은 npm으로 설정된 프로젝트가 아닌 pnpm으로 생성한 독립 프로젝트에서 검사한다. 빠른 유지보수 flow/install fixture도 외부 DATABASE_URL을 사용하지 않도록 고정했다. assertion/기능 범위는 완화하지 않았다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/plan.json)
- 기준 버전: `bd23d1ab0636cfd6b22efb025351d8b325a8e79f5ada992c8ebb36061cebb47d`
- 소스 버전: `6fc18044ee71c85155dcfea4ca0c4898ff8ace5bd29e876a022e7c1cd532523e`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: npm/pnpm에서 backend:setup, db:revision/migrate/status/rollback/seed/reset/check, test:unit/integration/fast/e2e를 실제 실행할 수 있다. 관리용 URL 누락/잘못된 revision/reset 확인 누락은 실패한다. 생성 revision SQL을 실제 upgrade/downgrade한다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b80e3fc39139/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b3fe011e2a0a/output.log) |
| R2: E2E 전 단위·통합 검사는 실제 SQLite :memory: DB에서 Alembic migration과 고정 seed를 적용한다. seed 재적용은 중복/기존 수정 덮어쓰기를 만들지 않으며 DB/서버 간 격리, 실제 SQL 제약/서비스 검증, HTTP 상태/값, migration 실패 후 버전 미진행을 확인한다. 외부 DATABASE_URL에 의존하지 않는다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b80e3fc39139/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b3fe011e2a0a/output.log) |
| R3: E2E 명령은 실제 PostgreSQL Testcontainer를 띄워 같은 migration/seed를 적용한다. 실제 HTTP 단일 flow 출력과 PostgreSQL 행의 일치, 재시작 후 지속성, downgrade/upgrade와 종료 후 컨테이너 제거를 확인한다. Docker 오류를 실패로 보고하고 메모리 fallback이나 오래된 성공 보고를 남기지 않는다. | 자동 검사 통과 | [database](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b80e3fc39139/output.log) |
| R4: DB 코드·migration·seed·테스트·설치 의존성·사용 안내가 0.3.0 tgz에 포함된다. 전달 tgz와 새 pack의 일치, 별도 npm/pnpm 설치·빌드·빠른 DB검사, 기존 API flow/OpenAPI/하네스 회귀를 확인한다. domain이 infra를 import하지 않는 경계를 유지한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b3fe011e2a0a/output.log), [regression](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/203f41506d7f/output.log) |

## 재현 명령과 Red → Green

### database · integration · database

```sh
python3 tests/bootstrap/run_database_checks.py
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/c42e045499f0/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/c42e045499f0/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b80e3fc39139/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b80e3fc39139/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/test_database.py)
- [테스트 test_postgres.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/e2e/test_postgres.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/run_database_checks.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/backend_support.py)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-fixtures/test_database.py)
- [테스트 test_e2e.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-fixtures/test_e2e.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-fixtures/test_http.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-requirements.txt)
### bootstrap · integration · bootstrap

```sh
python3 -m unittest discover -s tests/bootstrap -v
```

- Red: 기존 회귀 검사로 생략
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b3fe011e2a0a/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/b3fe011e2a0a/result.json)
- [테스트 api-skill.md](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/api-skill.md)
- [테스트 assets.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/assets.json)
- [테스트 backend_support.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/backend_support.py)
- [테스트 database.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/database.json)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-fixtures/test_database.py)
- [테스트 test_e2e.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-fixtures/test_e2e.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-fixtures/test_http.py)
- [테스트 db-requirements.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/db-requirements.txt)
- [테스트 distribution.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/distribution.json)
- [테스트 test_postgres.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/e2e/test_postgres.py)
- [테스트 feature.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/feature.json)
- [테스트 run_database_checks.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/run_database_checks.py)
- [테스트 single-flow.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/single-flow.json)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/test_database.py)
- [테스트 test_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/test_flow.py)
- [테스트 test_install.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/test_install.py)
- [테스트 test_openapi.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/test_openapi.py)
- [테스트 test_scaffold.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/test_scaffold.py)
- [테스트 tracker-input-contract.ts](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/tracker-input-contract.ts)
- [테스트 tracker.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/bootstrap/tracker.json)
### regression · unit · regression

```sh
python3 -m unittest discover -s tests -v
```

- Red: 기존 회귀 검사로 생략
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/203f41506d7f/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/runs/203f41506d7f/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_contract.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_order_workspace.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_report.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/unit/test_trace_view.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/integration/test_state_lifetime.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/tests/__init__.py)

## 독립 리뷰

- 기준 적절성: 통과 · 세션 `01a18de1-9b3d-7b43-96ad-698009742bb9` · 실행기 `/Users/jwsong/tools/proofstill/.proofstill/work/database-review`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/criteria-9fa45da2ea41/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/criteria-9fa45da2ea41/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/criteria-9fa45da2ea41/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/criteria-9fa45da2ea41/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/criteria-9fa45da2ea41/snapshot/manifest.json)
  - R1: pass — database/bootstrap 기준이 npm·pnpm 양쪽 명령을 실행하고, DATABASE_URL 누락, unknown revision, reset --yes 누락을 거부한다. 생성 revision에 실제 create/drop SQL을 넣어 upgrade/downgrade 결과를 SQLite 테이블로 확인한다. database 모듈 실행은 구현 부재 상태에서 DATABASE_BOOTSTRAP_MISSING으로 정확히 Red였다.
  - R2: pass — database 기준은 실제 SQLite :memory: migration/seed, 재시드 후 사용자 수정 보존, DB·서버 격리, SQL 제약, 서비스 검증, HTTP 201/200/400/404와 재조회, migration 실패 후 revision 미진행을 검사한다. 잘못된 외부 DATABASE_URL을 주입한 npm·pnpm unit/integration/fast/db:check도 포함한다.
  - R3: pass — database 모듈의 E2E 기준은 PostgreSQL 17 Testcontainer에서 migration/seed, 실제 HTTP flow와 PostgreSQL 행 일치, 서버 재시작 지속성, downgrade/upgrade, 컨테이너 제거를 검사한다. 잘못된 DOCKER_HOST 실행이 실패하고 기존 성공 JSON과 성공 표식을 남기지 않는지도 확인한다. 현재 실행은 E2E 구현 부재를 DATABASE_E2E_MISSING으로 정확히 Red 처리했다.
  - R4: pass — bootstrap 기준은 distribution manifest로 DB domain/infra/migration/seed/unit/integration/e2e/requirements 포함을 고정하고, 전달 tgz와 새 npm pack을 바이트 비교한다. 별도 npm·pnpm 프로젝트에서 설치, backend:setup, test:fast, db:check, OpenAPI/codegen/build/typecheck와 실제 API flow를 실행한다. AST 기반 domain import 허용 목록으로 infra 의존을 거부한다. regression 모듈을 직접 실행해 79 tests, OK를 확인했다.
- 구현: 통과 · 세션 `01a18dea-4e75-7070-9f23-1b2155755c6f` · 실행기 `/Users/jwsong/tools/proofstill/.proofstill/work/database-review`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/implementation-894e23984598/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/implementation-894e23984598/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/implementation-894e23984598/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/implementation-894e23984598/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/reviews/implementation-894e23984598/snapshot/manifest.json)
  - R1: pass — database 모듈 직접 실행: `python3 tests/bootstrap/run_database_checks.py` — 4 tests, 49.432s, OK. npm/pnpm 양쪽에서 전체 DB/테스트 명령을 실행했으며, DATABASE_URL 누락·unknown revision·reset의 --yes 누락 실패와 생성 revision의 실제 table upgrade/downgrade를 확인했다. bootstrap 모듈도 22 tests, 83.240s, OK.
  - R2: pass — database 모듈에서 SQLite :memory: migration/고정 seed, seed 재적용 시 수정값 보존, DB·서버 격리, SQL 제약, 서비스 검증, HTTP 상태·값, migration 실패 후 revision 미진행을 실행 확인했다. 잘못된 외부 DATABASE_URL을 주입한 npm/pnpm test:unit/integration/fast 및 db:check도 통과했다.
  - R3: pass — database 모듈의 Testcontainers 검사가 npm/pnpm 각각 실제 PostgreSQL 17 컨테이너를 실행했다. migration/seed, 실제 HTTP 3단계 flow와 SQL 행 일치, 서버 재시작 후 지속성, downgrade/upgrade, 종료 후 container NotFound를 확인했다. 잘못된 DOCKER_HOST에서는 실패하고 기존 e2e.json이 제거됨도 확인했다.
  - R4: pass — bootstrap 모듈 22 tests, 83.240s, OK; regression 모듈 `python3 -m unittest discover -s tests -v` — 79 tests, 9.536s, OK. 새 npm pack과 전달된 0.3.0 tgz의 바이트 일치, 별도 npm/pnpm 설치, backend setup, 빠른 DB 검사, build/typecheck, 기존 API flow/OpenAPI/하네스 회귀가 통과했다. domain 디렉터리의 infra import가 없으며 requirements fixture와 패키지 requirements가 동일하다. 검토 후 snapshot manifest 478개 항목의 해시 불일치는 0개였다.

## 구현·아티팩트

- [사용법](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/README.md)
- [DB와 E2E npm 패키지](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/dist/digitalpresso-proofstill-0.3.0.tgz)

## 한계·남은 사항

- E2E는 실제 HTTP API→PostgreSQL 흐름이며 브라우저 클릭은 포함하지 않는다.
- Docker 및 공개 컨테이너/패키지 다운로드가 필요하며 시험 환경 허용 여부를 보장하지 않는다.
- 공개 npm 업로드와 다른 DB 엔진/Windows 검증은 별도다.
- stage=criteria 판정이다. 구현 파일이 없는 Red snapshot이므로 완성 구현의 Green 여부를 판정하지 않았다.
- database 명령은 4 tests 모두 의도된 DATABASE_BOOTSTRAP_MISSING/DATABASE_E2E_MISSING Red에서 종료되어 실제 Docker 컨테이너 구동 단계에는 도달하지 않았다.
- 브라우저 UI, 공개 npm 업로드, Windows 및 다른 DB 엔진은 확정 범위 밖이다.
- 브라우저 클릭 UI는 확정 범위가 아니어서 검증하지 않았다.
- 공개 npm 업로드, Windows 및 PostgreSQL 외 다른 DB 엔진은 검증 범위에 포함되지 않았다.
- PASS는 전달된 요구사항과 지정 검사 범위에 한정되며 모든 잠재 결함의 부재를 의미하지 않는다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.

## 배포와 추가 검증

- [0.3.0 npm 패키지](/Users/jwsong/tools/proofstill/dist/digitalpresso-proofstill-0.3.0.tgz) · [버전·해시 기록](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/release.json)
- [SQLite/PostgreSQL 긴 제목 저장](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/long-title.json)
- [메모리 검사 실패 시 컨테이너 단계 차단](/Users/jwsong/tools/proofstill/.proofstill/validation/database-v6/.proofstill/evidence/database-v6/e2e-gate.json)

독립 검토에서 DB 통합 검사 4개, bootstrap 22개, 기존 회귀 79개를 직접 실행해 통과했다. 이 집계에는 모듈 간 중복과 내부에서 실행하는 생성 프로젝트 검사들이 있으므로 단순 합계를 고유 테스트 수로 표현하지 않는다. npm/pnpm 각각 PostgreSQL Testcontainers 성공·Docker 오류 경로를 실행했다. 공개 npm 업로드는 수행하지 않았다. E2E 범위는 HTTP API→DB이며 브라우저 클릭은 포함하지 않는다.
