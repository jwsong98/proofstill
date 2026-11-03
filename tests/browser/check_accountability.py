"""Real browser checks against the actual API, with isolated negative-state projects."""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from proofstill.trace import Flow
from prepare_accountability import prepare


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture-only', action='store_true', help='개발 중 격리 UI만 확인. 최종 검사는 이 옵션을 사용하지 않음')
    parser.add_argument('--output', default='output/playwright/accountability-web')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve(); output.mkdir(parents=True, exist_ok=True)
    wrapper = Path.home() / '.codex/skills/playwright/scripts/playwright_cli.sh'
    if not wrapper.is_file(): raise SystemExit('Playwright CLI wrapper is required; browser checks NOT executed')
    session = 'assurance-' + uuid.uuid4().hex[:8]
    def cli(*args):
        result = subprocess.run([str(wrapper), '--session='+session, *args], cwd=ROOT, text=True, capture_output=True, timeout=90)
        if result.returncode or re.search(r'(?m)^### Error(?:\n|$)', result.stdout):
            (output/'browser-command-failure.log').write_text(result.stdout+result.stderr)
            raise AssertionError((result.stdout+result.stderr)[:8000]+'\n[full output: browser-command-failure.log]')
        return result.stdout
    def run(code):
        text = cli('run-code', 'async page => {'+(ROOT/'tests/browser/assertions.js').read_text()+code+'}')
        match = re.search(r'### Result\n(.*?)\n### Ran', text, re.S)
        assert match, text
        return json.loads(match.group(1))
    results=[]
    with tempfile.TemporaryDirectory(prefix='proofstill-browser-') as temporary:
        directory=Path(temporary)
        projects=prepare(directory)
        config=directory/'projects.json';config.write_text(json.dumps({'projects':projects}))
        server=subprocess.Popen(['node','tests/browser/serve_accountability.mjs',str(config)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            state=json.loads(server.stdout.readline()); base=f'http://127.0.0.1:{state["port"]}'
            cli('open',base,'--headed');cli('snapshot')
            def project(name):
                return next(p for p in state['projects'] if p['name']==name)
            def choose(name,title):
                p=project(name)
                return f'''await page.getByRole('combobox',{{name:'프로젝트',exact:true}}).selectOption({json.dumps(p['id'])});
                await page.getByRole('textbox',{{name:'요구 검색',exact:true}}).fill({json.dumps(title)});
                await page.getByRole('button',{{name:{json.dumps(title)},exact:true}}).click();
                const detail=page.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                await detail.getByRole('heading',{{name:{json.dumps(title)},exact:true}}).waitFor();'''
            with Flow('웹에서 근거와 기준의 상태를 실제로 읽고 재조회') as flow:
                def current_project():
                    result=run(f'''const actualPage=await page.context().newPage();await actualPage.goto('http://127.0.0.1:7777');
                    const projects=await(await actualPage.request.get('http://127.0.0.1:7777/api/projects')).json();
                    const project=projects.find(p=>p.id==='965e6be6-dd96-4910-abe0-c23bba1a28f8'&&p.rootPath==={json.dumps(str(ROOT))});
                    insist(project,'실제 7777 기존 프로젝트가 아님');
                    await actualPage.getByRole('combobox',{{name:'프로젝트',exact:true}}).selectOption(project.id);
                    await actualPage.getByRole('textbox',{{name:'요구 검색',exact:true}}).fill('구현 기록과 현재 검증을 구분해요');
                    await actualPage.getByRole('button',{{name:'구현 기록과 현재 검증을 구분해요',exact:true}}).click();
                    const detail=actualPage.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                    await detail.getByRole('heading',{{name:'구현 기록과 현재 검증을 구분해요',exact:true}}).waitFor();
                    const endpoint='http://127.0.0.1:7777/api/projects/'+project.id;
                    const snapshot=await(await actualPage.request.get(endpoint+'/handoff')).json();
                    const graph=await(await actualPage.request.get(endpoint+'/graph')).json();
                    const actualRows=snapshot.rows.filter(r=>r.taskId==='accountability-web-v1');
                    insist(actualRows.length===6&&actualRows.every(r=>!r.historical),'현재 여섯 실제 요구 누락');
                    const origin=graph.nodes.find(n=>n.evidence?.sourceKind==='file'&&n.evidence.source.path==='requirements.md'&&n.evidence.content.includes('근거 U23')&&n.evidence.content.includes('NO.'));
                    insist(origin,'실제 사용자 NO 원문 인용 연결 누락');
                    for(const row of actualRows){{
                      const node=graph.nodes.find(n=>n.id===row.nodeId);
                      insist(node?.body.includes(row.taskId)&&node.body.includes(row.requirementId),'작업/요구 노드 오연결');
                      insist(row.relatedNodeIds?.includes(origin.id)&&row.relatedNodeIds.includes('ps-feature-handoff'),'기존 기능/원문과 현재 요구 관계 누락');
                    }}
                    const row=actualRows.find(r=>r.requirementId==='Q1-W');
                    insist(row.verification.criteriaChecks.find(c=>c.id==='adversarial').cases.length===6,'실제 여섯 부정 사례 누락');
                    insist(row.verification.criteriaChecks.find(c=>c.id==='adversarial').cases.every(c=>c.status==='passed'),'현재 실행된 여섯 부정 사례 근거 없음');
                    await tableMatches(row,actualPage);await dataMatches(row,detail);
                    await detail.locator('section[aria-label="지금 판단할 내용"]').scrollIntoViewIfNeeded();
                    await actualPage.screenshot({{path:{json.dumps(str(output/'actual-summary.png'))},fullPage:true}});
                    await detail.getByText('실제 관찰 · 통과',{{exact:true}}).first().scrollIntoViewIfNeeded();
                    await actualPage.screenshot({{path:{json.dumps(str(output/'actual-observation.png'))},fullPage:true}});
                    await detail.getByText('실행 근거 보기',{{exact:true}}).first().click();
                    insist(await detail.locator('pre').filter({{hasText:'CRITERIA_COUNTEREXAMPLES_OK'}}).first().isVisible(),'실제 로그가 화면에 없음');
                    await actualPage.screenshot({{path:{json.dumps(str(output/'actual-project.png'))},fullPage:true}});
                    const firstDom=await detail.innerText();
                    for(const target of actualRows){{
                      await actualPage.getByRole('textbox',{{name:'요구 검색',exact:true}}).fill(target.title);
                      await actualPage.getByRole('button',{{name:target.title,exact:true}}).click();
                      const selected=actualPage.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                      await selected.getByRole('heading',{{name:target.title,exact:true}}).waitFor();
                      if(target.requirementId!=='Q1-W')insist(!await selected.getByText('실행 근거 보기',{{exact:true}}).first().evaluate(el=>el.parentElement.open),'이전 요구의 근거 펼침 혼입');
                      await tableMatches(target,actualPage);await dataMatches(target,selected);
                    }}
                    const html=await(await actualPage.request.get(endpoint+'/handoff/export')).text();
                    const subset=await actualPage.evaluate(({{html,ids}})=>{{
                      const doc=new DOMParser().parseFromString(html,'text/html'),table=doc.querySelector('table').cloneNode(true);
                      for(const tr of table.querySelectorAll('tbody tr'))if(!ids.includes(tr.querySelector('a')?.getAttribute('href')?.slice(1)))tr.remove();
                      const articles=ids.map(id=>{{const element=doc.getElementById(id);if(!element)throw Error('실제 HTML 요구 누락');return element.outerHTML;}});
                      return '<!doctype html><html><head>'+doc.head.innerHTML+'</head><body>'+table.outerHTML+articles.join('')+'</body></html>';
                    }},{{html,ids:actualRows.map(r=>r.id)}});
                    const portable=await actualPage.context().newPage();await portable.setContent(subset);
                    for(const item of actualRows){{
                      await tableMatches(item,portable,item.verification.criteriaReview.status,'link');
                      const article=portable.locator('article').filter({{has:portable.getByRole('heading',{{name:item.title,exact:true}})}});
                      await dataMatches(item,article,true);
                    }}await portable.close();await actualPage.close();
                    return {{passed:true,summary:'7777의 기존 proofstill 프로젝트에서 여섯 현재 요구·기존 기능·사용자 NO 원문 링크를 확인했어요. 목록/상세/실제 인계 HTML의 네 상태와 API 원본의 상황·기대·관찰·지적·역할·행동을 전부 대조했어요.',dom:firstDom,html}};''')
                    (output/'actual-project.dom.txt').write_text(result.pop('dom'));(output/'actual-live-handoff.html').write_text(result.pop('html'));results.append(result);return result
                if not args.fixture_only:
                    flow.step('actual-project','현재 저장소 실제 요구의 설명과 실행 근거 연결',current_project)
                def normal_fixture():
                    p=project('격리 fixture · 정상 근거')
                    result=run(choose(p['name'],p['name'])+f'''
                    const source=await(await page.request.get({json.dumps(base+'/api/projects/'+p['id']+'/handoff')})).json();
                    const row=source.rows.find(r=>r.requirementId==='R1');await tableMatches(row,page,'passed');await dataMatches(row,detail);
                    const decision=await detail.locator('section[aria-label="지금 판단할 내용"]').innerText();
                    if(!decision.includes('등록한 범위의 기술 근거가 있어요.'))throw Error(decision);
                    if(!await detail.innerText().then(v=>v.includes('실제 초기값 1을 다시 읽었어요.')))throw Error('실제 관측 누락');
                    await detail.getByText('검토 근거와 이전 지적 펼치기',{{exact:true}}).first().click();
                    const link=await page.getByRole('link',{{name:'근거 포함 인계 파일 받기',exact:true}}).getAttribute('href');
                    const html=await(await page.request.get(new URL(link,page.url()).href)).text();
                    for(const text of ['지금 판단할 내용','검증 기준의 적절성','사람이 지금 확인할 행동','실제 초기값 1을 다시 읽었어요.'])if(!html.includes(text))throw Error('인계 HTML 설명 누락: '+text);
                    const portable=await page.context().newPage();await portable.setContent(html);
                    for(const item of source.rows){{
                      await tableMatches(item,portable,'passed','link');
                      const article=portable.locator('article').filter({{has:portable.getByRole('heading',{{name:item.title,exact:true}})}});
                      await dataMatches(item,article,true);
                    }}await portable.close();
                    for(const item of source.rows){{
                      await page.getByRole('textbox',{{name:'요구 검색',exact:true}}).fill(item.title);
                      await page.getByRole('button',{{name:item.title,exact:true}}).click();
                      await detail.getByRole('heading',{{name:item.title,exact:true}}).waitFor();
                      await dataMatches(item,detail);
                      const observation=await detail.locator('.check-example').allInnerTexts();
                      if(item.requirementId==='R2'&&observation.some(v=>v.includes('실제 초기값 1을 다시 읽었어요.')))throw Error('첫 요구 관찰이 두 번째 요구에 혼입');
                    }}
                    await page.getByRole('textbox',{{name:'요구 검색',exact:true}}).fill(row.title);await page.getByRole('button',{{name:row.title,exact:true}}).click();
                    await detail.getByRole('heading',{{name:row.title,exact:true}}).waitFor();
                    await page.screenshot({{path:{json.dumps(str(output/'normal-fixture.png'))},fullPage:true}});
                    return {{passed:true,summary:'격리 화면 fixture에서 정상 관찰·사람 확인 행동을 읽고 같은 API 원본의 인계 HTML에도 포함됨을 확인했어요. 합성 리뷰는 실제 적절성 검토로 쓰지 않아요.',dom:await detail.innerText(),html}};''')
                    (output/'portable.html').write_text(result.pop('html'));(output/'normal-fixture.dom.txt').write_text(result.pop('dom'));results.append(result);return result
                flow.step('normal-display','정상 상태와 근거 포함 인계 HTML의 일치',normal_fixture)
                def negative_states():
                    observed=[]
                    for name,expect in [('검사 실패','자동 검사 · 실패'),('미실행','자동 검사 · 미실행'),('기준 지적','합성 기준 지적'),('기준 미검토','독립 기준 검토 · 미실행'),('사람 결정 대기','보존 기간 정책은 사람이 결정해 주세요.')]:
                        p=project('격리 fixture · '+name)
                        value=run(choose(p['name'],p['name'])+f'''
                        const source=await(await page.request.get({json.dumps(base+'/api/projects/'+p['id']+'/handoff')})).json();
                        const row=source.rows.find(r=>r.requirementId==='R1');
                        const expectedCriterion={{'검사 실패':'failed','미실행':'not_run','기준 지적':'failed','기준 미검토':'not_run','사람 결정 대기':'stale'}}[{json.dumps(name)}];
                        await tableMatches(row,page,expectedCriterion);await dataMatches(row,detail);
                        const href=await page.getByRole('link',{{name:'근거 포함 인계 파일 받기',exact:true}}).getAttribute('href');
                        const html=await(await page.request.get(new URL(href,page.url()).href)).text();
                        const portable=await page.context().newPage();await portable.setContent(html);
                        await tableMatches(row,portable,expectedCriterion,'link');
                        const article=portable.locator('article').filter({{has:portable.getByRole('heading',{{name:row.title,exact:true}})}});
                        await dataMatches(row,article,true);await portable.close();
                        const body=await detail.innerText();if(!body.includes({json.dumps(expect)}))throw Error(body);
                        const text=await detail.locator('section[aria-label="지금 판단할 내용"]').innerText();
                        if(text.includes('등록한 범위의 기술 근거가 있어요.'))throw Error('미완료를 승인으로 표시');
                        await page.screenshot({{path:{json.dumps(str(output/('negative-'+name+'.png')))},fullPage:true}});
                        return {{name:{json.dumps(name)},dom:body}};''')
                        (output/('negative-'+name+'.dom.txt')).write_text(value.pop('dom'));observed.append(value['name'])
                    p=project('격리 fixture · 정상 근거')
                    mutation=run(choose(p['name'],p['name'])+f'''
                    const endpoint={json.dumps(base+'/api/projects/'+p['id']+'/handoff')};
                    const original=await(await page.request.get(endpoint)).json(),baseline=original.rows.find(r=>r.requirementId==='R1');
                    await dataMatches(baseline,detail);
                    const rejected=[];
                    const changes=[
                      ['상황',row=>row.verification.criteriaChecks[0].cases[0].situation='다른 요구에서 가져온 잘못된 상황'],
                      ['기대',row=>row.verification.criteriaChecks[0].cases[0].expected='다른 요구에서 가져온 잘못된 기대값'],
                      ['관찰',row=>row.verification.criteriaChecks[0].cases[0].observed='다른 요구에서 가져온 잘못된 관찰'],
                      ['사람 기대',row=>row.humanChecks[0].expected='다른 요구의 사람 기대 결과'],
                      ['위임 범위',row=>row.responsibility.ai='다른 작업의 위임 범위'],
                      ['미정 결정',row=>row.pendingDecisions=[{{id:'wrong',question:'다른 요구의 결정'}}]],
                      ['구현 상태',row=>row.implementation.status='not_started'],
                      ['검사 상태',row=>row.verification.status='not_run'],
                      ['구현 리뷰 상태',row=>row.verification.review.status='not_run'],
                      ['기준 상태',row=>row.verification.criteriaReview.status='not_run'],
                    ];
                    for(const [name,change] of changes){{
                      const wrong=structuredClone(original);change(wrong.rows.find(r=>r.requirementId==='R1'));
                      await page.route(endpoint,route=>route.fulfill({{status:200,contentType:'application/json',body:JSON.stringify(wrong)}}));
                      const response=page.waitForResponse(r=>r.url()===endpoint);await page.getByRole('button',{{name:'새로고침',exact:true}}).click();await response;
                      await page.getByRole('button',{{name:'새로고침',exact:true}}).waitFor();
                      const rendered=wrong.rows.find(r=>r.requirementId==='R1');
                      await tableMatches(rendered,page,name==='기준 상태'?'not_run':'passed');await dataMatches(rendered,detail);
                      let caught=false;try{{await tableMatches(baseline,page,'passed');await dataMatches(baseline,detail);}}catch(error){{caught=true;}}
                      insist(caught,'잘못 연결한 UI를 대조 기준이 놓침: '+name);rejected.push(name);await page.unroute(endpoint);
                    }}
                    const response=page.waitForResponse(r=>r.url()===endpoint);await page.getByRole('button',{{name:'새로고침',exact:true}}).click();await response;
                    await page.getByRole('button',{{name:'새로고침',exact:true}}).waitFor();await tableMatches(baseline,page,'passed');await dataMatches(baseline,detail);
                    return {{rejected}};''')
                    result={'passed':True,'summary':'실제 서버의 '+', '.join(observed)+' 상태를 구분했고 승인 안내를 보류했어요. 브라우저에 상황·기대·관찰·행동·위임·결정과 네 상태를 잘못 연결한 응답을 넣자 원본 대조 기준이 '+str(len(mutation['rejected']))+'개 모두 거부했어요. 이는 대조 검사의 결함 검출 시험이며 실제 서버가 해당 오류를 냈다는 뜻이 아니에요.'};results.append(result);return result
                flow.step('negative-states','실패·누락·미실행 기준의 실제 UI 구분',negative_states)
                def changed_evidence():
                    p=project('격리 fixture · 정상 근거')
                    run(choose(p['name'],p['name'])+'return {ready:true};')
                    root=Path(p['rootPath']);saved=json.loads((root/'.proofstill/evidence/counter/state.json').read_text())
                    target=next(run for run in reversed(saved['runs']) if run['check']=='counter-unit');log=Path(target['log']);original=log.read_bytes();log.write_text('변경된 실행 근거')
                    try:
                        result=run(f'''await page.getByRole('button',{{name:'새로고침',exact:true}}).click();
                        const detail=page.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                        await detail.getByRole('heading',{{name:'자동 검사 · 재검증 필요',exact:true}}).waitFor();
                        const text=await detail.innerText();if(text.includes('실제 초기값 1을 다시 읽었어요.'))throw Error('변경된 근거의 관찰을 현재 결과로 표시');
                        if(!text.includes('현재 버전에서 확인한 실행 관찰이 없어요.'))throw Error('근거 변경 안내 없음');
                        await page.screenshot({{path:{json.dumps(str(output/'changed-evidence.png'))},fullPage:true}});
                        return {{passed:true,summary:'실행 로그를 실제로 변경한 뒤 새로고침하자 재검증 필요로 바뀌고 이전 관찰을 현재 결과에서 제외했어요.',dom:text}};''')
                        (output/'changed-evidence.dom.txt').write_text(result.pop('dom'))
                    finally:log.write_bytes(original)
                    expected=root/'expect.json';original_expected=expected.read_bytes()
                    changed=json.loads(original_expected);changed['assertions'][0]['equals']=2;expected.write_text(json.dumps(changed))
                    try:
                        criterion=run(f'''await page.getByRole('button',{{name:'새로고침',exact:true}}).click();
                        const detail=page.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                        await detail.getByRole('heading',{{name:'검증 기준의 적절성 · 재검증 필요',exact:true}}).waitFor();
                        await detail.getByRole('heading',{{name:'독립 기준 검토 · 재검증 필요',exact:true}}).waitFor();
                        await page.screenshot({{path:{json.dumps(str(output/'changed-criteria.png'))},fullPage:true}});
                        return {{dom:await detail.innerText()}};''')
                        (output/'changed-criteria.dom.txt').write_text(criterion['dom'])
                    finally:expected.write_bytes(original_expected)
                    result['summary']+=' 기준의 기대값을 1에서 2로 바꾼 뒤에는 기준 적절성과 독립 기준 검토도 재검증 필요로 바뀌었어요.'
                    results.append(result);return result
                flow.step('changed-evidence','근거 변경 후 재조회에서 과거 관찰 무효화',changed_evidence)
                def query_failure():
                    result=run(f'''await page.getByRole('button',{{name:'새로고침',exact:true}}).click();
                    const decision=page.locator('section[aria-label="지금 판단할 내용"]');
                    await decision.getByText('등록한 범위의 기술 근거가 있어요.',{{exact:false}}).waitFor();
                    await page.route('**/handoff',route=>route.fulfill({{status:503,contentType:'application/json',body:'{{"error":"격리 조회 실패"}}'}}));
                    await page.getByRole('button',{{name:'새로고침',exact:true}}).click();
                    await page.getByText('최신 상태를 읽지 못했어요.',{{exact:false}}).waitFor();
                    await page.screenshot({{path:{json.dumps(str(output/'query-failure.png'))},fullPage:true}});
                    const body=await page.locator('body').innerText();
                    if((await decision.innerText()).includes('등록한 범위의 기술 근거가 있어요.'))throw Error('조회 실패에도 현재 승인 안내 유지');
                    await page.unroute('**/handoff');
                    return {{passed:true,summary:'브라우저에서 조회 실패 응답을 주입하자 이전 자료임을 표시하고 현재 승인 안내를 보류했어요. 실제 서버 장애를 재현한 검사는 아니에요.',dom:body}};''')
                    (output/'query-failure.dom.txt').write_text(result.pop('dom'));results.append(result);return result
                flow.step('query-failure','조회 실패와 이전 자료 구분',query_failure)
            (output/'verification.json').write_text(json.dumps({'passed':True,'fixtureOnly':args.fixture_only,'results':results,'limitations':['상태 부정 흐름은 격리 fixture이며 가짜 리뷰는 실제 적절성 근거가 아님','사용자 만족/수용은 미확인','조회 실패와 잘못 연결한 UI 응답은 브라우저 주입이며 실제 서버 오류가 발생했다는 판정이 아님']},ensure_ascii=False,indent=2))
            print(f'ACCOUNTABILITY_BROWSER_OK: 실제 DOM·서버 원본·HTML·{len(results)}개 화면 흐름 확인')
        finally:
            try:cli('close')
            finally:
                server.terminate()
                try:server.wait(timeout=10)
                except subprocess.TimeoutExpired:server.kill();server.wait()


if __name__=='__main__':main()
