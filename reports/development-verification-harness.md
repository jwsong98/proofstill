# 개발·독립 검증 하네스 — 기능 완료 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 결과: 의도별 고정 검사 → 독립 기준 검토 → 모듈별 Red→Green → 독립 구현 검토 → 근거 링크가 있는 Markdown 보고를 실행할 수 있다.
- 작업 위치: `/Users/jwsong/tools/proofstill` — 이전 T7 경로에서 옮겨진 프로젝트.

## 결과물

| 구성 | 바로가기 |
|---|---|
| 개발 스킬 | [proofstill-develop](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-develop/SKILL.md) |
| 독립 검증 스킬 | [proofstill-verify](/Users/jwsong/tools/proofstill/.agents/skills/proofstill-verify/SKILL.md) |
| 실행 CLI | [bin/proofstill](/Users/jwsong/tools/proofstill/bin/proofstill) |
| 기준·명령 검증 | [contract.py](/Users/jwsong/tools/proofstill/proofstill/contract.py) |
| 상태·TDD·정리 | [workflow.py](/Users/jwsong/tools/proofstill/proofstill/workflow.py) |
| 새 세션·격리 복사본 리뷰 | [reviewer.py](/Users/jwsong/tools/proofstill/proofstill/reviewer.py) |
| Markdown 보고 생성 | [report.py](/Users/jwsong/tools/proofstill/proofstill/report.py) |
| 실제 실행한 기능 보고 예제 | [주문 ID 중복 저장 방지](/Users/jwsong/tools/proofstill/reports/order-dedup-v3.md) |

## 기준과 검증

- [구현 전 검토 기준](/Users/jwsong/tools/proofstill/.proofstill/evidence/harness-build/criteria-contract.json)
- [독립 기준 검토와 회귀 기준 보완 판정](/Users/jwsong/tools/proofstill/.proofstill/evidence/harness-build/criteria-review-revisions.json)
- [초기 Red 원본 출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/harness-build/red-contract.log) — 의도한 미구현 API 실패. 환경/명령 실패를 Red로 간주한 것이 아니다.
- [하네스 최종 Green 출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/harness-build/green-snapshot-equivalence.log) — 34 tests 통과. 리뷰 프로세스 fixture는 상태·실행 연결 검사이며 실제 모델 리뷰와 구분한다.
- [독립 구현 최종 리뷰](/Users/jwsong/tools/proofstill/.proofstill/evidence/harness-build/implementation-review-accepted.json) — 직접 검사 실행, 최초 발견 F1–F4 해결 확인, pass.

| 검사 모듈 | 수 | 직접 재실행 명령 |
|---|---:|---|
| tests.unit.test_contract | 6 | `python3 -m unittest tests.unit.test_contract -v` |
| tests.unit.test_runner | 10 | `python3 -m unittest tests.unit.test_runner -v` |
| tests.unit.test_report | 17 | `python3 -m unittest tests.unit.test_report -v` |
| tests.integration.test_workflow | 1 | `python3 -m unittest tests.integration.test_workflow -v` |

## 실행 예제에서 확인한 것

- 실제 Codex CLI의 서로 다른 새 세션에서 기준 및 구현을 검토했다. 세션 ID·명령 이벤트·판정 원문은 [기능 보고](/Users/jwsong/tools/proofstill/reports/order-dedup-v3.md)에서 연결된다.
- 검토 기준이 부족했던 첫 시도들은 통과로 바꾸지 않고 실패 근거를 보존했다. SQLite 실제 파일과 새 프로세스 영속성을 보완한 v3 기준으로 다시 검토했다.
- unit 4개·integration 6개를 실제 Red에서 Green으로 전환했다. 최종 구현 리뷰도 검사를 재실행했다.
- 보고·실행 로그·기준/코드 스냅샷은 `.proofstill/evidence/`에 보존하고 완료된 예제의 임시 브리핑만 정리한다.

## 사용

```sh
python3 bin/proofstill --help
python3 bin/proofstill report order-dedup-v3
```

## 한계

- 이 하네스는 선언된 요구사항·소스·테스트·맥락을 검토한다. 누락된 업무 의도를 자동으로 증명하거나 모든 버그의 부재를 보장하지 않는다.
- 모델 리뷰는 작업 전역을 보는 새 세션이며 개발 대화를 전달하지 않는다. 공유 로컬 파일의 악의적 조작을 격리하는 보안 시스템은 아니다.
- 리뷰용 복사본은 선언한 파일만 포함한다. 프로젝트 의존성이나 실행 자원이 빠지면 미검증으로 남겨야 한다.
- 로컬 CLI 기본 설정의 모델이 계정에서 지원되지 않아 첫 시도는 실패했다. 예제는 실행별 `--ignore-user-config`로 CLI 기본 설정과 기존 로그인을 사용했다. 전역 설정을 변경하지 않았다. 제공된 응시 환경의 모델·도입 허용 여부는 별도 확인이 필요하다.
