# IA·상태 수명 검증

사용자 작업의 화면 경계와 상태 수명을 함께 검사하도록 하네스를 확장했다. 앱이 상태를 소유하고 `Flow.transition`이 실제 작업 전후 `feature/screen/data`를 복사해 관측한다. 상태 계약은 테스트와 같은 실행 기준이며 별도 IA 설명 문서는 만들지 않았다.

[실행 흐름 UI](/Users/jwsong/tools/proofstill/reports/state-lifetime.html) · [저장 실패·명시 취소 UI](/Users/jwsong/tools/proofstill/reports/state-save-failure.html) · [정상 원본 Trace](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/workspace-final.jsonl) · [실패 원본 Trace](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/save-failure.jsonl)

| 작업 경계 | 필요한 데이터와 수명 |
|---|---|
| 주문 찾기 | 검색 조건·페이지로 실제 목록 조회. 조건·페이지는 주문 기능 동안 유지. |
| 상세 확인 | 선택 ID로 상세 조회. 목록 데이터 제거. 현재 요청 토큰의 응답만 수용. |
| 주문 수정 | 상세 대신 금액 초안만 보관. 저장·명시 취소 전 다른 작업 이동 거부. |
| 저장·목록 복귀 | 저장 성공 시 초안 제거, 확정 상세 반영. 복귀 시 원래 조건·페이지로 목록 재조회. |
| 저장 실패·취소 | 실패는 초안과 화면 유지. 명시 취소는 상세 재조회 후 초안·오류 제거. |
| 주문 기능 종료 | 검색 조건·페이지·선택·상세 모두 제거. 이후 응답은 무시. |

`주문 찾기 → 상세 → 수정 → 저장 → 목록 복귀 → 선택 변경·응답 역전 → 기능 종료`를 실제 SQLite로 실행했다. 금액 10→35 저장과 목록 재조회 값을 대조했다. 다른 주문과 closed 주문은 바뀌지 않는다. 별도 실패 실행에서는 SQLite trigger가 UPDATE를 거부하고, 초안 77 유지·DB 금액 10 불변·취소 후 상세 10 복원을 확인했다.

조회기에서 작업을 선택하면 화면·기능 이동, 작업 전후 상태, 생성(created)·유지(retained)·변경(changed)·제거(removed) 필드를 볼 수 있다. 같은 화면 이름만 기록하는 대신 값 보존·삭제·전후 상태 연결을 검사한다.

## 코드와 실행 기준

- [실제 주문 상태와 화면 전이](/Users/jwsong/tools/proofstill/examples/order_workspace/workspace.py) · [SQLite 조회·저장](/Users/jwsong/tools/proofstill/examples/order_workspace/store.py) · [실행 가능한 예시](/Users/jwsong/tools/proofstill/examples/order_workspace/demo.py)
- [고정 IA·상태 수명·데이터 출처 기준](/Users/jwsong/tools/proofstill/examples/order_workspace/expected.json) · [저장 실패 기준](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/save-failure.expected.json)
- [상태 관측 API](/Users/jwsong/tools/proofstill/proofstill/trace.py:155) · [상태 형태·차이·화면 계약 검사](/Users/jwsong/tools/proofstill/proofstill/state.py) · [Trace 순서·상태 연결 검사](/Users/jwsong/tools/proofstill/proofstill/trace_check.py) · [조회기](/Users/jwsong/tools/proofstill/proofstill/trace_view.py)
- [개발 스킬](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-develop/SKILL.md) · [독립 검증 스킬](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-verify/SKILL.md): IA·소유·조회 시점·수명 정책을 먼저 정하고 전이별 Red→Green을 수행한다. 기존 `trace_expectation`을 지정하면 상태 기준 위반도 Green을 거부한다.

## 실제 검증

- 새 unit 16개, integration 4개. [관측 테스트](/Users/jwsong/tools/proofstill/tests/unit/test_state_trace.py) · [기준의 부정 사례](/Users/jwsong/tools/proofstill/tests/unit/test_state_contract.py) · [주문 기능별 상태 테스트](/Users/jwsong/tools/proofstill/tests/unit/test_order_workspace.py) · [실제 SQLite와 하네스 연결](/Users/jwsong/tools/proofstill/tests/integration/test_state_lifetime.py)
- 전체 79개 통과. [전체 실행 로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/full-regression.log) · [모듈별 명령·종료 코드·로그 해시](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/green-receipts.json)
- Chrome DOM: [새 상태 조회기 11개](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/state-ui.json) · [기존 흐름 조회기 13개](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/existing-ui.json) · [상태 UI 검사 코드](/Users/jwsong/tools/proofstill/tests/ui/check_state_view.py)
- [Red 명령·종료 코드·당시 테스트 해시](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/red-receipts.json) · [응답 토큰 회귀 Red](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/red-response-token.log) · [상태 UI Red](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/red-state-ui.json). 최초 Red는 미구현 API/모듈과 기존 검증기의 상태 계약 무시를 확인했다. 토큰 회귀는 잘못된 응답이 상태를 덮는 실제 assertion 실패다.
- 정상 16단계·상태 전이 13개: [기대값 대조 결과](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/trace-verification-final.json). [저장 실패·취소 대조 결과](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/save-failure-verification.json)
- [사전 독립 기준 판정](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/criteria-review-final.json) · [SQL 관측 범위 보정 검토](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/criteria-amendment.json) · [UI 검사 보정·토큰 부정 기준 검토](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/criteria-amendment-final.json). 독립 구현 판정: [리뷰 결과](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/implementation-review.json). [보고 링크·스킬 검사](/Users/jwsong/tools/proofstill/.proofstill/evidence/state-lifetime/report-check.json).

실행 위치: `/Users/jwsong/tools/proofstill`. 모듈만 선택해 실행할 수 있다.

```sh
python3 -m unittest tests.unit.test_order_workspace -v
python3 -m unittest tests.unit.test_state_contract -v
python3 -m unittest tests.integration.test_state_lifetime -v
python3 -m unittest discover -s tests -v
python3 tests/ui/check_state_view.py reports/state-lifetime.html
```

새 Trace 파일 경로를 지정해 재실행할 수 있다. 기존 Trace는 덮어쓰지 않는다.

```sh
python3 examples/order_workspace/demo.py --trace /tmp/proofstill-state-example.jsonl
python3 -m proofstill trace verify /tmp/proofstill-state-example.jsonl --expect examples/order_workspace/expected.json
python3 -m proofstill trace view /tmp/proofstill-state-example.jsonl --expect examples/order_workspace/expected.json --output /tmp/proofstill-state-example.html
```

관측 함수가 노출한 JSON만 검사한다. 숨은 저장소 전체나 메모리 회수·민감정보 제거를 보장하지 않는다. delta는 최상위 data 필드별 값 비교다. 응답 역전은 순차 호출로 재현하며 실제 병렬 네트워크 검증은 하지 않았다. 제공한 제품 예시는 화면·상태 모델이며 제품 클릭 UI는 구현하지 않았다. Chrome 검사는 Trace 조회기의 실제 DOM 검사다. 이번 Red/Green 자료는 모듈별 실패·통과 기록이며 모듈 사이의 순차 TDD 전체 과정을 인증하지 않는다. 독립 판정은 별도 subagent 세션의 검토이며 정형 `codex exec` 기능 완료 lifecycle을 수행했다는 뜻은 아니다. 사용자 수용은 별개다.
