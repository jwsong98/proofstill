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
        if result.returncode or '### Error' in result.stdout:
            raise AssertionError(result.stdout + result.stderr)
        return result.stdout
    def run(code):
        text = cli('run-code', 'async page => {'+code+'}')
        match = re.search(r'### Result\n(.*?)\n### Ran', text, re.S)
        assert match, text
        return json.loads(match.group(1))
    results=[]
    with tempfile.TemporaryDirectory(prefix='proofstill-browser-') as temporary:
        directory=Path(temporary)
        projects=prepare(directory)
        projects.insert(0,{'name':'현재 저장소 실제 근거','rootPath':str(ROOT)})
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
                    p=project('현재 저장소 실제 근거')
                    result=run(f'''await page.getByRole('combobox',{{name:'프로젝트',exact:true}}).selectOption({json.dumps(p['id'])});
                    await page.getByRole('textbox',{{name:'요구 검색',exact:true}}).fill('구현 기록과 현재 검증을 구분해요');
                    await page.getByRole('button',{{name:'구현 기록과 현재 검증을 구분해요',exact:true}}).click();
                    const detail=page.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                    await detail.getByRole('heading',{{name:'구현 기록과 현재 검증을 구분해요',exact:true}}).waitFor();
                    const body=await detail.innerText();
                    for(const text of ['지금 판단할 내용','잘못 판단할 위험','이 기준이 필요한 이유','검증 기준의 적절성','대표 상황','실제 관찰','사람이 지금 확인할 행동']){{if(!body.includes(text))throw Error('현재 실제 요구 설명 누락: '+text);}}
                    const snapshot=await (await page.request.get({json.dumps(base+'/api/projects/'+p['id']+'/handoff')})).json();
                    const row=snapshot.rows.find(r=>r.taskId==='accountability-web-v1'&&r.requirementId==='Q1-W');
                    if(!row||!row.humanChecks?.length||!row.risk||!row.verification.criteriaChecks?.length)throw Error('실제 원본 연결 누락');
                    if(!row.verification.criteriaChecks.some(c=>c.cases?.some(s=>s.status==='passed'&&s.observed.includes('거부'))))throw Error('실행된 부정 사례 관찰 없음');
                    await detail.locator('section[aria-label="지금 판단할 내용"]').scrollIntoViewIfNeeded();
                    await page.screenshot({{path:{json.dumps(str(output/'actual-summary.png'))},fullPage:true}});
                    await detail.getByText('실제 관찰 · 통과',{{exact:true}}).first().scrollIntoViewIfNeeded();
                    await page.screenshot({{path:{json.dumps(str(output/'actual-observation.png'))},fullPage:true}});
                    await detail.getByText('실행 근거 보기',{{exact:true}}).first().click();
                    if(!await detail.locator('pre').filter({{hasText:'CRITERIA_COUNTEREXAMPLES_OK'}}).first().isVisible())throw Error('실제 로그가 화면에 없음');
                    await page.screenshot({{path:{json.dumps(str(output/'actual-project.png'))},fullPage:true}});
                    return {{passed:true,summary:'실제 저장소 Q1-W를 선택해 위험·필요성·실행된 부정 관찰·원본 로그·사람 확인 행동을 화면과 API 원본에서 함께 확인했어요.',dom:await detail.innerText()}};''')
                    (output/'actual-project.dom.txt').write_text(result.pop('dom'));results.append(result);return result
                if not args.fixture_only:
                    flow.step('actual-project','현재 저장소 실제 요구의 설명과 실행 근거 연결',current_project)
                def normal_fixture():
                    p=project('격리 fixture · 정상 근거')
                    result=run(choose(p['name'],p['name'])+f'''
                    const decision=await detail.locator('section[aria-label="지금 판단할 내용"]').innerText();
                    if(!decision.includes('등록한 범위의 기술 근거가 있어요.'))throw Error(decision);
                    if(!await detail.innerText().then(v=>v.includes('실제 초기값 1을 다시 읽었어요.')))throw Error('실제 관측 누락');
                    await detail.getByText('검토 근거와 이전 지적 펼치기',{{exact:true}}).first().click();
                    const link=await page.getByRole('link',{{name:'근거 포함 인계 파일 받기',exact:true}}).getAttribute('href');
                    const html=await(await page.request.get(new URL(link,page.url()).href)).text();
                    for(const text of ['지금 판단할 내용','검증 기준의 적절성','사람이 지금 확인할 행동','실제 초기값 1을 다시 읽었어요.'])if(!html.includes(text))throw Error('인계 HTML 설명 누락: '+text);
                    await page.screenshot({{path:{json.dumps(str(output/'normal-fixture.png'))},fullPage:true}});
                    return {{passed:true,summary:'격리 화면 fixture에서 정상 관찰·사람 확인 행동을 읽고 같은 API 원본의 인계 HTML에도 포함됨을 확인했어요. 합성 리뷰는 실제 적절성 검토로 쓰지 않아요.',dom:await detail.innerText(),html}};''')
                    (output/'portable.html').write_text(result.pop('html'));(output/'normal-fixture.dom.txt').write_text(result.pop('dom'));results.append(result);return result
                flow.step('normal-display','정상 상태와 근거 포함 인계 HTML의 일치',normal_fixture)
                def negative_states():
                    observed=[]
                    for name,expect in [('검사 실패','자동 검사 · 실패'),('미실행','자동 검사 · 미실행'),('기준 지적','합성 기준 지적'),('기준 미검토','독립 기준 검토 · 미실행')]:
                        p=project('격리 fixture · '+name)
                        value=run(choose(p['name'],p['name'])+f'''
                        const body=await detail.innerText();if(!body.includes({json.dumps(expect)}))throw Error(body);
                        const text=await detail.locator('section[aria-label="지금 판단할 내용"]').innerText();
                        if(text.includes('등록한 범위의 기술 근거가 있어요.'))throw Error('미완료를 승인으로 표시');
                        await page.screenshot({{path:{json.dumps(str(output/('negative-'+name+'.png')))},fullPage:true}});
                        return {{name:{json.dumps(name)},dom:body}};''')
                        (output/('negative-'+name+'.dom.txt')).write_text(value.pop('dom'));observed.append(value['name'])
                    result={'passed':True,'summary':'실제 서버가 반환한 '+', '.join(observed)+' 상태를 각각 선택했고 승인 안내가 나오지 않았어요.'};results.append(result);return result
                flow.step('negative-states','실패·누락·미실행 기준의 실제 UI 구분',negative_states)
                def changed_evidence():
                    p=project('격리 fixture · 정상 근거')
                    run(choose(p['name'],p['name'])+'return {ready:true};')
                    root=Path(p['rootPath']);saved=json.loads((root/'.proofstill/evidence/counter/state.json').read_text())
                    log=Path(saved['runs'][-1]['log']);original=log.read_bytes();log.write_text('변경된 실행 근거')
                    try:
                        result=run(f'''await page.getByRole('button',{{name:'새로고침',exact:true}}).click();
                        const detail=page.getByRole('complementary',{{name:'요구별 구현·검증 상세',exact:true}});
                        await detail.getByRole('heading',{{name:'자동 검사 · 재검증 필요',exact:true}}).waitFor();
                        const text=await detail.innerText();if(text.includes('실제 초기값 1을 다시 읽었어요.'))throw Error('변경된 근거의 관찰을 현재 결과로 표시');
                        if(!text.includes('현재 버전에서 확인한 실행 관찰이 없어요.'))throw Error('근거 변경 안내 없음');
                        await page.screenshot({{path:{json.dumps(str(output/'changed-evidence.png'))},fullPage:true}});
                        return {{passed:true,summary:'실행 로그를 실제로 변경한 뒤 새로고침하자 재검증 필요로 바뀌고 이전 관찰을 현재 결과에서 제외했어요.',dom:text}};''')
                        (output/'changed-evidence.dom.txt').write_text(result.pop('dom'));results.append(result);return result
                    finally:log.write_bytes(original)
                flow.step('changed-evidence','근거 변경 후 재조회에서 과거 관찰 무효화',changed_evidence)
                def query_failure():
                    result=run(f'''await page.route('**/handoff',route=>route.fulfill({{status:503,contentType:'application/json',body:'{{"error":"격리 조회 실패"}}'}}));
                    await page.getByRole('button',{{name:'새로고침',exact:true}}).click();
                    await page.getByText('최신 상태를 읽지 못했어요.',{{exact:false}}).waitFor();
                    await page.screenshot({{path:{json.dumps(str(output/'query-failure.png'))},fullPage:true}});
                    const body=await page.locator('body').innerText();await page.unroute('**/handoff');
                    return {{passed:true,summary:'브라우저에서 조회 실패 응답을 주입하자 이전 자료임을 표시하고 현재 승인 안내를 보류했어요. 실제 서버 장애를 재현한 검사는 아니에요.',dom:body}};''')
                    (output/'query-failure.dom.txt').write_text(result.pop('dom'));results.append(result);return result
                flow.step('query-failure','조회 실패와 이전 자료 구분',query_failure)
            (output/'verification.json').write_text(json.dumps({'passed':True,'fixtureOnly':args.fixture_only,'results':results,'limitations':['상태 부정 흐름은 격리 fixture이며 가짜 리뷰는 실제 적절성 근거가 아님','사용자 만족/수용은 미확인','조회 실패는 브라우저에 실패 응답을 주입한 것임']},ensure_ascii=False,indent=2))
            print(f'ACCOUNTABILITY_BROWSER_OK: 실제 DOM·서버 원본·HTML·{len(results)}개 화면 흐름 확인')
        finally:
            try:cli('close')
            finally:
                server.terminate()
                try:server.wait(timeout=10)
                except subprocess.TimeoutExpired:server.kill();server.wait()


if __name__=='__main__':main()
