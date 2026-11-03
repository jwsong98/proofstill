# 앱과 하네스의 요구별 구현·검증 현황 및 인계 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| H1: 요구별 구현 상태·근거·남은 범위를 자동 검사·독립 리뷰와 분리하고 미기록을 추정하지 않는다. 완료 선언은 검증 통과가 아니다. | 구현 완료 | 통과 | 통과 | 미기록 |
| H2: CLI/앱/보고가 하네스 현재 원본을 공유한다. 부분/실패/미실행/중단/오래된 결과를 구분하고, 앱 native 요구/지정 코드·검사 변경과 프로젝트 경계를 확인한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| H3: 기존 앱에 현황표·필터·선택 상세·구현 편집·원문/코드/실행 탐색·그래프 연계를 연결한다. 저장 실패 입력과 프로젝트/재진입 상태를 확인한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| H4: 앱과 동일 snapshot에서 상태·남은 일·원문·코드·명령·출력을 포함하는 휴대 가능한 로컬 HTML을 생성한다. 누락과 생략을 드러내고 스크립트 삽입/경로 이탈을 거부한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| H5: 구현 기록 CLI/앱 연결과 검사·리뷰 역할을 지침에 반영하고 같은 현황에서 보고한다. 실제 속도/사용자 수용과 미실행 검증을 꾸며 쓰지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 구현속도가 느리고 제대로 검증됐는지 확인하기 어렵다. 처음 보는 사람에게 구현/미구현/검증/미검증과 남은 일을 명확히 전달해야 한다. 앱과 연계된 현황·근거 포함 인계를 구현한다.
- 업무 맥락: 사용자는 구현과 검증 분리, 앱 현황표/상세, 하네스 원본 연결, 같은 데이터에서 로컬 인계 HTML 생성, 중복 기록 감소 브리핑 후 진행을 승인했다(2026-11-03). 기존 React/SQLite/Python 스택과 다크 UI, Git/앱 해시 관리 제외를 유지한다. 앱 native 현재성은 요구·구현 기록/등록 코드·검사 파일의 수정 시각, 하네스는 기존 digest로 판단한다. 시각 보존 외부 변경은 앱 검사 한계다. 구현 선언·자동 검사·독립 리뷰·사용자 수용을 구분한다. 기존 미기록을 완료/미구현으로 추정하지 않는다. 흐름: 현황→요구 선택→원문/코드/실행 근거→구현 수정→저장 후 재조회, 실패 시 입력 보존, 프로젝트 변경 시 초안/선택 종료. 인계 파일은 같은 서버 snapshot에서 생성하고 큰 코드/로그의 생략과 조회 실패를 표시한다. 업무 정책/새 스택 논의/새 프로젝트 생성/배포/전역 설치 갱신은 범위 밖이다. 실제 모델 turn과 실사용 속도 개선 측정은 미실행이다. 구현의 UI 증거는 참고 자료이며 독립 리뷰가 재실행한 브라우저 검사로 간주하지 않는다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/plan.json)
- 기준 버전: `3e001a455655d93febb685544ef76beb76c995fde9b55f954851ba7de667966d`
- 소스 버전: `e5acc66a072c7b6139697b2d48ac028df32078ee039849da3d23bad471dd68f9`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| H1: 요구별 구현 상태·근거·남은 범위를 자동 검사·독립 리뷰와 분리하고 미기록을 추정하지 않는다. 완료 선언은 검증 통과가 아니다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/aaf7f98beb61/output.log), [console](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/output.log) |
| H2: CLI/앱/보고가 하네스 현재 원본을 공유한다. 부분/실패/미실행/중단/오래된 결과를 구분하고, 앱 native 요구/지정 코드·검사 변경과 프로젝트 경계를 확인한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/aaf7f98beb61/output.log), [console](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/output.log) |
| H3: 기존 앱에 현황표·필터·선택 상세·구현 편집·원문/코드/실행 탐색·그래프 연계를 연결한다. 저장 실패 입력과 프로젝트/재진입 상태를 확인한다. | 자동 검사 통과 | [console](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/8aedfec613ba/output.log), [build](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/90f9e6a10958/output.log) |
| H4: 앱과 동일 snapshot에서 상태·남은 일·원문·코드·명령·출력을 포함하는 휴대 가능한 로컬 HTML을 생성한다. 누락과 생략을 드러내고 스크립트 삽입/경로 이탈을 거부한다. | 자동 검사 통과 | [console](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/output.log) |
| H5: 구현 기록 CLI/앱 연결과 검사·리뷰 역할을 지침에 반영하고 같은 현황에서 보고한다. 실제 속도/사용자 수용과 미실행 검증을 꾸며 쓰지 않는다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/aaf7f98beb61/output.log), [console](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/8aedfec613ba/output.log), [build](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/90f9e6a10958/output.log) |

