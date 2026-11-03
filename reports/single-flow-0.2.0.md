# 설명 있는 단일 API 사용자 흐름 — 기능 개발 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 근데 flow/session 구분할 필요가 없어서 여기 설치할 버전은 좀 간략하게 flow하나만 구현하고 멀티 스탭별 유저의 사용흐름이 제대로 드러나도록 설명과 함께 해야함.
- 업무 맥락: 이전 설치 패키지의 API Tracker 표면을 단일 순차 flow로 교체한다. flow run/step/show/validate/reset/retry만 제공하고 session 선택을 제거한다. 예제는 사용자 목표가 드러나는 할 일 등록→완료→결과 확인이다. 각 단계에 행동/목적/기대결과를 설명하며 실제 OpenAPI 기반 HTTP, 응답 ID 출처 연결, 실패 기록을 유지한다. 재시도는 쓰기 중복 위험 때문에 명시적으로만, 완료 단계는 자동 재호출하지 않는다. env/spec 도구는 원본을 재사용한다. 전체 UI 구현이나 브라우저 클릭은 이 변경 범위가 아니다. 수정되는 테스트는 제거된 session/action UI를 새 단일 flow 동작으로 대체하며 기존 배포/빌드 검사는 유지한다. 공용 스킬에 새로 추가된 UX 스킬 참조도 배포 의존성으로 포함한다. 공개 업로드는 아직 미정이다. 기준 v4의 API 안내 스킬 내용은 새 내용으로 고정했으나 assets.json에 예전 스킬 hash가 남아 서로 모순됐다. API 안내 fixture의 정확한 hash로 정정했으며 어떤 동작 assertion도 완화하지 않는다. 재검토는 v4의 구현 전 baseline과 수정한 테스트를 사용한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/plan.json)
- 기준 버전: `fb887245e904806252c145e6c87bdfe28b9704358fb497f8dce2bad337609b14`
- 소스 버전: `90d8ea886b9517976ab7791a4842d5c3150d88d2b06df12f81822b3fb073a31d`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: 설치 CLI는 session 선택 없이 단일 flow run/step/show/validate/reset/retry를 제공하고 session 관련 명령/옵션을 거부한다. 현재 기록은 flow-record.json 하나다. | 자동 검사 통과 | [flow](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/bf5b63cfbc85/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0a3a5caf34e5/output.log) |
| R2: 할 일 등록→완료→결과 확인을 실제 서버에서 수행한다. 사용자 행동·목적·기대 결과가 정의/조회/실행 기록에 표시되고 요청·응답 결과도 함께 읽을 수 있다. | 자동 검사 통과 | [flow](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/bf5b63cfbc85/output.log), [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0a3a5caf34e5/output.log) |
| R3: 이전 성공 응답 ID를 후속 요청에 자동 연결하고 출처를 기록한다. 순서 오류·잘못된 정의/참조·누락 출력은 해당 HTTP 호출 전에 차단한다. 실패 시 중단/기록, 명시 재시도 이력, 완료 재실행 방지, 정의변경 거부, 동시 실행 잠금·중단 running 재실행 방지를 검사한다. | 자동 검사 통과 | [flow](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/bf5b63cfbc85/output.log) |
| R4: 변경 CLI/템플릿/안내/스킬 의존성이 npm 패키지에 포함되고 별도 설치 후 npm/pnpm 빌드와 실제 flow가 동작한다. 기존 OpenAPI export 및 Python 하네스 회귀를 검사한다. | 자동 검사 통과 | [bootstrap](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0a3a5caf34e5/output.log), [regression](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0f1fc1632ad7/output.log) |

## 재현 명령과 Red → Green

### flow · integration · flow

