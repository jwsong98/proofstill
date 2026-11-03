# 목록 주문 상태 변경과 검색 조건 유지 — 기능 개발 보고

목록에서 보이는 주문의 상태를 바꾸고 같은 검색 조건·페이지로 실제 SQLite 목록을 다시 조회하는 기능을 추가했다. 저장·재조회 실패는 트랜잭션을 롤백하고 기존 목록을 유지한다. 새 검사 12개와 기존 회귀 79개가 최종 코드에서 통과했으며 독립 구현 리뷰도 같은 명령을 직접 실행했다.

## 브리핑부터 완료까지

| 단계 | 실제 연결 근거 |
|---|---|
| 브리핑·범위 | [최초 임시 브리핑 보존본](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/brief-initial.md) |
| IA·상태 수명·테스트 고정 | [기능 정의와 명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/plan.json) · [화면·상태·출처 기준](/Users/jwsong/tools/proofstill/examples/order_status/expected.json) |
| 첫 기준 리뷰 반려 | [음수 ID·Trace 부정 사례 지적](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v1/reviews/criteria-0936c3627407/answer.json) |
| 보완 후 독립 기준 통과 | [요구사항별 판정](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/criteria-fd78cba02fc6/answer.json) · 세션 `01a18d9a-e82b-74c3-a729-0bcae1c4f0d4` |
| 순차 TDD | 아래 실제 실행 순서와 [소스 버전 연결 검사](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/lifecycle.json) |
| 구현 | [기준 승인 시점 대비 실제 변경 diff](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/implementation.patch) · 구현 파일 2개, 테스트·기대값 변경 없음 |
| 독립 구현 통과 | [리뷰 판정](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/implementation-51b8cbd7ca60/answer.json) · 세션 `01a18d9c-cedd-7c71-b220-0ce85933909d` |
| 정리 | 완료 보고·실행 증거 보존, 이 기능의 임시 brief 제거. 사용자 수용은 별도. |

첫 기준 반려 후 보완은 구현 전에 이루어졌으며 새 작업 ID로 기준을 고정했다. 승인 후에는 `unit Red → unit Green → integration Red → integration Green` 순서를 지켰고, 마지막에 모든 검사를 동일한 최종 소스에서 다시 실행했다. 이 작업은 두 스킬과 실제 하네스 CLI의 새 `codex exec` 리뷰를 사용했다.

| 실행 시각 (Asia/Seoul) | 단계 | 실제 테스트 종료 코드 | 근거 |
|---|---|---|---|
| 10-31 01:19:39 | 목록 상태 unit Red | 1 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/f0c47e79e3c0/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/f0c47e79e3c0/output.log) |
| 10-31 01:19:46 | 목록 상태 unit Green | 0 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/37bc1592cb42/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/37bc1592cb42/output.log) |
| 10-31 01:19:47 | SQLite integration Red | 1 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/04022b16f860/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/04022b16f860/output.log) |
| 10-31 01:19:56 | SQLite integration Green | 0 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/4811ffe279d3/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/4811ffe279d3/output.log) |
| 10-31 01:20:12 | 목록 상태 unit Green | 0 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/output.log) |
| 10-31 01:20:12 | SQLite integration Green | 0 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) |
| 10-31 01:20:12 | 기존 회귀 Green | 0 | [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/d22fc2b23ece/result.json) · [로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/d22fc2b23ece/output.log) |

