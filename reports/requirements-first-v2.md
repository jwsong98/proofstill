# 요구 근거 중심 빠른 개발 절차 — 기능 개발 보고

- 상태: **미완료**
- 사용자 수용: 미확인
- 의도: 구현 속도가 느리다. 긴 제공 요구사항을 따로 모아 근거 기반으로 바로 개발하고 담당자와 추가 요구를 반영해야 한다. 사람이 복합 조건의 로직을 파악하고 AI 지시·수정·검증 근거, 구현 범위와 미검증, 데이터 변경 검사, 입력부터 저장까지 흐름, 판단 이유를 설명할 수 있어야 한다.
- 업무 맥락: 사용자 요청은 Proofstill 개발 방식 개선이다. 첨부 통근버스 과제는 사용 상황이며 버스 앱 신규 구현 요청이 아니다. 기존 제공 명세와 실제 답변을 재사용하고 명확한 범위를 즉시 구현하며 미정 업무 조건만 확인한다. 요구사항 문서는 사용자가 요청한 지속 개발 근거다. 시험 자료는 외부 전달하지 않는다. 이 변경은 절차 지침이며 CLI 기능 추가, 전역 설치 갱신, 공개 배포는 범위 밖이다. 설치 회귀는 지침 전달만 확인하므로 실제 개발 속도·에이전트 행동 개선은 별도 실사용으로 확인해야 한다. 독립 검토에서는 원문 요청과 지침의 일관성, 질문/승인 경계 유지, 추적 근거와 사용자 이해 지원을 직접 검토한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/plan.json)
- 기준 버전: `0222602697310ebe01f0883520a081d3c1ac17036e19ce77f0044c17630f2399`
- 소스 버전: `33246540694614d173ef323a7f7eef29efb661b7eca2f12c8ac4313f92929f50`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: 긴 제공 명세를 원문 근거와 요구 ID·조건·구현/검사·상태로 모아 보존하고 담당자 실제 답변과 추가 요청을 변경 영향 단위로 반영한다. | 자동 검사 통과 | [install](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/runs/42c02aa1a9a1/output.log) |
| R2: 명확한 범위를 즉시 구현하고 인터뷰·전체 사전 설계·Trace를 불필요한 관문으로 만들지 않는다. 미정 업무 결정과 연락 권한을 임의 확정하지 않는다. 필수 검사와 최종 독립 리뷰를 유지한다. | 자동 검사 통과 | [install](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/runs/42c02aa1a9a1/output.log) |
| R3: 사람이 조건·로직·데이터 흐름·선택 이유와 AI 수정·검증·조치를 실제 코드/검사 근거로 설명하도록 하고 데이터 변경 검사 및 미검증 한계를 드러낸다. | 자동 검사 통과 | [install](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/runs/42c02aa1a9a1/output.log) |
| R4: 저장소·생성 프로젝트 지침·설치 전달을 일관되게 유지하고 실제 시간 단축·통근버스 검증·전역 설치 갱신을 수행했다고 주장하지 않는다. | 자동 검사 통과 | [install](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/runs/42c02aa1a9a1/output.log) |

## 재현 명령과 검사 결과

### install · integration · setup

```sh
python3 -m unittest tests.setup.test_setup.SetupTests.test_default_install_survives_source_removal_and_runs_scaffold -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/runs/42c02aa1a9a1/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/runs/42c02aa1a9a1/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/setup/test_setup.py)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 실패/미검증 · 세션 `미확인` · 실행기 `codex`
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/reviews/implementation-e50bfea96047/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/reviews/implementation-e50bfea96047/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/reviews/implementation-e50bfea96047/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/requirements-first-v2/reviews/implementation-e50bfea96047/manifest.json)

## 구현·아티팩트

- [개발 스킬](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-develop/SKILL.md)

## 한계·남은 사항

- 설치 회귀와 지침 독립 검토이며 실제 개발 시간·담당자 대화 행동·제품 동작은 이번 작업에서 측정하지 않는다.
- 전역 설치본과 공개 배포본은 갱신하지 않는다.
- 현재 버전의 독립 구현 리뷰가 필요합니다
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
