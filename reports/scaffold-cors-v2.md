# 바로 기능 개발할 수 있는 CORS와 API 연결 기본값 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| CORS-1: 루트 env와 환경변수로 허용 출처·credentials를 설정한다. 로컬 기본값과 JSON/Bearer preflight를 제공하며 미허용출처·헤더를 거부하고 정상·400·401·404 API응답에 CORS 헤더를 제공한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| CONNECT-1: Vite 전체 /api 프록시와 생성클라이언트 runtime base URL을 연결한다. 프록시 및 절대 API주소 두 모드에서 생성함수로 등록→수정→조회가 동작한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AUTH-REGRESSION: env 설정을 공유해도 기존 JWT 발급·검증·키 보존과 백엔드 저장/HTTP 동작이 유지된다. | 구현 완료 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: CORS나 이런것도 설정해서 바로바로 기능 개발에 들어갈 수 있어야 해
- 업무 맥락: 기존 스캐폴드의 FastAPI/Vite/Orval과 JWT 기반을 유지하며 사용자 후속 요청에 따라 연결 설정을 완성한다. UI 변경은 없다. 기본 개발 앱 127.0.0.1:5173→/api 프록시→backend8000, env로 BACKEND_URL과 VITE_API_BASE_URL을 변경한다. 로컬 5173/4173 출처와 Authorization/Content-Type 및 일반 CRUD 메서드 프리플라이트를 허용한다. CORS_ORIGINS 빈 값은 비허용, 명시 출처만 허용, CORS_ALLOW_CREDENTIALS 기본false와 선택true를 제공한다. JWT/쿠키 로그인 정책은 확정하지 않는다. 새 settings.py는 auth와 CORS의 루트 env읽기 책임을 공유한다. frontend-connection의 외부 경로는 이번에 실제 생성하고 npm install한 임시 프로젝트이며, 검사 시작 때 원본 설정/백엔드 파일과 동일한지 대조한다. 준비 환경은 py requirements 설치된 격리 venv이다. 개발 및 빌드 후 Vite runtime API 주소가 반영된다. 배포 시 /api 역방향 proxy를 배포서버에 구성하거나 절대 API주소를 사용하도록 문서화한다. 브라우저의 실제 생성클라이언트 CRUD 및 별도origin Bearer헤더 GET은 output/playwright/cors-result.txt로 별도 확인했다. v1의 고정 integration 명령은 backend cwd를 요구하는 기존 HTTP 검사를 저장소 루트에서 실행해 실패했다. v2는 backend cwd에서 같은 검사들을 실행하며 요구와 구현은 동일하다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/plan.json)
- 기준 버전: `756def6927c1aa6b983c1fe961096b3a1881e28edff7d75380f8a8c93ae17e33`
- 소스 버전: `00b680f62998666761452594705867f32c7a4600819099b075db0ff58ea56738`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| CORS-1: 루트 env와 환경변수로 허용 출처·credentials를 설정한다. 로컬 기본값과 JSON/Bearer preflight를 제공하며 미허용출처·헤더를 거부하고 정상·400·401·404 API응답에 CORS 헤더를 제공한다. | 자동 검사 통과 | [backend-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/69eaddb74caf/output.log) |
| CONNECT-1: Vite 전체 /api 프록시와 생성클라이언트 runtime base URL을 연결한다. 프록시 및 절대 API주소 두 모드에서 생성함수로 등록→수정→조회가 동작한다. | 자동 검사 통과 | [frontend-connection](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/855c18eec021/output.log) |
| AUTH-REGRESSION: env 설정을 공유해도 기존 JWT 발급·검증·키 보존과 백엔드 저장/HTTP 동작이 유지된다. | 자동 검사 통과 | [backend-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/3099fab51520/output.log), [backend-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/69eaddb74caf/output.log) |

## 재현 명령과 검사 결과

### backend-unit · unit · backend

