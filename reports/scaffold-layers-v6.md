# 단방향 계층과 독립 TDD 스캐폴드 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| R1: app → usecase → domain, infra → domain 및 조립 예외로 분리하고 역방향/상대 import 위반을 자동 거부한다. app은 domain/infra에 직접 의존하지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |
| R2: domain/usecase는 DB/웹 패키지 없이 가짜 저장소로 정상/잘못된 입력/미존재/저장 실패를 검사한다. 계층별 명령과 단일 테스트 선택 실행을 제공하고 fast는 경계부터 검사한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| R3: 생성된 프로젝트에서 기존 HTTP/DB 동작을 유지하고 기능별 소유권과 공유 파일 순차 통합, Red→Green 절차를 안내한다. npm 배포 목록에 신규 파일을 포함한다. | 구현 완료 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 지금 스캐폴딩 구조가 단방향 의존성 관계로, 멀티 에이전트가 작업을 하더라도 서로의 작업을 방해하지 않은 구조로 되어야 합니다. app -> usecase -> domain 의존성이고, 인프라 계층을 중간에 넣어서 domain 구현체를 만든다. TDD 방식으로 제대로 구현할 수 있게 만들어 봅시다.
- 업무 맥락: 기존 스택과 HTTP/DB 계약 유지. domain은 규칙과 저장소 Protocol, usecase는 이를 호출하고 app은 usecase만 호출. infra는 domain 계약의 SQLAlchemy 구현이며 infra/app.py는 조립 진입점으로만 app/usecase/infra를 연결한다. UI 변경/새 스택/보안 격리는 범위 밖. 기능별 담당 파일과 테스트를 분리하고 공유 계약·조립·생성물·migration·lockfile은 단일 담당 순차 통합. TDD는 순수 domain/usecase 테스트 및 단일 테스트 선택 실행, 의도한 Red와 Green으로 지원한다. 현재 저장소는 Git 메타데이터 없음.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/plan.json)
- 기준 버전: `c076da031c6cae5e6974ec3f0db1c63aa26dfa6a75b1fdc61e202e7842506411`
- 소스 버전: `009f1eb1db0e828a42cc95ba77aa8769577a4dfeb3510c43b58d9d6e994e2ec2`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: app → usecase → domain, infra → domain 및 조립 예외로 분리하고 역방향/상대 import 위반을 자동 거부한다. app은 domain/infra에 직접 의존하지 않는다. | 자동 검사 통과 | [layers](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/72d42263b9b4/output.log) |
| R2: domain/usecase는 DB/웹 패키지 없이 가짜 저장소로 정상/잘못된 입력/미존재/저장 실패를 검사한다. 계층별 명령과 단일 테스트 선택 실행을 제공하고 fast는 경계부터 검사한다. | 자동 검사 통과 | [layers](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/72d42263b9b4/output.log) |
| R3: 생성된 프로젝트에서 기존 HTTP/DB 동작을 유지하고 기능별 소유권과 공유 파일 순차 통합, Red→Green 절차를 안내한다. npm 배포 목록에 신규 파일을 포함한다. | 자동 검사 통과 | [layers](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/72d42263b9b4/output.log), [regression](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/12426ef0c4b5/output.log) |

## 재현 명령과 검사 결과

### layers · integration · scaffold

```sh
python3 -m unittest discover -s tests/bootstrap -p test_architecture.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/72d42263b9b4/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/72d42263b9b4/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/test_architecture.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/domain/__init__.py)
- [테스트 test_tasks.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/domain/test_tasks.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/usecase/__init__.py)
- [테스트 test_tasks.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/usecase/test_tasks.py)
- [테스트 __init__.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/architecture/__init__.py)
- [테스트 test_dependencies.py](/Users/jwsong/tools/proofstill/templates/monorepo/apps/backend/tests/architecture/test_dependencies.py)
### regression · integration · scaffold

```sh
python3 -m unittest discover -s tests/bootstrap -p test_fastapi.py -v
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/12426ef0c4b5/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/runs/12426ef0c4b5/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/tests/bootstrap/test_fastapi.py)

## 독립 리뷰

