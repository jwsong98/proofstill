# 그래프 DAG 실행 요구

근거: 2026-11-05 현재 대화의 사용자 원문 및 실제 선택 응답. 이 요청은 기존 requirements.md U8·U11의 자동 실행/커밋 제외를 그래프 DAG 실행 범위에서 변경한다. 기존 채팅·원문·사용자 수용 정책은 유지한다.

> 지금 그래프에서 보이는 작업 노드들과 그 선후 관계가 DAG 러너에 의해 실행되는 구조가 되어야 합니다.
> 그리고 commit 으로 완료된 작업 내용과 작업 완료 근거를 표시합니다.
> 동시에 구현 가능한 것은 폴더/파일 소유권 기반해서 충돌되지 않은 선에서 동시에 작동해야 합니다.
> codex를 프로그램에서 호출할 수 있기에 가능한 일입니다.
> context는 연결된 노드들과, 폴더 구조를 주입하도록 합니다.
> 작업은 완료된 것과 완료되지 않은 것 구분이 되어야 합니다.

사용자 선택: ‘명시적으로 실행 시작, 이후 자동 진행 (추천)’. 실행 시작 시 현재 작업·선후 관계·소유 파일을 고정한다. 기존 Node/React/SQLite/Codex app-server 경계 안에서 구현한다.

| ID | 조건·기대 결과 | 구현·검사 | 상태 |
|---|---|---|---|
| D1 | 명시적 실행 후 task/precedes에 따라 자동 진행. 순환 거부, 실패 후속 보류, 중단·재시작 시 미완료 보존 | dagPlan.ts, dagRunner.ts, dagStore.ts / dagPlan.test.ts, dagRunner.test.ts | 관련 자동 검사 통과; 최종 독립 리뷰 별도 |
| D2 | 실제 Codex app-server 호출, 연결 노드·선행 완료 결과·폴더 구조 주입 | dagWorker.ts, dagRunner.ts / dagWorker.test.ts, dagRunner.test.ts | 자동 검사 및 격리 합성 프로젝트 실제 Codex 실행 확인 |
| D3 | 소유 폴더/파일 비충돌 작업 병렬 구현, 겹치는 작업 직렬화. 검사와 Git stage/commit 직렬화 | dagPlan.ts, dagRunner.ts / dagRunner.test.ts | 관련 자동 검사 통과 |
| D4 | 실제 검사 성공과 실제 커밋에 근거해 완료. 변경 내용·커밋·검사 결과 조회. 단순 모델 완료 주장은 미완료 | dagRunner.ts, DagPanel.tsx / dagRunner.test.ts, dagApi.test.ts | 자동 검사 통과; 화면 확인 및 독립 리뷰 별도 |
| D5 | 완료/미완료 구분, 실행 설정·시작·중단·재조회, 완료 작업 필터 | DagPanel.tsx, GraphCanvas.tsx, DirectionalGraph.tsx, App.tsx | 타입·빌드 통과; 화면 확인 별도 |

제약: 공유 로컬 파일에 대한 보안 격리는 제공하지 않는다. Codex에는 소유 경로만 편집하도록 위임하고, 등록 소유권 전체 밖의 변경과 외부 stage/commit은 실패 처리한다. 시작 전 Git 루트와 깨끗한 작업 트리/index를 요구해 기존 변경 혼입을 막는다. 실패한 변경은 자동 폐기하지 않는다. 후속 실행은 사용자가 수정·커밋 후 명시적으로 시작한다. 작업별 등록 검사에 필요한 빌드를 포함해야 한다. 완료는 등록 검사·커밋의 근거이며 사용자 수용이나 독립 검증 통과를 뜻하지 않는다.
