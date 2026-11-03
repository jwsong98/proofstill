import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Store } from '../server/store.ts';

type Group = { id: string; title: string; requirements: number[]; merge: string[]; paths: string[]; tests: string[]; scope: string; next: string };
export const groups: Group[] = [
  { id: 'workspace', title: '프로젝트·로컬 저장', requirements: [1,11,12], merge: ['feature-scope','decision-git','decision-implementation','issue-git-tracking','task-architecture','task-db'], paths: ['console/server/store.ts','console/server/main.ts','console/server/migrations','console/server/service.ts'], tests: ['store.test.ts'], scope: 'SQLite 저장·재시작·프로젝트 격리 검사. 설치·배포와 실제 화면은 별도 확인.', next: 'WC-11의 그래프 라이브러리 선정은 @xyflow/react로 구현됨. 실제 재시작 후 화면 복구 확인 필요.' },
  { id: 'evidence', title: '원문·출처 확인', requirements: [2,16,23], merge: ['decision-immutable','issue-documents','issue-mixed-evidence','issue-mixed-sources'], paths: ['console/server/service.ts','console/server/store.ts','console/web/App.tsx','console/web/styles/app.css'], tests: ['store.test.ts','api.test.ts'], scope: '불변 원문·파일 구간·경로 경계·대화 출처 API 검사. 화면의 한 행 배치·문맥 펼침은 별도 확인.', next: '접힌 원문 근거에서 파일 문맥·대화 원문 이동과 900px·1280px 출처 한 행 표시 확인.' },
  { id: 'graph', title: '관계 그래프 탐색·편집', requirements: [7,8,17,20], merge: ['decision-relations','issue-why','issue-linear-flow'], paths: ['console/server/store.ts','console/server/service.ts','console/web/GraphCanvas.tsx','console/web/App.tsx','console/web/graphLayout.ts'], tests: ['store.test.ts','api.test.ts','graphLayout.test.ts'], scope: '관계 방향·순환·컨텍스트·원문 인용 및 레이아웃 계산 검사. 실제 AI 그래프 생성 품질·브라우저 조작은 별도 확인.', next: '통합한 8개 기능에서 근거 탐색·종류별 필터·전체 숨김 복구·실제 AI 갱신 확인.' },
  { id: 'chat', title: 'Codex 세션·채팅', requirements: [3,4,5,14,18,25,27,29,31], merge: ['feature-sessions','decision-chat','decision-runtime','issue-cli-input','issue-automatic-work','issue-navigation','task-api'], paths: ['console/server/service.ts','console/server/store.ts','console/server/codex.ts','console/web/App.tsx','console/web/SessionChat.tsx','console/web/api.ts'], tests: ['api.test.ts','store.test.ts','service.test.ts','codex.test.ts','sessionActivities.test.ts'], scope: '세션 재사용·동기화·초안 복구·권한·페이지 조회를 프로토콜 fixture로 검사. 실제 모델 turn은 미실행.', next: '실제 app-server의 세션 가져오기·복귀·전송·중단 및 승인 정책을 한 흐름으로 확인.' },
  { id: 'usage', title: '토큰·컨텍스트 사용량', requirements: [6], merge: [], paths: ['console/server/service.ts','console/web/contextUsage.ts','console/web/App.tsx'], tests: ['contextUsage.test.ts','api.test.ts'], scope: '최근 요청 컨텍스트와 누적 토큰 구분·미제공·경계값 계산 및 API 투영 검사. 실측 모델 값은 별도 확인.', next: '실제 모델 응답에서 최근 요청 컨텍스트와 누적 토큰이 각각 표시되는지 확인. 미제공 값은 미확인 유지.' },
  { id: 'results', title: '실행 결과·검증 근거', requirements: [9,13,26,28,30,32], merge: ['decision-results','task-verification'], paths: ['console/server/service.ts','console/server/store.ts','console/web/SessionChat.tsx','console/web/sessionActivities.ts','console/web/MessageContent.tsx','console/web/messageFormat.ts','console/web/App.tsx'], tests: ['api.test.ts','store.test.ts','sessionActivities.test.ts','messageFormat.test.ts'], scope: '정확한 명령 결과 연결·실패·중단·에이전트 이벤트·Markdown·활동 묶음 투영 검사. 실제 브라우저의 결과/링크 조작은 별도 확인.', next: '실제 실행 결과 필터와 에이전트 결과·링크·활동 묶음 펼침/갱신 유지 확인.' },
  { id: 'desktop', title: '읽기 쉬운 화면·제목', requirements: [15,19,21,22,24,33], merge: ['decision-ui','task-ux','task-ui'], paths: ['console/web/App.tsx','console/web/GraphCanvas.tsx','console/web/styles/app.css','console/server/service.ts','AGENTS.md'], tests: [], scope: '타입 검사와 번들 빌드만 자동 확인. 가독성·폭·키보드·툴팁·미리보기는 화면 확인 필요.', next: '900px·1280px에서 핵심 제목·상세 접힘·패널 폭·작업 미리보기·상단 한 행 확인. AI 제목 생성 품질은 실제 생성으로 확인.' },
  { id: 'handoff', title: '현재 요구·구현 현황·인계', requirements: [10,34,35], merge: [], paths: ['console/server/handoff.ts','console/server/handoffExport.ts','console/server/store.ts','console/web/HandoffView.tsx','console/maintenance/proofstillCatalog.ts'], tests: ['handoff.test.ts','catalog.test.ts','api.test.ts'], scope: '현재/이전 구분·코드 경로·관측 명령·오래된 근거·인계 HTML·통합 보존을 검사. 실제 화면과 독립 리뷰는 별도 판정.', next: '현재 기능/이전 작업 전환·WC ID 검색·구현 편집·남은 일·인계 HTML을 브라우저에서 확인. 독립 리뷰 확인.' },
];
export function requirementRows(text: string): Map<number, { condition: string; origin: string; implementation: string; line: number }> {
  const rows = new Map<number, { condition: string; origin: string; implementation: string; line: number }>();
  text.split('\n').forEach((line, i) => {
    const cells = line.split('|').map(s => s.trim());
    const match = cells[1]?.match(/^WC-(\d+)$/);
    if (!match) return;
    const n = Number(match[1]);
    if (rows.has(n)) throw new Error(`Duplicate WC-${n}`);
    rows.set(n, { condition: n <= 18 ? cells[3] : cells[2], origin: n <= 18 ? cells[4] : cells[3], implementation: n <= 18 ? cells[5] : cells[4], line: i+1 });
  });
  const expected = groups.flatMap(g => g.requirements);
  if (expected.length !== new Set(expected).size || rows.size !== expected.length || expected.some(id => !rows.has(id))) throw new Error('Requirement coverage must match the full current document');
  return rows;
}
export function reconcileCatalog(store: Store, projectId: string, root: string) {
  const project = store.getProject(projectId);
  if (resolve(project.rootPath) !== resolve(root)) throw new Error('Project root mismatch');
  const document = readFileSync(resolve(root, 'requirements.md'), 'utf8'), rows = requirementRows(document);
  const handoffPlan = JSON.parse(readFileSync(resolve(root, '.proofstill/evidence/handoff-clarity-v1/plan.json'), 'utf8'));
  for (const group of groups) for (const path of [...group.paths, ...group.tests.map(t => `console/tests/${t}`)]) if (!existsSync(resolve(root, path))) throw new Error(`Missing implementation/check path: ${path}`);
  return store.transaction(() => {
    const found = store.db.prepare("SELECT n.id FROM nodes n JOIN evidence e ON e.id=n.evidence_id WHERE n.project_id=? AND e.content=? AND e.source_kind='file' AND json_extract(e.source_json,'$.path')='requirements.md' LIMIT 1").get(projectId,document) as {id:string} | undefined;
    const documentSourceId = found?.id || store.captureEvidence(projectId,{title:'현재 요구사항 원문',sourceKind:'file',source:{path:'requirements.md',startLine:1,endLine:document.split('\n').length},content:document}).id;
    for (const group of groups) {
      const id = `ps-feature-${group.id}`, sections = group.requirements.map(n => `WC-${String(n).padStart(2,'0')}\n${rows.get(n)!.condition}\n근거: requirements.md:${rows.get(n)!.line} · ${rows.get(n)!.origin}`);
      if (group.id === 'handoff') for (const r of handoffPlan.requirements) sections.push(`${r.id}\n${r.text}\n근거: .proofstill/evidence/handoff-clarity-v1/plan.json`);
      const body = sections.join('\n\n');
      const existing = store.db.prepare('SELECT title,body FROM nodes WHERE project_id=? AND id=?').get(projectId,id) as { title: string; body: string } | undefined;
      if (!existing) store.createNode(projectId, { id, kind: 'feature', title: group.title, body });
      else if (existing.title !== group.title || existing.body !== body) store.updateNode(projectId,id,{title:group.title,body});
      const sourceIds = [...group.requirements.filter(n => n<=18).map(n => `ps-wc-${String(n).padStart(2,'0')}`), ...group.merge.map(name => `ps-${name}`)]
        .filter(source => !!store.db.prepare('SELECT 1 FROM nodes WHERE project_id=? AND id=?').get(projectId,source));
      store.consolidateNodes(projectId,id,sourceIds,'현재 기능별로 요구·이유·결정·작업을 통합. 원래 노드·관계·세션은 보존.');
      store.createEdge(projectId,{sourceId:id,targetId:documentSourceId,kind:'related',reason:'현재 요구사항 문서 원문'});
      const coverage = group.requirements.map(n => `WC-${String(n).padStart(2,'0')}`).join(', ') + (group.id==='handoff' ? ', H1~H5' : '');
      const implementation={ status:'implemented' as const, paths:group.paths, remaining:'', note:`포함 요구: ${coverage}. 구현 경로와 해당 동작을 소스에서 대조했습니다.\n검사 범위: ${group.scope}\n다음 검증: ${group.next}` };
      const old=store.implementationProgress(projectId,id);
      if (JSON.stringify([old.status,old.paths,old.remaining,old.note])!==JSON.stringify([implementation.status,implementation.paths,implementation.remaining,implementation.note])) store.saveImplementationProgress(projectId,id,implementation);
      const checks=group.tests.length ? [{id:'code',kind:'test' as const,label:`${group.title} 동작 회귀 확인`,purpose:group.scope,rationale:'기존 동작이 코드 수정으로 깨지거나 잘못된 데이터가 저장되는 회귀를 찾기 위해 확인해요.',expected:'등록한 테스트의 기대값을 모두 충족하고 실패가 0개여야 해요. 실제 화면과 모델 실행은 별도 확인해요.',command:'npm --prefix console test',files:group.tests.map(t => `console/tests/${t}`)}] : [];
      checks.push({id:'types',kind:'test' as const,label:'화면·서버 타입 연결 확인',purpose:'화면과 서버가 주고받는 데이터의 타입과 컴포넌트 연결을 검사해요.',rationale:'필드 누락이나 잘못된 전달로 화면이 실행 중 깨지는 문제를 미리 찾기 위해 필요해요.',expected:'TypeScript 오류 없이 검사가 완료돼야 해요. 화면 조작을 검증한 것은 아니에요.',command:'npm --prefix console run typecheck',files:['console/tsconfig.json']});
      checks.push({id:'build',kind:'test' as const,label:'웹 화면 배포 파일 생성 확인',purpose:'현재 소스에서 실행 가능한 웹 번들을 만들어요.',rationale:'누락된 파일이나 의존성 때문에 화면을 열 수 없는 문제를 찾기 위해 필요해요.',expected:'Vite 빌드가 오류 없이 완료돼야 해요. 실제 사용 흐름은 별도로 확인해요.',command:'npm --prefix console run build',files:['console/vite.config.ts']});
      const manual={id:'scenario',kind:'scenario' as const,label:`${group.title} 실제 사용 확인`,purpose:group.next,rationale:'자동 검사로 확인하지 못한 실제 화면과 모델 연결의 동작을 확인하기 위해 필요해요.',expected:'명시한 사용 흐름을 직접 수행하고 요구 조건과 실제 결과가 일치해야 해요.',command:`수동 확인 필요: ${group.next}`,files:group.paths};
      const definitions=[...checks,manual];
      const current=store.featureAcceptance(projectId,id).checks.map(c => ({id:c.id,kind:c.kind,label:c.label,command:c.command,files:c.files,purpose:c.purpose||'',rationale:c.rationale||'',expected:c.expected||''}));
      if(JSON.stringify(current)!==JSON.stringify(definitions.map(c=>({id:c.id,kind:c.kind,label:c.label,command:c.command,files:c.files,purpose:c.purpose||'',rationale:c.rationale||'',expected:c.expected||''})))) store.defineFeatureChecks(projectId,id,definitions);
    }
    store.activateCurrentCatalog(projectId);
    return {groups:groups.length,requirements:rows.size,merged:(store.db.prepare('SELECT count(*) AS n FROM node_merges WHERE project_id=?').get(projectId) as {n:number}).n};
  });
}
