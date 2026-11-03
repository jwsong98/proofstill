# 데이터 흐름 추적·검증 — 기능 완료 보고

- 상태: **검증 완료** · 사용자 수용: 미확인
- 구현: 실제 함수의 조회 → 조회 결과와 컨텍스트 결합 → 기능 실행 → 재조회 반복을 JSONL로 기록하고, 기대 흐름과 비교하며 로컬 UI에서 추적한다.
- 범위: 순차 Python 함수/SQLite 예제 및 기록 조회기. UI screen/action/element는 선언 매핑이며 제품 UI 클릭의 실행 증거와 구분한다.

## 바로 보기

- [실제 7단계 흐름 UI](/Users/jwsong/tools/proofstill/reports/order-flow.html)
- [원본 실행 JSONL](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/orders.jsonl)
- [기대 흐름: 순서·값·데이터 출처 연결](/Users/jwsong/tools/proofstill/examples/order_flow.expect.json)
- [기계 검증 결과](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/flow-verification.json)

## 실제 실행 흐름

| 단계 | 작업 | 입력·출력 연결 |
|---|---|---|
| 1 · `orders.lookup` | 현재 컨텍스트에서 미처리 주문을 조회해요 | context v0/tenant → /tenant |
| 2 · `context.merge` | 조회한 주문과 현재 처리 조건을 결합해요 | 단계 1/items/0 → /item; context v0/ → /policy |
| 3 · `orders.process` | 결합한 데이터로 주문을 처리하고 저장해요 | 단계 2/ → /payload |
| 4 · `orders.lookup` | 이전 처리 결과를 사용해 다음 미처리 주문을 다시 조회해요 | context v0/tenant → /tenant; 단계 3/last_id → /after |
| 5 · `context.merge` | 조회한 주문과 현재 처리 조건을 결합해요 | 단계 4/items/0 → /item; context v0/ → /policy |
| 6 · `orders.process` | 결합한 데이터로 주문을 처리하고 저장해요 | 단계 5/ → /payload |
| 7 · `orders.lookup` | 이전 처리 결과를 사용해 다음 미처리 주문을 다시 조회해요 | context v0/tenant → /tenant; 단계 6/last_id → /after |

- 예제 결과: 주문 1의 금액 `10 → 20`, 주문 2의 금액 `20 → 40`. 마지막 재조회는 빈 목록으로 끝난다.
- 독립 fixture 검사는 다른 tenant/ID/금액을 가진 DB를 직접 만들고, 실제 SQL `SELECT → UPDATE → SELECT → UPDATE → SELECT`와 최종 저장 상태를 확인한다.

## 코드·테스트

| 책임 | 파일 |
|---|---|
| 함수 실행·입출력·컨텍스트·참조 기록 | [trace.py](/Users/jwsong/tools/proofstill/proofstill/trace.py) |
| 순서·값·출처·기대 시나리오 검증 | [trace_check.py](/Users/jwsong/tools/proofstill/proofstill/trace_check.py) |
| offline HTML 조회기 | [trace_view.py](/Users/jwsong/tools/proofstill/proofstill/trace_view.py) |
| 실제 조회·처리 반복 예제 | [order_flow.py](/Users/jwsong/tools/proofstill/examples/order_flow.py) |
| 계측·컨텍스트 단위 검사 | [test_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace.py) |
| 잘못된 순서·값·연결·JSON 거부 | [test_trace_check.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_check.py) |
| DB 반복·CLI·수집·보고·보존 검사 | [test_data_flow.py](/Users/jwsong/tools/proofstill/tests/integration/test_data_flow.py) |
| 데이터 문자열 보존·HTML 요소 삽입 방지 | [test_trace_view.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_view.py) |
| 실제 Chrome UI 검사 | [check_trace_view.py](/Users/jwsong/tools/proofstill/tests/ui/check_trace_view.py) |

## 실제 검증 근거

- [구현 전 기준](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/criteria-contract.json) · [독립 기준 판정](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/criteria-revisions.json)
- [초기 Red](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/red-test_trace.log) · [리뷰 결함 Red](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/red-review-fixes.log)
- [전체 59 tests Green](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/full-regression-final.log)
- [Chrome UI 13항목 통과](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/ui-check.json) — 단계 선택, 설명·입출력·컨텍스트·버전, 이전 출처·다음 소비자 이동, 비인접 소비자 구분, 반복 조회, 매핑, 검색, 테마.
- [독립 구현 최종 리뷰: pass](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/implementation-review-final.json) · [최초 실패 리뷰 보존](/Users/jwsong/tools/proofstill/.proofstill/evidence/data-flow-build/implementation-review.json)

## 재실행

```sh
cd /Users/jwsong/tools/proofstill
python3 -m unittest tests.unit.test_trace tests.unit.test_trace_check tests.integration.test_data_flow -v
python3 -m proofstill trace verify .proofstill/evidence/data-flow-build/orders.jsonl --expect examples/order_flow.expect.json
python3 tests/ui/check_trace_view.py reports/order-flow.html
```

## 기능 개발에 연결

- 실제 함수는 `flow.step(operation, description, function, inputs=...)`으로 감싼다. 이전 출력은 `step.ref(...)`, 현재 컨텍스트는 `flow.context_ref(...)`로 전달한다.
- 기능 check에 `trace_expectation` 파일을 지정하면 실행별 trace를 수집한다. 필수 기록 누락·잘못된 데이터 연결·기대 흐름 불일치는 Green으로 인정하지 않는다.
- 완료 보고에서 UI 보기·원본 JSONL·기대 흐름을 찾아갈 수 있다. 기록 파일 변경과 재실행 실패/중단은 이전 완료 및 세부 통과 표시를 무효화한다.

## 한계

- 함수 계측을 명시적으로 붙인 범위만 기록한다. 자동 HTTP interception·분산/병렬 trace·제품 UI E2E는 이번 구현 범위에 포함하지 않는다.
- 뷰어는 생성 시점의 기록 스냅샷이다. 실제 제품 UI의 이벤트와 연결하려면 해당 화면·행동에서 같은 trace/step ID를 전달해야 한다.
- 임시 작업 문서만 정리하며 원본 JSONL·HTML·검증 결과·리뷰·테스트는 보존한다.
