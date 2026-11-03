const labels = {not_run:'미실행',partial:'일부 확인',passed:'통과',failed:'실패',stale:'재검증 필요',unverified:'확인 불가',interrupted:'중단'};
const implementationLabels = {unknown:'미기록',not_started:'미착수',in_progress:'진행 중',partial:'일부 구현',implemented:'구현 완료'};
const reviewLabels = status => status==='passed'?['확인','통과']:status==='failed'?['결함 발견','실패']:status==='unverified'?['추가 확인','확인 불가']:[labels[status]];
function insist(ok, reason) { if(!ok) throw Error(reason); }
async function tableMatches(row, root=page, criterionStatus=row.verification.criteriaReview?.status??'not_run', control='button') {
  const table=root.getByRole('table').first(), headers=await table.locator('thead th').allInnerTexts();
  insist(headers.length>=6&&headers[1].includes('구현')&&headers[2].includes('검사')&&headers[3].includes('리뷰')&&headers[4].includes('기준'),'구현·자동 검사·독립 리뷰·기준 상태가 별도 열이 아님');
  const target=table.locator('tbody tr').filter({has:root.getByRole(control,{name:row.title,exact:true})});
  insist(await target.count()===1,'요구 목록 연결 누락/중복: '+row.title);
  const cells=await target.locator('td').allInnerTexts();
  insist(cells[1].split('\n')[0].trim()===implementationLabels[row.implementation.status],'구현 선언 오표시');
  insist(cells[2].split('\n')[0].trim()===labels[row.verification.status],'자동 검사 상태 오표시');
  insist(reviewLabels(row.verification.review.status).includes(cells[3].trim()),'독립 구현 리뷰 상태 오표시');
  insist(cells[4].trim()===labels[criterionStatus],'기준 적절성 상태 오표시: '+criterionStatus);
}
async function reviewMatches(review, group) {
  const heading=await group.getByRole('heading').first().innerText();
  insist(reviewLabels(review?.status??'not_run').some(label=>heading.endsWith(label)),'독립 리뷰 상태 연결 오류');
  let text=await group.innerText();
  if(review?.evidence)insist(text.includes(review.evidence),'독립 리뷰 실제 근거 누락/변경');
  for(const field of ['findings','limitations'])for(const value of review?.[field]??[])insist(text.includes(value),'현재 리뷰 '+field+' 누락/변경');
  if(review?.gateStatus&&review.gateStatus!==review.status)insist(text.includes('작업 전체 게이트')&&text.includes(labels[review.gateStatus]),'요구 판정과 작업 전체 게이트 혼합');
  const toggle=group.getByText('검토 근거와 이전 지적 펼치기',{exact:true});
  if(!await toggle.evaluate(el=>el.parentElement.open))await toggle.click();
  text=await group.innerText();
  if(review?.session)insist(text.includes(review.session),'현재 독립 세션 출처 누락');
  for(const prior of review?.history??[]){
    insist(text.includes(prior.label)&&text.includes(prior.verdict),'이전 판정 구분 누락');
    for(const finding of prior.findings)insist(text.includes(finding),'이전 지적이 재검토 후 사라짐');
    for(const check of prior.checks)insist(text.includes(check.evidence),'이전 요구별 검토 근거 누락');
  }
}
async function dataMatches(row, detail, html=false) {
  let text=await detail.innerText();
  insist(text.includes(row.risk)&&text.includes(row.rationale),'위험/필요성 API↔DOM 연결 오류');
  if(row.limitations?.length)insist(text.includes(row.limitations[0]),'기본 미확인 범위 누락');
  const human=detail.locator('section[aria-label="사람이 지금 확인할 행동"]');
  const humanText=await human.innerText();
  for(const value of row.humanChecks??[])insist(humanText.includes(value.action)&&humanText.includes(value.expected),'사람 행동 또는 기대 결과 오연결');
  const responsibility=human.getByText('사람과 AI가 맡은 범위',{exact:true});
  if(!await responsibility.evaluate(el=>el.parentElement.open))await responsibility.click();
  const assigned=await human.innerText();
  insist(assigned.includes(row.responsibility.human)&&assigned.includes(row.responsibility.ai),'사람/AI 위임 범위 누락/오연결');
  for(const pending of row.pendingDecisions??[])insist(text.includes(pending.question),'미정 인간 결정이 사라짐');
  if(!row.pendingDecisions?.length)insist(!text.includes('사람 결정 대기:'),'다른 요구의 미정 결정 혼입');
  const criterion=detail.locator('section[aria-label="검증 기준의 적절성"]');
  const caseRoot=html?detail:criterion;
  for(const check of row.verification.criteriaChecks??[]){
    const card=caseRoot.locator('[data-check-id='+JSON.stringify(check.id)+']');
    insist(await card.count()===1,'부정 검사 카드 누락/중복: '+check.id);
    const cardText=await card.innerText();
    for(const field of ['label','purpose','rationale','expected','scope'])if(check[field])insist(cardText.includes(check[field]),'기준 설명 '+field+' API↔DOM 불일치');
    const examples=card.locator('.check-example');insist(await examples.count()===(check.cases??[]).length,'대표 사례 일부 누락/혼입');
    for(let index=0;index<(check.cases??[]).length;index++){
      const example=check.cases[index],content=await examples.nth(index).innerText();
      for(const field of ['situation','expected','observed'])insist(content.includes(example[field]),'대표 사례 '+field+' API↔DOM 불일치: '+example.operation);
      insist(content.includes('실제 관찰 · '+labels[example.status]),'사례 실행 상태 오표시');
    }
  }
  await reviewMatches(row.verification.criteriaReview,criterion.getByRole('group',{name:'독립 기준 검토',exact:true}));
  await reviewMatches(row.verification.review,detail.getByRole('group',{name:'독립 구현 검토',exact:true}));
}
