const labels = {not_run:'미실행',partial:'일부 확인',passed:'통과',failed:'실패',stale:'재검증 필요',unverified:'확인 불가',interrupted:'중단'};
const implementationLabels = {unknown:'미기록',not_started:'미착수',in_progress:'진행 중',partial:'일부 구현',implemented:'구현 완료'};
const reviewLabels = status => status==='passed'?['확인','통과']:status==='failed'?['결함 발견','실패']:status==='unverified'?['추가 확인','확인 불가']:[labels[status]];
function insist(ok, reason) { if(!ok) throw Error(reason); }
async function tableMatches(row, root=page, criterionStatus=row.verification.criteriaReview?.status??'not_run') {
  const table=root.getByRole('table').first(), headers=await table.locator('thead th').allInnerTexts();
  insist(headers.length>=6&&headers[1].includes('구현')&&headers[2].includes('검사')&&headers[3].includes('리뷰')&&headers[4].includes('기준'),'구현·자동 검사·독립 리뷰·기준 상태가 별도 열이 아님');
  const target=table.locator('tbody tr').filter({has:root.getByRole('button',{name:row.title,exact:true})});
  insist(await target.count()===1,'요구 목록 연결 누락/중복: '+row.title);
  const cells=await target.locator('td').allInnerTexts();
  insist(cells[1].split('\n')[0].trim()===implementationLabels[row.implementation.status],'구현 선언 오표시');
  insist(cells[2].split('\n')[0].trim()===labels[row.verification.status],'자동 검사 상태 오표시');
  insist(reviewLabels(row.verification.review.status).includes(cells[3].trim()),'독립 구현 리뷰 상태 오표시');
  insist(cells[4].trim()===labels[criterionStatus],'기준 적절성 상태 오표시: '+criterionStatus);
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
