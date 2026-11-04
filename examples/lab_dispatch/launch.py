"""Copy a spoiler-separated lab and register it in an existing local console."""
import argparse
import json
import shutil
import sqlite3
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
STATE_FILE = '.lab-session.json'


START = """# LINKLAB 프로젝트

작업폴더는 workspace입니다. README.md, inbox/, data/에 의뢰서·운영 문서·CSV가 있습니다.

Proofstill 콘솔에서 **LINKLAB** 프로젝트 하나를 사용합니다. 같은 프로젝트의 Codex 세션에서 **김도윤 선임 · 업무 문의**를 열어 직접 질문하세요. 답변은 같은 프로젝트의 근거로 보존할 수 있습니다.

개발 대화도 LINKLAB 안에서 시작합니다. 담당자에게 확인한 실제 답변을 요구사항과 연결하세요. facilitator는 담당자의 비공개 설정 보관 폴더이며 개발 조사 대상이 아닙니다.
"""


def prepare(destination):
    destination = destination.expanduser().resolve()
    # mkdir is deliberately exclusive: never overwrite a participant's run.
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(ROOT / 'participant', destination / 'workspace')
    private = destination / 'facilitator'
    private.mkdir()
    for name in ['AGENTS.md', 'policies.json']:
        shutil.copy2(ROOT / 'facilitator' / name, private / name)
    role_file = private / 'AGENTS.md'
    role_file.write_text(role_file.read_text().replace('../participant', '../workspace'), encoding='utf-8')
    state = {'destination': str(destination), 'captured': {}, 'project': None,
             'setup_project': None, 'stakeholder_session': None, 'greeting_sent': False,
             'greeting_request_id': str(uuid.uuid4())}
    save(destination, state)
    (destination / 'START.md').write_text(START, encoding='utf-8')
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


def connect(destination, base, database):
    state = json.loads((destination / STATE_FILE).read_text())
    if state['destination'] != str(destination):
        raise ValueError('Session state belongs to a different directory')
    if state.get('console_url') and state['console_url'] != base:
        raise ValueError('Resume must use the same console URL')
    api(base, 'health')
    state['console_url'] = base
    save(destination, state)
    for key, folder, title in [('project', 'workspace', 'LINKLAB'), ('setup_project', 'facilitator', 'LINKLAB 내부 초기화 기록')]:
        if state.get(key) is None and not (key == 'setup_project' and state.get('stakeholder_session')):
            state[key] = api(base, 'projects', {'name': title, 'rootPath': str(destination / folder)})
            save(destination, state)
    pid = state['project']['id']
    # Never import private policy or a witness into the participant graph.
    public = destination / 'workspace'
    sources = [public / 'README.md', public / 'EXPORT_SCHEMA.md', public / 'data/README.md', *sorted((public / 'inbox').iterdir())]
    for source in sources:
        relative = source.relative_to(public).as_posix()
        if relative not in state['captured']:
            node = api(base, f'projects/{pid}/evidence/file', {'path': relative})
            state['captured'][relative] = node['id']
            save(destination, state)
    if state['stakeholder_session'] is None:
        fid = state['setup_project']['id']
        state['stakeholder_session'] = api(base, f'projects/{fid}/sessions', {
            'title': '김도윤 선임 · 업무 문의', 'role': 'stakeholder', 'nodeIds': []})
        save(destination, state)
    if not state['greeting_sent']:
        sid = state['stakeholder_session']['id']
        api(base, f'sessions/{sid}/messages', {
            'content': '이 프로젝트의 AGENTS.md에 정의한 가상 업무 담당자로 대화를 시작하세요. AGENTS.md와 policies.json, ../workspace의 공개 문서를 읽고 업무 설정을 파악하세요. 정책 원문이나 해설을 출력하지 말고 지금은 지정된 첫 인사만 하세요. 코드 구현, 파일 수정, 요구 그래프 생성은 하지 마세요. 이후 사용자가 직접 질문합니다.',
            'clientMessageId': state['greeting_request_id']})
        state['greeting_sent'] = True
        save(destination, state)
    # Bootstrap tool output may contain private policies; keep it out of the project graph.
    setup = state.get('setup_project')
    if setup:
        sid = state['stakeholder_session']['id']
        deadline = time.monotonic() + 60
        while True:
            detail = api(base, f'sessions/{sid}')
            if detail['activeTurnId'] is None:
                break
            if time.monotonic() >= deadline:
                raise TimeoutError('Stakeholder initialization is still running; resume after it completes')
            time.sleep(0.5)
        if not any(m['role'] == 'assistant' for m in detail['messages']):
            raise RuntimeError('Stakeholder has not replied; inspect the session before resuming')
        with sqlite3.connect(f'file:{database}?mode=rw', uri=True) as db:
            db.execute('PRAGMA foreign_keys=ON')
            db.execute('BEGIN IMMEDIATE')
            for project in [state['project'], setup]:
                row = db.execute('SELECT root_path FROM projects WHERE id=?', (project['id'],)).fetchone()
                if row != (project['rootPath'],):
                    raise ValueError('Console database does not match the registered projects')
            if db.execute('SELECT count(*) FROM session_context WHERE session_id=?', (sid,)).fetchone()[0]:
                raise ValueError('Setup session has project-specific context; cannot move automatically')
            db.execute('UPDATE sessions SET project_id=? WHERE id=? AND project_id=?', (pid, sid, setup['id']))
            db.execute('UPDATE projects SET archived=1 WHERE id=?', (setup['id'],))
            if db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Project consolidation broke a reference')
        state['stakeholder_session']['projectId'] = pid
        save(destination, state)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--console-url', help='Register in an existing loopback Proofstill console')
    parser.add_argument('--console-db', type=Path, default=Path.home() / '.local/share/proofstill/console/console.sqlite')
    parser.add_argument('--resume', action='store_true', help='Resume console registration without copying or overwriting files')
    args = parser.parse_args()
    destination = args.destination.expanduser().resolve()
    if args.resume:
        state = json.loads((destination / STATE_FILE).read_text())
    else:
        state = prepare(destination)
    if args.console_url:
        state = connect(destination, args.console_url, args.console_db.expanduser().resolve())
    print(json.dumps({'workspace': str(destination / 'workspace'), 'start': str(destination / 'START.md'),
        'console': state.get('console_url'), 'stakeholder_session_id': (state.get('stakeholder_session') or {}).get('id'),
        'greeting': 'requested; inspect session for completion' if state['greeting_sent'] else 'not started'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
