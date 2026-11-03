"""Prepare isolated real harness states; fake review plumbing is labelled fixture."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


def prepare(directory):
    projects = []
    for kind, title in [('current', '정상 근거'), ('failed', '검사 실패'), ('missing', '미실행'), ('criteria-failed', '기준 지적'), ('criteria-missing', '기준 미검토')]:
        root = (Path(directory) / kind).resolve(); root.mkdir()
        origin = make_plan(root)
        plan = json.loads(origin.read_text())
        plan.update(title=f'격리 fixture · {title}', required_reviews=['criteria'], context='화면 상태 전환 검사용 합성 fixture. 이 가짜 리뷰는 실제 기준 적절성 검토가 아니에요.')
        plan['requirements'][0].update(title=f'격리 fixture · {title}', risk='상태가 잘못 표시되면 미검증을 통과로 오해해요.', rationale='실제 실행 상태와 기준 검토를 분리해서 보여야 해요.', criteria_checks=['counter-unit'])
        (root / 'expect.json').write_text(json.dumps({'operations':['read'], 'assertions':[{'step':0,'field':'output','path':'/value','equals':1}]}))
        (root / 'tests/check.py').write_text('from pathlib import Path\nfrom proofstill.trace import Flow\nimport runpy\ndef read():\n    value=runpy.run_path("src/counter.py")["VALUE"]\n    assert value==1\n    return {"value":value,"summary":f"실제 초기값 {value}을 다시 읽었어요."}\nwith Flow("화면 fixture 조회") as flow:\n    flow.step("read","실제 카운터 읽기",read)\nprint("CHECK_EXECUTED")\n')
        plan['checks'][0].update(label='실제 초기값 다시 읽기', purpose='현재 파일에서 값을 조회해요.', rationale='성공 문구만으로 실제 값을 확인했다고 오해하지 않기 위해 필요해요.', expected='조회한 값은 1이어야 해요.', scope='격리 fixture의 값 조회만 확인해요. 제품 업무 규칙은 확인하지 않아요.', trace_expectation='expect.json', cases=[{'operation':'read','situation':'초기값이 저장된 파일을 다시 읽어요.','expected':'실제 조회값은 1이어야 해요.'}], argv=[sys.executable,'-c',f'import sys;sys.path.insert(0,{str(Path(__file__).resolve().parents[2])!r});exec(open("tests/check.py").read())'])
        origin.write_text(json.dumps(plan))
        h=Harness(root,codex=fake_codex(root));h.init(origin)
        (root / 'src/counter.py').write_text('VALUE = 0\n' if kind=='failed' else 'VALUE = 1\n')
        h.implement('counter','R1','implemented',['src/counter.py'])
        h.checkpoint('counter','화면에서 실제 관측과 누락 상태를 대조해요.',['가짜 리뷰는 UI 상태 fixture이며 실제 독립 검토가 아님'])
        if kind!='missing': h.run('counter')
        if kind in ['current','criteria-missing']:
            if kind=='current':h.review('counter','criteria')
            h.review('counter')
        if kind=='criteria-failed':
            (root/'review_behavior.json').write_text(json.dumps({'verdict':'fail','findings':['합성 기준 지적: 잘못된 기대값을 재검토해야 해요.']}))
            try:h.review('counter','criteria')
            except HarnessError:pass
        projects.append({'name':f'격리 fixture · {title}','rootPath':str(root)})
    return projects

if __name__=='__main__':print(json.dumps(prepare(sys.argv[1]),ensure_ascii=False))
