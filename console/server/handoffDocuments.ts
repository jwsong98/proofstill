import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { implementationLabels, verificationLabels, nextAction } from '../shared/progress.ts';
import { criteriaStatus } from '../shared/assurance.ts';
import type { HandoffRow, HandoffSnapshot } from './types.ts';

const execute = promisify(execFile);
const cell = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const block = (value: string) => {
  const fence = '`'.repeat(Math.max(3, ...Array.from(value.matchAll(/`+/g), m => m[0].length + 1)));
  return `${fence}\n${value}\n${fence}`;
};
export function verified(row: HandoffRow) {
  return row.implementation.status === 'implemented' && !row.implementation.remaining
    && row.implementationCurrent === true && !row.pendingDecisions?.length
    && row.verification.checks.length > 0 && row.verification.checks.every(c => c.status === 'passed')
    && row.verification.status === 'passed' && row.verification.review.status === 'passed'
    && (row.verification.review.gateStatus ?? 'passed') === 'passed'
    && criteriaStatus(row) === 'passed'
    && (row.verification.criteriaReview?.gateStatus ?? 'passed') === 'passed';
}
function table(rows: HandoffRow[], indexes: Map<string, number>) {
  return ['| 요구·기능 | 구현 | 자동 검사 | 독립 리뷰 | 다음 행동 |', '|---|---|---|---|---|',
    ...rows.map(r => `| [${cell(r.title)}](details.md#item-${indexes.get(r.id)})${r.historical ? ' (이전 작업)' : ''} | ${implementationLabels[r.implementation.status]} | ${verificationLabels[r.verification.status]} | ${verificationLabels[r.verification.review.status]} | ${cell(nextAction(r))} |`),
    ...(rows.length ? [] : ['해당 항목 없음. 등록되지 않은 기능의 상태를 뜻하지 않습니다.'])].join('\n');
}
function detail(row: HandoffRow, index: number) {
  return [`<a id="item-${index}"></a>`, `## ${row.title}`, '',
    `작업: ${row.taskId} / 요구: ${row.requirementId} / ${row.historical ? '이전 작업' : '현재 항목'}`, '',
    '### 요구·원문', row.description || row.origin, '', '원래 맥락:', row.origin, '',
    '### 구현', `${implementationLabels[row.implementation.status]} / 현재 코드 근거: ${row.implementationCurrent === true ? '확인' : '미확인 또는 변경됨'}`,
    row.implementation.note || '구현 설명 미기록', `코드 위치: ${row.implementation.paths.join(', ') || '미기록'}`,
    `남은 구현: ${row.implementation.remaining || '미기록'}`, ...(row.issues ?? []), '',
    '### 검사·실행 결과', ...[...row.verification.checks, ...(row.verification.criteriaChecks ?? [])].flatMap(c => [
      `#### ${c.label} · ${verificationLabels[c.status]}`, `확인 범위: ${c.scope}`,
      `목적: ${c.purpose || '미기록'}`, `필요한 이유: ${c.rationale || '미기록'}`, `통과 조건: ${c.expected || '미기록'}`,
      `검사 파일: ${c.files.join(', ') || '미기록'}`, block(c.command),
      `실행 시각: ${c.recordedAt ?? '미실행'} / 종료 코드: ${c.exitCode ?? '미확인'}`,
      `원본 로그: ${('logPath' in c ? c.logPath : null) || '미기록'} / 영수증: ${('receiptPath' in c ? c.receiptPath : null) || '미기록'}`,
      ...(c.outputTruncated ? ['출력 생략 있음: 전체 출력은 원본 로그에서 확인해야 합니다.'] : []), block(c.output || '실행 출력 없음'),
      ...(c.cases ?? []).map(v => `- ${v.situation}: 기대 ${v.expected} / 관측 ${v.observed} / ${verificationLabels[v.status]}`), '']),
    '### 독립 리뷰·기준·작업 전체 판정',
    `요구별 리뷰: ${verificationLabels[row.verification.review.status]}`,
    row.verification.review.evidence || '독립 리뷰 근거 없음',
    ...[row.verification.review, row.verification.criteriaReview].filter(Boolean).flatMap(r => [
      `리뷰 세션: ${r!.session || '미기록'}`, ...(r!.findings ?? []).map(f => `- 발견: ${f}`),
      ...(r!.limitations ?? []).map(l => `- 리뷰 한계: ${l}`),
    ]),
    `작업 전체 게이트: ${verificationLabels[row.verification.review.gateStatus ?? row.verification.review.status]}`,
    `기준 적절성: ${verificationLabels[criteriaStatus(row)]}`,
    row.verification.criteriaReview?.evidence || '기준 리뷰 근거 없음', '',
    '### 남은 일·결정·한계', `다음 행동: ${nextAction(row)}`, row.next || '',
    `사람의 책임: ${row.responsibility?.human || '미기록'}`, `AI 위임 범위: ${row.responsibility?.ai || '미기록'}`,
    ...(row.pendingDecisions ?? []).map(d => `- 결정 대기 ${d.id}: ${d.question}`),
    ...row.limitations.map(l => `- ${l}`), '', '### 사람이 확인할 행동',
    ...(row.humanChecks?.length ? row.humanChecks.map(c => `- ${c.action} → 기대: ${c.expected}`) : ['미등록. 사용자 수용은 미확인입니다.']),
    ...(row.mergedRecords ?? []).flatMap(r => ['', `### 통합 전 기록: ${r.title}`, r.body]), ''].join('\n');
}
export async function writeHandoffDocuments(root: string, output: string, snapshot: HandoffSnapshot, projectName: string) {
  root = await realpath(root); output = resolve(output);
  // A fresh directory prevents accidental replacement of project files or an earlier handoff.
  await mkdir(output);
  let commit = 'Git 기준 없음', dirty = '';
  const errors = [...snapshot.errors];
  let documents: string[] = [];
  try {
    commit = (await execute('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
    dirty = (await execute('git', ['status', '--short'], { cwd: root })).stdout.trim();
    documents = (await execute('git', ['ls-files', '-z', '--', '*.md'], { cwd: root })).stdout.split('\0').filter(p => p && !p.startsWith('vendor/') && !p.startsWith('templates/'));
  } catch (error) { errors.push({ taskId: 'documents', message: `Git·문서 목록 조회 실패: ${String(error)}` }); }
  const copied: string[] = [];
  for (const path of documents) {
    try {
      const actual = await realpath(resolve(root, path)), rel = relative(root, actual);
      if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw new Error('문서 경로가 프로젝트 밖을 가리킵니다');
      const target = resolve(output, 'documents', path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(actual)); copied.push(path);
    } catch (error) { errors.push({ taskId: path, message: `문서 포함 실패: ${String(error)}` }); }
  }
  const indexes = new Map(snapshot.rows.map((r, i) => [r.id, i + 1]));
  const implemented = snapshot.rows.filter(r => r.implementation.status === 'implemented');
  const passed = snapshot.rows.filter(verified), pending = snapshot.rows.filter(r => !verified(r));
  const files = {
    'implemented.md': '# 구현된 것\n\n구현 완료로 기록된 항목입니다. 현재성·검증·사용자 수용과 구분합니다.\n\n' + table(implemented, indexes),
    'verified.md': '# 검증된 것\n\n현재 구현 근거·등록된 검사·기준 적절성·독립 리뷰·전체 게이트가 모두 통과한 항목입니다. 등록 범위 밖과 사용자 수용을 보증하지 않습니다.\n\n' + table(passed, indexes),
    'unverified.md': '# 미검증·실패·남은 일\n\n미실행·미기록·진행 중·실패·중단·오래된 근거·결정 대기를 모두 포함합니다. 상세에서 실제 상태를 구분합니다.\n\n' + table(pending, indexes),
    'details.md': '# 전체 요구별 근거\n\n' + snapshot.rows.map((r, i) => detail(r, i + 1)).join('\n'),
    'snapshot.json': JSON.stringify({ ...snapshot, errors, gitCommit: commit, workingTreeChanges: dirty, documents: copied }, null, 2),
    'README.md': [`# ${projectName} 인계`, '', `생성: ${snapshot.generatedAt}`, `Git 기준: ${commit}`,
      `작업 트리: ${dirty ? '미커밋 변경 포함. 현재 작업 트리 조회이며 커밋에 고정된 검증 자료가 아닙니다.' : '미커밋 변경 없음'}`, '',
      `전체 ${snapshot.rows.length}개 (현재 ${snapshot.rows.filter(r => !r.historical).length} / 이전 작업 ${snapshot.rows.filter(r => r.historical).length})`,
      `구현 완료 기록 ${implemented.length}개 / 검증됨 ${passed.length}개 / 미검증·남은 일 ${pending.length}개`, '',
      '- [구현된 것](implemented.md)', '- [검증된 것](verified.md)', '- [미검증·실패·남은 일](unverified.md)',
      '- [전체 요구·코드 위치·명령·출력·리뷰·한계](details.md)', '- [기계 판독 원본](snapshot.json)', '',
      '## 포함한 기존 문서', ...copied.map(p => `- [${p}](documents/${p.split('/').map(encodeURIComponent).join('/')})`), '',
      '## 조회 실패·누락', ...(errors.length ? errors.map(e => `- ${e.taskId}: ${e.message}`) : ['조회 오류 없음.']),
      ...(snapshot.rows.length ? [] : ['등록된 요구가 없습니다. 빈 목록을 구현·검증 완료로 판단하지 마세요.']), '',
      '## 범위', '현재 기록을 문서화했으며 검사·리뷰·모델을 재실행하지 않았습니다. 구현 목록과 미검증 목록은 겹칠 수 있습니다.',
      'Git에 등록된 Markdown 문서를 포함합니다(vendor·템플릿 제외). 미추적 문서와 등록되지 않은 기능은 자동 수집하지 않습니다.',
      '코드·DB·대화 전체의 복원 패키지가 아닙니다. 코드는 위 Git 커밋으로 받으며 원본 로그 경로는 원래 프로젝트를 기준으로 합니다.',
      '검사 출력은 조회 원본의 생략 한도를 따릅니다. 생성 후 변경은 반영되지 않으며 사용자 수용은 별도입니다.', ''].join('\n'),
  };
  for (const [name, content] of Object.entries(files)) await writeFile(resolve(output, name), content);
  return { output, rows: snapshot.rows.length, implemented: implemented.length, verified: passed.length, unverified: pending.length, errors };
}
