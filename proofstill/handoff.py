"""Current requirement progress, separate from test and review verdicts."""
import shlex
from pathlib import Path
from .contract import HarnessError, project_path, require

IMPLEMENTATION = {'unknown': '미기록', 'not_started': '미착수', 'in_progress': '진행 중', 'partial': '일부 구현', 'implemented': '구현 완료'}
VERIFICATION = {'not_run': '미실행', 'partial': '일부 확인', 'passed': '통과', 'failed': '실패', 'stale': '재검증 필요', 'unverified': '확인 불가', 'interrupted': '중단'}


def verification_status(checks):
    statuses = [c['status'] for c in checks]
    if 'failed' in statuses:
        return 'failed'
    if 'stale' in statuses:
        return 'stale'
    if statuses and all(s == 'passed' for s in statuses):
        return 'passed'
    if 'passed' in statuses:
        return 'partial'
    if 'interrupted' in statuses:
        return 'interrupted'
    if 'unverified' in statuses:
        return 'unverified'
    return 'not_run'


def snapshot(h, feature):
    plan, state = h.load(feature)
    try:
        criteria = h.criteria_digest(plan, state)
    except HarnessError:
        criteria = None
    source = h.source_digest(plan) if criteria else None
    checks = {}
    for check in plan['checks']:
        run = h.latest(state, 'green', check['id'])
        current = bool(run and criteria and h.evidence_current(run) and run['criteria_digest'] == criteria and run['source_digest'] == source)
        label = 'not_run' if not run else 'unverified' if run.get('pending') else 'stale' if not current else 'interrupted' if run.get('timed_out') else 'passed' if run['accepted'] else 'unverified' if run.get('pending') or run['exit_code'] is None else 'failed'
        log = ''
        output_truncated = False
        if run:
            path = Path(run['log']).resolve()
            if path.is_relative_to(h.folder(feature).resolve()) and path.is_file():
                with path.open(errors='replace') as stream:
                    log = stream.read(100001)
                output_truncated = len(log) > 100000
                log = log[:100000]
                if output_truncated:
                    log += '\n[출력 생략: 원본이 100,000자를 초과하여 앞부분만 포함했습니다.]'
            else:
                log = '[실행 출력 근거를 찾을 수 없습니다. 원본 로그를 복구하거나 다시 검사하세요.]'
        checks[check['id']] = {'id': check['id'], 'label': check.get('label', check['id']), 'kind': check['kind'],
                                'purpose': check.get('purpose', ''), 'rationale': check.get('rationale', ''), 'expected': check.get('expected', ''),
                                'command': shlex.join(check['argv']), 'status': label, 'output': log, 'outputTruncated': output_truncated,
                                'exitCode': run.get('exit_code') if run else None, 'recordedAt': run.get('recorded_at') if run else None,
                                'files': check['files'], 'scope': check.get('scope', '등록된 검사 범위. 제품 화면 확인 여부는 검사 내용을 확인하세요.')}
    record = state.get('reviews', {}).get('implementation')
    review_current = bool(record and criteria and record.get('criteria_digest') == criteria and record.get('source_digest') == source)
    review_checks = {c['id']: c for c in (record or {}).get('answer', {}).get('checks', [])}
    rows = []
    for req in plan['requirements']:
        implementation = state.get('implementations', {}).get(req['id'], {'status': 'unknown', 'paths': [], 'remaining': '', 'note': ''})
        linked = [checks[c] for c in req['checks']]
        review = review_checks.get(req['id'])
        review_status = 'not_run' if not record else 'stale' if not review_current else 'passed' if review and review['status'] == 'pass' and record.get('passed') else 'failed' if (review and review['status'] == 'fail') or (record or {}).get('answer', {}).get('verdict') == 'fail' else 'unverified'
        rows.append({'id': f'harness:{feature}:{req["id"]}', 'source': 'harness', 'taskId': feature, 'requirementId': req['id'],
                     'title': req.get('title', req['text']), 'description': req['text'], 'group': req.get('group', plan['title']), 'origin': plan['intent'] + '\n\n' + plan['context'], 'implementation': implementation,
                     'verification': {'status': verification_status(linked), 'checks': linked,
                                      'review': {'status': review_status, 'evidence': (review or {}).get('evidence', (record or {}).get('error', ''))}},
                     'limitations': plan['limitations'] + (record or {}).get('answer', {}).get('limitations', []) + [str(f) for f in (record or {}).get('answer', {}).get('findings', [])]})
    return rows


def record_implementation(h, feature, requirement, status, paths, remaining='', note=''):
    from .workflow import save_json
    plan, state = h.load(feature)
    require(requirement in [r['id'] for r in plan['requirements']], '알 수 없는 요구 ID')
    require(status in IMPLEMENTATION, '잘못된 구현 상태')
    require(all(isinstance(p, str) for p in paths), '구현 경로는 문자열 배열이어야 합니다')
    for path in paths:
        require(not Path(path).is_absolute(), '구현 경로는 프로젝트 상대 경로여야 합니다')
        require(project_path(h.root, path).exists(), f'구현 경로 없음: {path}')
    require(status != 'implemented' or paths, '구현 완료에는 구현 경로가 필요합니다')
    require(status != 'partial' or remaining.strip(), '일부 구현에는 남은 범위가 필요합니다')
    state.setdefault('implementations', {})[requirement] = {'status': status, 'paths': paths, 'remaining': remaining, 'note': note}
    # This is an implementation declaration, never a test/review success claim.
    save_json(h.folder(feature) / 'state.json', state)
    return state['implementations'][requirement]


def markdown(rows):
    def cell(text):
        return str(text).replace('|', '/').replace('\n', ' ')
    lines = ['## 구현·검증 현황', '', '구현은 근거를 붙인 기록이며, 자동 검사와 독립 리뷰는 별도 판정입니다.', '',
             '| 요구 | 구현 | 자동 검사 | 독립 리뷰 | 남은 범위 |', '|---|---|---|---|---|']
    for row in rows:
        i, v = row['implementation'], row['verification']
        lines.append('| ' + ' | '.join(map(cell, [row['requirementId'] + ': ' + row['title'], IMPLEMENTATION[i['status']], VERIFICATION[v['status']], VERIFICATION[v['review']['status']], i.get('remaining') or '미기록'])) + ' |')
    return '\n'.join(lines)
