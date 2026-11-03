# 최신본 push

[main 커밋](https://github.com/jwsong98/proofstill/commit/83dae189f5a88670f1910bc36386d45505ef8410) · [0.5.0 prerelease](https://github.com/jwsong98/proofstill/releases/tag/v0.5.0)

FastAPI/ORM, 빠른 CLI flow, 간소화된 최종 리뷰, UX 상태머신, 전역 설치를 통합해 공개 main에 push했다. 테스트와 lockfile도 포함했다. 공개 npx 경로의 0.5.0 설치와 8개 스킬 등록을 확인했다.

검사: 전역 설치 10개, Python 하네스/UX 93개, PostgreSQL Testcontainers 1개 통과. bootstrap 29개 중 최신 스킬의 오래된 fixture hash 1건이 실패했다. 최신 원본 스킬의 hash로 갱신한 뒤 해당 scaffold 검사 4개는 통과했다. 전체 bootstrap 재실행 및 독립 최종 리뷰는 사용자의 2분 내 완료 요청에 따라 미실행이다. prerelease 상태를 유지한다.

[검사 기록](../.proofstill/evidence/latest-push-v1/state.json) · [공개 설치 로그](../.proofstill/evidence/latest-push-v1/public-smoke.log)
