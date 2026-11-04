"""Compose independent product and logic work around explicit shared contracts."""
import fcntl
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from .contract import HarnessError, digest, inventory, project_path, read_json, require, validate_plan
from .execution import write_json
from .handoff import snapshot


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', value), '잘못된 프로젝트/작업 ID')
    return value


def overlaps(a, b):
    a, b = Path(a), Path(b)
    return a == b or a in b.parents or b in a.parents


def validate(h, value):
    require(isinstance(value, dict), '프로젝트 정의는 객체여야 합니다')
    identifier(value.get('id'))
    for field in ['title', 'intent']:
        require(isinstance(value.get(field), str) and value[field].strip(), f'{field}가 필요합니다')
    require(isinstance(value.get('contracts'), list) and value['contracts'], '공유 입출력 계약 파일이 필요합니다')
    for path in value['contracts']:
        require(project_path(h.root, path).is_file(), f'공유 계약 없음: {path}')
    work = value.get('work')
    require(isinstance(work, list) and work, '제품/로직 작업이 필요합니다')
    ids = [identifier(item.get('id')) for item in work]
    require(len(ids) == len(set(ids)), '중복 작업 ID')
    owners = []
    for item in work:
        require(item.get('kind') in ['product', 'logic', 'integration'], '작업 kind는 product/logic/integration')
        require(isinstance(item.get('owns'), list) and item['owns'], '작업별 쓰기 경계 owns가 필요합니다')
        for path in item['owns']:
            resolved = project_path(h.root, path)
            require(resolved != h.root, '전체 프로젝트를 한 작업의 쓰기 경계로 지정할 수 없습니다')
            normalized = str(resolved.relative_to(h.root))
            for owner, other in owners:
                require(owner == item['id'] or not overlaps(normalized, other), f'쓰기 경계 충돌: {owner}/{item["id"]}: {path}')
            owners.append((item['id'], normalized))
        deps = item.get('depends_on', [])
        require(isinstance(deps, list) and all(d in ids and d != item['id'] for d in deps), '잘못된 의존 작업')
        item['depends_on'] = deps
        feature = item.get('feature')
        require(isinstance(feature, dict), '작업 feature 정의가 필요합니다')
        feature['id'] = identifier(value['id'] + '-' + item['id'])
        feature.setdefault('intent', value['intent'])
        feature.setdefault('context', '공유 계약을 보존하며 작업 경계 안에서 구현한다.')
        feature['context_files'] = list(dict.fromkeys([*value['contracts'], *feature.get('context_files', [])]))
        validate_plan(h.root, feature, check_files=False)
    for contract in value['contracts']:
        require(any(overlaps(path, contract) and (Path(path) == Path(contract) or Path(path) in Path(contract).parents) for _, path in owners),
                f'공유 계약을 수정할 단일 소유 작업이 필요합니다: {contract}')
    visiting, done = set(), set()
    by_id = {item['id']: item for item in work}
    def visit(key):
        require(key not in visiting, '작업 의존성이 순환합니다')
        if key in done:
            return
        visiting.add(key)
        for dependency in by_id[key]['depends_on']:
            visit(dependency)
        visiting.remove(key)
        done.add(key)
    for key in ids:
        visit(key)
    return value


