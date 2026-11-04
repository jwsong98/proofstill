# JSON 내보내기 계약 v1

JSON 객체, UTF-8. 필드는 아래 이름을 사용합니다. 모든 시각은 오프셋이 있는 ISO 8601 분 단위, ID는 원본 그대로입니다. 예약과 일반 작업은 allocations 한 배열에서 각각 한 번 나타납니다.

```json
{
  "schema_version": "1.0",
  "plan_id": "생성한 고유 ID",
  "dataset": {"id": "provided", "revision": "1", "content_hash": "전체 입력 내용의 해시"},
  "period": {"from": "2026-11-09", "to": "2026-11-12"},
  "settings": {"setup_buffer_minutes": 0, "search_limit_seconds": 10},
  "status": "draft",
  "allocations": [{"job_id": "J0001", "machine_id": "M-N1", "staff_id": "T-N",
    "setup_start": "2026-11-09T08:00:00+09:00", "process_start": "2026-11-09T08:25:00+09:00",
    "process_end": "2026-11-09T08:55:00+09:00", "fixed": true}],
  "unassigned": [{"job_id": "J0002", "reason_code": "NO_FEASIBLE_SLOT", "detail": "작업자와 장비의 가용 구간을 함께 만족하는 시간 없음"}],
  "metrics": {"completed_jobs": 1, "late_jobs": 0, "total_late_minutes": 0, "total_setup_minutes": 25},
  "validation": {"valid": false, "violations": []},
  "search": {"termination": "feasible", "optimality_proven": false}
}
```

예시는 모양만 설명하며 완전한 제출 결과가 아닙니다. detail에는 한국어 업무 설명을 씁니다. status는 draft/published, termination은 feasible/limit/infeasible 중 하나입니다. 탐색 시간 소진만으로 infeasible을 사용하지 않습니다. 알고리즘의 결과 주장과 독립 불변조건 검사는 구분합니다.

게시에는 대상 전원 단일 배정, unassigned가 빈 배열, 독립 검증 valid=true가 필요합니다. 진단 초안은 내보낼 수 있지만 draft와 위반을 명확히 표시하고 요청자 확정 일정으로 사용하지 않습니다. 현재 데이터와 다른 버전은 별도의 과거 결과 열람으로만 제공하고 현재 계획 내보내기에서 제외합니다.

completed_jobs는 배정된 대상 작업 수이며 실제 장비 완료 실적이 아닙니다. late는 process_end가 due_at을 초과한 분(음수는 0), total_setup은 모든 배정의 process_start-setup_start 합입니다. 지표에 고정 예약도 포함합니다. 운영 규칙상 허용하지 않는 지연은 게시 불가이며 지표가 작다고 허용되지 않습니다.