## 재현 명령과 검사 결과

### harness · unit · harness

```sh
python3 -m unittest discover -s tests -q
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/aaf7f98beb61/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/aaf7f98beb61/result.json)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 test_contract.py](/Users/jwsong/tools/proofstill/tests/unit/test_contract.py)
- [테스트 test_handoff.py](/Users/jwsong/tools/proofstill/tests/unit/test_handoff.py)
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
### console · integration · console

```sh
npm --prefix console test
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/413069c9dfbe/result.json)
- [테스트 api.test.ts](/Users/jwsong/tools/proofstill/console/tests/api.test.ts)
- [테스트 codex.test.ts](/Users/jwsong/tools/proofstill/console/tests/codex.test.ts)
- [테스트 contextUsage.test.ts](/Users/jwsong/tools/proofstill/console/tests/contextUsage.test.ts)
- [테스트 fake-app-server.mjs](/Users/jwsong/tools/proofstill/console/tests/fixtures/fake-app-server.mjs)
- [테스트 graphLayout.test.ts](/Users/jwsong/tools/proofstill/console/tests/graphLayout.test.ts)
- [테스트 handoff.test.ts](/Users/jwsong/tools/proofstill/console/tests/handoff.test.ts)
- [테스트 messageFormat.test.ts](/Users/jwsong/tools/proofstill/console/tests/messageFormat.test.ts)
- [테스트 service.test.ts](/Users/jwsong/tools/proofstill/console/tests/service.test.ts)
- [테스트 sessionActivities.test.ts](/Users/jwsong/tools/proofstill/console/tests/sessionActivities.test.ts)
- [테스트 store.test.ts](/Users/jwsong/tools/proofstill/console/tests/store.test.ts)
- [테스트 001_initial.sql](/Users/jwsong/tools/proofstill/console/server/migrations/001_initial.sql)
- [테스트 002_feature_checks.sql](/Users/jwsong/tools/proofstill/console/server/migrations/002_feature_checks.sql)
- [테스트 003_implementation_progress.sql](/Users/jwsong/tools/proofstill/console/server/migrations/003_implementation_progress.sql)
### types · unit · console

