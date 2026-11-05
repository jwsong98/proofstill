# 그래프 작업의 DAG 실행과 커밋 근거 — 기능 개발 보고

## 현재 확인 및 커밋

- `python3 -m proofstill test graph-dag-runner`: 기능 검사 12개, 타입 검사, 빌드 통과.
- `python3 -m proofstill review graph-dag-runner`: 최종 D1~D5 pass, findings 없음.
- `npm --prefix console test`: 134개 중 133개 통과. 남은 handoff.test.ts:174 실패는 변경 전 코드와 기존 handoff 수정만 복원한 임시 폴더에서도 재현했다. 원본: `reports/graph-dag-evidence/pre-dag-handoff-test.log`.
- 실제 Codex 단일 작업과 브라우저 설정·시작·중단·재조회·두 그래프 완료 필터 확인. 실제 다중 Codex 동시 호출은 미검증이며 병렬 러너는 대역 기반 검사로 확인.
- 7777 서버는 활성 turn·승인 대기 0건을 확인한 후 재시작했고 기존 프로젝트 2개 유지 및 health·DAG 조회 응답을 확인했다. 실행 시작 전 기존 미커밋 변경의 정리가 필요하다.

| 전체 Git 해시 | 변경 의도 |
|---|---|
| `d19cc0eda84524113af297c92500ebcb62792781` | feat(dag): 소유권 기반 실행 계획과 상태를 보존한다 |
| `4d2ac8216d3ad21a6413b85b4481e0cd5c3fc6e2` | feat(dag): Codex 작업을 병렬 실행하고 검사와 커밋으로 완료한다 |
| `3e00c209ef03846587f51496c0fa2a955de24a83` | feat(dag): 그래프에서 실행 설정과 커밋 완료 근거를 표시한다 |
| `74d76be4815a312f26e4c8179e0d7de1789a95a0` | test(db): 모든 등록 migration의 적용과 재시작을 확인한다 |
| `9cacaf7aa0725eeac18dc87e8729b8faedb5e277` | fix(dag): 재실행과 설정 변경 시 오래된 완료 상태를 무효화한다 |
| `593cc3fe050e9e479f623d5cac9df97110f930f3` | test(dag): 생성 시각과 무관하게 작업 ID로 결과를 검증한다 |
| `42240d4a6a4d425fd9c76006accdd90f7b5ff207` | test(dag): 실제 Codex 실행과 화면 완료·중단 근거를 보존한다 |
| `e04cec83150f31b2ed8d6f2dc0bdbef06390183c` | test(dag): 두 그래프 배치의 완료 작업 필터를 확인한다 |

아래 원문에 포함된 상태 표는 기준 고정 당시 기록이며 현재 결과는 이 절과 요구별 검증 판정을 따른다.


- 자동 검사·독립 리뷰: **검증 완료**
- 인계 준비: 보완 필요
- 사용자 수용: 미확인
- 의도: # 그래프 DAG 실행 요구

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

- 업무 맥락: 사용자는 명시적으로 실행 시작 후 자동 진행을 선택했다. 기존 스택과 책임 경계를 유지한다. 공유 파일 소유권은 협력적 작업 경계이며 악의적 파일 접근을 격리하는 보안 경계가 아니다. 기존 저장소에는 이 기능 외 미커밋 변경이 있으며 포함하지 않는다. 화면 실행 증거와 실제 Codex 실행 원본은 context_files 및 artifacts에 제공한다. 첫 독립 리뷰는 화면 증거 미제공으로 D4/D5 unverified였으며, 소스 보강 후 현재 검사와 제공 증거 전체를 다시 대조한다.
- 명령 실행 위치: `/Users/jwsong/tools/proofstill`
- 기준: [고정된 요구사항·명령](/Users/jwsong/tools/proofstill/.proofstill/evidence/graph-dag-runner/plan.json)

## 관련 코드 커밋
- `d19cc0eda84524113af297c92500ebcb62792781` feat(dag): 소유권 기반 실행 계획과 상태를 보존한다 (console/server/dagPlan.ts, console/server/migrations)
- `9cacaf7aa0725eeac18dc87e8729b8faedb5e277` fix(dag): 재실행과 설정 변경 시 오래된 완료 상태를 무효화한다 (console/server/dagStore.ts, console/server/dagRunner.ts, console/web/DagPanel.tsx, console/tests/dagPlan.test.ts)
- `4d2ac8216d3ad21a6413b85b4481e0cd5c3fc6e2` feat(dag): Codex 작업을 병렬 실행하고 검사와 커밋으로 완료한다 (console/server/dagWorker.ts, console/server/api.ts, console/tests/dagWorker.test.ts, console/tests/dagApi.test.ts)
- `284cfeebf70184c6b86b0ecfd2413daa5bdb4437` chore: Proofstill의 현재 상태를 개발 기준점으로 보존한다 (console/server/codex.ts, console/web/components.tsx, console/tsconfig.json)
- `181c55643d324965ad89a437ab0363d7508557f8` feat: let Codex define graph node clouds (console/server/store.ts, console/server/types.ts)
- `3e00c209ef03846587f51496c0fa2a955de24a83` feat(dag): 그래프에서 실행 설정과 커밋 완료 근거를 표시한다 (console/web/styles/dag.css, console/web/App.tsx, console/web/GraphCanvas.tsx, console/web/DirectionalGraph.tsx)
- `a60519fa9566cf3fc66c8ed1e87d77b6eccf305b` feat(console): 통합된 결정과 작업을 보드에 복원한다 (console/web/api.ts)
- `10f5c211d96bcd30deaac8c33906add49d344d8c` feat: render detail content as Markdown CSV and formatted JSON (console/package.json)
- `593cc3fe050e9e479f623d5cac9df97110f930f3` test(dag): 생성 시각과 무관하게 작업 ID로 결과를 검증한다 (console/tests/dagRunner.test.ts)