class Project:
    def __init__(self, h, project):
        self.h = h
        self.folder = h.root / '.proofstill/projects' / identifier(project)

    @contextmanager
    def lock(self):
        self.folder.mkdir(parents=True, exist_ok=True)
        with (self.folder / '.lock').open('a') as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            yield

    @classmethod
    def create(cls, h, path, *, reason='', source=''):
        value = validate(h, read_json(path))
        project = cls(h, value['id'])
        with project.lock():
            stored = project.folder / 'project.json'
            state_path = project.folder / 'state.json'
            state = read_json(state_path) if state_path.exists() else {'claims': {}, 'revision': 0}
            if stored.exists():
                require(reason.strip() and source.strip(), '프로젝트 변경에는 이유와 실제 출처가 필요합니다')
                prior = read_json(stored)
                require(not state['claims'], '작업 소유자가 작업을 마친 뒤 프로젝트 구성을 갱신하세요')
                require({i['id'] for i in prior['work']} <= {i['id'] for i in value['work']}, '진행/증거가 있는 작업을 삭제할 수 없습니다')
                write_json(project.folder / 'revisions' / f'{state["revision"]}.json', prior)
            # Validate the entire definition before applying any feature revision.
            for item in value['work']:
                feature = item['feature']
                target = project.folder / 'definitions' / f'{item["id"]}.json'
                if h.folder(feature['id']).exists():
                    previous, _ = h.load(feature['id'])
                    if digest(previous) == digest(feature):
                        continue
                    require(reason.strip() and source.strip(), '기존 기능 갱신에는 변경 근거가 필요합니다')
                    write_json(target, feature)
                    h.revise(feature['id'], target, reason, source)
                else:
                    write_json(target, feature)
                    # Tests may be authored concurrently after the contract is fixed.
                    h.init(target, check_files=False)
            state.update(revision=state['revision'] + 1, origin=str(Path(path).resolve()),
                         origin_digest=digest(read_json(path)), definition_digest=digest(value), reason=reason, source=source)
            write_json(stored, value)
            write_json(state_path, state)
        return project

    def load(self):
        value, state = read_json(self.folder / 'project.json'), read_json(self.folder / 'state.json')
        require(digest(value) == state['definition_digest'], '보관된 프로젝트 정의가 변경됐습니다')
        require(digest(read_json(state['origin'])) == state['origin_digest'], '프로젝트 정의가 변경됐습니다. project sync로 변경 근거를 기록하세요')
        return value, state

    def item(self, name):
        value, _ = self.load()
        found = next((item for item in value['work'] if item['id'] == name), None)
        require(found is not None, '알 수 없는 작업 ID')
        return found

    def dependencies(self, item):
        result = {}
        for name in item['depends_on']:
            dependency = self.item(name)
            require(self.green(dependency), f'의존 작업의 현재 검사가 필요합니다: {name}')
            plan, state = self.h.load(dependency['feature']['id'])
            result[name] = {'criteria': self.h.criteria_digest(plan, state), 'source': self.h.source_digest(plan)}
        return result

    def green(self, item):
        try:
            plan, state = self.h.load(item['feature']['id'])
            require(state.get('project_dependencies', {}) == self.dependencies(item), '의존 작업이 변경됐습니다')
            self.h.green_ready(plan, state)
            return True
        except (HarnessError, OSError):
            return False

    def status(self):
        value, state = self.load()
        greens = {item['id']: self.green(item) for item in value['work']}
        rows = []
        for item in value['work']:
            feature = item['feature']['id']
            _, task_state = self.h.load(feature)
            pending = {k: v for k, v in task_state.get('decisions', {}).items() if not v.get('answer')}
            deps = [d for d in item['depends_on'] if not greens[d]]
            rows.append({'id': item['id'], 'feature': feature, 'kind': item['kind'],
                'owner': state['claims'].get(item['id']), 'blocked_by': deps, 'questions': pending,
                'ready': not deps and not pending, 'green': greens[item['id']],
                'verification': self.h.status(feature)})
        return {'id': value['id'], 'revision': state['revision'], 'work': rows,
                'submission_ready': not state['claims'] and all(row['green'] and row['verification']['complete'] for row in rows),
                'user_acceptance': 'unconfirmed'}

    def packet(self, name):
        item = self.item(name)
        value, _ = self.load()
        rows = snapshot(self.h, item['feature']['id'])
        return {'project': value['id'], 'intent': value['intent'], 'work': name, 'kind': item['kind'],
                'write_paths': item['owns'], 'contracts': inventory(self.h.root, value['contracts']),
                'feature': self.h.load(item['feature']['id'])[0],
                'state': next(row for row in self.status()['work'] if row['id'] == name),
                'requirements': [{k: row[k] for k in ['requirementId', 'description', 'implementation', 'issues', 'pendingDecisions']} for row in rows],
                'instructions': '공통 입출력 계약을 지키며 담당 경로만 수정한다. 제품은 입력→처리→저장→조회 흐름을 먼저 연결한다. 로직 작업은 같은 계약에 구현과 경계/부정 사례를 보강한다. 미정 해석은 관찰한 입력·결과 차이와 함께 question에 기록하고 영향 없는 작업은 계속한다. 실제 답변과 출처로만 해소한다. 관련 검사 후 작은 커밋을 남기고 공유 index의 stage/commit은 직렬화한다. 구현 선언은 검증·수용이 아니다.'}

    def claim(self, name, owner, *, release=False):
        require(isinstance(owner, str) and owner.strip(), '작업자/세션 ID가 필요합니다')
        self.item(name)
        with self.lock():
            _, state = self.load()
            current = state['claims'].get(name)
            require(current is None or current == owner, f'다른 작업자가 사용 중: {current}')
            if release:
                state['claims'].pop(name, None)
            else:
                row = next(r for r in self.status()['work'] if r['id'] == name)
                require(row['ready'], '의존 작업/질문 대기 상태입니다')
                state['claims'][name] = owner
            write_json(self.folder / 'state.json', state)
        return self.packet(name)

    def question(self, name, key, question, answer='', source=''):
        item = self.item(name)
        return self.h.decision(item['feature']['id'], key, question, answer, source)

    def run(self, *, jobs=2):
        require(type(jobs) is int and 1 <= jobs <= 8, 'jobs는 1~8 정수입니다')
        value, _ = self.load()
        pending = {item['id']: item for item in value['work']}
        results = {}
        def execute(item):
            try:
                self.h.bind_dependencies(item['feature']['id'], self.dependencies(item))
                runs = self.h.run(item['feature']['id'], reuse=True)
                return {'passed': all(r['accepted'] for r in runs),
                        'checks': [{'id': r['check'], 'accepted': r['accepted'], 'reused': r.get('reused', False), 'receipt': r['receipt']} for r in runs]}
            except (HarnessError, OSError) as error:
                return {'passed': False, 'error': str(error)}
        with ThreadPoolExecutor(max_workers=jobs) as pool:
            while pending:
                status = {row['id']: row for row in self.status()['work']}
                ready = [item for key, item in pending.items() if status[key]['ready'] and not status[key]['owner']]
                if not ready:
                    break
                futures = {item['id']: pool.submit(execute, item) for item in ready}
                for key, future in futures.items():
                    results[key] = future.result()
                    pending.pop(key)
        return {'work': results, 'blocked': list(pending), 'status': self.status()}

    def requirements(self):
        from .handoff import markdown
        value, _ = self.load()
        return '\n\n'.join(markdown(snapshot(self.h, item['feature']['id'])) for item in value['work'])
