# 원본 최종 리뷰와 메모리 CLI 흐름 검증 — 기능 개발 보고

- 상태: **미완료**
- 사용자 수용: 미확인
- 의도: 리뷰용 복사본도 굳이 있어야 해? 그냥 수정 다하고 한번에 리뷰해도 되잖아. 다하지 않더라도 CLI + 임시 저장소 (메모리) 로 빠르게 통합 테스트 및 유저 플로우 테스트를 진행할 수 있을 것 같은데? 정 안되면 git worktree 쓰면 됨. 근데 이건 제일 나중에 고려하면 좋겠어. 스캐폴딩 구조에 따라서 각 작업을 동시에 진행해도 충돌이 최소화되어야 함.
- 업무 맥락: 사전 criteria 리뷰와 Red를 선택 사항으로 바꾸고 기본 test/review 명령을 제공한다. 원본 작업 폴더에서 독립 리뷰하고 실행별 TMPDIR·대상 해시를 사용한다. CLI HTTP flow는 새 메모리 DB, seed, 임의 포트, 전용 임시 기록으로 실행한다. 같은 작업 ID의 동시 변이를 막고 다른 작업과 별도 서버의 병렬 검사를 허용한다. UI의 기존 시작 기능을 기능 폴더로 옮기며 공유 계약/생성물/진입점은 한 담당자가 통합한다. worktree 자동 생성·외부 배포·브라우저 클릭은 범위 밖. 기존 DB bootstrap 검사에는 template requirements와 FastAPI fixture 불일치가 관찰되어 별도 한계로 기록한다. 완료된 과거 리뷰는 코드 복사 부분만 제거하고 manifest와 판정/로그는 보존한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/plan.json)
- 기준 버전: `f0f008d6ac012e7c35d54b82c81f8471b363b43093def8d7cefc43034eb2975e`
- 소스 버전: `4ece48e36cf1e228da0548b7679152d3c6cf0833cc979b1354b1ff5ab1184741`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: 사전 리뷰/Red 없이 검사 후 한 번의 독립 리뷰를 수행하며 코드 복사본을 만들지 않는다. 원본 변경과 오래된 결과를 감지한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/a19958cf4a52/output.log) |
| R2: 서로 다른 작업은 독립 기록으로 동시에 검사하고 동일 작업의 중복 명령은 상태를 덮어쓰지 못한다. | 자동 검사 통과 | [harness](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/a19958cf4a52/output.log) |
| R3: 생성 프로젝트 test:flow와 test:fast가 외부 DB·Docker 없이 CLI/HTTP/메모리 DB를 검사하며 동시 실행과 실패 정리에서 공유 기록을 보존한다. | 자동 검사 통과 | [memory-flow](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/6f76dce2d43d/output.log) |
| R4: 스캐폴드는 앱/기능별 파일과 공유 통합 책임을 구분하고 새 스킬·명령·파일을 휴대 가능하게 생성한다. worktree는 자동 사용하지 않는다. | 자동 검사 통과 | [scaffold](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/3638da4bfc0b/output.log) |

## 재현 명령과 검사 결과

### harness · unit · harness

```sh
python3 -m unittest discover -s tests -q
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/a19958cf4a52/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/a19958cf4a52/result.json)
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
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/tests/integration/__init__.py)
- [테스트 test_data_flow.py](/Users/jwsong/tools/proofstill/tests/integration/test_data_flow.py)
- [테스트 test_state_lifetime.py](/Users/jwsong/tools/proofstill/tests/integration/test_state_lifetime.py)
- [테스트 test_workflow.py](/Users/jwsong/tools/proofstill/tests/integration/test_workflow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/__init__.py)
### memory-flow · integration · flow

```sh
python3 -m unittest discover -s tests/bootstrap -p test_memory_flow.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/6f76dce2d43d/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/6f76dce2d43d/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/test_memory_flow.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/backend_support.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/db-requirements.txt)
### scaffold · integration · scaffold

