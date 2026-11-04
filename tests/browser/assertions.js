const labels = {not_run:'미실행',partial:'일부 확인',passed:'통과',failed:'실패',stale:'재검증 필요',unverified:'확인 불가',interrupted:'중단'};
const implementationLabels = {unknown:'미기록',not_started:'미착수',in_progress:'진행 중',partial:'일부 구현',implemented:'구현 완료'};
const reviewLabels = status => status==='passed'?['확인','통과']:status==='failed'?['결함 발견','실패']:status==='unverified'?['추가 확인','확인 불가']:[labels[status]];
function insist(ok, reason) { if(!ok) throw Error(reason); }
async function detailMatches(row, detail, criterionStatus=row.verification.criteriaReview?.status??'not_run') {
  const labelsInPanel = await detail.locator('.handoff-statuses dt').allInnerTexts();
  insist(labelsInPanel.join('|') === '구현|검사 상태|요구별 리뷰|기준 적절성', '판정 근거에 네 상태가 분리되어 있지 않음');
  const values = await detail.locator('.handoff-statuses dd').allInnerTexts();
  insist(values[0] === implementationLabels[row.implementation.status], '구현 선언 오표시');
  insist(values[1] === labels[row.verification.status], '자동 검사 상태 오표시');
  insist(reviewLabels(row.verification.review.status).includes(values[2]), '독립 구현 리뷰 상태 오표시');
  insist(values[3] === labels[criterionStatus], '기준 적절성 상태 오표시');
}
async function selectRequirement(page, title) {
  await page.getByRole('textbox', {name:'요구 검색', exact:true}).fill(title);
  await page.getByRole('button', {name:title, exact:true}).click();
  const detail = page.getByRole('complementary', {name:'요구별 구현·검증 상세', exact:true});
  await detail.getByRole('heading', {name:title, exact:true}).waitFor();
  return detail;
}

async function downloadHandoff(page, path) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', {name:'근거 포함 인계 파일 받기', exact:true}).click(),
  ]);
  insist(download.suggestedFilename().endsWith('.html'), '인계 다운로드 파일 형식 오류');
  await download.saveAs(path);
}

async function explanationMatches(row, detail) {
  const context = await detail.getByRole('region', {name:'판단 기준과 미확인 범위'}).innerText();
  for (const text of [row.risk, row.rationale, row.limitations[0]].filter(Boolean)) {
    insist(context.includes(text), row.requirementId+' 판단 기준 또는 한계 누락');
  }
  const human = detail.getByRole('region', {name:'사람이 지금 확인할 행동'});
  const actionText = await human.innerText();
  for (const item of row.humanChecks ?? []) {
    insist(actionText.includes(item.action) && actionText.includes(item.expected), row.requirementId+' 사람 행동 또는 기대 결과 오연결');
  }
  await human.getByText('사람과 AI가 맡은 범위', {exact:true}).click();
  const roles = await human.innerText();
  for (const text of [row.responsibility?.human, row.responsibility?.ai].filter(Boolean)) {
    insist(roles.includes(text), row.requirementId+' 담당 범위 누락');
  }
  const criteria = detail.getByRole('region', {name:'검증 기준의 적절성'});
  const cases = await criteria.locator('.check-example').allInnerTexts();
  const expected = (row.verification.criteriaChecks ?? []).flatMap(check => check.cases ?? []);
  insist(cases.length === expected.length, row.requirementId+' 대표 상황 일부 누락 또는 혼입');
  for (const [index, item] of expected.entries()) {
    for (const text of [item.situation, item.expected, item.observed].filter(Boolean)) {
      insist(cases[index].includes(text), row.requirementId+' 대표 상황·기대 결과·관찰 오연결');
    }
  }
}

function sourceMatches(row, original) {
  for (const field of ['risk', 'rationale']) {
    insist(row[field] === original[field], row.requirementId+' 고정 원문 '+field+' 불일치');
  }
  for (const field of ['human', 'ai']) {
    insist(row.responsibility[field] === original.responsibility[field], row.requirementId+' 원문 담당 범위 불일치');
  }
  insist(row.humanChecks.length === original.humanChecks.length, row.requirementId+' 원문 사람 행동 개수 불일치');
  for (const [index, expected] of original.humanChecks.entries()) {
    for (const field of ['requirement', 'action', 'expected']) {
      insist(row.humanChecks[index][field] === expected[field], row.requirementId+' 원문 사람 행동 오연결');
    }
  }
  const checks = row.verification.criteriaChecks;
  insist(checks.length === original.verification.criteriaChecks.length, row.requirementId+' 원문 기준 검사 개수 불일치');
  for (const [index, expected] of original.verification.criteriaChecks.entries()) {
    const actual = checks[index];
    insist(actual.id === expected.id && actual.cases.length === expected.cases.length, row.requirementId+' 원문 기준 검사 오연결');
    for (const [index, example] of expected.cases.entries()) {
      for (const [field, value] of Object.entries(example)) {
        insist(actual.cases[index][field] === value, row.requirementId+' 원문/Trace 대표 상황 오연결: '+field);
      }
    }
  }
}
