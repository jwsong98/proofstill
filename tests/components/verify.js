async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5193/stress.html');
  await page.getByRole('textbox', {name:'이름',exact:true}).fill('한글 입력 user@example.com');
  assert((await page.getByRole('status', {name:'입력 결과'}).textContent()).includes('한글 입력'), 'controlled value');
  await page.getByRole('button', {name:'지우기',exact:true}).click();
  assert(await page.getByRole('textbox', {name:'이름',exact:true}).inputValue() === '', 'clear');
  await page.getByRole('textbox', {name:'상세 내용',exact:true}).fill('긴 한글 내용 '.repeat(300));
  assert((await page.getByRole('textbox', {name:'상세 내용',exact:true}).inputValue()).length === 2000, 'maxlength');
  await page.getByRole('textbox', {name:'비밀번호',exact:true}).fill('StrongPassword123!');
  await page.getByRole('button', {name:'비밀번호 보기',exact:true}).click();
  assert(await page.getByRole('textbox', {name:'비밀번호',exact:true}).getAttribute('type') === 'text', 'password toggle');
  await page.getByRole('spinbutton', {name:'수량'}).fill('101');
  await page.getByRole('spinbutton', {name:'수량'}).blur();
  assert(await page.getByRole('spinbutton', {name:'수량'}).inputValue() === '100', 'numeric clamp');
  assert(await page.locator('button[aria-busy=true]').isDisabled(), 'loading disabled');
  assert(await page.getByRole('button', {name:'사용 불가',exact:true}).isDisabled(), 'disabled');
  await page.getByRole('button', {name:'공유 버튼 0'}).click();
  assert(await page.getByRole('button', {name:'공유 버튼 1'}).count() === 1, 'shared button');
  await page.getByRole('button', {name:'콘텐츠 채우기'}).click();
  const combo = page.getByRole('combobox', {name:'검색 선택',exact:true});
  await combo.fill('선택 12');
  await combo.press('ArrowDown');
  await combo.press('Enter');
  assert((await combo.inputValue()).startsWith('선택 12 '), 'combobox');
  await page.getByRole('checkbox', {name:'전체 선택',exact:true}).check();
  assert(await page.locator('tbody input:checked').count() === 100, '100 row selection');
  await page.getByRole('button', {name:'이름',exact:true}).click();
  assert(await page.locator('th[aria-sort]').getAttribute('aria-sort') === 'ascending', 'table sorting');
  await page.getByRole('button', {name:'긴 본문 펼치기',exact:true}).click();
  assert(await page.getByRole('button', {name:'긴 본문 펼치기',exact:true}).getAttribute('aria-expanded') === 'true', 'accordion');
  await page.getByRole('textbox',{name:'인증번호 1번째 자리',exact:true}).focus();
  await page.keyboard.type('123456');
  assert(await page.getByRole('group',{name:'인증번호',exact:true}).locator('input').evaluateAll(inputs => inputs.map(i=>i.value).join('')) === '123456', 'PIN typing');
  await page.getByRole('button',{name:'날짜',exact:true}).click();
  await page.getByRole('gridcell',{name:'3',exact:true}).click();
  await page.getByRole('button',{name:'시간',exact:true}).click();
  await page.getByRole('option',{name:'오전 1:30',exact:true}).click();
  assert((await page.getByRole('button',{name:'시간',exact:true}).textContent()).includes('오전 1:30'), 'time selection');
  const measurements = [];
  for (const [width,height] of [[1280,800],[768,1024],[375,812]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(() => window.scrollTo(0,0));
    const dimensions = await page.evaluate(() => ({viewport:innerWidth,document:document.documentElement.scrollWidth}));
    assert(dimensions.document <= width, `page overflow at ${width}`);
    measurements.push(dimensions);
    const buttonBounds=await page.getByRole('button',{name:'긴 버튼 문구',exact:true}).evaluate(e=>({width:e.clientWidth,content:e.scrollWidth}));
    assert(buttonBounds.content <= buttonBounds.width, 'long button content bounds');
    await page.screenshot({path:`output/playwright/components-filled-${width}.png`});
    for (const [button,selector,bodySelector] of [['긴 모달 열기','.jw-modal','.jw-modal__body'],['긴 서랍 열기','.jw-drawer','.jw-drawer__body']]) {
      await page.getByRole('button',{name:button,exact:true}).click();
      await page.locator(selector).waitFor();
      await page.locator(selector).evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
      const metrics = await page.locator(selector).evaluate((dialog, bodySelector) => {
        const body=dialog.querySelector(bodySelector), rect=dialog.getBoundingClientRect();
        body.scrollTop=body.scrollHeight;
        const footer=dialog.querySelector('[class$="__foot"]').getBoundingClientRect();
        return {right:rect.right,bottom:rect.bottom,scroll:body.scrollTop,bodyWidth:body.clientWidth,contentWidth:body.scrollWidth,footerBottom:footer.bottom};
      },bodySelector);
      assert(metrics.right <= width && metrics.bottom <= height + 1, `dialog overflow ${width}`);
      assert(metrics.scroll > 0 && metrics.contentWidth <= metrics.bodyWidth, 'body scroll and wrapping');
      assert(metrics.footerBottom <= height, 'visible footer');
      await page.screenshot({path:`output/playwright/components-${selector.slice(4)}-${width}.png`});
      await page.keyboard.press('Escape');
      assert(await page.getByRole('dialog').count() === 0, 'Escape close');
    }
  }
  assert(errors.length === 0, JSON.stringify(errors));
  return {result:'COMPONENT_UI_VERIFIED',measurements,rows:100,textareaLength:2000,errors};
}