## 하네스 생성 상세 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 사용자 원문: 작은 기능 하나를 실제로 이 스킬들로 처음부터 끝까지 개발해봐. 브리핑부터 독립 검증까지 어떻게 연결되는지 보여주고, 마지막에 근거 링크가 있는 완료 보고를 줘. 선택한 기능: 목록에서 현재 보이는 주문의 상태를 open/closed로 바꾸고 같은 검색 조건·페이지로 목록을 다시 조회한다.
- 업무 맥락: 로컬 연습 기능. 실제 시험 과제 아님. 기존 Workspace/SQLite OrderStore를 확장한다. 목록에서만 상태 변경 가능하며 다른 화면·화면에 없는 ID·bool/문자열 ID·잘못된 status는 쓰기 전 거부한다. 같은 status 요청은 멱등 허용. query/page를 보존하며 새 items로 교체하고 성공은 error를 정리한다. 쓰기와 재조회는 하나의 SQLite 트랜잭션: 어느 쪽이든 실패하면 DB 롤백, 기존 화면·목록·조건 유지와 error만 추가한다. 기능 종료는 전체 화면 데이터 정리, 재진입 기본값 사용. 현재 페이지가 비면 자동 이동하지 않고 같은 페이지의 빈 목록을 표시한다. 상태 변경용 초안·선택 상태는 추가하지 않는다. 잘못된 저장소 ID/status(음수 포함)는 UPDATE 전 거부한다. 없는 양의 ID는 변경된 행 없음 확인 뒤 ValueError를 허용한다. 기능별 Trace 부정 사례는 잘못된 설명·값·단계 누락·순서·출처 없는 literal 입력을 거부해야 한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/plan.json)
- 기준 버전: `9b06db1d4715fd7950ae66c3604e5f26410e8cac118eb5e3c9d390af9effbdb8`
- 소스 버전: `a83248a4543f894856ae27e75e7a5384df2edd5819e4e24e9ceb7d8d9869a06b`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: 목록에서 보이는 양의 정수 ID만 open/closed 상태 변경 가능. home/detail/edit·잘못된 입력·화면 밖 ID는 저장과 상태 변경 전에 거부한다. | 자동 검사 통과 | [status-workspace](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/output.log), [status-store](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) |
| R2: 쓰기 후 같은 query/page로 실제 목록 재조회. items는 정규 저장소 반환값으로 교체하고 임시 초안·선택·중복 데이터는 만들지 않는다. 같은 상태 요청은 멱등이다. | 자동 검사 통과 | [status-workspace](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/output.log), [status-store](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) |
| R3: 저장·재조회 실패는 DB 변경을 원자적으로 롤백하고 원래 목록·화면·조건을 유지하며 오류를 표시. 재시도 성공은 오류 제거. | 자동 검사 통과 | [status-workspace](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/output.log), [status-store](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) |
| R4: 기능 종료 시 query/page/items/error 정리, 재진입 기본값 복원. 실제 DB 저장과 reopen·미대상 주문 및 금액 불변 검증. | 자동 검사 통과 | [status-workspace](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/output.log), [status-store](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) |
| R5: 실제 workflow를 Trace로 기록하고 단계 설명·실제 조회 데이터와 현재 컨텍스트 출처·화면별 허용 상태·유지/제거를 사전 기대값으로 검사한다. | 자동 검사 통과 | [status-store](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) |
| R6: 기존 하네스와 주문 기능의 회귀 테스트를 현재 소스에서 통과한다. | 자동 검사 통과 | [harness-regression](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/d22fc2b23ece/output.log) |

## 재현 명령과 Red → Green

### status-workspace · unit · status-workspace

```sh
python3 -m unittest discover -s examples/order_status/tests/unit -v
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/f0c47e79e3c0/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/f0c47e79e3c0/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/09f26e754cc2/result.json)
- [테스트 test_status.py](/Users/jwsong/tools/proofstill/examples/order_status/tests/unit/test_status.py)
### status-store · integration · status-store

```sh
python3 -m unittest discover -s examples/order_status/tests/integration -v
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/04022b16f860/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/04022b16f860/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/result.json)
- [고정된 기대 흐름](/Users/jwsong/tools/proofstill/examples/order_status/expected.json)
- 흐름 목록 주문 상태 변경 · 7단계 · [UI 추적 보기](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/traces/4d5d83b7cf9b4e97a492bde9849af7f5.html) · [원본 JSONL](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/546edd0e82c7/traces/4d5d83b7cf9b4e97a492bde9849af7f5.jsonl)
- [테스트 test_status.py](/Users/jwsong/tools/proofstill/examples/order_status/tests/integration/test_status.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/examples/order_status/expected.json)
### harness-regression · unit · harness-regression

```sh
python3 -m unittest discover -s tests -v
```

