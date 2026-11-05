# 실제 모델·제품 8개 시나리오 검증

검증 시점: 2026-11-03T09:32:18.791Z. 실제 모델·제품 흐름을 수행하고 실패를 수정한 뒤 독립 리뷰와 웹을 대조했다.

**5개 확인·3개 추가 확인.** 미해결 코드 결함 지적은 없지만, 미관측 조건이 남아 작업 전체 게이트는 미통과다. 사용자 수용과 구분한다.

| 기능 | 요구별 독립 판정 | 남은 확인 |
|---|---|---|
| 프로젝트·로컬 저장 | 확인 | 지정 범위 확인 완료 |
| 원문·출처 확인 | 추가 확인 | 긴 출처의 네이티브 툴팁 표시 |
| 관계 그래프 탐색·편집 | 확인 | 지정 범위 확인 완료 |
| Codex 세션·채팅 | 추가 확인 | 실제 모델의 네트워크·파일 권한 요청 발생 분기 |
| 토큰·컨텍스트 사용량 | 확인 | 지정 범위 확인 완료 |
| 실행 결과·검증 근거 | 확인 | 지정 범위 확인 완료 |
| 읽기 쉬운 화면·제목 | 추가 확인 | 일반 hover·제목·아이콘 네이티브 툴팁 표시 |
| 현재 요구·구현 현황·인계 | 확인 | 지정 범위 확인 완료 |

## 실제 실행과 근거

- 실제 모델: 선택 맥락 응답, 명령 종료0·의도실패7, HTTP200 요청/응답, 자식42·부모 후속 실행, 중단·재개, AI 그래프2회 및 수동 수정 보존, 실제 세션 가져오기.
- 실제 제품: 원문 구간·문맥·대화 이동, 900/1280px 배치, 필터·전체 숨김 복구, 드래그 위치 저장·재시작 복원, 프로젝트 격리, 구현 기록 저장/재조회, HTML 다운로드.
- 추가 수정 확인: 목적·이유·통과 조건을 실제 화면과 모델 도구로 등록하고 정확한 명령·출력·종료 코드에 연결했다.
- fixture: 동기화503·events 누락·23개 페이지 metadata는 재현용이며 실제 모델 실행과 구분했다. 합성 주문 기능을 구현·수용했다고 주장하지 않는다.

| 최종 자동 검사 | 실제 결과 |
|---|---|
| `npm --prefix console test` | 105 통과·실패0 |
| `npm --prefix console run typecheck` | 종료0 |
| `npm --prefix console run build` | 종료0 |

자동 검사는 코드 회귀·저장 관측 대조·타입·번들 범위다. 모델/브라우저 재실행을 뜻하지 않는다. @xyflow/react의 비차단 `use client` 경고는 남아 있다.

## 수정한 실패와 이유

- 빈 새 세션과 재시작 후 빈 세션의 조회 오류: 생성 출처를 보존해 이력 미관측과 실제 오류를 구분했다.
- 세션 재사용·프로젝트 전환: 정규화 컨텍스트 일치와 늦은 응답 경계를 보강했다.
- 채팅의 맥락·작업 폴더·턴별/누적 사용량: 실제 선택 내용과 모델 제공 값을 별도로 표시했다.
- 동기화 오류 소실과 중단 명령의 진행 중 표시·결과 누락: 실패/중단의 출처와 미확인 종료 코드를 보존했다.
- 조회 실패를 빈 목록처럼 보이던 상태와 일반 상세 폭: 실패 안내 및 40%/58% 배치를 바로잡았다.
- 설명 포함 검사 등록 거부: 누락된 설명 필드를 허용하고 상태/결과 위조는 계속 거부했다.
- 8개를 모두 실패로 표시하던 리뷰: 원래 작업 전체 게이트를 유지하면서 요구별 확인·추가 확인·결함 발견을 분리했다. 오래된·손상된·잘못된 리뷰와 재조회 경쟁은 통과로 올리지 않는다.

## 웹 반영과 검증 범위

기존 8개 대표 노드를 재사용했다. 원문·세션·과거 실행을 보존하고 중복 검증 설명 V1~V3은 현황·인계 조건에 포함해 이전 작업으로 분리했다. 8개 요구별 판정과 원본 receipt, 전체 미통과 게이트가 API/DOM/HTML에서 일치함을 대조했다.

별도 작업에서 변경된 핵심 런타임44개 요구는 현재 재검증 필요로 유지했다. 이 검증 후 다른 작업이 소스를 바꾸면 이번 결과도 재검증 필요로 표시하는 것이 정상이다. 아래 원본은 검증 시점의 기록으로 보존한다.

- [원래 조건과 고정 검사](/Users/jwsong/tools/proofstill/console/tests/live-product.feature.json)
- [실제 관측 목록·범위·한계](/Users/jwsong/tools/proofstill/console/tests/live-observations.json)
- [최종 독립 리뷰 원본](/Users/jwsong/tools/proofstill/.proofstill/evidence/live-product-validation-v1/reviews/implementation-26b5ac411c1a/receipt.json)
- [최종 API 대조](/Users/jwsong/tools/proofstill/.proofstill/evidence/live-product-v1/final-reviewed-web-audit.json)
- [최종 DOM](/Users/jwsong/tools/proofstill/.proofstill/evidence/live-product-v1/final-reviewed-web.dom.txt)
- [검증 시점 인계 HTML](/Users/jwsong/tools/proofstill/.proofstill/evidence/live-product-v1/final-reviewed-handoff.html)
- [검증 시점 화면](/Users/jwsong/tools/proofstill/.proofstill/evidence/live-product-v1/final-reviewed-web.png)
