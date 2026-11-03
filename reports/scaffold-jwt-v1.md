# JWT 발급·검증과 재사용 가능한 환경 설정 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| JWT-1: 임의 JSON 객체를 발급·검증하고 데이터 구조를 고정하지 않으며 만료/발급 시각을 관리한다. 변조·다른 키·다른 알고리즘·누락·만료 토큰을 거부한다. | 미기록 | 통과 | 통과 | 미기록 |
| JWT-2: FastAPI Bearer 의존성은 유효한 토큰의 사용자 데이터를 반환하며 누락·잘못된 인증은 401, 설정 누락은 503이다. | 미기록 | 통과 | 통과 | 미기록 |
| JWT-3: 생성 스캐폴드에 .env.example과 auth:setup을 제공하고 고유 키 생성·재실행 보존·환경 로딩을 실제 명령으로 확인한다. | 미기록 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 로그인 기능을 구현하기 좋게 미리 jwt 같은거 만들어두고, 인증 같은 거 토큰 안에 무엇이 들어갈지는 정하지 못하더라도 바로 토큰화하고 바로 검증할 수 있게 되어야 하고, 시크릿 키도 그냥 기본으로 만들 수 있어야 하고 .env.example에서 쓸 수 있는 구조가 되어야 함.
- 업무 맥락: 2026-11-03 사용자 요청. 기존 FastAPI 스캐폴드의 인증 기반 추가를 위임했다. 로그인 업무, 사용자 데이터 구조, refresh/revoke 정책은 확정하지 않았다. 사용자 정보는 자유 JSON data 객체로 보존하고 공통 iat/exp를 관리한다. HS256/PyJWT 라이브러리와 동일 백엔드의 infra 모듈 사용은 위임된 구현 선택이다. 공개 토큰 발급 API나 계정 기능은 만들지 않고 로그인 처리에서 자격 확인 후 호출할 함수를 제공한다. auth:setup은 .env에 키를 한 번 생성하며 기존 키와 다른 설정은 보존한다. 기본 예제 API는 그대로 공개, 필요한 라우트에 Depends(require_token)를 붙여 보호한다. .env는 npm/pnpm 백엔드 명령과 TokenService.from_env에서 읽는다. 검사 Python은 이 작업에서 requirements.txt를 설치한 격리 venv이다. UI 컴포넌트 검사는 별도로 실제 브라우저에서 수행하며 이 인증 검토의 요구가 아니다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/plan.json)
- 기준 버전: `f8ac2a69f35c8772d079992f2f92d7014301e24d5fcbf5b877694e735e1e0b2d`
- 소스 버전: `cedd1db44d1d0e2a6c463534c53528fdb5529488dfebb0ab293fb2847d2288c1`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| JWT-1: 임의 JSON 객체를 발급·검증하고 데이터 구조를 고정하지 않으며 만료/발급 시각을 관리한다. 변조·다른 키·다른 알고리즘·누락·만료 토큰을 거부한다. | 자동 검사 통과 | [jwt-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/4628567016ed/output.log) |
| JWT-2: FastAPI Bearer 의존성은 유효한 토큰의 사용자 데이터를 반환하며 누락·잘못된 인증은 401, 설정 누락은 503이다. | 자동 검사 통과 | [jwt-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/deed43608a22/output.log) |
| JWT-3: 생성 스캐폴드에 .env.example과 auth:setup을 제공하고 고유 키 생성·재실행 보존·환경 로딩을 실제 명령으로 확인한다. | 자동 검사 통과 | [jwt-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/4628567016ed/output.log), [jwt-scaffold](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/303836023267/output.log) |

## 재현 명령과 검사 결과

### jwt-unit · unit · auth

```sh
env PYTHONPATH=templates/monorepo/apps/backend .proofstill/work/scaffold-auth-ui/venv/bin/python -m unittest discover -s templates/monorepo/apps/backend/tests/unit -p test_auth.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/4628567016ed/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/4628567016ed/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/unit/test_auth.py)
### jwt-integration · integration · auth

```sh
env PYTHONPATH=templates/monorepo/apps/backend .proofstill/work/scaffold-auth-ui/venv/bin/python -m unittest discover -s templates/monorepo/apps/backend/tests/integration -p test_auth.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/deed43608a22/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/deed43608a22/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/integration/test_auth.py)
### jwt-scaffold · integration · scaffold

```sh
.proofstill/work/scaffold-auth-ui/venv/bin/python -m unittest discover -s tests/bootstrap -p test_auth.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/303836023267/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/runs/303836023267/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/test_auth.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/backend_support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/db-requirements.txt)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a19d37-b802-7dc3-bd18-00ca8b338312` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/reviews/implementation-576a201a0eb2/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/reviews/implementation-576a201a0eb2/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/reviews/implementation-576a201a0eb2/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/reviews/implementation-576a201a0eb2/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-jwt-v1/reviews/implementation-576a201a0eb2/manifest.json)
  - JWT-1: pass — jwt-unit 직접 실행: 5 tests, OK. auth.py의 HS256 고정, exp/iat/data 필수화와 데이터·시각 검증을 확인했다. 임의 JSON 객체 왕복, 변조, 다른 키·알고리즘, 누락 claim, 만료 토큰 거부 테스트가 통과했다.
  - JWT-2: pass — jwt-integration 직접 실행: 3 tests, OK. 유효 Bearer 토큰은 사용자 데이터를 반환했고, 누락·잘못된 형식·다른 키 토큰은 401과 WWW-Authenticate: Bearer, 설정 누락은 503을 반환했다.
  - JWT-3: pass — jwt-unit 5 tests 및 jwt-scaffold 1 test 직접 실행: 모두 OK. 생성 스캐폴드의 .env.example과 auth:setup 등록, 고유 키 생성, 재실행 시 키 보존, 다른 설정 보존, 백엔드 명령의 .env 로딩을 확인했다.

## 구현·아티팩트

- [인증 구현](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/infra/auth.py)
- [환경 예제](/Users/jwsong/tools/proofstill/templates/monorepo/.env.example)

## 한계·남은 사항

- 계정 저장·자격 확인·refresh/revoke·클라이언트 토큰 저장 정책은 사용자 요구가 미확정이라 포함하지 않는다.
- 계정 저장·자격 확인·refresh/revoke·클라이언트 토큰 저장 정책과 UI 브라우저 검사는 지정 범위가 아니어서 검증하지 않았다.
- 통합 검사에서 FastAPI TestClient 관련 StarletteDeprecationWarning이 발생했으나 검사 결과에는 영향을 주지 않았다.
- PASS는 전달된 JWT 요구사항과 지정 검사 범위에 한정되며 모든 결함의 부재를 의미하지 않는다. 검토 전후 manifest 대상 해시는 모두 일치했다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
