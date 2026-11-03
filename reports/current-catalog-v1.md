# 현재 요구·구현 현황과 중복 노드 통합 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| C1: WC-01~34와 H1~H5 조건을 빠짐없이 8개 대표 기능에 보존하고 중복 노드는 통합한다. 원문·실행·대화·원래 노드·관계·이전 세션 컨텍스트를 보존한다. 다른 프로젝트/원문/자기 자신/순환 통합을 거부하고 반복 실행에서 요구나 근거를 중복 생성하지 않는다. | 구현 완료 | 통과 | 통과 | 미기록 |
| C2: 구현 파일과 실제 검사 명령/관측 결과를 연결하고 구현 선언·자동 검사·실제 화면/모델 확인·독립 리뷰를 구분한다. 검사 미실행/실패/오래됨을 통과로 조작하지 않는다. 최신 하네스 작업은 CLI 원본을 공유하고 요구 조건과 기존 기준 불일치를 보존한다. | 구현 완료 | 통과 | 통과 | 미기록 |
| C3: 웹에서 현재/이전 작업을 구분하고 제목·WC ID·요구 조건 검색, 구현·검사·다음 할 일·원문·통합 전 기록을 확인한다. 현재 집계와 HTML 인계에 과거 작업의 남은 일이 섞이지 않으며 이전 기록도 내보낸다. 기존 테마·동작을 보존한다. | 구현 완료 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 현재 요구사항을 빠짐없이 반영하고 실제 코드와 검사 근거를 연결해 구현 상태와 남은 일을 웹에서 확인한다. 너무 많은 노드를 통폐합한다.
- 업무 맥락: 사용자가 현재 요구 현행화 및 구현/검사 연결 1~2번 진행과 노드 통폐합을 명시 요청했다. 원문·실행·대화·기존 노드·관계는 보존하고 대표 기능으로 통합한다. 웹 WC-01~34와 H1~H5는 8개 기능 상세에 보존, 하네스 본체 최신 12개 작업은 현재 목록에 유지, 이전 버전/예제는 이전 작업에서 보존한다. 현재 목록으로 분류하거나 코드 경로를 확인한 것은 검사 통과나 사용자 수용이 아니다. 실제 모델·제품 전체 UI 검증은 범위 밖이며 그룹별 시나리오는 미실행으로 등록한다. 실제 관찰한 테스트만 연결한다. 기존 배포 버전·스킬 개수·리뷰 복사본 기준의 불일치는 남은 일로 표시한다. 설치/배포/외부 전송은 범위 밖. 통합은 DB 백업 후 스크립트로 원자적 적용하며 세션 참조와 immutable 근거를 보존한다. UI는 현재/이전 범위 선택, WC ID 검색, 다음 할 일, 요구 조건/통합 전 기록, 같은 구분의 인계 파일에 한정한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/plan.json)
- 기준 버전: `6e62666e0bdbb2d71ee661e5f037452fa7ed0fba4754892645cda9d008e28707`
- 소스 버전: `9b44c3a91967d4599b07287404d719c437576124cc033cfe15ebbdbd182870e2`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| C1: WC-01~34와 H1~H5 조건을 빠짐없이 8개 대표 기능에 보존하고 중복 노드는 통합한다. 원문·실행·대화·원래 노드·관계·이전 세션 컨텍스트를 보존한다. 다른 프로젝트/원문/자기 자신/순환 통합을 거부하고 반복 실행에서 요구나 근거를 중복 생성하지 않는다. | 자동 검사 통과 | [console-tests](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/23f81ef2b7c2/output.log) |
| C2: 구현 파일과 실제 검사 명령/관측 결과를 연결하고 구현 선언·자동 검사·실제 화면/모델 확인·독립 리뷰를 구분한다. 검사 미실행/실패/오래됨을 통과로 조작하지 않는다. 최신 하네스 작업은 CLI 원본을 공유하고 요구 조건과 기존 기준 불일치를 보존한다. | 자동 검사 통과 | [console-tests](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/23f81ef2b7c2/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/d0c2871a8ef5/output.log) |
| C3: 웹에서 현재/이전 작업을 구분하고 제목·WC ID·요구 조건 검색, 구현·검사·다음 할 일·원문·통합 전 기록을 확인한다. 현재 집계와 HTML 인계에 과거 작업의 남은 일이 섞이지 않으며 이전 기록도 내보낸다. 기존 테마·동작을 보존한다. | 자동 검사 통과 | [console-tests](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/23f81ef2b7c2/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/d0c2871a8ef5/output.log), [build](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/74ea6d6c8118/output.log) |

## 재현 명령과 검사 결과

