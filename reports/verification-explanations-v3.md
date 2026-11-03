# 검증 목적·실행 근거·현재 결과 표시 — 기능 개발 보고

## 구현·검증 현황

구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.

| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |
|---|---|---|---|---|
| V1: 검사 목적·필요한 이유·통과 조건 설명 | 구현 완료 | 통과 | 통과 | 미기록 |
| V2: 설명과 결과를 API·DB·인계에 보존 | 구현 완료 | 통과 | 통과 | 미기록 |
| V3: 현재 기준·실제 실행·남은 일 웹 반영 | 구현 완료 | 통과 | 통과 | 미기록 |

- 상태: **검증 완료**
- 사용자 수용: 미확인
- 의도: 사용자가 실제 DB·스캐폴드·하네스 검증과 독립 리뷰를 끝내고, 웹에 의미 없는 database/bootstrap/harness 별칭이나 명령만 던지지 말고 각 검증·행동의 목적과 이유를 설명해 달라고 요청했다.
- 업무 맥락: 핵심 제품 실검증은 tests/bootstrap/current-verification.json의 runtime-verification-v2 44개 요구와 4개 실제 검사에서 별도로 수행한다. 이 묶음은 UI/API/인계의 설명 및 실제 원본 결과 연결을 담당한다. 새 검사 정의는 label/purpose/rationale/expected를 보존하고 과거 설명 없는 검사는 명시적으로 설명 미등록으로 표시한다. 현재/이전 기록을 보존하고 현재 요구의 원래 ID 대응과 조건을 잃지 않는다. 현재 runtime 기준 선택은 요구 대응 44개 전부 확인 후 같은 하네스 원본으로 연결한다. 코드를 고쳤거나 현재 검사/리뷰가 없다면 통과로 추정하지 않는다. native 8개 기능의 전체 제품 UI·실제 모델 사용 시나리오는 이번 목적 설명 검증으로 통과 처리하지 않는다. UI는 기존 현황 상세/검사 등록/인계와 관련 설명만 바꾸고 테마·내비게이션을 확장하지 않는다. 전역 설치·배포·외부 전송은 하지 않는다. 저장 변경은 로컬 DB 백업 후 수행하며 원문·세션·실행 결과를 보존한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/plan.json)
- 기준 버전: `bff43a4ddb9c6950b0f0c0eacbcbf55cb476e739a96240d922c2196e0d142426`
- 소스 버전: `e92c3cdcea742a5bae1c6017b5f535d315d2cf8dadcb2e2685b4f70e2b8dcf41`

## 요구사항과 검증

| 요구사항 | 상태 | 테스트·근거 |
|---|---|---|
| V1: 검사마다 사람이 이해할 제목, 확인할 내용, 필요한 이유, 통과 조건, 현재 상태의 이유를 보여준다. 명령·검사 파일·실제 출력은 실행 근거로 접어 보여준다. raw check ID를 설명처럼 사용하지 않는다. 갱신·등록·리뷰 등 관련 행동의 목적과 영향을 설명하고 미실행을 통과로 오인시키지 않는다. | 자동 검사 통과 | [console-tests](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/06a0522e10ab/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/86e5b37a3371/output.log), [build](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/05e09bf85b71/output.log) |
| V2: 검사 설명을 저장·조회·수정·하네스 JSON·HTML 인계에 보존하고 안전하게 이스케이프한다. 과거 호환성을 유지하며 설명 미등록을 임의 지어내지 않는다. 코드 변경 시 오래된 근거를 재검증 필요로 표시한다. | 자동 검사 통과 | [console-tests](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/06a0522e10ab/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/86e5b37a3371/output.log) |
| V3: 12개 과거 현재 작업의 44개 요구를 현재 버전 검증 묶음과 정확히 대응해 웹의 현재 목록에 연결한다. 실제 관측 실행만 자동 검사에 연결하고 독립 리뷰/실제 사용 시나리오와 구분한다. 실패·중단·미실행·재검증과 남은 일을 정확히 표시한다. 이전 원문·기록은 이전 작업에 보존한다. | 자동 검사 통과 | [console-tests](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/06a0522e10ab/output.log), [types](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/86e5b37a3371/output.log) |

