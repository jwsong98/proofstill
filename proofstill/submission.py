"""Record a Git commit and evidence locations; never duplicate project files."""
from pathlib import Path
import uuid
from .contract import git_version
from .execution import write_json


def capture(project):
    with project.lock():
        definition, state = project.load()
        status = project.status()
        h = project.h
        paths = list(definition['contracts'])
        evidence = []
        for item in definition['work']:
            plan, _ = h.load(item['feature']['id'])
            paths += h.source_paths(plan) + plan['context_files'] + [p for c in plan['checks'] for p in c['files']]
            paths += [a['path'] for a in plan['artifacts'] if a.get('path')]
            evidence.append(str(h.folder(item['feature']['id'])))
        origin = Path(state['origin'])
        if origin.is_relative_to(h.root):
            paths.append(str(origin.relative_to(h.root)))
        version = git_version(h.root, paths)
        folder = project.folder / 'submissions' / uuid.uuid4().hex[:12]
        folder.mkdir(parents=True)
        result = {
            'status': 'recorded',
            'project': definition['id'], 'git': version, 'evidence_paths': evidence,
            'verification': status, 'user_acceptance': 'unconfirmed',
            'scope': 'Git 커밋과 현재 프로젝트의 실행 근거 경로 참조. 파일 복사·압축·자체 소스 해시 없음. 실제 제출·사용자 수용은 별도.',
        }
        write_json(folder / 'manifest.json', result)
        return result