### console-tests · integration · console-tests

```sh
npm --prefix console test
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/23f81ef2b7c2/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/23f81ef2b7c2/result.json)
- [테스트 api.test.ts](/Users/jwsong/tools/proofstill/console/tests/api.test.ts)
- [테스트 catalog.test.ts](/Users/jwsong/tools/proofstill/console/tests/catalog.test.ts)
- [테스트 codex.test.ts](/Users/jwsong/tools/proofstill/console/tests/codex.test.ts)
- [테스트 contextUsage.test.ts](/Users/jwsong/tools/proofstill/console/tests/contextUsage.test.ts)
- [테스트 fake-app-server.mjs](/Users/jwsong/tools/proofstill/console/tests/fixtures/fake-app-server.mjs)
- [테스트 graphLayout.test.ts](/Users/jwsong/tools/proofstill/console/tests/graphLayout.test.ts)
- [테스트 handoff.test.ts](/Users/jwsong/tools/proofstill/console/tests/handoff.test.ts)
- [테스트 messageFormat.test.ts](/Users/jwsong/tools/proofstill/console/tests/messageFormat.test.ts)
- [테스트 service.test.ts](/Users/jwsong/tools/proofstill/console/tests/service.test.ts)
- [테스트 sessionActivities.test.ts](/Users/jwsong/tools/proofstill/console/tests/sessionActivities.test.ts)
- [테스트 store.test.ts](/Users/jwsong/tools/proofstill/console/tests/store.test.ts)
### types · unit · types

```sh
npm --prefix console run typecheck
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/d0c2871a8ef5/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/d0c2871a8ef5/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/tsconfig.json)
### build · integration · build

```sh
npm --prefix console run build
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/74ea6d6c8118/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/runs/74ea6d6c8118/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/vite.config.ts)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a1a02a-f514-76a1-96ac-7d9550624376` · 실행기 `/tmp/proofstill-current-catalog-review.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/reviews/implementation-8c5f00f51a7f/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/reviews/implementation-8c5f00f51a7f/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/reviews/implementation-8c5f00f51a7f/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/reviews/implementation-8c5f00f51a7f/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/reviews/implementation-8c5f00f51a7f/manifest.json)
  - C1: pass — console/tests/catalog.test.ts와 console/server/store.ts를 대조하고 `npm --prefix console test`를 별도 TMPDIR에서 직접 실행했다. 67/67 통과, fail 0. WC-01~34와 H1~H5의 8개 기능 보존, 원본 노드·관계·세션 컨텍스트 유지, 다른 프로젝트·원문·자기 자신·기존 통합 대상 거부, 반복 실행 멱등성이 확인됐다.
  - C2: pass — HandoffService가 구현 상태, 자동 검사 결과, 수동 시나리오, 독립 리뷰를 별도 필드로 처리하며 수정 시각 이후 결과를 stale로 판정함을 확인했다. 최신 12개 하네스 작업은 원본 plan 및 harness handoff 결과를 사용하고 오래된 기준 차이는 remaining으로 보존한다. 직접 실행 결과: 테스트 67/67 통과, `npm --prefix console run typecheck` 종료 코드 0.
  - C3: pass — HandoffView와 filterHandoffRows에서 현재/이전/전체 범위, 제목·WC ID·요구 조건 검색, 구현·검사·다음 할 일·원문·통합 전 기록 표시를 확인했다. handoffExport는 현재 집계와 이전 작업을 분리해 내보낸다. 관련 통합 테스트가 통과했고 `npm --prefix console run build`도 종료 코드 0으로 185개 모듈을 빌드했다. 검토 후 manifest 대상 해시는 모두 일치했다.

## 구현·아티팩트

- [통합 전후 보존 및 실제 검사 연결 기록](/Users/jwsong/tools/proofstill/.proofstill/evidence/current-catalog-v1/data-audit.json)

## 한계·남은 사항

- 전체 제품 UI, 실제 모델 turn 및 배포 패키지 재검증은 이번 범위 밖이며 웹의 다음 검증으로 남긴다.
- 과거 하네스 요구의 전체 업무 조건 재검증은 하지 않고 코드 진입점과 기존 검사 정의·현재 결과를 연결한다.
- 원래 기준에서 제외한 전체 제품 UI의 실제 브라우저 조작, 실제 모델 turn, 배포 패키지는 검증하지 않았다.
- 과거 하네스 요구 전체를 재검증하지 않고 현재 코드 진입점, 기존 검사 정의와 현황 연결만 검토했다.
- Vite 빌드에서 @xyflow/react의 `use client` 지시어 보존 관련 비차단 경고가 발생했다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
