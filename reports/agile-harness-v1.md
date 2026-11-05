# 계약 기반 병행 개발과 검증·제출 안정성 — 기능 개발 보고

# 계약 기반 병행 개발과 검증·제출 안정성 — 인계 브리핑

목표: 사용자: 오케이 진행해. 추가로 이 하네스는 구조화와 추상화를 이용해 전체 제품을 빠르게 빌드하고, 이와 동시에 주요 로직에 대한 엣지케이스 또는 로직 자체에 대한 구현을 동시에 진행할 수 있게 해야 함. 궁금한 점을 가지고 에이전트랑 이야기하면서 보강하고 제출 안정성을 얻고 비교 케이스도 생기게 한다.
맥락: 사용자는 직전 분석의 실행 제어/토큰 계측/중복 기록/검토 범위/판정 구분 개선을 승인했다. 기존 Python CLI와 로컬 증거 구조를 확장한다. 새 스택/외부서비스/추가 자동 모델 호출을 도입하지 않는다. 기존 dirty console 파일과 LINKLAB 원본·에이전트 정의·실험 결과를 보존한다. 모델 추론은 6.1-sol 또는 5.6-terra만. 현재 검토는 하네스 런타임/CLI/예제 범위이며 실제 웹 콘솔 신규 화면이나 별도 생산성 비교 실험은 범위 밖이다.
실행 위치: `/Users/jwsong/tools/proofstill`
기준·원문: /Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/plan.json
맥락 자료: 기능 정의의 intent/context

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| AH-01: 리뷰 무출력 추론을 기본 중단하지 않고 제한 변경/취소를 자식에 전파한다. 명시 없는 자동 재시도는 하지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-02: 세션 누적 사용량을 차분 집계하고 완료/중단/미관측을 구분한다. 기존 실험 원본은 보존한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-03: 같은 요구 ID로 기준 revision과 실제 답변 근거를 보존하고 영향 없는 검사/구현 기록을 재사용한다. 독립 리뷰에는 변경과 교차 영향을 제공한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-04: 제품 결함·미검증·실행기 오류를 구분하고 미검증을 통과시키지 않으며 같은 미검증 리뷰를 불필요하게 반복하지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-05: 공통 입출력 계약으로 제품 흐름과 로직/엣지케이스 작업을 분리한다. 소유 경계/의존성/작업 패킷을 제공하고 독립 검사는 병행한 뒤 통합한다. 질문은 해당 작업만 보류하고 답변 변경은 의존 통합 근거에도 반영한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-06: 동일 입력의 기준/개선 구현을 별도 검사기로 비교한다. invalid와 실행 오류를 구분하고 소스 변경은 비교 완료 근거로 쓰지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-07: 소스/필수물/답변/검증 근거를 고정한 제출 스냅샷을 만들고 새 partial이 마지막 verified를 덮지 않는다. 미검증/진행 중/변경된 결과를 verified로 표시하지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |
| AH-08: 하나의 프로젝트 정의에서 작업 패킷과 요구 현황을 파생하고 실제 예제로 제품/계산/저장/조회/비교/부분 제출을 재현한다. 에이전트 호출은 기존 Codex 위임 수단을 사용하며 CLI가 자동 모델을 생성했다고 주장하지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |

## 지금 확인할 일

