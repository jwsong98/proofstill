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
