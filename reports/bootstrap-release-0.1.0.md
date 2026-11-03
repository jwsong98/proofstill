# Proofstill 0.1.0 배포 검증

설치 가능한 npm tgz를 생성하고 별도 디렉터리에서 설치·실행을 검증했다. 공개 npm registry에는 아직 업로드하지 않았다.

- [배포 파일](/Users/jwsong/tools/proofstill/dist/digitalpresso-proofstill-0.1.0.tgz) · 7,673,426 bytes
- SHA-256: `2414201a753553de8f7b5bccc2859f4fef60bd0b94652d3a8dea4efef4a57549`
- [사용법](/Users/jwsong/tools/proofstill/README.md)
- [Red/Green·독립 검토 보고서](/Users/jwsong/tools/proofstill/.proofstill/validation/bootstrap-v18/reports/bootstrap-v18.md)
- [배포 버전 기록](/Users/jwsong/tools/proofstill/.proofstill/validation/bootstrap-v18/.proofstill/evidence/bootstrap-v18/delivery/release.json)

## 제공 기능

- domain/infra 분리와 선택 가능한 cli/backend/app/www 모노레포
- 실제 jwdesign 컴포넌트·폰트·토큰, shadcn 확장 가능한 UI, API 계약 패키지
- jwdesign·design-taste-frontend·개발·검증·인터뷰·API 안내 스킬 동봉
- 파일/명령/URL OpenAPI export와 Orval TypeScript 생성
- 기존 API Tracker 0.2.0의 실제 HTTP 호출·관측 ID 연결·flow 기록

## 검증 결과와 한계

scaffold 4개, OpenAPI 7개, 설치 통합 1개, 회귀 79개로 총 91개 검사가 통과했다. 별도 Codex 검토 세션도 직접 검사하여 R1–R5 모두 pass를 반환했고 하네스가 판정을 접수했다. npm/pnpm 설치·빌드·타입 검사, 실제 앱 진입점 SSR, API 호출 및 실패 경계를 포함한다. 추가로 CLI --install, shadcn card 설치, pnpm 전달 명령을 실행했다.

검증 환경은 macOS/POSIX, Node 24.14.0, Python 3.14.4다. Node 22.18+와 Python 3.10+가 필요하고 독립 리뷰에는 로그인한 Codex CLI가 필요하다. Windows, 실제 UI 클릭, 다른 백엔드 프레임워크 exporter는 미검증이다. npm 캐시 권한 오류는 원본 캐시를 변경하지 않고 임시 복사본으로 격리하여 재실행했다.

배포 파일은 검증한 bootstrap-v18 소스에 고정했다. 검토 중 다른 채팅에서 수정한 공용 스킬 3개와 예제 1개는 현재 작업 트리에 보존했으며 이 tgz에 반영하지 않았다. 현재 작업 트리에서 다시 pack하면 별도 검증이 필요하다. 사용자의 최종 수용과 공개 배포 위치 결정은 별개로 남아 있다.
