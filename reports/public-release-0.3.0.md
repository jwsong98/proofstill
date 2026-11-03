# Proofstill 0.3.0 공개 배포

[공개 저장소](https://github.com/jwsong98/proofstill) · [릴리스](https://github.com/jwsong98/proofstill/releases/tag/v0.3.0)

사용자 요청에 따라 검증된 tgz를 GitHub 공개 Release에 게시했다. npm registry에는 게시하지 않았다. GitHub/npm 로그인 없이 아래 명령으로 다운로드하여 프로젝트를 만든다.

```sh
npm exec --yes --package=https://github.com/jwsong98/proofstill/releases/download/v0.3.0/digitalpresso-proofstill-0.3.0.tgz -- proofstill scaffold my-project --install
cd my-project
npm run test:fast
```

Node 22.18+, Python 3.10+가 필요하다. 독립 검증은 Codex CLI 로그인, Testcontainers E2E는 실행 중인 Docker가 필요하다.

실제 검사: 인증 없는 HTTP 다운로드, SHA-256 원본 일치, 비어 있는 npm 설정·새 npm 캐시에서 공개 URL scaffold --install, Python 환경 설치, OpenAPI export와 Orval 생성, db:check, test:fast, build, typecheck, flow validate 모두 종료 코드 0.

패키지 코드는 변경하지 않았다. [이전 DB 구현·독립 검증 보고](database-0.3.0.md)의 tgz와 동일하며 SHA-256은 `7151a69d345d4a1b2290771e840b05f2a41d68d8a8c5636f36e4df6420ea9e4c`이다. 공개 저장소와 로컬 README에는 공개 설치 URL을 추가했다. tgz 내 README의 로컬 설치 예시는 그대로 남아 있다.

이번 검사는 macOS/POSIX의 공개 배포 설치 경계 검증이다. 컨테이너 E2E는 동일한 tgz의 기존 검증 결과를 사용하며 이번에 재실행하지 않았다. Windows와 브라우저 클릭은 검증하지 않았다.

근거: [배포 메타데이터](../.proofstill/evidence/public-release-0.3.0/release.json), [실행 결과와 명령](../.proofstill/evidence/public-release-0.3.0/results.json), [다운로드·설치 검사 코드](../.proofstill/evidence/public-release-0.3.0/check-public.py), [공개 설치 로그](../.proofstill/evidence/public-release-0.3.0/public-scaffold.log), [메모리 DB 테스트 로그](../.proofstill/evidence/public-release-0.3.0/test-fast.log).
