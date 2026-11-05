"""Explicit changes to frozen criteria, with stable requirement IDs and retained evidence."""
from pathlib import Path
from .contract import digest, read_json, require, validate_plan, inventory
from .execution import write_json


def check_basis(plan, state, check):
    requirements = [r for r in plan['requirements'] if check['id'] in r['checks']]
    ids = {r['id'] for r in requirements}
    collaboration = plan.get('collaboration', {})
    return {'version': 2, 'check': check, 'requirements': requirements,
            'intent': plan['intent'], 'context': plan['context'], 'limitations': plan['limitations'],
            'human': collaboration.get('human'), 'ai': collaboration.get('ai'),
            'human_checks': [c for c in collaboration.get('human_checks', []) if c['requirement'] in ids],
            'decisions': state.get('decisions', {}), 'dependencies': state.get('project_dependencies', {})}


def implementation_basis(h, plan, state, requirement, paths):
    req = next(r for r in plan['requirements'] if r['id'] == requirement)
    checks = [c for c in plan['checks'] if c['id'] in req['checks']]
    sources = list(paths) + [p for c in checks for p in c.get('sources', h.source_paths(plan))]
    return digest({'checks': [check_basis(plan, state, c) for c in checks],
                   'files': plan['context_files'] + [p for c in checks for p in c['files']],
                   'sources': sources})


def revise(h, feature, path, reason, source):
    require(reason.strip() and source.strip(), '변경 이유와 실제 요청/답변 출처가 필요합니다')
    plan, state = h.load(feature)
    require(digest(plan) == state['plan_digest'], '보관된 기준이 변경되었습니다')
    updated = validate_plan(h.root, read_json(path))
    require(updated['id'] == feature, 'revision은 기존 작업 ID를 유지해야 합니다')
    require(digest(updated) != state['plan_digest'], '변경된 기준이 없습니다')
    version = state.get('revision', 1)
    archive = h.folder(feature) / 'revisions' / str(version)
    require(not archive.exists(), '이미 보존된 revision입니다')
    write_json(archive / 'plan.json', plan)
    write_json(archive / 'state.json', state)
    before = {r['id']: r for r in plan['requirements']}
    after = {r['id']: r for r in updated['requirements']}
    state.setdefault('revisions', []).append({'from': version, 'to': version + 1,
        'reason': reason, 'source': source, 'archive': str(archive),
        'changed_requirements': sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))})
    state.update(revision=version + 1, origin=str(Path(path).resolve()), plan_digest=digest(updated),
                 criteria_digest=digest(h.basis(updated)), closed=False, next='변경된 요구와 관련 검사 확인')
    # A changed plan never inherits independent approval. Check receipts remain reusable by their own inputs.
    write_json(h.folder(feature) / 'plan.json', updated)
    h.save(updated, state)
    return state['revisions'][-1]


def review_delta(h, plan, state, previous, manifest):
    if not h.review_evidence_current(previous, state['developer_session']):
        return None
    old = read_json(Path(previous['folder']) / 'manifest.json')
    changed = sorted(k for k in old.keys() | manifest.keys() if old.get(k) != manifest.get(k))
    prior = {c['id']: c for c in previous.get('answer', {}).get('checks', [])}
    signatures = previous.get('requirement_inputs', {})
    affected = []
    for req in plan['requirements']:
        current = implementation_basis(h, plan, state, req['id'], [])
        if signatures.get(req['id']) != current or prior.get(req['id'], {}).get('status') != 'pass':
            affected.append(req['id'])
    return {'changed_files': changed, 'focus_requirements': affected,
            'previous_checks': list(prior.values()), 'previous_manifest': str(Path(previous['folder']) / 'manifest.json'),
            'previous_evidence': {'folder': previous['folder']},
            'rule': '변경과 교차 영향을 우선 검토한다. 유지할 판정은 현재 입력과 이전 증거를 확인한다. 연결이 불충분하면 전체 검토한다. 모든 요구를 판정하며 미검증을 자동 통과시키지 않는다.'}
