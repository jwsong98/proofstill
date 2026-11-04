# 제품 흐름과 핵심 로직을 병행하는 예제

주문 저장·조회는 `Orders`가, 금액 계산은 `quote(request)`가 맡는다. 제품 작업은 주입한 계산 함수를 사용해 저장·재조회 경계를 먼저 확인하고, 로직 작업은 같은 입출력 계약에서 실제 계산과 경계값을 보강한다. 통합 검사는 실제 두 구현을 연결한다. 이 예제에는 웹 화면이 없다.

저장소 루트에서 실행한다. Python 표준 라이브러리만 사용한다.

```sh
python3 bin/proofstill --root examples/agile_product project init examples/agile_product/project.json
python3 bin/proofstill --root examples/agile_product project claim pricing product --owner product-agent
python3 bin/proofstill --root examples/agile_product project claim pricing logic --owner logic-agent
```

반환된 작업 패킷을 각각의 구현 에이전트에 전달한다. 에이전트 실행/모델 연결은 현재 Codex의 위임 수단을 사용한다. 이 명령이 모델을 자동 호출하지는 않는다. 쓰기 경계는 협업 규칙이며 파일 보안 격리가 아니다. 계약·공유 파일의 소유자는 하나이고 Git index의 stage/commit은 직렬화한다. 스킬의 작은 커밋 규칙을 따른다.

```sh
python3 bin/proofstill --root examples/agile_product project release pricing product --owner product-agent
python3 bin/proofstill --root examples/agile_product project release pricing logic --owner logic-agent
python3 bin/proofstill --root examples/agile_product project test pricing --jobs 2
python3 bin/proofstill --root examples/agile_product project compare pricing rounding
```

제품·로직 검사를 병렬 실행하고 둘이 현재 입력에서 통과하면 통합 검사를 이어간다. 기준 구현은 `half-cent`에서 2, 개선 구현은 3을 반환한다. 별도 검사기는 고정된 업무 기대값 3과 대조해 기준 구현을 invalid로 표시한다. 지표가 좋아도 잘못된 결과를 승자로 고르지 않는다.

업무 의미가 미정인 실제 상황에서는 `project question pricing logic <질문ID> --question '<관찰과 결과 차이>'`로 해당 작업만 보류한다. 실제 답변을 받은 뒤 같은 명령에 `--answer '<답변>' --source '<실제 대화·문서 위치>'`를 넣는다. 무응답이나 에이전트 제안을 답변으로 기록하지 않는다. 제품 작업은 계속할 수 있으며 답변 변경 후 로직과 통합 근거는 다시 확인한다.

요구·검사 추가는 **project.json 한 곳**을 편집하고 다음 명령으로 기존 요구 ID와 이력을 유지한다.

```sh
python3 bin/proofstill --root examples/agile_product project sync examples/agile_product/project.json --reason '변경 이유' --source '실제 요청·답변 위치'
python3 bin/proofstill --root examples/agile_product project requirements pricing
python3 bin/proofstill --root examples/agile_product project snapshot pricing
```

`requirements`는 현재 구현·검사·리뷰 현황을 파생해 보여준다. 구현 상태는 기존 `implement pricing-product PRODUCT ...`처럼 실제 작업자가 기록한다. 기록은 검사와 수용을 대신하지 않는다. 최종 검토는 기존 `review pricing-product`, `review pricing-logic`, `review pricing-integration`에 허용된 Codex 경로와 모델을 명시해 수행한다. 이번 환경에서는 `gpt-6.1-sol` 또는 `gpt-5.6-terra`만 사용한다.

스냅샷은 미완료 상태도 `partial`로 남긴다. 모든 작업의 현재 자동 검사·독립 리뷰가 통과하고 실행 중 변경이 없어야 `verified`다. 이전 검증본은 새 실패/미검증 결과로 덮어쓰지 않는다. 사용자 수용과 외부 제출은 별도다.