## 요구사항과 검증

| 요구사항 | 구현 | 자동 검사 | 검사 ID |
|---|---|---|---|
| D1: 그래프 task/precedes를 실제 실행하며 선행 완료와 실패 보류·중단·재시작을 구분한다. | 구현 완료 | 통과 | dag-tests, types, build |
| D2: Codex app-server로 호출하며 연결 노드·폴더 구조·선행 결과를 주입한다. | 구현 완료 | 통과 | dag-tests, types, build |
| D3: 소유 폴더/파일 비충돌 작업만 병렬 실행하며 검사 및 커밋은 직렬화한다. | 구현 완료 | 통과 | dag-tests, types, build |
| D4: 실제 검사와 커밋 근거를 보존·표시하고 근거 없는 완료 선언을 거부한다. | 구현 완료 | 통과 | dag-tests, types, build |
| D5: 설정 저장·명시적 시작·중단·완료/미완료 표시와 필터를 연결한다. | 구현 완료 | 통과 | dag-tests, types, build |

## 재현 명령과 검사 결과

### dag-tests · integration · dag

```sh
node --test console/tests/dagPlan.test.ts console/tests/dagRunner.test.ts console/tests/dagWorker.test.ts console/tests/dagApi.test.ts
```

- 결과 · 통과
### types · unit · dag

```sh
npm --prefix console run typecheck
```

- 결과 · 통과
### build · unit · dag

```sh
npm --prefix console run build
```

- 결과 · 통과

## 독립 리뷰

- 사전 기준 검토 · 선택: 미실행
- 기준·구현 최종 검토: 통과 · 세션 `01a1aadd-a531-7d01-8391-d90981d88ef9` · 실행기 `codex`
  - D1: pass — dagPlan.ts·dagRunner.ts·dagStore.ts를 dag-tests 영수증 cac45204d489 및 테스트와 대조했다. 12개 통과, 실패·생략 0이며 선행 완료, 순환 거부, 실패 전파, 중단·재시작 시 미완료 보존을 확인했다.
  - D2: pass — dagWorker.ts→codex.ts의 app-server --stdio, thread/start·turn/start 호출과 dagRunner.ts의 연결 노드·선행 결과·폴더 구조 주입을 확인했다. dag-tests와 live-codex-run.json의 실제 단일 작업 completed·검사 exitCode=0·커밋 기록을 대조했다.
  - D3: pass — readyTasks의 소유권 충돌 배제와 commitQueue의 검사·stage·commit 직렬화를 확인했다. dag-tests는 비충돌 병렬 실행, 중복 소유권 직렬 실행, 작업별 실제 커밋 귀속, 등록 소유권 밖 변경 거부를 검증한다.
  - D4: pass — dagRunner.ts는 검사 성공과 변경 커밋 이후 완료 처리하며 변경 없는 완료 선언과 외부 stage·commit을 거부한다. dag-tests의 검사 실패·커밋 보존 검증과 완료 DOM·ui-run-response.json·DagPanel.tsx의 커밋·요약·검사 출력 표시를 대조했다.
  - D5: pass — dagApi.test.ts와 stop-dom.log·reload-dom.log에서 설정 저장·시작·중단·재조회를 확인했다. 추가된 filter-flow-dom.log와 filter-free-dom.log 모두 완료 1/1 상태에서 미완료 필터 적용 후 0/1개 및 빈 결과를 표시한다. 두 그래프의 필터 구현과 일치한다. types(2079c6994e39)·build(1ed19e0843c6)는 종료 코드 0이다.

## 구현·아티팩트

- [최종 완료 커밋·검사 표시 화면](/Users/jwsong/tools/proofstill/reports/graph-dag-evidence/completed-final.png)
- [실제 모델 및 화면 관측 위치](/Users/jwsong/tools/proofstill/reports/graph-dag-evidence/observations.json)

## 한계·남은 사항

- 공유 폴더 소유권은 보안 격리가 아니다.
- 실제 Codex 실행은 별도 합성 프로젝트에서 단일 작업만 관측했으며 다중 모델 동시 실행은 자동 검사 대역으로 검증한다.
- manifest의 현재 파일 해시는 모두 일치하며 이전 대비 변경은 필터 로그 2개와 observations.json뿐이다. 확인된 검사는 재실행하지 않았다.
- 실제 Codex 실행은 합성 프로젝트의 단일 작업이며 다중 작업 동시 실행과 UI 작업 실행은 대역 기반 증거다.
- 공유 폴더 소유권은 보안 격리가 아니다. PASS는 지정 요구와 제공 증거의 확인 범위에 한정한다.
- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.
