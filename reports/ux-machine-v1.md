# UX 합의 상태머신과 실제 Trace 연결 — 기능 개발 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: Ux 디자이너와의 인터뷰로 결론지어진 것은 상태머신으로 trace 머신으로 연동되어야 함
- 업무 맥락: 사용자 확정 요구는 UX 인터뷰 결론을 상태머신으로 실제 Trace와 연결하는 것이다. 구현 범위는 기존 Python 상태 관측 계약 확장과 관련 스킬·로컬 예제다. 기존 screens/단계 계약은 호환한다. 앱이 소유한 실제 state_id/feature/screen/data를 관측하며 전이 ID·operation과 허용 경로·수명·초기 상태·중요 경로 실행 누락을 검사한다. 상태머신이 앱 상태를 대신 변경하지 않는다. 제품 UI 클릭·공개 배포·전역 설치는 범위 밖이다. 하네스 자체는 CLI 기능이며 UX 저장 예제는 인터뷰를 수행했다는 주장이 아닌 합성 fixture다. 예제 흐름: editing(편집 화면, 초안과 저장) → submit → saving(같은 화면, 처리 중) → save-failed → failed(초안·오류·재시도) → retry → saving → save-succeeded → saved(상세 화면, 저장 결과). 유지: 실패/재시도에서 초안. 임시: 오류. 정리: 재시도 시 오류, 성공 시 초안. 단일 Trace의 unvisited 분기는 실행 증거가 아니며 required_transitions는 시나리오별 중요한 경로를 요구한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/plan.json)
- 기준 버전: `23d4fba83fead71d6feff4f2ead894f832459f0044fe45293fc465c51ff7ee9a`
- 소스 버전: `a273fb7789f0f82037f5031f82e9a7cbe4cf7f5c0d3668d609ba2e91a0579930`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: UX 상태·전이 ID를 실제 앱 snapshot과 Flow.transition에 기록하고 같은 화면의 편집/저장 중/실패를 구별한다. 앱 상태 소유는 유지한다. | 자동 검사 통과 | [machine-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/7e130fb726c9/output.log), [machine-example](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/048835dbbe90/output.log) |
| R2: 초기 상태·허용 전이·operation·화면/기능 소유·허용 필드와 preserve/drop을 검사하고 ID 누락·잘못된 경로·실제 관측 누락을 거부한다. 필수 전이 미실행은 거부하고 미실행 분기를 보고한다. | 자동 검사 통과 | [machine-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/7e130fb726c9/output.log), [machine-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/d14841374bc7/output.log) |
| R3: 기획/UX/개발/검증 스킬이 확정한 UX 흐름→상태머신 계약→실제 Trace를 같은 ID로 연결하고 설계와 UI 실행 증거를 구분한다. 예제가 스캐폴드 runtime에도 포함되어 CLI 수집·검사되며 명령 성공만으로 틀린 상태머신을 통과시키지 않는다. | 자동 검사 통과 | [machine-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/d14841374bc7/output.log), [machine-example](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/048835dbbe90/output.log) |
| R4: 기존 상태 계약·Trace·CLI 하네스의 회귀 검사를 유지한다. | 자동 검사 통과 | [regression](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/a3cfdd83f052/output.log) |

## 재현 명령과 검사 결과

### machine-unit · unit · ux-machine

```sh
python3 -m unittest tests.unit.test_ux_machine -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/7e130fb726c9/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/7e130fb726c9/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/unit/test_ux_machine.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/examples/ux_save/expected.json)
### machine-integration · integration · ux-machine

```sh
python3 -m unittest tests.integration.test_ux_machine -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/d14841374bc7/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/d14841374bc7/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/integration/test_ux_machine.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
### machine-example · integration · ux-example

