# Proofstill 0.4.0 전역 설치

[공개 릴리스](https://github.com/jwsong98/proofstill/releases/tag/v0.4.0) · [공개 소스](https://github.com/jwsong98/proofstill/tree/v0.4.0) · [로컬 tgz](../dist/digitalpresso-proofstill-0.4.0.tgz)

```sh
npx github:jwsong98/proofstill
```

추가 명령 없이 하네스·8개 스킬·Codex 전역 지침을 등록한다. 설치 뒤 새 Codex 세션에서 “Proofstill로 프로젝트 만들어줘”라고 요청한다. Node 22.18+, Python 3.10+, Git이 필요하며 npm registry 계정이나 개인 API 키는 필요 없다.

- runtime은 CODEX_HOME/proofstill(기본 ~/.codex/proofstill)에 보관하여 npm 캐시 삭제 후에도 동작한다.
- 전역 스킬은 ~/.agents/skills에 등록한다. 기존 개인 스킬과 config.toml·auth.json을 보존한다.
- AGENTS.md와 비어 있지 않은 AGENTS.override.md에 관리 블록을 등록하고 원본을 백업한다. 반복 설치는 중복을 만들지 않으며 설치 오류는 이전 상태로 복구한다.
- 파일 등록은 즉시 완료된다. 전역 AGENTS 지침의 새 세션 적용과 스킬 자동 감지를 구분해 안내한다.

현재 사용자 환경에도 공개 npx 명령으로 설치했다. 기존 config/auth 및 개인 스킬이 변경되지 않았음을 확인했으며, 기존 jwdesign·design-taste-frontend는 보존했다. [실제 설치 결과](../.proofstill/evidence/global-setup-install/result.json)와 [설치 로그](../.proofstill/evidence/global-setup-install/install.log)를 남겼다.

| 검사 | 실제 결과 |
|---|---|
| 전역 설치·보존·재설치·캐시 제거·실패 복구 | 10 tests 통과 |
| 기존 npm/pnpm 스캐폴드·OpenAPI/Orval·빌드·DB fast·flow | 22 tests 통과 |
| Python 하네스 회귀 | 79 tests 통과 |
| 비인증 GitHub 짧은 명령 설치 | 1 test 통과 |
| 최종 독립 검토 | 모든 요구 pass, 미해결 findings 없음 |
| Release 자산 비인증 다운로드 | 원본 SHA-256 일치 |

각 수는 바깥 테스트 실행 단위이며 하위 프로젝트에서 실행된 테스트를 합산하지 않았다. 독립 검토자가 동일 명령들을 별도로 실행했다.

[독립 판정](../.proofstill/validation/global-setup-v2/.proofstill/evidence/global-setup-v12/reviews/implementation-073d61765f41/answer.json) · [전체 검사·Red/Green·소스 보고](../.proofstill/validation/global-setup-v2/reports/global-setup-v12.md) · [설치기](../.proofstill/validation/global-setup-v2/bootstrap/setup.mjs) · [배포 메타데이터](../.proofstill/validation/global-setup-v2/.proofstill/evidence/global-setup-v12/release.json)

SHA-256: `54c2f9e9236aeecd5c1cec2d9b9e463236f0cfb07c6df14bb216f5dbfaf68594`

이번 공개본은 기존 공개 0.3.0에 전역 설치를 더한 버전이다. 같은 작업 폴더에서 병행 개발 중인 FastAPI·ORM·새 검증 절차 변경은 덮어쓰거나 공개하지 않았다. 해당 로컬 소스/0.3.0 tgz는 별도 상태로 보존했고, 이 작업의 구현과 테스트는 위 검증 복사본 및 공개 Git 저장소에 있다. npm registry에는 게시하지 않았다.

검증 환경은 macOS/POSIX, Node 24.14.0이다. Windows와 현재 열린 Codex 세션의 강제 갱신은 확인하지 않았다. 이번 변경에서 Docker E2E는 재실행하지 않았으며 기존 DB fast 회귀를 확인했다.

설정 방식의 근거: [OpenAI Docs 전역 AGENTS](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [전역 스킬 위치와 자동 감지](https://learn.chatgpt.com/docs/build-skills).