```sh
npm --prefix console run typecheck
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/8aedfec613ba/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/8aedfec613ba/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/tsconfig.json)
### build · integration · console

```sh
npm --prefix console run build
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/90f9e6a10958/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/runs/90f9e6a10958/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/vite.config.ts)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/package.json)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a19d4b-dd1b-78c1-b768-5bf91f681e9f` · 실행기 `/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/review-launcher.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/reviews/implementation-5b0adf39a54f/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/reviews/implementation-5b0adf39a54f/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/reviews/implementation-5b0adf39a54f/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/reviews/implementation-5b0adf39a54f/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/handoff-clarity-v1/reviews/implementation-5b0adf39a54f/manifest.json)
  - H1: pass — proofstill/handoff.py와 console/server/handoff.ts를 대조했다. tests/unit/test_handoff.py 및 console/tests/handoff.test.ts가 미기록=unknown, 구현 선언과 검사·리뷰 분리, partial/remaining 제약을 검증한다. 지정 검사도 모두 통과했다.
  - H2: pass — CLI와 앱 API에서 handoff-clarity-v1의 H1~H5 행을 조회·정규화해 비교한 결과 완전히 일치했다(cmp=0). 실패·미실행·일부·중단·stale 처리와 코드/검사 변경 현재성 및 프로젝트 경계 부정 사례도 테스트에서 통과했다.
  - H3: pass — 로컬 Chromium에서 현황표, 검색·필터, 상세, 코드·명령·출력 탐색과 그래프 왕복을 실행했다. 없는 경로 저장 시 오류와 입력 보존을 확인했고, 프로젝트 전환 시 오류·초안·검색·선택이 제거되며 재진입 시 원래 저장 기록이 유지됨을 확인했다. typecheck와 build도 성공했다.
  - H4: pass — 서버에서 생성한 1,380,337바이트 HTML을 TMPDIR에 받아 검사했다. H1 상태·원문·proofstill/handoff.py·재현 명령·100-test 출력이 포함됐고 외부 URL과 script 태그는 없었다. 별도 정적 서버의 Chromium에서 파일을 열어 코드 및 검사 상세을 직접 확인했다. 경로 이탈·비밀 경로·스크립트 삽입 부정 사례 테스트도 통과했다.
  - H5: pass — .agents/skills/proofstill-develop/SKILL.md와 README.md가 implement/handoff/report 연결, 구현·검사·독립 리뷰·사용자 수용 분리, 미측정 속도 표기를 반영한다. 직접 실행 결과: Python 100 tests OK, console 63/63 pass, tsc --noEmit 성공, Vite build 성공.

## 구현·아티팩트

- [구현·검증 현황 UI](/Users/jwsong/tools/proofstill/console/web/HandoffView.tsx)
- [브라우저 확인 범위와 한계](/Users/jwsong/tools/proofstill/output/playwright/handoff-clarity/verification.json)
- [앱 화면](/Users/jwsong/tools/proofstill/output/playwright/handoff-clarity/overview.png)
- [하네스 그래프 연계 화면](/Users/jwsong/tools/proofstill/output/playwright/handoff-clarity/harness-linked.png)
- [독립 서버에서 확인한 인계 HTML 예제](/Users/jwsong/tools/proofstill/output/playwright/handoff-clarity/handoff.html)

## 한계·남은 사항

- 실제 Codex 모델 turn, 실사용 개발 속도/인계 소요 시간, 사용자 수용은 미확인이다.
- 브라우저 확인은 합성 fixture의 UI·연결 검사이며 실제 업무 알고리즘의 정확성 검사가 아니다.
- 앱 native 현재성은 수정 시각에 의존한다. 시각 보존 외부 변경과 미등록 구현/검사 경로는 감지하지 못한다.
- 인계 HTML은 시점 snapshot이다. 코드 파일/폴더는 최대 128 KiB, 하네스 검사 출력은 최대 100000자를 포함하고 생략을 표시한다.
- 현재 개발 체크아웃에 반영하며 전역 설치본과 공개 배포본은 갱신하지 않는다.
- 실제 Codex 모델 turn, 실사용 개발 속도·인계 소요 시간 및 사용자 수용은 검증하지 않았다.
- 브라우저 검사는 로컬 Chromium과 검토용 프로젝트를 사용했으며 실제 업무 알고리즘의 정확성을 의미하지 않는다.
- 앱 native 현재성은 수정 시각 기반이므로 시각이 보존된 외부 변경과 미등록 경로는 감지하지 못한다.
- 검토 전후 manifest 대상 파일의 SHA-256 불일치는 0개였다. PASS는 지정 요구와 검사 범위에 한정된다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