- AH-01: 리뷰 무출력 추론을 기본 중단하지 않고 제한 변경/취소를 자식에 전파한다. 명시 없는 자동 재시도는 하지 않는다.
- 구현 경로: proofstill/execution.py, proofstill/reviewer.py, proofstill/workflow.py
- AH-02: 세션 누적 사용량을 차분 집계하고 완료/중단/미관측을 구분한다. 기존 실험 원본은 보존한다.
- 구현 경로: proofstill/usage.py, examples/lab_dispatch/exam.py
- AH-03: 같은 요구 ID로 기준 revision과 실제 답변 근거를 보존하고 영향 없는 검사/구현 기록을 재사용한다. 독립 리뷰에는 변경과 교차 영향을 제공한다.
- 구현 경로: proofstill/revisions.py, proofstill/workflow.py, proofstill/handoff.py
- AH-04: 제품 결함·미검증·실행기 오류를 구분하고 미검증을 통과시키지 않으며 같은 미검증 리뷰를 불필요하게 반복하지 않는다.
- 구현 경로: proofstill/assurance.py, proofstill/handoff.py, proofstill/reviewer.py
- AH-05: 공통 입출력 계약으로 제품 흐름과 로직/엣지케이스 작업을 분리한다. 소유 경계/의존성/작업 패킷을 제공하고 독립 검사는 병행한 뒤 통합한다. 질문은 해당 작업만 보류하고 답변 변경은 의존 통합 근거에도 반영한다.
- 구현 경로: proofstill/project.py, proofstill/project_cli.py
- AH-06: 동일 입력의 기준/개선 구현을 별도 검사기로 비교한다. invalid와 실행 오류를 구분하고 소스 변경은 비교 완료 근거로 쓰지 않는다.
- 구현 경로: proofstill/comparison.py
- AH-07: 소스/필수물/답변/검증 근거를 고정한 제출 스냅샷을 만들고 새 partial이 마지막 verified를 덮지 않는다. 미검증/진행 중/변경된 결과를 verified로 표시하지 않는다.
- 구현 경로: proofstill/submission.py
- AH-08: 하나의 프로젝트 정의에서 작업 패킷과 요구 현황을 파생하고 실제 예제로 제품/계산/저장/조회/비교/부분 제출을 재현한다. 에이전트 호출은 기존 Codex 위임 수단을 사용하며 CLI가 자동 모델을 생성했다고 주장하지 않는다.
- 구현 경로: examples/agile_product, README.md, .agents/skills/proofstill-develop/SKILL.md

## 재현 검사

- unit: 통과 · `/opt/homebrew/opt/python@3.14/bin/python3.14 -m unittest discover -s tests/unit -q`
- 확인할 결과: 검사 파일의 조건과 실제 출력 대조: tests/unit, tests/support.py
- 확인 범위: 등록된 검사 범위. 제품 화면 확인 여부는 검사 내용을 확인하세요.
- 실제 출력: /Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/e8e9c270c368/output.log
- integration: 통과 · `/opt/homebrew/opt/python@3.14/bin/python3.14 -m unittest discover -s tests/integration -q`
- 확인할 결과: 검사 파일의 조건과 실제 출력 대조: tests/integration, tests/support.py
- 확인 범위: 등록된 검사 범위. 제품 화면 확인 여부는 검사 내용을 확인하세요.
- 실제 출력: /Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log

## 담당과 재개 맥락

- 사람: 의도·범위·실제 답변과 최종 수용을 결정한다. 사용자가 분석 개선안 실행을 승인하고 병행 개발을 추가 요청했다.
- AI: 기존 스택 안에서 구현 방법을 선택하고 로컬 검사·독립 검토·커밋한다. 외부 배포/전송이나 사람의 수용을 대신하지 않는다.
- 현재 실행 상태: 보고 생성 및 사용자 전달
- 다음 행동: 실행 예제로 사용자가 병행 개발·질문·비교·제출 흐름을 확인한다.
- 가정: 모델 자동 생성과 UI 신규 화면은 이번 변경 범위 밖이다. / 현재 저장소 CLI 버전이며 전역 설치본은 별도 관리된다.
- 결정 기록: 없음. 사용자 수용을 의미하지 않습니다.

## 사람이 직접 확인할 행동

- AH-01: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 리뷰 무출력 추론을 기본 중단하지 않고 제한 변경/취소를 자식에 전파한다. 명시 없는 자동 재시도는 하지 않는다.
- AH-02: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 세션 누적 사용량을 차분 집계하고 완료/중단/미관측을 구분한다. 기존 실험 원본은 보존한다.
- AH-03: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 같은 요구 ID로 기준 revision과 실제 답변 근거를 보존하고 영향 없는 검사/구현 기록을 재사용한다. 독립 리뷰에는 변경과 교차 영향을 제공한다.
- AH-04: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 제품 결함·미검증·실행기 오류를 구분하고 미검증을 통과시키지 않으며 같은 미검증 리뷰를 불필요하게 반복하지 않는다.
- AH-05: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 공통 입출력 계약으로 제품 흐름과 로직/엣지케이스 작업을 분리한다. 소유 경계/의존성/작업 패킷을 제공하고 독립 검사는 병행한 뒤 통합한다. 질문은 해당 작업만 보류하고 답변 변경은 의존 통합 근거에도 반영한다.
- AH-06: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 동일 입력의 기준/개선 구현을 별도 검사기로 비교한다. invalid와 실행 오류를 구분하고 소스 변경은 비교 완료 근거로 쓰지 않는다.
- AH-07: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 소스/필수물/답변/검증 근거를 고정한 제출 스냅샷을 만들고 새 partial이 마지막 verified를 덮지 않는다. 미검증/진행 중/변경된 결과를 verified로 표시하지 않는다.
- AH-08: 연결된 CLI·검사 사례와 실제 영수증을 대조한다. → 기대: 하나의 프로젝트 정의에서 작업 패킷과 요구 현황을 파생하고 실제 예제로 제품/계산/저장/조회/비교/부분 제출을 재현한다. 에이전트 호출은 기존 Codex 위임 수단을 사용하며 CLI가 자동 모델을 생성했다고 주장하지 않는다.

