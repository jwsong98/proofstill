"""Copy a spoiler-separated lab and register it in an existing local console."""
import argparse
import json
import shutil
import uuid
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
STATE_FILE = '.lab-session.json'


def prepare(destination):
    destination = destination.expanduser().resolve()
    # mkdir is deliberately exclusive: never overwrite a participant's run.
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(ROOT / 'participant', destination / 'participant')
    private = destination / 'facilitator'
    private.mkdir()
    for name in ['AGENTS.md', 'policies.json']:
        shutil.copy2(ROOT / 'facilitator' / name, private / name)
    state = {'destination': str(destination), 'captured': {}, 'participant_project': None,
             'facilitator_project': None, 'stakeholder_session': None, 'greeting_sent': False,
             'greeting_request_id': str(uuid.uuid4())}
    save(destination, state)
    (destination / 'START.md').write_text('''# LINKLAB 실험 시작

1. participant/README.md를 읽고 participant/inbox와 data의 자료를 살펴보세요.
2. Proofstill 콘솔의 “LINKLAB · 참가자” 프로젝트에는 제공 문서 원문만 가져와 있습니다. 아직 요구 해석이나 구현을 대신 진행하지 않았습니다.
3. “LINKLAB · 담당자” 프로젝트 → Codex 세션 → “김도윤 선임 · 업무 문의”에서 직접 질문하세요.
4. 담당자 답변을 참가자 프로젝트의 요구 근거로 남기세요. 프로젝트가 분리되어 있으므로 답변을 직접 옮길 때 담당자·메시지 시각·원문을 함께 기록합니다. 자동 동기화되지 않습니다.
5. 정책이 정리되면 참가자 프로젝트에서 구현을 시작하고, 하네스 검사·현황·인계 기능을 사용합니다. 이 연습의 결과를 실제 시험 규정이나 정답으로 해석하지 마세요.

연습 중 facilitator 폴더는 열지 마세요. 참가자 작업폴더는 participant만 지정합니다. 폴더 분리는 스포일러 방지이며 OS 보안 격리는 아닙니다.

다시 시작하려면 새 이름의 디렉터리로 launch.py를 실행합니다. 기존 실험은 덮어쓰지 않습니다.
''', encoding='utf-8')
    return state


def save(destination, state):
    (destination / STATE_FILE).write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def api(base, path, payload=None):
    parsed = urlparse(base)
    if parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost', '::1'} or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Only a local HTTP Proofstill console URL is supported')
    raw = None if payload is None else json.dumps(payload).encode()
    request = Request(base.rstrip('/') + '/api/' + path, raw, {'Content-Type': 'application/json'})
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def connect(destination, base):
    state = json.loads((destination / STATE_FILE).read_text())
    if state['destination'] != str(destination):
        raise ValueError('Session state belongs to a different directory')
    if state.get('console_url') and state['console_url'] != base:
        raise ValueError('Resume must use the same console URL')
    api(base, 'health')
    state['console_url'] = base
    save(destination, state)
    for role, title in [('participant', 'LINKLAB · 참가자'), ('facilitator', 'LINKLAB · 담당자')]:
        key = role + '_project'
        if state[key] is None:
            state[key] = api(base, 'projects', {'name': title, 'rootPath': str(destination / role)})
            save(destination, state)
    pid = state['participant_project']['id']
    # Never import private policy or a witness into the participant graph.
    public = destination / 'participant'
    sources = [public / 'README.md', public / 'EXPORT_SCHEMA.md', public / 'data/README.md', *sorted((public / 'inbox').iterdir())]
    for source in sources:
        relative = source.relative_to(public).as_posix()
        if relative not in state['captured']:
            node = api(base, f'projects/{pid}/evidence/file', {'path': relative})
            state['captured'][relative] = node['id']
            save(destination, state)
    if state['stakeholder_session'] is None:
        fid = state['facilitator_project']['id']
        state['stakeholder_session'] = api(base, f'projects/{fid}/sessions', {
            'title': '김도윤 선임 · 업무 문의', 'role': 'stakeholder', 'nodeIds': []})
        save(destination, state)
    if not state['greeting_sent']:
        sid = state['stakeholder_session']['id']
        api(base, f'sessions/{sid}/messages', {
            'content': '이 프로젝트의 AGENTS.md에 정의한 가상 업무 담당자로 대화를 시작하세요. AGENTS.md와 policies.json, ../participant의 공개 문서를 읽고 업무 설정을 파악하세요. 정책 원문이나 해설을 출력하지 말고 지금은 지정된 첫 인사만 하세요. 코드 구현, 파일 수정, 요구 그래프 생성은 하지 마세요. 이후 사용자가 직접 질문합니다.',
            'clientMessageId': state['greeting_request_id']})
        state['greeting_sent'] = True
        save(destination, state)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--console-url', help='Register in an existing loopback Proofstill console')
    parser.add_argument('--resume', action='store_true', help='Resume console registration without copying or overwriting files')
    args = parser.parse_args()
    destination = args.destination.expanduser().resolve()
    if args.resume:
        state = json.loads((destination / STATE_FILE).read_text())
    else:
        state = prepare(destination)
    if args.console_url:
        state = connect(destination, args.console_url)
    print(json.dumps({'participant': str(destination / 'participant'), 'start': str(destination / 'START.md'),
        'console': state.get('console_url'), 'stakeholder_session_id': (state.get('stakeholder_session') or {}).get('id'),
        'greeting': 'requested; inspect session for completion' if state['greeting_sent'] else 'not started'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