```sh
python3 -m unittest discover -s tests/bootstrap -p test_scaffold.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/3638da4bfc0b/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/runs/3638da4bfc0b/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/test_scaffold.py)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/assets.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/api-skill.md)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 현재 버전에서 무효 · 세션 `01a18f48-2404-75c1-ba74-eef9f0c6b59f` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/reviews/implementation-873f4d1c7020/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/reviews/implementation-873f4d1c7020/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/reviews/implementation-873f4d1c7020/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/reviews/implementation-873f4d1c7020/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/reviews/implementation-873f4d1c7020/manifest.json)
  - R1: pass — `python3 -m unittest discover -s tests -q` 직접 실행: 83개 통과. reviewer/workflow 코드에서 새 ephemeral 세션, 원본 manifest, 기준·소스 digest 재검사 및 오래된 Green/review 거부를 확인했다. 실행 전후 manifest 전체 SHA-256도 일치했다.
  - R2: pass — harness 83개 테스트 통과. `tests/unit/test_parallel_work.py`가 작업별 독립 기록·동시 실행과 동일 작업의 비차단 `fcntl` 잠금 및 상태 비덮어쓰기를 검증한다.
  - R3: unverified — 지정 memory-flow 명령은 3개 중 실패 정리/공유 기록 보존 사례 1개만 통과했다. 나머지 2개는 localhost 임의 포트 bind가 샌드박스에서 `PermissionError: Operation not permitted`로 차단됐다. 정적 검토에서는 메모리 DB, seed, 임의 포트, 실행별 임시 기록과 출력→입력 ID 연결을 확인했다.
  - R4: pass — `test_scaffold.py` 직접 실행: 4개 모두 통과. 앱/기능 파일, 공유 통합 책임, 휴대 가능한 스킬·명령·생성 파일을 검사하며 코드에는 자동 worktree 생성 경로가 없다.

## 구현·아티팩트

- [워크플로](/Users/jwsong/tools/proofstill/proofstill/workflow.py)
- [리뷰 실행](/Users/jwsong/tools/proofstill/proofstill/reviewer.py)
- [메모리 CLI 사용자 흐름 검사](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/flow/test_tasks.py)
- [생성 프로젝트 작업 경계](/Users/jwsong/tools/proofstill/templates/monorepo/AGENTS.md)

## 한계·남은 사항

- 현재 파일 잠금은 POSIX fcntl을 사용한다. Windows 미검증.
- 기존 FastAPI 의존성 fixture와 현재 template requirements 불일치로 test_database.py의 2개 기존 검사는 실패한다. 이를 통과로 주장하지 않는다.
- 현재 소스와 신규 생성 프로젝트 대상 변경이다. 기존 tgz 재발행과 기존 생성 프로젝트 자동 갱신은 하지 않는다.
- 메모리 사용자 흐름은 실제 CLI·HTTP API 검증이며 브라우저 클릭이나 PostgreSQL E2E 재검증은 포함하지 않는다.
- 현재 버전의 독립 구현 리뷰가 필요합니다
- 검토 환경이 localhost 소켓 bind를 금지해 memory-flow의 실제 HTTP 서버 검증이 불가능했다.
- Windows의 POSIX `fcntl` 잠금 동작, 브라우저 클릭, PostgreSQL E2E는 검증 범위 밖이다.
- 검사 전후 manifest 대상 파일 해시는 모두 일치했다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.

## 최종 실행 결과와 검토 한계

- 하네스 83개, 메모리 CLI flow 3개, 스캐폴드 4개, 최신 DB 회귀 3개 검사 통과.
- 기능 폴더로 분리한 생성 프로젝트의 오프라인 설치·build·typecheck 통과.
- 앞선 FastAPI fixture 불일치 2건은 병행 백엔드 갱신 후 재실행에서 해소됨. 위 고정 정의의 해당 한계는 최초 관찰 기록이다.
- 독립 CLI 리뷰는 HTTP 포트 bind가 샌드박스에서 차단되어 전체 통과가 아니다. 이후 테스트 부정 사례를 정확한 HTTP 상태 오류로 보강하고 로컬 검사를 다시 실행했다. 작업 상태를 검증 완료로 바꾸지 않고 재개용 brief를 보존한다.
- 현재 소스 및 새 스캐폴드에 반영했으며 기존 배포 tgz는 재발행하지 않았다.

- [추가 실행 결과](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/additional-checks.json)
- [빌드 로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-build/2.log)
- [타입 검사 로그](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-build/3.log)
- [완료된 리뷰 복사본 정리 목록](/Users/jwsong/tools/proofstill/.proofstill/evidence/direct-review-v1/removed-review-copies.json)
