# Proofstill 로컬 웹 콘솔

합의한 DB → API → UI 흐름으로 구현했다. 요구 대조·DB·app-server·API·UI 담당과 별도 독립 검증자가 분담했고, 최종 요구 18개를 확인했다. 별도 자동 작업 진행 UI, Git 상태·해시 추적, 인터뷰/기능 고정 메뉴는 추가하지 않았다.

## 실행

```sh
npm run console:setup
npm run console
```

기본 주소 http://127.0.0.1:7777. 현재 이 주소에서 실제 앱이 실행 중이며 이 저장소 프로젝트가 등록되어 있다. 원문 자료와 세션은 사용자가 선택해서 가져온다. 데이터는 기본 ~/.local/share/proofstill/console/console.sqlite에 보존한다. 전역 Codex 설정·인증 파일·설치본은 변경하지 않았다.

## 변경과 이유

- SQLite에서 원문 근거·실행 결과를 수정/삭제할 수 없게 하고, 요구·기능·문제·결정·작업·관계를 별도로 저장했다.
- 의미적 연관은 무방향, 명확한 작업 선후는 방향으로 저장·표시한다. 관계의 프로젝트 경계·순환을 검사한다.
- 로컬 app-server로 선택 맥락을 권한 없는 자료로 전달하고 일반 Codex 채팅을 연다. 계정이 광고하는 기본 모델을 사용해 개인 설정의 지원 종료 모델로 인한 실패를 피한다.
- 원문별 독립 표시·원래 메시지 복귀, 실제 대화 시각 기준 세션 커서, 과거 턴 사용량, CLI용 컨텍스트 내보내기를 연결했다.
- 검사 기준은 명령 원문과 함께 정의하고 실제 관측 결과만 연결한다. 비어 있지 않은 정해진 검사 전체가 통과할 때 완료하며, 실패·중단·미확인·다른 명령으로 완료를 만들지 않는다. 검사 정의 자체는 아무 명령도 실행하지 않는다.

## 실제 확인 결과

| 확인 | 결과·근거 |
|---|---|
| DB | 11개 통과: 원문 불변·프로젝트 경계·관계·순서·커서·재시작·수용 조건 |
| app-server transport | 8개 통과: 실제 자식 프로세스 JSONL·승인 만료·연결 실패 |
| API | 16개 통과: 실제 HTTP 서버·불변 캡처·가져오기·SSE·실제 결과·체크 평가 |
| 타입·빌드 | TypeScript 검사 및 Vite 빌드 통과 |
| 실제 Codex | 합성 문서 AI 그래프 생성, 맥락 응답, 사용량, 재시작·이름/이력 가져오기·중복 방지 확인 |
| Python 하네스 | 실제 Codex가 python3 -m proofstill --help를 실행한 commandExecution 원문·exit 0 보존. 체크 정의 후 같은 명령을 명시적으로 다시 실행해 1/1 충족 확인 |
| UI | 순수 원문, 원래 메시지 복귀, 일반/분석 세션 분리, 실제 응답과 대화 복귀, 세션 20→28 추가 조회, 과거 턴 사용량 확인 |
| 독립 검증 | 초기 4건 및 사용량 1건을 발견·수정한 뒤 WC01~18 최종 PASS |

최종 독립 판정: [.proofstill/evidence/web-console-live/independent-review-accepted.json](../.proofstill/evidence/web-console-live/independent-review-accepted.json). 실제 원문 실행 기록은 [harness-smoke.json](../.proofstill/evidence/web-console-live/harness-smoke.json), 통합 결과는 [api-smoke.json](../.proofstill/evidence/web-console-live/api-smoke.json)에 있다. 초기 실패 보고도 보존했다.

## 한계

- 현재 컨텍스트 점유값은 Codex가 제공하지 않아 미확인으로 표시한다. 누적·최근 호출·과거 턴의 실제 관측값과 혼동하지 않는다.
- 원문 파일 가져오기는 프로젝트 안 UTF-8 텍스트(2 MiB 이하) 대상이다. 네이티브 데스크톱 패키징·브라우저 출력 수집·자동 후속 작업은 범위 밖이다.
- 검증은 현재 설치된 macOS·Node 24·Codex 환경과 지정 시나리오 범위이며, 모든 오류의 부재를 뜻하지 않는다. 새 Codex 리뷰 내부 Node 워커가 sandbox에서 중단된 것은 직접 실행한 전체 검사 35개와 별도로 기록했다.
