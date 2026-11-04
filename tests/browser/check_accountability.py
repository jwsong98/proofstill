"""Real browser checks against the actual API, with isolated negative-state projects."""
import argparse
import json
import re
import subprocess
import sys
import tempfile
import uuid
from urllib.error import URLError
from urllib.request import urlopen
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from proofstill.trace import Flow
from proofstill.trace_check import verify_trace
from proofstill.workflow import Harness
from prepare_accountability import prepare


def source_expectations():
    harness = Harness(ROOT)
    plan, state = harness.load('accountability-web-v1')
    checks = {check['id']: check for check in plan['checks']}
    adversarial = checks['adversarial']
    run = harness.latest(state, 'green', 'adversarial')
    assert run and run['accepted'] and harness.run_current(
        plan, state, adversarial, run, harness.criteria_digest(plan, state), harness.source_digest(plan)
    ), '먼저 현재 기준 부정 검사를 실행하세요'
    expectation = json.loads((ROOT / adversarial['trace_expectation']).read_text())
    observations = {}
    for trace in run['traces']:
        verified = verify_trace(Path(trace['path']), expectation)
        assert verified['valid'], verified['issues']
        for step in verified['steps']:
            observations[step['operation']] = step['output']['summary']
    collaboration = plan['collaboration']
    return {
        requirement['id']: {
            'risk': requirement['risk'], 'rationale': requirement['rationale'],
            'limitations': plan['limitations'],
            'humanChecks': [item for item in collaboration['human_checks'] if item['requirement'] == requirement['id']],
            'responsibility': {key: collaboration[key] for key in ('human', 'ai')},
            'verification': {'criteriaChecks': [
                {'id': key, 'cases': [
                    dict(case, **({'observed': observations[case['operation']]} if key == 'adversarial' else {}))
                    for case in checks[key].get('cases', [])
                ]} for key in requirement['criteria_checks']
            ]},
        } for requirement in plan['requirements']
    }


def verify_live_target(url, project_id):
    try:
        with urlopen(url.rstrip('/') + '/api/projects', timeout=4) as response:
            projects = json.load(response)
    except (OSError, URLError, ValueError) as error:
        raise SystemExit(f'브라우저 실행 환경 오류: {url}에서 Proofstill 프로젝트를 조회할 수 없습니다. {error}') from error
    matches = [project for project in projects
               if project['rootPath'] == str(ROOT) and (project_id is None or project['id'] == project_id)]
    if len(matches) != 1:
        raise SystemExit(f'브라우저 실행 환경 오류: {url}에 {ROOT}의 프로젝트가 하나로 확인되어야 합니다. --live-project를 지정할 수 있습니다.')
    return matches[0]



