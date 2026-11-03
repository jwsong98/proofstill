# 불필요한 초기 복사본 제거 — 기능 개발 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 아니 git 쓰면 되는데 굳이? 빨리 버려
- 업무 맥락: 직전 설명의 시작 시점 baseline 복사본 생성과 보고 링크 및 기존 baseline 폴더 제거. baseline_source 해시와 독립 리뷰 snapshot은 유지. Git 자동화나 재배포는 요청 범위 아님.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/plan.json)
- 기준 버전: `eace57d3e3c7c77a6fed47807d35611856bf6c5d8f9dde25adf246c7535b794f`
- 소스 버전: `c09c91364f4c881813c67694bbd4bbff95abaee83ee1ccb70d0aef11fcb5068b`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: init은 초기 코드 복사본을 만들지 않고 보고서도 해당 링크를 생성하지 않는다. | 자동 검사 통과 | [no-baseline](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/f3af48f4ea64/output.log) |
| R2: 기존 변경 감지, Red/Green, 리뷰 복사본, 보고 및 정리 동작이 유지된다. | 자동 검사 통과 | [regression](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/93a385d9daf5/output.log) |

## 재현 명령과 Red → Green

### no-baseline · unit · workflow

```sh
python3 -m unittest tests.unit.test_report.ReportTests.test_init_and_report_do_not_keep_initial_source_copy -v
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/dd23ad9e9520/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/dd23ad9e9520/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/f3af48f4ea64/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/f3af48f4ea64/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/unit/test_report.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/__init__.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-verify/SKILL.md)
### regression · integration · workflow

```sh
python3 -m unittest tests.unit.test_runner tests.unit.test_report tests.integration.test_workflow -v
```

- Red: 기존 회귀 검사로 생략
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/93a385d9daf5/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/runs/93a385d9daf5/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/unit/test_runner.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/unit/test_report.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/__init__.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/unit/__init__.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/integration/__init__.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-verify/SKILL.md)

## 독립 리뷰

- 기준 적절성: 통과 · 세션 `01a18f37-fe9b-71e3-91a0-09b928e134ba` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/criteria-b7ba3918ac54/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/criteria-b7ba3918ac54/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/criteria-b7ba3918ac54/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/criteria-b7ba3918ac54/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/criteria-b7ba3918ac54/snapshot/manifest.json)
  - R1: pass — no-baseline 기준은 tests/unit/test_report.py:26-29에서 init 직후 작업 폴더가 plan.json/state.json만 포함하는지와 보고서에 baseline/manifest.json 링크가 없는지를 함께 검증한다. 지정 명령을 직접 실행해 현재 구현에서 INITIAL_COPY_CREATED로 정확히 Red가 발생함을 확인했다.
  - R2: pass — regression 기준은 runner/report/integration 전체 30개 테스트를 실행하며 변경 감지, Red/Green 판정, 독립 리뷰 snapshot, 보고서 링크, cleanup 및 CLI 종단 흐름을 포함한다. 직접 실행 결과 R1의 의도된 Red 1건을 제외한 기존 29개 검사가 통과했다. Green 패턴은 실제 테스트 수와 OK를 요구하므로 일부 실행이나 실패를 통과로 오인하지 않는다.
- 구현: 통과 · 세션 `01a18f38-c444-7bc1-9760-c4d59b272163` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/implementation-1f3803bf68bf/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/implementation-1f3803bf68bf/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/implementation-1f3803bf68bf/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/implementation-1f3803bf68bf/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/remove-baseline-v2/reviews/implementation-1f3803bf68bf/snapshot/manifest.json)
  - R1: pass — 직접 실행한 no-baseline 검사가 1/1 통과했다. workflow.py:83-96의 init은 plan.json/state.json만 생성하고 baseline_source 해시만 저장한다. report.py에는 baseline 링크 생성이 없으며, test_report.py:26-29가 초기 복사본 및 baseline/manifest.json 링크 부재를 확인한다.
  - R2: pass — 지정 regression 명령과 전체 unittest discover를 직접 실행해 모두 30/30 통과했다. workflow.py:67-80, 109-215, 218-250은 source digest, Red/Green 실행, 독립 리뷰 snapshot과 무결성 검사를 유지하고, report.py:19-99 및 workflow.py:287-302는 보고·정리 동작을 유지한다. 계산한 현재 source digest가 packet의 c09c91364f4c881813c67694bbd4bbff95abaee83ee1ccb70d0aef11fcb5068b와 일치했다.

## 구현·아티팩트

- [워크플로](/Users/jwsong/tools/proofstill/proofstill/workflow.py)
- [보고 생성](/Users/jwsong/tools/proofstill/proofstill/report.py)

## 한계·남은 사항

- 로컬 소스 변경이며 기존 배포 tgz는 재패키징하지 않는다.
- criteria 단계 판정으로, 변경 후 구현의 실제 통과 여부는 implementation 검토에서 두 지정 명령을 다시 실행해야 한다.
- 배포 tgz 재패키징은 명시적으로 요청 범위 밖이다.
- 검증은 전달된 snapshot과 지정·전체 30개 테스트 범위에 한정된다.
- 요청 범위대로 기존 배포 tgz의 재패키징 여부는 검증하지 않았다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
