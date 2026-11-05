"""Read-only console projection; the core task gate remains authoritative."""
import runpy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from proofstill import handoff
from proofstill.contract import HarnessError

original_snapshot = handoff.snapshot


def requirement_checks(plan, answer):
    if not isinstance(answer, dict) or set(answer) != {'verdict', 'checks', 'findings', 'limitations'}:
        return None
    if answer['verdict'] not in ('pass', 'fail', 'blocked'):
        return None
    if any(not isinstance(answer[key], list) or not all(isinstance(value, str) for value in answer[key]) for key in ('findings', 'limitations')):
        return None
    checks = answer['checks']
    if not isinstance(checks, list):
        return None
    expected = {requirement['id'] for requirement in plan['requirements']}
    found = {}
    for check in checks:
        if not isinstance(check, dict) or set(check) != {'id', 'status', 'evidence'}:
            return None
        requirement = check['id']
        if not isinstance(requirement, str) or requirement not in expected or requirement in found:
            return None
        if check['status'] not in ('pass', 'fail', 'unverified') or not isinstance(check['evidence'], str) or not check['evidence'].strip():
            return None
        found[requirement] = check
    return found if set(found) == expected else None


def snapshot(h, feature):
    rows = original_snapshot(h, feature)
    plan, state = h.load(feature)
    record = state.get('reviews', {}).get('implementation')
    if not record:
        for row in rows:
            review = row['verification']['review']
            if review['status'] not in ('stale', 'not_run'):
                review['status'] = review['gateStatus'] = 'stale'
        return rows
    try:
        current = h.review_current(plan, state, h.criteria_digest(plan, state), h.source_digest(plan))
    except (HarnessError, KeyError, TypeError, OSError, ValueError):
        current = False
    checks = requirement_checks(plan, record.get('answer'))
    for row in rows:
        review = row['verification']['review']
        review['gateStatus'] = review.get('gateStatus', review['status'])
        if review['status'] in ('stale', 'not_run'):
            continue
        if not current:
            review['status'] = review['gateStatus'] = 'stale'
            continue
        if checks is None:
            review['status'] = 'unverified'
            review['evidence'] = '리뷰 응답의 구조·요구 ID·판정·근거를 확인하지 못했어요. 작업 전체 판정은 별도 표시해요.'
            continue
        check = checks[row['requirementId']]
        review['status'] = {'pass': 'passed', 'fail': 'failed', 'unverified': 'unverified'}[check['status']]
        review['evidence'] = check['evidence']
    return rows


if __name__ == '__main__':
    # Only the console's read command uses this adapter; writes use the core CLI.
    if len(sys.argv) not in (4, 5) or sys.argv[1] != '--root' or sys.argv[3] != 'handoff':
        raise SystemExit('Only --root PROJECT handoff [TASK] is supported')
    handoff.snapshot = snapshot
    runpy.run_module('proofstill', run_name='__main__')