def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture-only', action='store_true', help='개발 중 격리 UI만 확인. 최종 검사는 이 옵션을 사용하지 않음')
    parser.add_argument('--live-url', default='http://127.0.0.1:7777', help='확인할 실제 Proofstill 서버 주소')
    parser.add_argument('--live-project', help='서버에서 현재 작업 경로와 일치해야 하는 프로젝트 ID')
    parser.add_argument('--output', default='output/playwright/accountability-web')
    args = parser.parse_args()
    live_target = None if args.fixture_only else verify_live_target(args.live_url, args.live_project)
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
                    expected = source_expectations()
                    result = run(f'''const live = await page.context().newPage();
                    await live.goto({json.dumps(args.live_url)});
                    const project = {json.dumps(live_target, ensure_ascii=False)};
                    await live.getByRole('combobox', {{name:'프로젝트', exact:true}}).selectOption(project.id);
                    await live.getByRole('heading', {{name:'확인할 항목을 골라 주세요'}}).waitFor();
                    const columns = await live.getByRole('columnheader').allInnerTexts();
                    insist(columns.join('|') === '확인할 항목|지금 판단', '목록의 두 열이 표시되지 않음');
                    await live.setViewportSize({{width:1440,height:900}});
                    await live.screenshot({{path:{json.dumps(str(output/'entry.png'))}}});
                    await live.getByRole('button', {{name:'구현 기록과 현재 검증을 구분해요', exact:true}}).click();
                    const detail = live.getByRole('complementary', {{name:'요구별 구현·검증 상세'}});
                    const summary = detail.getByRole('region', {{name:'지금 판단할 내용'}});
                    await summary.getByRole('heading', {{name:/^(내가 할 일|볼 결과)$/}}).waitFor();
                    const topics = await summary.getByRole('heading').allInnerTexts();
                    insist(['지금 판단|이렇게 판단한 이유|내가 할 일', '지금 판단|이렇게 판단한 이유|볼 결과'].includes(topics.join('|')), '선택 직후 안내 순서 오류');
                    insist(!await detail.locator('.handoff-statuses').isVisible(), '기술 상태가 기본 상세에 노출됨');
                    await live.screenshot({{path:{json.dumps(str(output/'selected.png'))}}});
                    const source = await (await live.request.get(new URL('/api/projects/' + project.id + '/handoff', live.url()).href)).json();
                    const rows = source.rows.filter(r => r.taskId === 'accountability-web-v1' && !r.historical);
                    insist(rows.length === 6, '현재 여섯 실제 요구 누락');
                    const graph = await (await live.request.get(new URL('/api/projects/' + project.id + '/graph', live.url()).href)).json();
                    const origin = graph.nodes.find(n => n.evidence?.sourceKind === 'file' && n.evidence.source.path === 'requirements.md'
                      && n.evidence.content.includes('근거 U23') && n.evidence.content.includes('NO.'));
                    insist(origin, '현재 요구의 실제 사용자 원문 연결 누락');
                    const originals = {json.dumps(expected, ensure_ascii=False)};
                    for (const row of rows) {{
                      const node = graph.nodes.find(n => n.id === row.nodeId);
                      insist(node?.body.includes(row.taskId) && node.body.includes(row.requirementId)
                        && row.relatedNodeIds?.includes(origin.id) && row.relatedNodeIds.includes('ps-feature-handoff'), '현재 작업 또는 원문 연결 오류: '+row.requirementId);
                      await live.getByRole('button', {{name:row.title, exact:true}}).click();
                      await detail.getByRole('heading', {{name:row.title, exact:true}}).waitFor();
                      await detail.getByText('판정 근거', {{exact:true}}).click();
                      await detailMatches(row, detail);
                      const original = originals[row.requirementId];
                      insist(original, '고정된 요구 원문 매핑 누락');
                      sourceMatches(row, original);
                      await explanationMatches({{...original, requirementId: row.requirementId}}, detail);
                      if (row.requirementId === 'Q1-W') {{
                        await detail.getByText('실행 근거 보기', {{exact:true}}).first().click();
                        insist(await detail.locator('pre').filter({{hasText:'CRITERIA_COUNTEREXAMPLES_OK'}}).first().isVisible(), '실제 실행 로그 펼침 실패');
                        await live.screenshot({{path:{json.dumps(str(output/'actual-project.png'))}}});
                      }}
                    }}
                    await downloadHandoff(live, {json.dumps(str(target))});
                    const portable = await live.context().newPage();
                    await portable.goto({json.dumps(target.as_uri())});
                    for (const row of rows) await exportedStatusMatches(portable, row);
                    await portable.close();
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
                    await switched.getByText('판정 근거', {{exact:true}}).click();
                    const criteria = switched.getByRole('group', {{name:'독립 기준 검토', exact:true}});
                    await criteria.getByRole('heading', {{name:'독립 기준 검토 · 확인', exact:true}}).waitFor();
                    await criteria.getByText('검토 근거와 이전 지적 펼치기', {{exact:true}}).click();
                    insist((await criteria.innerText()).includes('합성 이전 지적:'), '재검토 후 이전 기준 지적이 사라짐');
                    await downloadHandoff(page, {json.dumps(str(target))});
                    const search = page.getByRole('textbox', {{name:'요구 검색', exact:true}});
                    await search.fill('');
                    const old = page.getByRole('button', {{name:'격리 fixture · 이전 요구', exact:true}});
                    insist(await old.count() === 0, '현재 목록에 과거 요구가 섞임');
                    const unrelated = await selectRequirement(page, '격리 fixture · 무관한 현재 요구');
                    await unrelated.getByText('판정 근거', {{exact:true}}).click();
                    insist(await unrelated.locator('.check-example').count() === 0
                      && !(await unrelated.innerText()).includes(first), '무관 요구에 현재 관찰을 채움');
                    await search.fill('');
                    await page.getByRole('combobox', {{name:'목록 범위', exact:true}}).selectOption('history');
                    await old.click();
                    const historical = page.getByRole('complementary', {{name:'요구별 구현·검증 상세'}});
                    await historical.getByText('판정 근거', {{exact:true}}).click();
                    insist(await historical.locator('.check-example').count() === 0
                      && !(await historical.innerText()).includes(first), '과거 자료에 현재 관찰을 채움');
                    await page.getByRole('combobox', {{name:'목록 범위', exact:true}}).selectOption('current');
                    return {{passed:true, summary:'요구를 바꿔 선택하자 관찰과 사람 확인 행동이 바뀌었고 인계 HTML을 다운로드했어요.'}};''')
                    html = target.read_text()
                    assert all(title in html for title in ('격리 fixture · 정상 근거', '격리 fixture · 다른 대표 상황')), '다운로드한 인계에 요구가 누락됐어요'
                    return result

                def failed_check():
                    cases = [
                        ('검사 실패', '자동 검사 · 실패'),
                        ('미실행', '자동 검사 · 미실행'),
                        ('기준 지적', '합성 기준 지적: 잘못된 기대값을 재검토해야 해요.'),
                        ('기준 미검토', '독립 기준 검토 · 미실행'),
                        ('사람 결정 대기', '보존 기간 정책은 사람이 결정해 주세요.'),
                    ]
                    cases = [{'id': project('격리 fixture · '+name)['id'], 'title': '격리 fixture · '+name, 'expected': expected}
                             for name, expected in cases]
                    return run(f'''for (const test of {json.dumps(cases, ensure_ascii=False)}) {{
                      await page.getByRole('combobox', {{name:'프로젝트', exact:true}}).selectOption(test.id);
                      const detail = await selectRequirement(page, test.title);
                      await detail.getByText('판정 근거', {{exact:true}}).click();
                      await detail.getByText(test.expected, {{exact:true}}).first().waitFor();
                      const decision = await detail.getByRole('region', {{name:'지금 판단할 내용'}}).innerText();
                      insist(!decision.includes('확인 후 결정'), test.title+'에 수용 안내를 표시했어요');
                    }}
                    return {{passed:true, summary:'실패·미실행·기준 지적·기준 미검토·사람 결정 대기를 실제 화면에서 확인하고 판단을 보류했어요.'}};''')

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
                        result = run('''await page.getByRole('button', {name:'새로고침', exact:true}).click();
                        const detail = page.getByRole('complementary', {name:'요구별 구현·검증 상세', exact:true});
                        await detail.getByText('판정 근거', {exact:true}).click();
                        await detail.getByRole('heading', {name:'자동 검사 · 재검증 필요', exact:true}).waitFor();
                        await detail.getByText('지금은 결정할 필요가 없어요. AI가 확인을 마치고 새 결과가 나오면 다시 확인하세요.', {exact:true}).waitFor();
                        insist(!(await detail.innerText()).includes('실제 초기값 1을 다시 읽었어요.'), '변경된 근거의 관찰을 현재 결과로 표시했어요');
                        return {passed:true, summary:'실행 로그를 바꾸고 새로고침하자 재검증 필요로 바뀌고 이전 관찰이 사라졌어요.'};''')
                    finally:
                        log.write_bytes(original)
                    expected = root / 'expect.json'
                    original = expected.read_bytes()
                    changed = json.loads(original)
                    changed['assertions'][0]['equals'] = 2
                    try:
                        expected.write_text(json.dumps(changed))
                        run('''await page.getByRole('button', {name:'새로고침', exact:true}).click();
                        const criteria = page.getByRole('region', {name:'검증 기준의 적절성'});
                        await criteria.getByRole('heading', {name:'독립 기준 검토 · 재검증 필요', exact:true}).waitFor();
                        return true;''')
                    finally:
                        expected.write_bytes(original)
                    result['summary'] += ' 기준 변경 뒤에는 이전 기준 검토도 재검증 필요로 표시됐어요.'
                    return result

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
