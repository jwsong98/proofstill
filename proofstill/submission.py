"""Capture declared deliverables and their evidence without overwriting the last verified snapshot."""
import hashlib
import io
import tarfile
import uuid
from pathlib import Path
from .contract import file_hash, inventory, project_path
from .execution import write_json


def capture(project):
    with project.lock():
        definition, state = project.load()
        status = project.status()
        h = project.h
        paths = list(definition['contracts'])
        for item in definition['work']:
            plan, task_state = h.load(item['feature']['id'])
            paths += h.source_paths(plan) + plan['context_files'] + [p for c in plan['checks'] for p in c['files']]
            paths += [a['path'] for a in plan['artifacts'] if a.get('path')]
        origin = Path(state['origin'])
        if origin.is_relative_to(h.root):
            paths.append(str(origin.relative_to(h.root)))
        before = inventory(h.root, paths)
        folder = project.folder / 'submissions' / uuid.uuid4().hex[:12]
        folder.mkdir(parents=True)
        archive = folder / 'submission.tar.gz'
        missing, excluded, copied = [], [], {}
        evidence = {}
        for item in definition['work']:
            evidence_root = h.folder(item['feature']['id'])
            for path in evidence_root.rglob('*'):
                if path.is_file() and path.name != '.lock':
                    evidence[str(path.relative_to(h.root))] = file_hash(path)
        with tarfile.open(archive, 'w:gz') as tar:
            def add(name, path):
                data = path.read_bytes()
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                entry.mode = 0o755 if path.stat().st_mode & 0o111 else 0o644
                tar.addfile(entry, io.BytesIO(data))
                return hashlib.sha256(data).hexdigest()
            for name, expected in before.items():
                if expected == 'directory':
                    continue
                if expected == 'missing':
                    missing.append(name)
                    continue
                if Path(name).name == '.env' or (Path(name).name.startswith('.env.') and Path(name).name != '.env.example'):
                    excluded.append(name)
                    continue
                copied[name] = add(name, project_path(h.root, name))
            for name in evidence:
                copied[name] = add(name, h.root / name)
        after = inventory(h.root, paths)
        expected_files = {k: v for k, v in before.items() if v not in ('directory', 'missing') and k not in excluded}
        unchanged = (before == after and all(copied.get(k) == v for k, v in {**expected_files, **evidence}.items())
                     and all(file_hash(h.root / k) == v for k, v in evidence.items()))
        now = project.status()
        result = {'status': 'verified' if status['submission_ready'] and now['submission_ready'] and unchanged and not missing and not excluded else 'partial',
                  'project': definition['id'], 'definition': definition, 'revision': state['revision'], 'archive': str(archive),
                  'archive_sha256': file_hash(archive), 'source_unchanged': unchanged, 'missing': missing, 'excluded': excluded,
                  'files': copied, 'verification': status, 'user_acceptance': 'unconfirmed',
                  'scope': '등록한 소스·검사·원문·필수 산출물과 실행 증거의 로컬 스냅샷. 등록 밖 파일과 실제 제출·사용자 수용은 별도.'}
        write_json(folder / 'manifest.json', result)
        # A partial/failed attempt never destroys the last verified submission.
        if result['status'] == 'verified':
            write_json(project.folder / 'last-verified.json', {'manifest': str(folder / 'manifest.json'), 'sha256': file_hash(folder / 'manifest.json')})
        return result