```sh
python3 -m examples.ux_save.demo
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/048835dbbe90/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/048835dbbe90/result.json)
- [고정된 기대 흐름](/Users/jwsong/tools/proofstill/examples/ux_save/expected.json)
- 흐름 UX 저장 실패와 재시도 · 4단계 · [UI 추적 보기](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/048835dbbe90/traces/c606ce2a5bcf4ee1b223cdb06d4d79e6.html) · [원본 JSONL](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/048835dbbe90/traces/c606ce2a5bcf4ee1b223cdb06d4d79e6.jsonl)
- 상태머신 실행 전이: retry, save-failed, save-succeeded, submit
- 상태머신 미실행 전이: 없음
- [테스트 코드](/Users/jwsong/tools/proofstill/examples/ux_save/demo.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/examples/ux_save/expected.json)
### regression · unit · regression

```sh
python3 -m unittest discover -s tests -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/a3cfdd83f052/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/runs/a3cfdd83f052/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_contract.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/tests/unit/test_order_workspace.py)
- [테스트 test_parallel_work.py](/Users/jwsong/tools/proofstill/tests/unit/test_parallel_work.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/tests/unit/test_report.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_view.py)
- [테스트 test_ux_machine.py](/Users/jwsong/tools/proofstill/tests/unit/test_ux_machine.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/tests/integration/test_state_lifetime.py)
- [테스트 test_ux_machine.py](/Users/jwsong/tools/proofstill/tests/integration/test_ux_machine.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/__init__.py)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a18f5a-e69f-7103-a0f6-c1b6c1094d77` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/reviews/implementation-41f545f7e820/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/reviews/implementation-41f545f7e820/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/reviews/implementation-41f545f7e820/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/reviews/implementation-41f545f7e820/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/ux-machine-v1/reviews/implementation-41f545f7e820/manifest.json)
  - R1: pass — `examples/ux_save/demo.py`가 앱 소유 상태를 snapshot으로 읽고 `Flow.transition`에 전이 ID를 기록한다. 격리 실행과 CLI 검증에서 editing→saving→failed→saving→saved가 관측됐고, 같은 `profile.edit` 화면에서도 상태 ID가 구별됐다. machine-unit 8개 통과, machine-example 및 trace verify 통과.
  - R2: pass — `proofstill/state.py::verify_machine`이 initial, from/to, operation, feature/screen, required/optional, preserve/drop, required_transitions를 검사한다. 단위 검사가 ID 누락·잘못된 경로/operation·관측 누락·필수 전이 미실행을 거부하고 미실행 분기를 보고함을 확인했다. machine-unit 8개와 machine-integration 2개 모두 통과.
  - R3: pass — interview/UX/develop/verify 스킬이 UX ID→상태머신 계약→실제 Trace 연결과 설계/제품 UI 증거 구분을 명시한다. scaffold 통합 검사가 runtime 예제 포함과 실행·수집·검증을 확인하며, 종료 코드 0이어도 잘못된 계약은 거부했다. machine-integration 2개 및 격리된 예제 CLI 검증 통과.
  - R4: pass — `python3 -m unittest discover -s tests -v`를 별도 TMPDIR에서 직접 실행해 기존 상태 계약·Trace·CLI 하네스를 포함한 93개 검사가 모두 통과했다. 검토 전후 manifest 46개 항목의 SHA-256 불일치도 0개였다.

## 구현·아티팩트

- [UX 상태머신 예제 계약](/Users/jwsong/tools/proofstill/examples/ux_save/expected.json)
- [실제 앱 관측과 전이 연결 예제](/Users/jwsong/tools/proofstill/examples/ux_save/demo.py)

## 한계·남은 사항

- 앱이 snapshot으로 노출한 JSON만 검사한다. 제품 UI 클릭과 숨은 상태, 실제 서버 저장은 이 합성 예제의 범위 밖이다.
- 공개 패키지 배포와 기존 전역 설치 갱신은 수행하지 않는다.
- 검증 범위는 앱이 snapshot으로 노출한 JSON과 합성 저장 예제다. 제품 UI 클릭, 숨은 상태 및 실제 서버 저장은 확인하지 않았다.
- 공개 패키지 배포와 기존 전역 설치 갱신은 검증하지 않았다.
- PASS는 packet의 지정 요구사항과 실행 기준 범위에 한정되며 모든 결함의 부재를 의미하지 않는다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