인계 정보: 필수 정보 있음 — 기술 검사/리뷰 결과는 위 표에서 별도 확인

사용자 수용: 미확인. 사람이 원문·코드·실행 출력을 대조한 뒤 YES/NO로 판단합니다.
NO이면 차이를 요구 ID에 연결해 수정하고 영향받는 검사·독립 리뷰를 다시 수행합니다.
한계: 기록은 AI의 사실성을 보증하지 않습니다. 등록 밖 코드·검사, 하네스 우회, 거짓 기록은 별도 확인이 필요합니다.
- 명시된 소유 경계는 협업 규칙이며 공유 로컬 파일의 보안 격리가 아니다.
- 동일 프로젝트의 구현 에이전트 실행은 Codex 위임 수단을 사용한다. 이 변경이 새 모델 워커를 자동 생성하지는 않는다.
- 한 번의 구현/검증으로 생산성 절감 배수나 무결함을 주장하지 않는다.
- PASS는 전달된 하네스 런타임·CLI·agile_product 예제와 현재 source digest 70fe6add… 범위에 한정됩니다.
- current_green의 원본 로그·영수증·해시는 확인했으며, 이미 실행된 unit/integration 전체 검사는 중복 실행하지 않았습니다. 외부 Codex 실행 환경, 실제 사용자 수용 및 등록 밖 파일은 검토 범위 밖입니다.


- 자동 검사·독립 리뷰: **검증 완료**
- 인계 준비: 필수 정보·기술 근거 있음
- 사용자 수용: 미확인
- 의도: 사용자: 오케이 진행해. 추가로 이 하네스는 구조화와 추상화를 이용해 전체 제품을 빠르게 빌드하고, 이와 동시에 주요 로직에 대한 엣지케이스 또는 로직 자체에 대한 구현을 동시에 진행할 수 있게 해야 함. 궁금한 점을 가지고 에이전트랑 이야기하면서 보강하고 제출 안정성을 얻고 비교 케이스도 생기게 한다.
- 업무 맥락: 사용자는 직전 분석의 실행 제어/토큰 계측/중복 기록/검토 범위/판정 구분 개선을 승인했다. 기존 Python CLI와 로컬 증거 구조를 확장한다. 새 스택/외부서비스/추가 자동 모델 호출을 도입하지 않는다. 기존 dirty console 파일과 LINKLAB 원본·에이전트 정의·실험 결과를 보존한다. 모델 추론은 6.1-sol 또는 5.6-terra만. 현재 검토는 하네스 런타임/CLI/예제 범위이며 실제 웹 콘솔 신규 화면이나 별도 생산성 비교 실험은 범위 밖이다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/plan.json)
- 기준 버전: `44c2796836fba7fc3f9c534a13c613744b121ed5cc9349b05a403d287c6ac4b7`
- 소스 버전: `70fe6add4cf40645644f2ed59f5cc791d0e07a9361f00021bfa1ad8946e4e6fa`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| AH-01: 리뷰 무출력 추론을 기본 중단하지 않고 제한 변경/취소를 자식에 전파한다. 명시 없는 자동 재시도는 하지 않는다. | 자동 검사 통과 | [unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/e8e9c270c368/output.log) |
| AH-02: 세션 누적 사용량을 차분 집계하고 완료/중단/미관측을 구분한다. 기존 실험 원본은 보존한다. | 자동 검사 통과 | [unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/e8e9c270c368/output.log) |
| AH-03: 같은 요구 ID로 기준 revision과 실제 답변 근거를 보존하고 영향 없는 검사/구현 기록을 재사용한다. 독립 리뷰에는 변경과 교차 영향을 제공한다. | 자동 검사 통과 | [integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log) |
| AH-04: 제품 결함·미검증·실행기 오류를 구분하고 미검증을 통과시키지 않으며 같은 미검증 리뷰를 불필요하게 반복하지 않는다. | 자동 검사 통과 | [unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/e8e9c270c368/output.log) |
| AH-05: 공통 입출력 계약으로 제품 흐름과 로직/엣지케이스 작업을 분리한다. 소유 경계/의존성/작업 패킷을 제공하고 독립 검사는 병행한 뒤 통합한다. 질문은 해당 작업만 보류하고 답변 변경은 의존 통합 근거에도 반영한다. | 자동 검사 통과 | [integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log) |
| AH-06: 동일 입력의 기준/개선 구현을 별도 검사기로 비교한다. invalid와 실행 오류를 구분하고 소스 변경은 비교 완료 근거로 쓰지 않는다. | 자동 검사 통과 | [integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log) |
| AH-07: 소스/필수물/답변/검증 근거를 고정한 제출 스냅샷을 만들고 새 partial이 마지막 verified를 덮지 않는다. 미검증/진행 중/변경된 결과를 verified로 표시하지 않는다. | 자동 검사 통과 | [integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log) |
| AH-08: 하나의 프로젝트 정의에서 작업 패킷과 요구 현황을 파생하고 실제 예제로 제품/계산/저장/조회/비교/부분 제출을 재현한다. 에이전트 호출은 기존 Codex 위임 수단을 사용하며 CLI가 자동 모델을 생성했다고 주장하지 않는다. | 자동 검사 통과 | [integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log) |

