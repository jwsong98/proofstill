# Project

- 모든 구현 작업자는 [커밋 스킬](.agents/skills/proofstill-commit/SKILL.md)을 따른다. 작은 관심사 하나를 구현하고 변경 위험에 맞는 필요한 확인을 마치면 즉시 로컬 커밋한 뒤 다음 관심사로 이동한다. 커밋마다 테스트·타입 검사·빌드를 무조건 반복하지 않는다. 이미 통과한 검사는 관련 변경·실패·구체적인 우려가 없으면 재실행하지 않는다. 검사용 코드의 임시 폴더 복사·내보내기와 별도 checkout·worktree·clone 생성은 금지한다. 검사는 현재 작업 디렉터리에서 수행하고 실제 확인 범위와 한계를 밝힌다. 마지막에 변경을 모아 hunk로 나누지 않는다. 위임 시에도 스킬·담당 파일·검사·커밋 시점을 전달하고 공유 index의 stage·커밋은 직렬화한다. 읽기 전용 검증자는 커밋하지 않으며 push·이력 재작성은 별도 요청 범위다.

- 백엔드 의존성은 app → usecase → domain, infra → domain이다. domain은 업무 규칙·저장소 Protocol, usecase는 실행 순서, app은 HTTP 입력·응답, infra는 저장소 구현을 소유한다. domain/usecase는 표준 라이브러리만 사용한다. infra/app.py만 조립 진입점으로 app·usecase·infra를 연결한다. app은 domain/infra를 직접 import하지 않는다.
- 기능 담당 범위는 domain/<기능>.py, usecase/<기능>.py, app/<기능>.py, infra/<기능>_repository.py와 대응 tests/domain·usecase·integration 파일로 나눈다. 계층별로 위임할 때는 domain의 계약을 먼저 고정하고 가짜 저장소로 독립 구현한다. 공유 계약·조립 진입점·migration·lockfile·생성 코드는 한 담당자가 순서대로 통합한다.
- 새로운 업무 동작은 실패할 행동 테스트를 먼저 작성하고 해당 테스트의 Red를 확인한 뒤 구현하여 Green으로 만든다. `npm run test:domain -- tests.domain.test_tasks.TaskRulesTests.test_rejects_invalid_titles_and_completion`, `npm run test:usecase -- tests.usecase.test_tasks.TaskListTests.test_create_update_get`처럼 담당 테스트만 반복한다. 실패가 기대한 행동 차이인지 확인하며 import 오류·환경 오류를 행동 검증으로 대신하지 않는다. Green 뒤 중복을 정리하고 관련 검사를 다시 실행한다.
- `test:architecture`는 역방향 import·순환 의존성·순수 계층의 외부 패키지 의존을 거부한다. `test:unit`은 architecture/domain/usecase/기존 unit, `test:fast`는 그 뒤 integration/flow를 순서대로 실행한다. domain/usecase 테스트는 DB·웹 라이브러리 없이도 실행할 수 있어야 한다.
- .agents/skills/proofstill-develop과 proofstill-verify로 개발·독립 검증을 수행한다. 실행은 npm run proofstill -- <명령>이다.
- 새 프로젝트나 중요한 기술 변경은 .agents/skills/proofstill-engineer로 구현 가능성·아키텍처를 사용자와 논의한다. 필요한 사용자 결정을 받은 뒤 스택·폴더 구조를 확정하고 생성·구현한다. 기존 합의는 재사용한다.
- UI 변경은 사용자가 요청한 화면·행동과 이를 만족하는 데 필요한 최소 범위로 제한한다. 기존 디자인·구조·테마를 존중하고, 요청하지 않은 꾸미기·테마 변형·모바일 전용 화면·내비게이션을 추가하지 않는다. 하네스에서 에이전트에 작업을 지시할 때도 대상 UI와 변경 범위·범위 밖을 함께 전달한다.
- UI는 jwdesign 토큰과 컴포넌트를 우선한다. design-taste-frontend는 화면 구성에 적용하고 충돌 시 jwdesign 규칙을 따른다. packages/ui는 공유 컴포넌트, packages/api는 계약과 생성 클라이언트를 소유한다.
- OpenAPI/Orval/API Tracker 작업은 .agents/skills/proofstill-api를 따른다. 계약과 서버 생성 명세를 분리하고 생성 코드를 직접 고치지 않는다.
- 현재 목표·제약·미정 결정·다음 행동은 .proofstill/work/<ID>/brief.md에 짧게 유지한다. 사용자 수용과 에이전트 검증을 구분한다.
- HTTP·CLI 경계가 바뀔 때 관련 integration/flow 검사, 중요한 기능 묶음 마무리에는 필요한 필수 검사 후 `proofstill review <ID>`로 기준과 구현을 한 번에 검토한다. 사전 리뷰·코드 복사본은 필수가 아니다. 새로운 업무 동작의 Red→Green은 위 TDD 절차를 따른다. 리뷰는 원본을 읽고 임시 쓰기는 실행별 TMPDIR에 둔다.
- 병렬 작업은 apps/app/src/features/<기능>, backend의 기능별 domain/usecase/app/infra·테스트 파일로 나눈다. 작업별 sources는 담당 파일과 실제 공유 의존성을 포함한다. 화면 진입점 main.tsx, HTTP 라우트 연결, packages/api 계약·생성물, packages/ui·jwdesign, DB migration, package/lockfile은 한 담당자가 순서대로 통합한다.
- 테스트는 실행마다 메모리 DB·seed·임의 포트·임시 flow 기록을 사용한다. 공유 개발 서버나 .api-tracker/flow-record.json으로 병렬 검증하지 않는다. 같은 작업 ID 명령은 순서대로 실행한다. Git worktree는 이 방식으로 해결되지 않는 충돌의 마지막 수단이다.
- 기존 파일을 임의로 덮어쓰지 않는다. 도구·모델의 개인 키를 저장하지 않는다. 시험 문제·파일·결과물을 외부로 전송하지 않는다.

- DB 변경은 proofstill-db 스킬을 따른다. E2E 전에는 test:fast의 메모리 DB+seed로 검증하고, test:e2e에서 실제 PostgreSQL Testcontainers를 사용한다. Docker 오류를 건너뛰거나 메모리 성공으로 대체하지 않는다.

- 긴 제공 요구는 원문을 보존하고 `requirements.md`(기존 동등 문서 우선)에 요구 ID·조건·원문/담당자 답변 근거·구현/검사 위치·상태를 연결한다. 이 문서는 개발 근거로 보존하며 임시 brief와 구분한다.
- 명확한 요구는 즉시 구현하고 업무 해석이 달라지는 조건만 확인한다. 입력→검증→처리→저장→조회 흐름을 일찍 연결하고 추가 요청은 영향받는 요구·코드·검사부터 갱신한다. 복잡한 상태·출처 검사가 필요한 경우에 Trace를 적용한다.
- 진행 설명에는 핵심 조건·선택 이유·실제 검증 근거와 한계를 짧게 담는다. 필수 협업 문서는 실제 지시·변경·검사·조치에 근거하며 사용자의 경험이나 미실행 검증을 꾸며 쓰지 않는다.

- 검증은 기능 묶음 단위로 한다. 구현 중에는 필요한 관련 검사만 실행하고, 중요한 동작 변경의 최종 검사·독립 리뷰는 수정을 모아 한 번 수행한다. 문구·문서·스타일 등 낮은 위험의 작은 수정은 직접 확인으로 끝낼 수 있다. 새 변경·실패·우려가 없으면 통과한 검사를 반복하지 않는다.
