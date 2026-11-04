"""Real browser checks against the actual API, with isolated negative-state projects."""
import argparse
import json
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
            cli('open', base)
            def project(name):
                return next(p for p in state['projects'] if p['name']==name)
            def choose(name):
                return f'''await page.getByRole('combobox', {{name:'프로젝트', exact:true}}).selectOption({json.dumps(project(name)['id'])});
                const detail = await selectRequirement(page, {json.dumps(name)});'''

            with Flow('웹에서 근거와 기준의 상태를 실제로 읽고 재조회') as flow:
                def current_project():
                    target = output / 'actual-live-handoff.html'
                    result = run(f'''const live = await page.context().newPage();
                    await live.goto('http://127.0.0.1:7777');
                    const projects = await (await live.request.get(new URL('/api/projects', live.url()).href)).json();
                    const project = projects.find(p => p.id === '965e6be6-dd96-4910-abe0-c23bba1a28f8' && p.rootPath === {json.dumps(str(ROOT))});
                    insist(project, '실제 7777 기존 프로젝트가 아님');
                    await live.getByRole('combobox', {{name:'프로젝트', exact:true}}).selectOption(project.id);
                    await live.getByRole('heading', {{name:'확인할 항목을 골라 주세요'}}).waitFor();
                    const columns = await live.getByRole('columnheader').allInnerTexts();
                    insist(columns.join('|') === '확인할 항목|지금 판단', '목록의 두 열이 표시되지 않음');
                    await live.setViewportSize({{width:1440,height:900}});
                    await live.screenshot({{path:{json.dumps(str(output/'entry.png'))}}});
                    await live.getByRole('button', {{name:'구현 기록과 현재 검증을 구분해요', exact:true}}).click();
                    const detail = live.getByRole('complementary', {{name:'요구별 구현·검증 상세'}});
                    const summary = detail.getByRole('region', {{name:'지금 판단할 내용'}});
                    await summary.getByRole('heading', {{name:'내가 할 일'}}).waitFor();
                    const topics = await summary.getByRole('heading').allInnerTexts();
                    insist(topics.join('|') === '지금 판단|이렇게 판단한 이유|내가 할 일', '선택 직후 안내 순서 오류');
                    insist(!await detail.locator('.handoff-statuses').isVisible(), '기술 상태가 기본 상세에 노출됨');
                    await live.screenshot({{path:{json.dumps(str(output/'selected.png'))}}});
                    const source = await (await live.request.get(new URL('/api/projects/' + project.id + '/handoff', live.url()).href)).json();
                    const rows = source.rows.filter(r => r.taskId === 'accountability-web-v1' && !r.historical);
                    insist(rows.length === 6, '현재 여섯 실제 요구 누락');
                    await detail.getByText('판정 근거', {{exact:true}}).click();
                    await detailMatches(rows.find(row => row.requirementId === 'Q1-W'), detail);
                    insist(await detail.getByRole('heading', {{name:'사람이 지금 확인할 행동', exact:true}}).isVisible(), '사람 확인 행동 영역 누락');
                    await detail.getByText('실행 근거 보기', {{exact:true}}).first().click();
                    insist(await detail.locator('pre').filter({{hasText:'CRITERIA_COUNTEREXAMPLES_OK'}}).first().isVisible(), '실제 실행 로그 펼침 실패');
                    await live.screenshot({{path:{json.dumps(str(output/'actual-project.png'))}}});
                    await downloadHandoff(live, {json.dumps(str(target))});
                    await live.close();
                    return {{passed:true, summary:'실제 7777 프로젝트에서 대표 요구를 선택하고 실행 로그를 펼쳐 인계 파일을 다운로드했어요.'}};''')
                    assert '구현 기록과 현재 검증을 구분해요' in target.read_text(), '실제 인계 파일에 선택한 요구가 없음'
                    return result

                def normal_display():
                    target = output / 'portable.html'
                    result = run(choose('격리 fixture · 정상 근거')+f'''
                    const first = '실제 초기값 1을 다시 읽었어요.';
                    const second = '실제 대조값 2을 다시 읽었어요.';
                    insist((await detail.innerText()).includes(first), '첫 요구의 실제 관찰 누락');
                    await detail.getByText('판정 근거', {{exact:true}}).click();
                    const switched = await selectRequirement(page, '격리 fixture · 다른 대표 상황');
                    const text = await switched.innerText();
                    insist(!await switched.locator('.handoff-statuses').isVisible(), '이전 요구의 상세 펼침이 남음');
                    insist(text.includes(second) && !text.includes(first), '요구를 바꾼 뒤 실제 관찰이 섞였어요');
                    insist(text.includes('두 번째 요구의 대조값 관찰을 보고'), '두 번째 요구 확인 행동 누락');
                    await downloadHandoff(page, {json.dumps(str(target))});
                    return {{passed:true, summary:'요구를 바꿔 선택하자 관찰과 사람 확인 행동이 바뀌었고 인계 HTML을 다운로드했어요.'}};''')
                    html = target.read_text()
                    assert all(title in html for title in ('격리 fixture · 정상 근거', '격리 fixture · 다른 대표 상황')), '다운로드한 인계에 요구가 누락됐어요'
                    return result

                def failed_check():
                    result = run(choose('격리 fixture · 검사 실패')+'''
                    await detail.getByText('판정 근거', {exact:true}).click();
                    insist(await detail.getByRole('heading', {name:'자동 검사 · 실패', exact:true}).isVisible(), '실패한 검사 상태 누락');
                    const decision = await detail.locator('section[aria-label="지금 판단할 내용"]').innerText();
                    insist(!decision.includes('확인 후 결정'), '실패한 검사에 수용 안내를 표시했어요');
                    return {passed:true, summary:'실패한 요구를 선택했을 때 검사 실패를 표시하고 수용 안내를 보류했어요.'};''')
                    return result

                def changed_evidence():
                    name = '격리 fixture · 정상 근거'
                    run(choose(name)+'return true;')
                    root = Path(project(name)['rootPath'])
                    state_file = root / '.proofstill/evidence/counter/state.json'
                    saved = json.loads(state_file.read_text())
                    target = next(record for record in reversed(saved['runs']) if record['check'] == 'counter-unit')
                    log = Path(target['log'])
                    original = log.read_bytes()
                    try:
                        log.write_text('변경된 실행 근거')
                        return run('''await page.getByRole('button', {name:'새로고침', exact:true}).click();
                        const detail = page.getByRole('complementary', {name:'요구별 구현·검증 상세', exact:true});
                        await detail.getByText('판정 근거', {exact:true}).click();
                        await detail.getByRole('heading', {name:'자동 검사 · 재검증 필요', exact:true}).waitFor();
                        insist(!(await detail.innerText()).includes('실제 초기값 1을 다시 읽었어요.'), '변경된 근거의 관찰을 현재 결과로 표시했어요');
                        return {passed:true, summary:'실행 로그를 바꾸고 새로고침하자 재검증 필요로 바뀌고 이전 관찰이 사라졌어요.'};''')
                    finally:
                        log.write_bytes(original)

                def query_failure():
                    return run('''const refresh = page.getByRole('button', {name:'새로고침', exact:true});
                    const decision = page.locator('section[aria-label="지금 판단할 내용"]');
                    const ready = decision.getByText('확인 후 결정', {exact:true});
                    await refresh.click();
                    await ready.waitFor();
                    await page.route('**/handoff', route => route.fulfill({status:503, json:{error:'격리 조회 실패'}}));
                    await refresh.click();
                    await page.getByText('최신 상태를 읽지 못했어요.', {exact:false}).waitFor();
                    insist(!await ready.isVisible(), '조회 실패에도 현재 수용 안내가 남았어요');
                    await page.unroute('**/handoff');
                    return {passed:true, summary:'조회 실패 응답을 주입하자 이전 자료 안내가 나타나고 현재 수용 안내가 사라졌어요.'};''')

                if not args.fixture_only:
                    results.append(flow.step('actual-project', '실제 프로젝트에서 요구 선택·근거 펼침·다운로드', current_project).value)
                results.append(flow.step('normal-display', '요구 전환·다운로드', normal_display).value)
                results.append(flow.step('negative-states', '실패한 검사 수용 보류', failed_check).value)
                results.append(flow.step('changed-evidence', '근거 변경 후 새로고침', changed_evidence).value)
                results.append(flow.step('query-failure', '조회 실패 후 수용 보류', query_failure).value)

            (output/'verification.json').write_text(json.dumps({
                'passed': True, 'fixtureOnly': args.fixture_only, 'results': results,
                'limitations': ['격리 프로젝트의 합성 리뷰는 실제 독립 기준 검토가 아님', '503은 브라우저 응답 주입'],
            }, ensure_ascii=False, indent=2))
            print(f'ACCOUNTABILITY_BROWSER_OK: 실제 DOM·다운로드·{len(results)}개 화면 흐름 확인')
        finally:
            try:cli('close')
            finally:
                server.terminate()
                try:server.wait(timeout=10)
                except subprocess.TimeoutExpired:server.kill();server.wait()


if __name__=='__main__':main()