- 사전 기준 검토 · 선택: 통과 · 세션 `01a1a087-ecce-7c41-9c3e-b2eb4c262e1c` · 실행기 `/tmp/proofstill-layers-review-codex.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/criteria-f2f60d236f5f/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/criteria-f2f60d236f5f/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/criteria-f2f60d236f5f/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/criteria-f2f60d236f5f/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/criteria-f2f60d236f5f/manifest.json)
  - R1: pass — layers 기준은 생성물의 app/usecase/domain/infra 구조와 infra/app.py의 조립 전용 여부를 확인한다. architecture 단위 기준은 역방향·상대·프레임워크 import, 동일 계층 순환을 거부하고 조립 예외만 허용한다. 생성 프로젝트에는 14개 불법 import를 주입해 test:fast가 경계 검사에서 먼저 실패하는지도 확인하도록 설계됐다.
  - R2: pass — layers 기준은 domain/usecase의 정상·잘못된 입력·미존재·저장 실패·인스턴스 격리를 가짜 저장소로 검사한다. python -S 실행으로 DB/웹 패키지 없이 동작하는지 확인하며, test:architecture/domain/usecase 명령과 지정 단일 테스트의 'Ran 1 test'도 검증한다. 현재 기준 명령은 직접 실행되어 LAYER_COMMANDS_MISSING에서 의도한 Red로 실패했다(Ran 1 test, failures=1).
  - R3: pass — layers 기준은 기능별 소유 경로, 공유 파일 순차 통합 및 Red→Green 안내 문구, package.json 배포 목록과 distribution.json의 일치를 검사한다. regression 기준인 test_fastapi.py는 ORM·migration·HTTP·OpenAPI·검증·격리·생성 프로젝트 동작을 다룬다. 직접 실행 결과 4개 중 2개가 통과했고, 나머지는 아직 생성되지 않은 usecase/app 계층과 갱신 전 안내 문구를 정확히 거부했다. 이는 criteria 단계의 예상 Red이며 기준 누락이나 환경 오류가 아니다.
- 기준·구현 최종 검토: 통과 · 세션 `01a1a08d-18d7-78c3-b471-d349cff77c24` · 실행기 `/tmp/proofstill-layers-review-codex.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/implementation-f450a80cf3da/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/implementation-f450a80cf3da/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/implementation-f450a80cf3da/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/implementation-f450a80cf3da/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/scaffold-layers-v6/reviews/implementation-f450a80cf3da/manifest.json)
  - R1: pass — manifest 59개 항목의 SHA-256을 실행 전후 대조해 불일치 0건을 확인했다. layers 검사는 생성 프로젝트의 app→usecase→domain, infra→domain 및 infra/app.py 조립 예외를 확인하고, 역방향·상대·외부 프레임워크 import와 계층 내 순환 의존성의 거부 사례를 실행했다. 지정 명령은 1개 테스트를 4.589초에 실행해 OK로 종료했다.
  - R2: pass — domain/usecase 테스트는 가짜 MemoryTaskStore를 사용하며 정상 생성·수정·조회, 잘못된 제목/완료값, 미존재, 저장 실패 전파, 인스턴스 격리를 검사한다. layers 검사는 test:domain/test:usecase 전체 및 각 필수 사례의 단일 선택 실행을 확인했고, python -S로 두 계층 테스트가 DB·웹 패키지 없이 성공함을 확인했다. test:fast의 경계 우선 실행 및 의도적 위반 시 후속 DB 검사가 실행되지 않는 사례도 통과했다.
  - R3: pass — regression 지정 명령은 FastAPI 수명주기·문서·검증·OpenAPI·격리, 개발 절차, DB 없는 OpenAPI export, ORM/session/constraint/migration metadata 등 4개 테스트를 4.014초에 실행해 OK로 종료했다. layers 검사의 실제 생성 프로젝트에서 unit/integration과 조립된 HTTP 생성→저장→재조회가 성공했다. AGENTS의 기능별 소유권·공유 파일 순차 통합·Red→Green 안내를 확인했다. npm pack --dry-run 결과 453개 파일 중 신규 계층·검사·테스트 필수 파일 누락은 0건이었다.

## 구현·아티팩트


## 한계·남은 사항

- 파일 소유권은 협업 규칙이며 공유 로컬 파일의 보안 격리를 제공하지 않는다. 동적 import의 모든 형태를 증명하지 않는다. 실제 PostgreSQL 컨테이너는 저장 계층 동작을 바꾸지 않는 이번 변경의 필수 검사 범위 밖.
- stage=criteria 검토이므로 현재 구현의 완료 여부는 승인하지 않았다. layers와 regression은 구현 후 모두 Green이어야 한다.
- 동적 import의 모든 형태, 실제 PostgreSQL 컨테이너, 공유 로컬 파일의 보안 격리는 지정 범위 밖이다.
- 검토 전후 manifest의 모든 파일 해시와 디렉터리 존재 여부를 확인했으며 불일치는 없었다.
- 정적 검사는 동적 import의 모든 형태를 증명하지 않는다.
- 실제 PostgreSQL 컨테이너 검사는 수행하지 않았으며, DB 회귀 확인은 메모리 SQLite 및 기존 ORM·migration 검사 범위다.
- 파일 소유권과 순차 통합 안내는 협업 규칙이며 공유 로컬 파일의 보안 격리를 제공하지 않는다.
- PASS는 전달된 R1–R3와 지정 검사 범위의 확인 결과이며 모든 잠재 결함의 부재를 뜻하지 않는다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.

## 추가 실행 증거

- 구현 전 실패: [수동 TDD Red](../.proofstill/evidence/scaffold-layers-v6/tdd-red.log)의 `LAYER_COMMANDS_MISSING`. 하네스 Red 명령은 같은 module에 있는 회귀 검사를 함께 선택해 거부됐으며, 이 로그는 별도로 실행한 실제 실패다.
- [추가 회귀 검사](../.proofstill/evidence/scaffold-layers-v6/additional-checks.log): 9개 중 지침 hash fixture 1개 실패를 발견하고 fixture를 수정했다. [해당 재검사](../.proofstill/evidence/scaffold-layers-v6/portability-fixed.log)는 통과했다. 기존 flow 동시 실행·실패 정리·공유 기록 보존 및 인증 검사는 통과했다.
- npm pack dry-run: 배포 목록 453개 파일 일치. JS 구문 및 staged diff 검사 통과. 구현 커밋: `94bcab9`.
- 독립 리뷰의 기본 sandbox는 로컬 HTTP bind를 금지해 첫 최종 검사를 미검증 처리했다. [실행 어댑터](../.proofstill/evidence/scaffold-layers-v6/review-launcher.py)는 로컬 포트를 허용하는 실행 모드와 requirement ID 출력 형식만 설정했으며 판정 내용을 가공하지 않았다. 소스 수정 금지 조건으로 새 독립 세션에서 지정 검사를 다시 실행해 통과했다.
- PostgreSQL/Docker E2E, 전체 설치·프런트 빌드는 이번에 실행하지 않았다. 기존 생성 프로젝트를 자동 이관하지 않으며 변경은 이후 생성되는 스캐폴드에 적용된다.

- 작업 시작 시 Git 저장소가 없었으나, 진행 중 별도 세션이 기준점을 생성했다. 구현은 `94bcab9`에 커밋했으며 다른 작업의 console 변경은 제외했다.
