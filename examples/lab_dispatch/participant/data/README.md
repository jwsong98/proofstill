# 제공 데이터 사전

UTF-8 CSV, 첫 행은 열 이름. ID는 대소문자를 구별하는 문자열입니다. 빈 값은 열별로 명시된 경우에만 허용합니다. 시각은 ISO 8601 `+09:00`, 정밀도는 분이며 모든 구간은 `[시작, 끝)`입니다. 종료와 다음 시작이 같은 시각이면 중첩하지 않습니다. 표의 시간 단위는 분입니다. 데이터는 합성 자료이고 실제 장비 성능을 나타내지 않습니다.

`manifest.json`: dataset_id, revision, service_date_from/to(양 끝 포함), timezone. 선언 범위를 CSV의 최소/최대 날짜로 추정하지 마세요. 전체 CSV가 한 버전입니다.

| 파일 | 열과 형식 |
|---|---|
| sites.csv | site_id PK, name |
| machines.csv | machine_id PK, site_id FK, name, initial_family(A/B/C) |
| capabilities.csv | (machine_id, family) PK; 허용 조합만 존재. duration_factor는 양수 소수, 작업의 nominal_minutes에 곱하고 올림 |
| jobs.csv | job_id PK, requester_id, site_id FK, service_date, family(A/B/C), nominal_minutes(양의 정수), release_at, due_at, priority(RUSH/NORMAL), status(READY/HOLD/CANCELLED), predecessor_id(없으면 빈 값) |
| changeovers.csv | (from_family,to_family) PK, minutes(0 이상 정수). 동일 계열 포함 9쌍 |
| machine_windows.csv | window_id PK, machine_id FK, start_at, end_at. 목록 밖 시간 사용 불가; 같은 장비 구간은 겹치지 않음 |
| staff_windows.csv | window_id PK, staff_id, site_id FK, families(`A\|B\|C`처럼 `\|` 구분), start_at, end_at. 같은 사람의 창은 겹치지 않음 |
| fixed_runs.csv | reservation_id PK, job_id UNIQUE FK, machine_id FK, staff_id FK, setup_start, process_start, process_end. 현장에 전달한 기존 예약 |
| history.csv | record_id PK, service_date, machine_id FK, family, completed_jobs(0 이상 정수), busy_minutes(0 이상 정수). 과거 기간의 집계, 개인 작업 ID 없음 |
| staff.csv | staff_id PK, display_name. 이름은 가명 |

release_at은 시편이 준비되는 시각, due_at은 요청 부서가 적은 납기입니다. 준비·처리 중 어느 경계에 적용하는지, 상태별 편성 대상, 납기와 우선순위의 운영 의미는 인수인계 자료와 담당자에게 확인합니다. 모든 머신의 초기 계열은 manifest 기간 시작 직전 상태입니다. 장비 준비 행렬은 방향별로 독립이며 누락 값을 대칭 값이나 0으로 보정하지 않습니다.

작업의 소속 사업장은 고정입니다. 선행 작업이 있으면 동일 사업장입니다. 후행 준비 전에 선행 완료 후 인계 시간이 필요한지는 담당자에게 확인하세요. 원본에는 취소·보류, 고정 예약, 계열 전환, 여러 장비의 동일 시간대, 다음날 새벽 작업이 섞여 있습니다. history의 건수와 jobs의 행 수가 같은 의미인지 먼저 확인하세요.

기본 자료 외의 유효성 검증 실습용 변경안은 `inbox/05_변경요청.txt`에 있습니다. 기본 자료를 덮어쓰지 말고 별도 묶음으로 준비하세요.
