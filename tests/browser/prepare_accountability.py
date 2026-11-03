"""Prepare isolated real harness states; fake review plumbing is labelled fixture."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


def prepare(directory):
    projects = []
    for kind, title in [('current', '정상 근거'), ('failed', '검사 실패'), ('missing', '미실행'), ('criteria-failed', '기준 지적'), ('criteria-missing', '기준 미검토'), ('decision-pending', '사람 결정 대기')]:
        root = (Path(directory) / kind).resolve(); root.mkdir()
        origin = make_plan(root)
        plan = json.loads(origin.read_text())
        plan.update(title=f'격리 fixture · {title}', required_reviews=['criteria'], context='화면 상태 전환 검사용 합성 fixture. 이 가짜 리뷰는 실제 기준 적절성 검토가 아니에요.')
        plan['requirements'][0].update(title=f'격리 fixture · {title}', risk='상태가 잘못 표시되면 미검증을 통과로 오해해요.', rationale='실제 실행 상태와 기준 검토를 분리해서 보여야 해요.', criteria_checks=['counter-unit'])
        (root / 'expect.json').write_text(json.dumps({'operations':['read'], 'assertions':[{'step':0,'field':'output','path':'/value','equals':1}]}))
        (root / 'tests/check.py').write_text('from pathlib import Path\nfrom proofstill.trace import Flow\nimport runpy\ndef read():\n    value=runpy.run_path("src/counter.py")["VALUE"]\n    assert value==1\n    return {"value":value,"summary":f"실제 초기값 {value}을 다시 읽었어요."}\nwith Flow("화면 fixture 조회") as flow:\n    flow.step("read","실제 카운터 읽기",read)\nprint("CHECK_EXECUTED")\n')
        plan['checks'][0].update(label='실제 초기값 다시 읽기', purpose='현재 파일에서 값을 조회해요.', rationale='성공 문구만으로 실제 값을 확인했다고 오해하지 않기 위해 필요해요.', expected='조회한 값은 1이어야 해요.', scope='격리 fixture의 값 조회만 확인해요. 제품 업무 규칙은 확인하지 않아요.', trace_expectation='expect.json', cases=[{'operation':'read','situation':'초기값이 저장된 파일을 다시 읽어요.','expected':'실제 조회값은 1이어야 해요.'}], argv=[sys.executable,'-c',f'import sys;sys.path.insert(0,{str(Path(__file__).resolve().parents[2])!r});exec(open("tests/check.py").read())'])
        if kind=='current':
            (root/'src/second.py').write_text('VALUE = 2\n')
            second=(root/'tests/check.py').read_text().replace('src/counter.py','src/second.py').replace('value==1','value==2').replace('실제 초기값','실제 대조값').replace('flow.step("read",','flow.step("read-second",')
            (root/'tests/second.py').write_text(second)
            (root/'second.expect.json').write_text(json.dumps({'operations':['read-second'],'assertions':[{'step':0,'field':'output','path':'/value','equals':2}]}))
            plan['sources'].append('src/second.py')
            plan['requirements'].append({'id':'R2','title':'격리 fixture · 다른 대표 상황','text':'다른 요구의 값 2와 기대 결과를 구분해요.','risk':'첫 요구의 관찰이 두 번째 요구에 남을 수 있어요.','rationale':'값과 상황이 다른 두 요구를 바꿔 선택해 실제 연결을 비교해야 해요.','checks':['second'],'criteria_checks':['second']})
            plan['checks'].append(dict(plan['checks'][0],id='second',label='다른 값 2를 다시 읽기',files=['tests/second.py'],trace_expectation='second.expect.json',expected='조회한 값은 2여야 해요.',cases=[{'operation':'read-second','situation':'두 번째 파일에 저장한 대조값을 읽어요.','expected':'다른 요구의 실제 조회값은 2여야 해요.'}],argv=[sys.executable,'-c',f'import sys;sys.path.insert(0,{str(Path(__file__).resolve().parents[2])!r});exec(open("tests/second.py").read())']))
            plan['collaboration']['human_checks'].append({'requirement':'R2','action':'두 번째 요구의 대조값 관찰을 보고 첫 번째 요구와 구분해요.','expected':'실제 대조값 2가 보이고 초기값 1 관찰이 섞이지 않아야 해요.'})
        origin.write_text(json.dumps(plan))
        h=Harness(root,codex=fake_codex(root));h.init(origin)
        (root / 'src/counter.py').write_text('VALUE = 0\n' if kind=='failed' else 'VALUE = 1\n')
        h.implement('counter','R1','implemented',['src/counter.py'])
        if kind=='current':h.implement('counter','R2','implemented',['src/second.py'])
        h.checkpoint('counter','화면에서 실제 관측과 누락 상태를 대조해요.',['가짜 리뷰는 UI 상태 fixture이며 실제 독립 검토가 아님'])
        if kind!='missing': h.run('counter')
        if kind in ['current','criteria-missing','decision-pending']:
            if kind=='current':
                (root/'review_behavior.json').write_text(json.dumps({'verdict':'fail','findings':['합성 이전 지적: 기대값이 다른 요구의 관찰을 구분해 검토해야 해요.']}))
                try:h.review('counter','criteria')
                except HarnessError:pass
                (root/'review_behavior.json').unlink()
            if kind!='criteria-missing':h.review('counter','criteria')
            h.review('counter')
        if kind=='criteria-failed':
            (root/'review_behavior.json').write_text(json.dumps({'verdict':'fail','findings':['합성 기준 지적: 잘못된 기대값을 재검토해야 해요.']}))
            try:h.review('counter','criteria')
            except HarnessError:pass
        if kind=='decision-pending':h.decision('counter','D1','보존 기간 정책은 사람이 결정해 주세요.')
        projects.append({'name':f'격리 fixture · {title}','rootPath':str(root)})
    return projects

if __name__=='__main__':print(json.dumps(prepare(sys.argv[1]),ensure_ascii=False))