## 재현 명령과 검사 결과

### console-tests · integration · console-tests

```sh
npm --prefix console test
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/06a0522e10ab/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/06a0522e10ab/result.json)
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
- [테스트 verification-explanations.feature.json](/Users/jwsong/tools/proofstill/console/tests/verification-explanations.feature.json)
### types · unit · types

```sh
npm --prefix console run typecheck
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/86e5b37a3371/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/86e5b37a3371/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/tsconfig.json)
### build · integration · build

```sh
npm --prefix console run build
```

- Red: 선택 검사 · 미실행
- Green: 기대 결과 확인 · 종료 코드 `0` · [출력](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/05e09bf85b71/output.log) · [실행 영수증](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/runs/05e09bf85b71/result.json)
- [테스트 코드](/Users/jwsong/tools/proofstill/console/vite.config.ts)

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a1a057-6495-7d71-b3b4-374ba1bf4fec` · 실행기 `/tmp/proofstill-verification-review.py`
  - [answer.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/reviews/implementation-2675286c9780/answer.json)
  - [receipt.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/reviews/implementation-2675286c9780/receipt.json)
  - [events.jsonl](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/reviews/implementation-2675286c9780/events.jsonl)
  - [input.txt](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/reviews/implementation-2675286c9780/input.txt)
  - [manifest.json](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/reviews/implementation-2675286c9780/manifest.json)
  - V1: pass — 코드에서 제목·확인 내용·필요 이유·통과 조건·상태 이유와 접힌 실행 근거를 확인했다(console/web/VerificationChecks.tsx, HandoffView.tsx). raw ID와 같은 label은 ‘설명이 등록되지 않은 검사’로 대체하고, 등록·새로고침·독립 리뷰의 목적과 영향을 안내한다. 직접 실행: console-tests 69/69 통과, typecheck 오류 0, Vite build 완료.
  - V2: pass — 설명 필드는 migration/store/API/handoff JSON/HTML까지 연결되며 HTML export가 특수문자를 이스케이프한다. 기존 레코드는 빈 설명을 유지하고 UI에서 미등록으로 표시한다. 검사 파일 변경·삭제와 중단 결과를 stale/interrupted로 처리하는 부정 사례가 포함되어 있다. 관련 통합검사를 포함한 console-tests 69/69 및 typecheck가 통과했다.
  - V3: pass — tests/bootstrap/current-verification.json에서 요구 44개, ID 44개, previous 대응 44개가 모두 고유했다. 현재 카탈로그는 runtime-verification-v2와 verification-explanations-v3만 활성화되어 있고 이전 기록은 historical로 분리된다. 실제 로컬 DB를 immutable 모드로 조회한 결과 설명 누락 0, 자동 검사 연결 23개 모두 exit 0/passed, 수동 시나리오 8개는 미관측 상태였다. runtime 원본의 database/bootstrap/harness/setup은 모두 accepted green이고 실제 사용 시나리오·독립 리뷰와 명시적으로 분리된다. console-tests 69/69 및 typecheck가 통과했다.

## 구현·아티팩트

- [현재 결과 연결 기록](/Users/jwsong/tools/proofstill/.proofstill/evidence/verification-explanations-v3/data-audit.json)

## 한계·남은 사항

- 이 묶음의 리뷰 통과는 목적 설명과 현재 결과 연결 범위이며, runtime-verification-v2의 제품 검증과 리뷰를 대신하지 않는다.
- 실제 모델 turn과 제품 전체 화면의 사용 시나리오는 별도 확인이다.
- 실제 모델 turn과 제품 전체 UI 클릭 시나리오는 지정 범위 밖이며, 로컬 DB에서도 수동 시나리오 8개가 미관측으로 정확히 남아 있다.
- Vite build는 성공했으나 @xyflow/react의 module-level "use client" directive 관련 비차단 경고가 있었다.
- 검토 종료 시 manifest 대상 파일의 SHA-256 불일치는 없었다. PASS는 검증 설명과 현재 결과 연결 범위에 한정된다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