## 재현 명령과 검사 결과

### unit · unit · harness

```sh
/opt/homebrew/opt/python@3.14/bin/python3.14 -m unittest discover -s tests/unit -q
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/e8e9c270c368/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/e8e9c270c368/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 test_assurance.py](/Users/jwsong/tools/proofstill/tests/unit/test_assurance.py)
- [테스트 test_collaboration.py](/Users/jwsong/tools/proofstill/tests/unit/test_collaboration.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_contract.py)
- [테스트 test_execution_control.py](/Users/jwsong/tools/proofstill/tests/unit/test_execution_control.py)
- [테스트 test_handoff.py](/Users/jwsong/tools/proofstill/tests/unit/test_handoff.py)
- [테스트 test_order_workspace.py](/Users/jwsong/tools/proofstill/tests/unit/test_order_workspace.py)
- [테스트 test_parallel_work.py](/Users/jwsong/tools/proofstill/tests/unit/test_parallel_work.py)
- [테스트 test_report.py](/Users/jwsong/tools/proofstill/tests/unit/test_report.py)
- [테스트 test_review_watchdog.py](/Users/jwsong/tools/proofstill/tests/unit/test_review_watchdog.py)
- [테스트 test_runner.py](/Users/jwsong/tools/proofstill/tests/unit/test_runner.py)
- [테스트 test_state_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_contract.py)
- [테스트 test_state_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_state_trace.py)
- [테스트 test_trace.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace.py)
- [테스트 test_trace_check.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_check.py)
- [테스트 test_trace_view.py](/Users/jwsong/tools/proofstill/tests/unit/test_trace_view.py)
- [테스트 test_usage.py](/Users/jwsong/tools/proofstill/tests/unit/test_usage.py)
- [테스트 test_ux_machine.py](/Users/jwsong/tools/proofstill/tests/unit/test_ux_machine.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
### integration · integration · harness

```sh
/opt/homebrew/opt/python@3.14/bin/python3.14 -m unittest discover -s tests/integration -q
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/runs/372496c9f282/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/integration/__init__.py)
- [테스트 test_agile_cli.py](/Users/jwsong/tools/proofstill/tests/integration/test_agile_cli.py)
- [테스트 test_check_reuse.py](/Users/jwsong/tools/proofstill/tests/integration/test_check_reuse.py)
- [테스트 test_comparison.py](/Users/jwsong/tools/proofstill/tests/integration/test_comparison.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/tests/integration/test_data_flow.py)
- [테스트 test_project.py](/Users/jwsong/tools/proofstill/tests/integration/test_project.py)
- [테스트 test_revisions.py](/Users/jwsong/tools/proofstill/tests/integration/test_revisions.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/tests/integration/test_state_lifetime.py)
- [테스트 test_submission.py](/Users/jwsong/tools/proofstill/tests/integration/test_submission.py)
- [테스트 test_ux_machine.py](/Users/jwsong/tools/proofstill/tests/integration/test_ux_machine.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a1a5ad-5a2c-7431-9a51-bcf241624a92` · 실행기 `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/reviews/implementation-dd9e708035af/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/reviews/implementation-dd9e708035af/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/reviews/implementation-dd9e708035af/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/reviews/implementation-dd9e708035af/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/agile-harness-v1/reviews/implementation-dd9e708035af/manifest.json)
  - AH-01: pass — 원본 unit 영수증 e8e9c270c368 및 로그 해시가 packet과 일치하며 127 tests OK. execution.py의 ExecutionControl은 deadline/cancel을 자식 환경에 전달하고 프로세스 그룹을 종료한다. reviewer.py는 기본 review_retries=0이며 idle 제한도 기본 비활성이다; test_execution_control.py·test_review_watchdog.py가 취소·자식 정리·무출력·명시 재시도를 확인한다.
  - AH-02: pass — 동일 unit 영수증의 현재 source digest 70fe6add…와 현행 소스가 일치한다. usage.py aggregate_calls는 동일 thread의 누적 계량을 차분 집계하고 감소/누락을 missing으로, 부분 관측을 partial로 구분한다. test_usage.py가 완료·부분·미관측 사례를 확인한다.
  - AH-03: pass — 원본 integration 영수증 372496c9f282 및 로그 해시가 packet과 일치하며 30 tests OK. revisions.py는 이전 plan/state를 revision archive에 보존하고 requirement별 입력 basis로 영향 범위를 계산하며, workflow.py는 delta를 독립 리뷰 packet에 제공한다. test_revisions.py와 test_check_reuse.py가 변경 없는 검사 재사용 및 영향 요구 재검사를 확인한다.
  - AH-04: pass — assurance.py·handoff.py는 defect, unverified, execution_error, stale 및 interrupted를 분리해 표시하고, reviewer.validate_verdict는 pass 외 요구별 상태를 최종 통과로 허용하지 않는다. test_assurance.py의 unverified/launcher-error 사례와 test_review_watchdog.py의 timeout 사례가 이를 확인한다.
  - AH-05: pass — project.py는 contract, 작업별 owns, 의존성 DAG, claim 및 작업 packet을 검증하고 product·logic을 병렬 실행한 뒤 integration을 의존시킨다. decision 변경은 해당 feature의 기준을 무효화하고 downstream dependency를 재검사하게 한다. test_project.py가 병행 실행, 질문의 국소 차단 및 downstream 무효화를 확인한다.
  - AH-06: pass — comparison.py는 동일 case input을 baseline/candidate 각각에 전달하고 별도 validator의 valid 결과만 domain invalid로 기록한다. 명령/파싱 오류는 error이며, 비교 중 입력 소스 변경은 comparable=false가 된다. test_comparison.py와 examples/agile_product의 half-cent/round-up 사례가 이 경계를 확인한다.
  - AH-07: pass — submission.py는 등록 소스·검사·context·artifact 및 feature evidence를 해시하여 archive에 넣고, 캡처 전후 변경·누락·제외·현재 submission_ready를 partial로 처리한다. verified일 때만 last-verified 포인터를 갱신한다. test_submission.py가 partial이 이전 verified를 보존하고 archive 중 변경을 partial로 만드는 것을 확인한다.
  - AH-08: pass — examples/agile_product/project.json 하나에서 product/logic/integration feature와 contract·comparison을 파생한다. project CLI는 init/claim/release/test/compare/snapshot을 제공할 뿐 모델 워커를 생성하지 않는다. test_agile_cli.py가 실제 예제의 병행 검사, 저장·조회, half-up 비교, partial snapshot을 재현한다.

## 구현·아티팩트


## 한계·남은 사항

- 명시된 소유 경계는 협업 규칙이며 공유 로컬 파일의 보안 격리가 아니다.
- 동일 프로젝트의 구현 에이전트 실행은 Codex 위임 수단을 사용한다. 이 변경이 새 모델 워커를 자동 생성하지는 않는다.
- 한 번의 구현/검증으로 생산성 절감 배수나 무결함을 주장하지 않는다.
- PASS는 전달된 하네스 런타임·CLI·agile_product 예제와 현재 source digest 70fe6add… 범위에 한정됩니다.
- current_green의 원본 로그·영수증·해시는 확인했으며, 이미 실행된 unit/integration 전체 검사는 중복 실행하지 않았습니다. 외부 Codex 실행 환경, 실제 사용자 수용 및 등록 밖 파일은 검토 범위 밖입니다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