```sh
python3 -m unittest discover -s tests/bootstrap -p test_flow.py -v
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/e3566b4071f4/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/e3566b4071f4/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/bf5b63cfbc85/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/bf5b63cfbc85/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/test_flow.py)
### bootstrap · integration · bootstrap

```sh
python3 -m unittest discover -s tests/bootstrap -v
```

- Red: 기존 회귀 검사로 생략
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0a3a5caf34e5/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0a3a5caf34e5/result.json)
- [테스트 api-skill.md](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/api-skill.md)
- [테스트 assets.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/assets.json)
- [테스트 distribution.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/distribution.json)
- [테스트 feature.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/feature.json)
- [테스트 single-flow.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/single-flow.json)
- [테스트 test_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/test_flow.py)
- [테스트 test_install.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/test_install.py)
- [테스트 test_openapi.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/test_openapi.py)
- [테스트 test_scaffold.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/test_scaffold.py)
- [테스트 tracker-input-contract.ts](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/tracker-input-contract.ts)
- [테스트 tracker.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/bootstrap/tracker.json)
### regression · unit · regression

```sh
python3 -m unittest discover -s tests -v
```

- Red: 기존 회귀 검사로 생략
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0f1fc1632ad7/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/runs/0f1fc1632ad7/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_contract.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_order_workspace.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_report.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/unit/test_trace_view.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/integration/test_state_lifetime.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/tests/__init__.py)

## 독립 리뷰

- 기준 적절성: 통과 · 세션 `01a18dc9-472d-7ad0-9d99-bb80eac81263` · 실행기 `/Users/jwsong/tools/proofstill/.proofstill/work/single-flow-review`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/criteria-314381f691b6/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/criteria-314381f691b6/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/criteria-314381f691b6/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/criteria-314381f691b6/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/criteria-314381f691b6/snapshot/manifest.json)
  - R1: pass — flow/bootstrap 기준이 run·step·show·validate·reset·retry 표면, session 명령·옵션 및 구형 action/scenario/replay 거부, sessions 부재와 flow-record.json 단일 기록을 검사한다(test_flow.py:62-125). flow 모듈 직접 실행: 7 tests, 예상 baseline Red(SINGLE_FLOW_MISSING).
  - R2: pass — flow 기준이 실제 Python HTTP 서버에서 POST→PATCH→GET을 실행하고, 정의·show·flow-record의 title/description/expected 및 요청·응답 본문을 대조한다(test_flow.py:62-115). bootstrap 설치 기준도 설치본 서버와 3단계 실제 flow를 검사한다(test_install.py:147-188). bootstrap 직접 실행: 19 tests 중 기존 10 pass, 구현 전 예상 결손으로 9 fail.
  - R3: pass — flow 기준이 실제 응답 ID의 후속 URL·binding 출처 연결, 선행 순서 오류, 중복/미등록 operationId, 미래·미등록 참조, 누락 pointer, 응답 불일치 중단, 명시 retry 이력, 완료 재호출 방지, 정의 변경 거부, 잠금 및 running 재실행 방지, 동시 프로세스 경쟁을 검사한다(test_flow.py:71-100,117-215). flow 실행 실패는 모두 지정 red_pattern인 SINGLE_FLOW_MISSING이었다.
  - R4: pass — bootstrap 기준이 package files와 배포 manifest 일치, tarball 재생성 바이트 일치, 별도 offline 설치, npm/pnpm export·codegen·build·typecheck, 설치본 실제 flow, UX/API 스킬 및 fixture hash를 검사한다(test_install.py:23-204; test_scaffold.py:19-42). regression 명령 직접 실행: 79 tests, OK. bootstrap baseline은 누락 예정 산출물 bootstrap/flow.mjs, proofstill-ux, tasks.py를 명시적으로 검출했다.
- 구현: 통과 · 세션 `01a18dcb-6479-7121-b785-09e5195213b6` · 실행기 `/Users/jwsong/tools/proofstill/.proofstill/work/single-flow-review`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/implementation-7574134af195/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/implementation-7574134af195/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/implementation-7574134af195/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/implementation-7574134af195/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/reviews/implementation-7574134af195/snapshot/manifest.json)
  - R1: pass — flow 모듈 7개 및 bootstrap 모듈 19개 직접 실행 통과. bin/proofstill.mjs:53-61은 tracker 표면을 flow/env/spec/app으로 제한하고, bootstrap/flow.mjs:180-189는 run/step/show/validate/reset/retry만 허용하며 flow-record.json 하나를 사용한다. tests/bootstrap/test_flow.py:62-125에서 session 명령·옵션 거부, 단일 기록 및 reset을 실제 검사한다.
  - R2: pass — flow 모듈 7개 및 bootstrap 모듈 19개 직접 실행 통과. templates/monorepo/.api-tracker/flow.yaml:3-70에 등록→완료→재조회 단계와 행동·목적·기대 결과가 정의된다. tests/bootstrap/test_flow.py:62-115에서 실제 서버의 POST/PATCH/GET, 기록된 요청·응답 및 show 출력을 대조했고, 설치본 검사도 test_install.py:160-186에서 실제 준비 서버와 flow를 실행한다.
  - R3: pass — flow 모듈 7개 직접 실행 통과. bootstrap/flow.mjs:125-177은 성공 응답 값을 해석해 bindings와 요청·응답·실패를 기록하고, 199-212는 fingerprint·순서·명시 retry·완료 재실행을 통제한다. tests/bootstrap/test_flow.py:117-215에서 잘못된 정의/참조의 HTTP 전 차단, 응답 불일치 중단, 실패 이력 보존, 정의 변경 거부, 잠금, running 재실행 방지 및 동시 요청 단일화를 검사한다.
  - R4: pass — bootstrap 모듈 19개와 regression 모듈 79개를 직접 실행해 모두 통과. tests/bootstrap/test_install.py:23-204에서 새 npm pack과 배포 tgz의 바이트 동일성, 별도 오프라인 설치, npm/pnpm 생성·OpenAPI export·코드 생성·build·typecheck, 설치본 실제 서버 flow 및 기존 spec compare를 검증한다. package.json:13-90에는 변경 CLI·flow·템플릿·proofstill-api 및 proofstill-ux 스킬이 배포 목록에 포함된다.

## 구현·아티팩트

- [사용법](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/README.md)
- [단일 flow 구현](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/bootstrap/flow.mjs)
- [배포 파일](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/dist/digitalpresso-proofstill-0.2.0.tgz)

## 한계·남은 사항

- 공개 npm 업로드는 별도 결정이다.
- HTTP JSON 순차 flow이며 조건 분기·병렬 실행·전체 스키마 검증·UI 클릭은 범위 밖이다.
- 서버 메모리 데이터는 재시작시 사라진다. reset은 로컬 호출 기록만 지운다.
- criteria 단계 판정으로, 현재 구현의 요구 충족 여부를 승인하지 않는다. 직접 실행된 flow/bootstrap 실패는 고정 기준이 구현 전 baseline 결손을 검출한다는 근거다.
- 공개 npm 업로드, 조건 분기·병렬 flow·전체 스키마 검증·UI 클릭은 확정 범위 밖이다.
- 공개 npm 업로드는 검증 범위가 아니다.
- 조건 분기·병렬 flow·전체 응답 스키마 검증·제품 UI 클릭은 고정 범위 밖이다.
- PASS는 전달된 요구사항과 직접 실행한 검사 범위에 한정되며 모든 결함의 부재를 의미하지 않는다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.

## 배포 파일

[Proofstill 0.2.0](/Users/jwsong/tools/proofstill/dist/digitalpresso-proofstill-0.2.0.tgz) · [배포 해시·소스 일치 기록](/Users/jwsong/tools/proofstill/.proofstill/validation/single-flow-v6/.proofstill/evidence/single-flow-v6/release.json)

고유 테스트 98개(bootstrap 19개 + Python 회귀 79개)가 통과했다. flow 7개는 모듈 단독으로도 재실행했다. 공개 npm 업로드는 수행하지 않았다.