- Red: 기존 회귀 검사로 생략
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/d22fc2b23ece/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/runs/d22fc2b23ece/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/__init__.py)
- [테스트 api-skill.md](/Users/jwsong/tools/proofstill/tests/bootstrap/api-skill.md)
- [테스트 assets.json](/Users/jwsong/tools/proofstill/tests/bootstrap/assets.json)
- [테스트 distribution.json](/Users/jwsong/tools/proofstill/tests/bootstrap/distribution.json)
- [테스트 feature.json](/Users/jwsong/tools/proofstill/tests/bootstrap/feature.json)
- [테스트 test_install.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_install.py)
- [테스트 test_openapi.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_openapi.py)
- [테스트 test_scaffold.py](/Users/jwsong/tools/proofstill/tests/bootstrap/test_scaffold.py)
- [테스트 tracker-input-contract.ts](/Users/jwsong/tools/proofstill/tests/bootstrap/tracker-input-contract.ts)
- [테스트 tracker.json](/Users/jwsong/tools/proofstill/tests/bootstrap/tracker.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/tests/integration/test_state_lifetime.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/tests/integration/test_workflow.py)
- [테스트 support.py](/Users/jwsong/tools/proofstill/tests/support.py)
- [테스트 check_state_view.py](/Users/jwsong/tools/proofstill/tests/ui/check_state_view.py)
- [테스트 check_trace_view.py](/Users/jwsong/tools/proofstill/tests/ui/check_trace_view.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_contract.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/tests/unit/test_order_workspace.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/tests/unit/test_report.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_view.py)

## 독립 리뷰

- 기준 적절성: 통과 · 세션 `01a18d9a-e82b-74c3-a729-0bcae1c4f0d4` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/criteria-fd78cba02fc6/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/criteria-fd78cba02fc6/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/criteria-fd78cba02fc6/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/criteria-fd78cba02fc6/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/criteria-fd78cba02fc6/snapshot/manifest.json)
  - R1: pass — examples/order_status/tests/unit/test_status.py의 invalid/nonvisible 및 home/detail/edit 테스트가 화면 밖 ID, bool·문자열·0·음수 ID, 잘못된 status를 저장 호출과 상태 변경 전에 거부하도록 검사한다. integration의 repository invalid/missing 테스트는 UPDATE 실행 여부와 DB 불변도 확인한다.
  - R2: pass — unit의 filtered/unfiltered 테스트가 동일 query/page 전달, 실제 재조회 횟수, canonical items 교체 및 정확한 상태 필드 집합을 검사한다. integration의 update/requery 및 idempotent 테스트가 UPDATE→SELECT 순서, 필터·OFFSET, 빈 페이지 유지와 동일 상태 요청을 검증한다.
  - R3: pass — unit의 failure/retry 테스트가 기존 목록·조건 유지, error 추가와 성공 후 제거를 검사한다. integration의 refresh failure 및 실제 SQLite trigger write failure 테스트가 DB 롤백, 화면 상태 보존, 오류 표시와 재시도 성공을 검사한다.
  - R4: pass — unit의 exit/reentry 테스트가 home 복귀 시 전체 data 제거와 재진입 기본 query='', page=1을 검사한다. integration의 reopen 및 workflow 테스트가 실제 SQLite 영속 상태와 모든 주문의 id·amount·status를 비교해 미대상 주문과 금액 불변을 확인한다.
  - R5: pass — examples/order_status/expected.json이 7단계 작업 순서, 설명, 실제 상태값, 화면별 required/optional 상태, 전이의 preserve/drop 및 step/context 데이터 링크를 고정한다. integration 테스트는 잘못된 설명·값·단계 누락·순서·출처 없는 literal 변형이 verify_trace에서 거부되는지 검사한다. proofstill/state.py와 trace_check.py는 실제 before/after 상태 연결, 정확한 화면 상태 필드 및 컨텍스트 버전·바인딩 값을 검증한다.
  - R6: pass — 지정 명령 `python3 -m unittest discover -s tests -v`를 직접 실행해 79개 테스트가 모두 통과했다. 별도 기능 명령은 미구현 기준선에서 각각 6개 테스트가 모두 지정된 STATUS_WORKSPACE_NOT_IMPLEMENTED 및 STATUS_STORE_NOT_IMPLEMENTED AssertionError로 실패해 Red 패턴도 확인됐다.
