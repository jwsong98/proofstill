# 주문 ID 중복 저장 방지 — 기능 개발 보고

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 동일한 주문 ID는 한 번만 저장하고 처음 저장한 주문 내용을 유지한다. 잘못된 ID가 있는 묶음은 일부도 저장하지 않는다.
- 업무 맥락: 외부 서비스가 없는 합성 연습 기능. Python 표준 라이브러리와 로컬 SQLite로 순차 요청을 검증한다. 실제 시험 문제가 아니다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/plan.json)
- 기준 버전: `e60f1a55805acb75b6672df10e2e7cd0e715620c231546800a41aa303a1e1c7e`
- 소스 버전: `32a6cd07eb079ecf258e202f9f678435663f76dfa605b36a889e6645021bfb1d`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| R1: 같은 ID는 최초 입력을 유지하며 원본 목록은 변경하지 않는다. | 자동 검사 통과 | [orders-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/4035a2f63bb4/output.log) |
| R2: 누락·빈 ID를 거부하고 빈 입력은 허용한다. | 자동 검사 통과 | [orders-unit](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/4035a2f63bb4/output.log) |
| R3: SQLite를 다시 열어도 중복 없는 최초 내용이 남는다. | 자동 검사 통과 | [orders-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/0e26f1315bcd/output.log) |
| R4: 잘못된 ID를 포함한 묶음은 부분 저장하지 않는다. | 자동 검사 통과 | [orders-integration](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/0e26f1315bcd/output.log) |

## 재현 명령과 Red → Green

### orders-unit · unit · orders

```sh
python3 -m unittest discover -s examples/orders/tests/unit -v
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/85efbc8c8bb2/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/85efbc8c8bb2/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/4035a2f63bb4/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/4035a2f63bb4/result.json)
- [테스트 test_orders.py](/Users/jwsong/tools/proofstill/examples/orders/tests/unit/test_orders.py)
### orders-integration · integration · orders

```sh
python3 -m unittest discover -s examples/orders/tests/integration -v
```

- Red: 기대 결과 확인 · 종료 코드 `1` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/eecc6728e99f/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/eecc6728e99f/result.json)
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/0e26f1315bcd/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/runs/0e26f1315bcd/result.json)
- [테스트 test_store.py](/Users/jwsong/tools/proofstill/examples/orders/tests/integration/test_store.py)

## 독립 리뷰

- 기준 적절성: 통과 · 세션 `01a18a7d-23a1-78d1-9d5b-d0ed51994812` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/criteria-28587e1ce9e8/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/criteria-28587e1ce9e8/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/criteria-28587e1ce9e8/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/criteria-28587e1ce9e8/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/criteria-28587e1ce9e8/snapshot/manifest.json)
  - R1: pass — examples/orders/tests/unit/test_orders.py:10-15에서 동일 ID의 최초 항목 유지, 입력 목록의 deep-copy 비교를 검증한다. 지정 orders-unit 명령을 직접 실행했으며 현재 잘못된 스텁을 해당 테스트가 실제로 거부했다.
  - R2: pass — examples/orders/tests/unit/test_orders.py:17-27에서 빈 문자열 ID와 누락 ID의 ValueError, 빈 입력의 허용을 각각 검증한다. orders-unit은 4개 테스트를 실행했고 관련 스텁 결함 3건을 실패로 검출했다.
  - R3: pass — examples/orders/tests/integration/test_store.py:12-20에서 재개방 후 중복 없는 최초 payload를 확인하고, 51-65에서 실제 SQLite 헤더·integrity_check·새 프로세스 재개방을 검증한다. orders-integration 실행은 현재 비구현 상태를 6개 실패로 거부했다.
  - R4: pass — examples/orders/tests/integration/test_store.py:22-35에서 빈/누락 ID가 포함된 묶음의 부분 저장 금지를, 42-49에서 기존 행 보존까지 검증한다. 지정 명령 실행으로 해당 잘못된 동작이 실패 처리됨을 확인했다.
- 구현: 통과 · 세션 `01a18a7e-7000-7d81-883a-f31a1aaa8f05` · 실행기 `codex`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/implementation-a033f87c2d21/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/implementation-a033f87c2d21/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/implementation-a033f87c2d21/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/implementation-a033f87c2d21/input.txt)
  - [snapshot/manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/order-dedup-v3/reviews/implementation-a033f87c2d21/snapshot/manifest.json)
  - R1: pass — orders.py:5-14에서 ID별 첫 주문의 복사본만 결과에 추가한다. 지정 unit 검사 4건이 모두 통과했고, test_orders.py:10-15가 최초 입력 유지와 원본 불변을 확인한다. 추가 독립 probe에서도 중첩 값을 포함한 원본이 변경되지 않았다.
  - R2: pass — orders.py:8-10은 누락(None) 및 빈 문자열 ID를 ValueError로 거부하며 빈 목록은 그대로 반환한다. 지정 unit 검사의 관련 정상·예외 사례를 포함한 4건이 모두 통과했다.
  - R3: pass — orders.py:20의 SQLite PRIMARY KEY와 32-33의 INSERT OR IGNORE가 기존 payload를 보존한다. 지정 integration 검사 6건이 모두 통과했으며 test_store.py:13-20은 재개방 후 최초 내용, 50-64는 실제 SQLite 파일·무결성·새 프로세스 재개방을 확인한다. 추가 probe에서도 재개방 후 중복 입력이 0건 저장되고 최초 내용이 유지됐다.
  - R4: pass — orders.py:29에서 전체 묶음을 먼저 검증·중복 제거한 뒤 31-33에서 트랜잭션 저장하므로 잘못된 ID 발견 전에는 DB 쓰기가 시작되지 않는다. 지정 integration 검사 6건이 모두 통과했고 test_store.py:22-34 및 42-48이 빈/누락 ID 묶음의 무부분저장과 기존 행 보존을 확인한다. 추가 probe도 동일 결과였다.

## 구현·아티팩트

- [주문 중복 제거와 저장 구현](/Users/jwsong/tools/proofstill/examples/orders/orders.py)
- [Unit test](/Users/jwsong/tools/proofstill/examples/orders/tests/unit/test_orders.py)
- [Integration test](/Users/jwsong/tools/proofstill/examples/orders/tests/integration/test_store.py)

## 한계·남은 사항

- 순차 요청만 검증. 동시 요청·대용량·외부 서비스 연동은 검증 범위 밖이다.
- criteria 단계 판정으로, 현재 스텁 구현의 요구사항 충족 여부를 승인한 것이 아니다. 테스트가 명백히 잘못된 현재 구현을 거부하는지 확인하기 위해 지정 명령을 실행했다.
- 검증 범위는 명시된 순차 요청과 문자열 빈 ID·누락 ID 사례에 한정된다. 동시 요청, 대용량, 외부 연동 및 별도로 정의되지 않은 공백·null ID 의미는 범위 밖이다.
- manifest의 세 대상 파일 SHA-256이 모두 일치함을 확인했으며 소스·기준·기대값은 수정하지 않았다.
- 검증 범위는 계획대로 순차 요청과 로컬 SQLite에 한정된다. 동시 요청, 대용량 처리, 외부 서비스 연동은 검증하지 않았다.
- 검토 후 구현 및 두 테스트 파일의 SHA-256이 snapshot manifest와 일치함을 확인했다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
