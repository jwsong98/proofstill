import json
import sys
from pathlib import Path


def make_plan(root):
    (root / 'src').mkdir()
    (root / 'tests').mkdir()
    (root / 'src/counter.py').write_text('VALUE = 0\n')
    (root / 'tests/check.py').write_text(
        'import runpy\n'
        'value = runpy.run_path("src/counter.py")["VALUE"]\n'
        'assert value == 1, "EXPECTED_VALUE_ONE"\n'
        'print("CHECK_EXECUTED")\n'
    )
    plan = {
        'id': 'counter', 'title': '카운터 초기값',
        'intent': '새 카운터의 값은 1이다.',
        'context': '로컬 파일 기반 동작을 확인하는 합성 테스트 과제.',
        'sources': ['src/counter.py'],
        'collaboration': {
            'human': '값 요구와 최종 수용을 결정한다(합성 fixture).',
            'ai': '카운터 구현·검사·인계를 맡는다(합성 fixture).',
            'human_checks': [{'requirement': 'R1', 'action': 'tests/check.py를 직접 실행하고 값을 확인한다.',
                              'expected': '값 1, CHECK_EXECUTED 출력과 종료 코드 0.'}],
        },
        'requirements': [{'id': 'R1', 'text': '초기값은 1', 'checks': ['counter-unit']}],
        'checks': [{
            'id': 'counter-unit', 'kind': 'unit', 'module': 'counter',
            'argv': [sys.executable, 'tests/check.py'],
            'files': ['tests/check.py'],
            'red_pattern': 'AssertionError: EXPECTED_VALUE_ONE',
            'green_pattern': 'CHECK_EXECUTED', 'timeout': 5,
        }],
        'artifacts': [{'label': '구현', 'path': 'src/counter.py'}],
    }
    path = root / 'feature.json'
    path.write_text(json.dumps(plan, ensure_ascii=False))
    return path


def fake_codex(root):
    path = root / 'fake_codex.py'
    path.write_text('''#!/usr/bin/env python3
import json, os, sys, uuid
from pathlib import Path
root = Path(__file__).resolve().parent
prompt = json.loads(sys.stdin.read().split("PACKET_JSON\\n", 1)[1])
(root / "review_packet.json").write_text(json.dumps({"argv": sys.argv, "cwd": os.getcwd(), "packet": prompt}))
settings_path = root / "review_behavior.json"
s = json.loads(settings_path.read_text()) if settings_path.exists() else {}
if s.get("process_fail"):
    sys.exit(2)
checks = [{"id": r["id"], "status": "pass", "evidence": "MOCK_REVIEW: plumbing fixture only"} for r in prompt["plan"]["requirements"]]
if s.get("missing"):
    checks = []
if s.get("duplicate"):
    checks += checks[:1]
if s.get("unknown"):
    checks[0]["id"] = "unknown"
if s.get("empty_evidence"):
    checks[0]["evidence"] = ""
if s.get("unverified"):
    checks[0]["status"] = "unverified"
if s.get("mutate_snapshot"):
    (Path(prompt["project_root"]) / s.get("mutate_path", "tests/check.py")).write_text("# weakened oracle")
answer = {"verdict": s.get("verdict", "pass"), "checks": checks, "findings": s.get("findings", []), "limitations": []}
output = Path(sys.argv[sys.argv.index("--output-last-message") + 1])
output.write_text("not json" if s.get("invalid_json") else json.dumps(answer))
if not s.get("no_thread"):
    print(json.dumps({"type": "thread.started", "thread_id": s.get("thread_id", str(uuid.uuid4()))}))
''')
    path.chmod(0o755)
    return str(path)