- 구현: 통과 · 세션 `01a18d9c-cedd-7c71-b220-0ce85933909d` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/implementation-51b8cbd7ca60/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/implementation-51b8cbd7ca60/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/implementation-51b8cbd7ca60/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/implementation-51b8cbd7ca60/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/reviews/implementation-51b8cbd7ca60/snapshot/manifest.json)
  - R1: pass — Workspace.set_status는 orders.list 화면, 양의 int ID, open/closed 상태, 현재 items 포함 여부를 저장소 호출 전에 검사한다. 단위 테스트 6개 및 통합 테스트 6개 통과; home/detail/edit, 화면 밖 ID, bool·문자열·0·음수 ID와 잘못된 status 거부 및 UPDATE 미실행을 확인했다.
  - R2: pass — OrderStore.set_status는 UPDATE 뒤 동일 트랜잭션에서 search(query, page)를 호출하며 Workspace는 반환된 items로 목록 상태 전체를 교체한다. 동일 상태 요청과 빈 페이지 유지 사례를 포함해 status-workspace 및 status-store가 각각 6/6 통과했다.
  - R3: pass — SQLite connection 컨텍스트가 UPDATE와 재조회를 하나의 트랜잭션으로 묶는다. 직접 실행한 통합 테스트에서 재조회 오류와 트리거 기반 쓰기 오류 모두 DB 롤백, 기존 screen/query/page/items 유지, error 추가를 확인했고 재시도 성공 후 error 제거도 통과했다.
  - R4: pass — Workspace.leave는 home의 빈 data로 전환하고 재진입 search()는 query='', page=1을 사용한다. 테스트에서 reopen 후 대상 상태 지속, 미대상 주문과 모든 amount 불변, 종료 시 query/page/items/error 제거를 확인했다.
  - R5: pass — run_status_flow의 7단계 실제 Trace를 expected.json으로 검증했다. 현재 목록 출력→identifier 및 context→status 연결, 화면 상태·전이·보존·제거를 확인했다. 설명 변경, 단계 누락, 값 변조, 순서 변경, provenance binding 제거 변형이 모두 거부되는 통합 테스트가 통과했다.
  - R6: pass — 지정 명령 `python3 -m unittest discover -s tests -v`를 현재 복사본에서 직접 실행했으며 79개 테스트가 12.007초에 모두 통과했다.

## 구현·아티팩트

- [주문 화면·상태 코드](/Users/jwsong/tools/proofstill/examples/order_workspace/workspace.py)
- [SQLite 상태 변경·재조회](/Users/jwsong/tools/proofstill/examples/order_workspace/store.py)
- [실제 Trace 시나리오](/Users/jwsong/tools/proofstill/examples/order_status/scenario.py)
- [고정 IA·상태 전이·데이터 출처](/Users/jwsong/tools/proofstill/examples/order_status/expected.json)
- [Unit test](/Users/jwsong/tools/proofstill/examples/order_status/tests/unit/test_status.py)
- [Integration test](/Users/jwsong/tools/proofstill/examples/order_status/tests/integration/test_status.py)
- [작업 시작 브리핑](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-status-v2/brief-initial.md)

## 한계·남은 사항

- 제품의 클릭 UI·외부 API·동시 사용자 갱신은 범위 밖이며 기존 화면·상태 모델의 로컬 기능이다.
- 페이지가 비어도 동일 페이지 유지라는 예시 정책. 숨은 메모리 상태는 관측하지 않는다.
- stage=criteria 판정으로서 기준의 요구 반영, 부정 사례, 실행 가능성 및 미구현 기준선의 Red를 검토한 결과다. 현재 구현 충족 여부를 승인한 것이 아니다.
- 제품 클릭 UI, 외부 API, 동시 사용자 갱신과 관측되지 않는 숨은 메모리 상태는 전달된 범위 밖이다.
- 제품 클릭 UI, 외부 API, 동시 사용자 갱신 및 관측되지 않는 숨은 메모리 상태는 전달된 범위 밖이다.
- PASS는 전달된 요구사항과 지정 검사 및 검토한 코드 경로에 한정되며 모든 잠재 결함의 부재를 의미하지 않는다.
- 검사 후 manifest의 선언 파일 해시와 현재 파일 SHA-256이 일치했다. 테스트 실행으로 생성된 임시·캐시 파일만 검토 대상 밖에 존재한다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
