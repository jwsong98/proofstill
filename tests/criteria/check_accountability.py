"""Execute deliberately wrong evidence; summaries come from observed rejections."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from proofstill.contract import HarnessError, validate_plan
from proofstill.handoff import snapshot
from proofstill.trace import Flow
from proofstill.trace_check import verify_trace
from proofstill.workflow import Harness
from tests.support import make_plan


def fixture():
    temporary = tempfile.TemporaryDirectory(prefix='proofstill-criterion-')
    root = Path(temporary.name).resolve()
    return temporary, root, make_plan(root)


def mapping_gap():
    temporary, root, path = fixture()
    with temporary:
        plan = json.loads(path.read_text())
        plan['requirements'][0]['checks'] = []
        try:
            validate_plan(root, plan)
        except HarnessError as error:
            assert '검사' in str(error)
            return {'rejected': True, 'summary': f'검사 연결을 뺀 요구를 등록하려 했고 “{error}”로 거부됐어요.'}
        raise AssertionError('요구에 검사 연결이 없어도 승인됨')


def wrong_expected():
    temporary, root, _ = fixture()
    with temporary:
        trace = root / 'wrong.jsonl'
        with Flow('실제 조회', path=trace) as flow:
            flow.step('read', '실제 파일 조회', lambda: {'value': len((root / 'src/counter.py').read_text())})
        actual = verify_trace(trace)['steps'][0]['output']['value']
        valid = {'operations': ['read'], 'assertions': [{'step': 0, 'field': 'output', 'path': '/value', 'equals': actual}]}
        assert verify_trace(trace, valid)['valid'], '정상 대조군이 실패함'
        valid['assertions'][0]['equals'] = actual + 1
        result = verify_trace(trace, valid)
        assert not result['valid'], '틀린 기대값도 승인됨'
        return {'rejected': not result['valid'], 'summary': f'파일 조회값 {actual}의 정상 기준은 통과했고, 기대값을 {actual + 1}로 바꾸자 실제 출력 불일치로 거부됐어요.'}


def constant_success():
    temporary, root, path = fixture()
    with temporary:
        plan = json.loads(path.read_text())
        expected = root / 'expected.json'
        expected.write_text(json.dumps({'operations': ['save', 'read'], 'assertions': [], 'links': []}))
        plan['checks'][0]['trace_expectation'] = 'expected.json'
        (root / 'tests/check.py').write_text('print("CHECK_EXECUTED")')
        path.write_text(json.dumps(plan))
        h = Harness(root); h.init(path)
        run = h.run('counter')[0]
        assert run['exit_code'] == 0 and not run['accepted'], '상수 성공 문구만 출력한 코드가 승인됨'
        return {'rejected': not run['accepted'], 'summary': f'기대 문구만 출력한 가짜 처리는 종료 코드 {run["exit_code"]}였지만 저장·조회 실행 Trace가 없어 통과하지 못했어요.'}


def wrong_source():
    temporary, root, _ = fixture()
    with temporary:
        trace = root / 'source.jsonl'
        with Flow('출처 대조', path=trace) as flow:
            found = flow.step('lookup', '조회값 생성', lambda: {'value': 4})
            flow.step('process', '조회값 사용', lambda value: value * 2, inputs={'value': found.ref('/value')})
        assert verify_trace(trace)['valid'], '정상 출처 대조군이 실패함'
        records = [json.loads(line) for line in trace.read_text().splitlines()]
        event = next(r for r in records if r['event'] == 'step.inputs' and r['bindings'])
        event['bindings'][0]['step_id'] = '다른-조회-출처'
        trace.write_text(''.join(json.dumps(record) + '\n' for record in records))
        result = verify_trace(trace)
        assert not result['valid'], '값은 같지만 출처가 다른 데이터를 승인함'
        return {'rejected': not result['valid'], 'summary': '정상 출처의 값 4→결과 8은 통과했어요. 값은 그대로 두고 조회 출처만 바꾸자 연결 오류로 거부됐어요.'}


def stale_evidence():
    temporary, root, path = fixture()
    with temporary:
        h = Harness(root); h.init(path)
        (root / 'src/counter.py').write_text('VALUE = 1\n')
        h.run('counter')
        assert snapshot(h, 'counter')[0]['verification']['status'] == 'passed'
        (root / 'tests/check.py').write_text('print("CHECK_EXECUTED")')
        status = snapshot(h, 'counter')[0]['verification']['status']
        assert status == 'stale' and not h.status('counter')['complete'], '기준 변경 후 과거 통과를 현재 통과로 승인함'
        return {'rejected': status == 'stale', 'summary': f'원래 검사는 통과했지만 검사 코드를 바꾸자 “{status}”로 바뀌고 완료 판정이 보류됐어요.'}


def never_run():
    temporary, root, path = fixture()
    with temporary:
        h = Harness(root); h.init(path)
        row = snapshot(h, 'counter')[0]
        status = row['verification']['status']
        assert status == 'not_run' and row['verification']['criteriaReview']['status'] == 'not_run' and not h.status('counter')['complete']
        return {'rejected': True, 'summary': '요구와 검사를 등록만 하고 실행하지 않자 자동 검사와 기준 리뷰 모두 미실행으로 남았고 완료되지 않았어요.'}


if __name__ == '__main__':
    with Flow('검증 기준이 잘못된 결과를 거부하는지 확인') as flow:
        for operation, description, function in [
            ('mapping-gap', '요구의 검사 연결 누락 거부', mapping_gap),
            ('wrong-expected', '틀린 기대 결과 거부와 정상 대조군', wrong_expected),
            ('constant-success', '실제 처리 없이 상수 성공 문구만 출력한 처리 거부', constant_success),
            ('wrong-source', '동일한 값이라도 잘못된 출처의 연결 거부', wrong_source),
            ('stale-evidence', '검사 변경 후 오래된 통과 무효화', stale_evidence),
            ('never-run', '미실행을 통과로 표시하지 않기', never_run),
        ]:
            flow.step(operation, description, function)
    print('CRITERIA_COUNTEREXAMPLES_OK: 6개 부정 사례와 정상 대조군 실행')
