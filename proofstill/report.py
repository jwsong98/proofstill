import shlex
import subprocess
from urllib.parse import quote
from .contract import HarnessError


def link(label, path):
    return f'[{label}]({quote(str(path), safe="/:?#=&%")})'


def code_references(h, plan):
    paths = [str(path) for path in h.source_paths(plan)]
    if not paths:
        return ['- 등록된 소스 경로 없음']
    try:
        def git(*args):
            return subprocess.check_output(['git', *args], cwd=h.root, text=True, stderr=subprocess.DEVNULL)

        status = git('status', '--porcelain', '--', *paths)
        commits = {}
        for path in paths:
            commit = git('log', '-1', '--format=%H %s', '--', path).strip()
            if commit:
                commits.setdefault(commit, []).append(path)
    except (OSError, subprocess.CalledProcessError):
        return ['- Git 커밋을 확인할 수 없음']
    lines = [f'- `{commit.split(" ", 1)[0]}` {commit.partition(" ")[2]} ({", ".join(files)})'
             for commit, files in commits.items()]
    if status:
        lines.append('- 등록된 소스에 미커밋 변경이 있음')
    return lines or ['- 등록된 소스의 커밋 이력 없음']


def render(h, plan, state, status):
    evidence = h.folder(plan['id'])
    current_source = h.source_digest(plan)
    try:
        current_criteria = h.criteria_digest(plan, state)
    except HarnessError:
        current_criteria = None
    criteria_valid = current_criteria is not None
    checks_by_id = {check['id']: check for check in plan['checks']}

    def current_run(run):
        return bool(run and h.run_current(plan, state, checks_by_id[run['check']], run, current_criteria, current_source))

    lines = [f"# {plan['title']} — 기능 개발 보고", '',
             f"- 자동 검사·독립 리뷰: **{'검증 완료' if status['complete'] else '미완료'}**",
             f"- 인계 준비: {'필수 정보·기술 근거 있음' if status['handoff_ready'] else '보완 필요'}", '- 사용자 수용: 미확인',
             f"- 의도: {plan['intent']}", f"- 업무 맥락: {plan['context']}",
             f"- 명령 실행 위치: `{h.root}`",
             f"- 기준: {link('고정된 요구사항·명령', evidence / 'plan.json')}",
             '', '## 관련 코드 커밋', *code_references(h, plan), '',
             '## 요구사항과 검증', '', '| 요구사항 | 상태 | 테스트·근거 |', '|---|---|---|']
    for item in plan['requirements']:
        refs = []
        passed = True
        for check_id in item['checks']:
            run = h.latest(state, 'green', check_id)
            current = bool(current_run(run) and run['accepted'])
            passed = passed and current
            refs.append(check_id)
        label = '자동 검사 통과' if passed else '실패/미검증'
        lines.append(f"| {item['id']}: {item['text'].replace('|', '/')} | {label} | {', '.join(refs)} |")
    lines += ['', '## 재현 명령과 검사 결과', '']
    for check in plan['checks']:
        lines += [f"### {check['id']} · {check['kind']} · {check['module']}", '',
                  '```sh', shlex.join(check['argv']), '```', '']
        run = h.latest(state, 'green', check['id'])
        label = ('미실행' if not run else '무효 · 다시 검사 필요' if not current_run(run)
                 else '통과' if run['accepted'] else '실패')
        lines.append(f'- 결과 · {label}')
        for trace in (run or {}).get('traces', []):
            viewer = link('UI 추적 보기', trace['html']) if trace.get('html') else 'UI 뷰어 미생성'
            lines.append(f"- 흐름 {trace['name']} · {trace['steps']}단계 · {viewer} · {link('원본 JSONL', trace['path'])}")
            if 'state_machine' in trace:
                coverage = trace['state_machine']
                lines.append('- 상태머신 실행 전이: ' + ', '.join(coverage['visited_transitions']))
                lines.append('- 상태머신 미실행 전이: ' + (', '.join(coverage['unvisited_transitions']) or '없음'))
            for issue in trace['issues']:
                lines.append(f'  - 흐름 검증: {issue}')
    lines += ['', '## 독립 리뷰', '']
    for stage, title in [('criteria', '사전 기준 검토 · 선택'), ('implementation', '기준·구현 최종 검토')]:
        if stage == 'criteria' and stage in plan.get('required_reviews', []):
            title = '기준 적절성 독립 검토 · 필수'
        record = state['reviews'].get(stage)
        if not record:
            lines.append(f'- {title}: 미실행')
            continue
        valid = h.review_evidence_current(record, state['developer_session']) and criteria_valid and record['criteria_digest'] == current_criteria and ((stage == 'criteria' and stage not in plan.get('required_reviews', [])) or record['source_digest'] == current_source)
        if stage == 'implementation':
            valid = valid and h.review_current(plan, state, current_criteria, current_source) and all(current_run(h.latest(state, 'green', c['id']))
                                  and h.latest(state, 'green', c['id'])['accepted'] for c in plan['checks'])
        label = '현재 버전에서 무효' if not valid else ('통과' if record['passed'] else '실패/미검증')
        lines += [f"- {title}: {label} · 세션 `{record.get('session', '미확인')}` · 실행기 `{record['launcher']}`"]
        for check in record.get('answer', {}).get('checks', []):
            lines.append(f"  - {check.get('id')}: {check.get('status')} — {check.get('evidence')}")
    lines += ['', '## 구현·아티팩트', '']
    for artifact in plan['artifacts']:
        if artifact.get('url'):
            lines.append('- ' + link(artifact['label'], artifact['url']))
        else:
            path = (h.root / artifact['path']).resolve()
            lines.append('- ' + (link(artifact['label'], path) if path.is_file() else f"누락: {artifact['label']} — {path}"))
    lines += ['', '## 한계·남은 사항', '']
    limitations = list(plan['limitations']) + status['reasons']
    for record in state['reviews'].values():
        limitations += record.get('answer', {}).get('limitations', [])
    for limitation in dict.fromkeys(limitations):
        lines.append('- ' + limitation)
    lines.append('- 검증은 위 기준과 대상 버전에 한정하며, 모든 버그의 부재나 사용자의 최종 수용을 뜻하지 않는다.')
    return '\n'.join(lines) + '\n'