```sh
.proofstill/work/scaffold-auth-ui/venv/bin/python -c 'import os,sys,unittest;os.chdir('"'"'templates/monorepo/apps/backend'"'"');sys.path.insert(0,os.getcwd());suite=unittest.defaultTestLoader.discover('"'"'tests/unit'"'"');result=unittest.TextTestRunner(verbosity=2).run(suite);raise SystemExit(0 if result.wasSuccessful() else 1)'
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/3099fab51520/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/3099fab51520/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/unit/__init__.py)
- [테스트 test_auth.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/unit/test_auth.py)
- [테스트 test_database.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/unit/test_database.py)
### backend-integration · integration · backend

```sh
.proofstill/work/scaffold-auth-ui/venv/bin/python -c 'import os,sys,unittest;os.chdir('"'"'templates/monorepo/apps/backend'"'"');sys.path.insert(0,os.getcwd());suite=unittest.defaultTestLoader.discover('"'"'tests/integration'"'"');result=unittest.TextTestRunner(verbosity=2).run(suite);raise SystemExit(0 if result.wasSuccessful() else 1)'
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/69eaddb74caf/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/69eaddb74caf/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/integration/__init__.py)
- [테스트 test_app.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/integration/test_app.py)
- [테스트 test_auth.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/integration/test_auth.py)
- [테스트 test_cors.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/integration/test_cors.py)
- [테스트 test_http.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/integration/test_http.py)
### frontend-connection · integration · frontend-api

```sh
node tests/bootstrap/check_frontend_connection.mjs /private/tmp/proofstill-cors-20261103 .proofstill/work/scaffold-auth-ui/venv/bin/python
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/855c18eec021/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/runs/855c18eec021/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/check_frontend_connection.mjs)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a19d52-0edc-7d40-8b17-027d0bf72419` · 실행기 `/tmp/proofstill-cors-review-codex.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/reviews/implementation-38c07626775b/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/reviews/implementation-38c07626775b/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/reviews/implementation-38c07626775b/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/reviews/implementation-38c07626775b/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-cors-v2/reviews/implementation-38c07626775b/manifest.json)
  - CORS-1: pass — manifest 해시 51개가 검사 전후 모두 일치했다. TMPDIR 지정 후 backend integration 14건을 직접 실행해 모두 통과했다. tests/integration/test_cors.py에서 로컬 JSON/Bearer preflight, 미허용 origin/header 거부, env·credentials·빈 origin·환경변수 우선순위, 잘못된 설정 거부, 200·400·401·404 응답의 CORS 헤더를 확인했다. 구현은 infra/settings.py와 infra/app.py에 연결돼 있다.
  - CONNECT-1: pass — TMPDIR 지정 후 frontend-connection을 직접 실행해 FRONTEND_CONNECTION_VERIFIED 결과 proxy(create 201, saved 200)와 direct(create 201, saved 200)를 확인했다. 두 모드 모두 생성함수로 등록→수정→재조회 및 missing 404를 검사했다. 임시 프로젝트의 vite.config.ts, orval.config.mjs, base-url.ts, index.ts와 관련 백엔드 파일이 현재 템플릿과 일치했고, 생성 client.ts가 runtime apiBaseUrl을 실제 import했다.
  - AUTH-REGRESSION: pass — TMPDIR 및 PYTHONDONTWRITEBYTECODE 지정 후 backend unit 10건과 integration 14건을 직접 실행해 모두 통과했다. JWT 설정 우선순위, 발급·검증, 변조·만료·잘못된 키/알고리즘 거부, 기존 키 보존, Bearer 인증, 메모리 DB 저장·HTTP 동작을 확인했다. auth.py는 공유 environment()를 사용한다.

## 구현·아티팩트

- [환경 설정 예제](/Users/jwsong/tools/proofstill/templates/monorepo/.env.example)
- [연결 안내](/Users/jwsong/tools/proofstill/templates/monorepo/README.md)
- [실제 브라우저 확인](/Users/jwsong/tools/proofstill/output/playwright/cors-result.txt)

## 한계·남은 사항

- 쿠키 로그인/토큰 저장 정책·운영 배포 구성은 별도이며 기본 Bearer 방식과 개발 연결만 제공한다.
- 검증 범위는 지정된 단위·통합 검사와 관련 코드 대조에 한정된다. 쿠키 로그인·토큰 저장 정책과 운영 배포의 역방향 프록시 구성은 이번 요구 범위가 아니다.
- project_root가 Git 저장소가 아니어서 Git diff는 확인할 수 없었으며, 제공 manifest의 51개 경로 해시를 검사 전후 대조해 대상 불변성을 확인했다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
