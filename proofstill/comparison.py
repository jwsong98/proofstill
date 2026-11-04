"""Run baseline/candidate implementations on identical cases with a separate validator."""
import json
import math
import time
import uuid
from .contract import HarnessError, digest, inventory, project_path, read_json, require
from .execution import write_json
from .project import identifier


def compare(project, name):
    definition, _ = project.load()
    spec = next((s for s in definition.get('comparisons', []) if s.get('id') == name), None)
    require(spec is not None, '알 수 없는 비교 사례 묶음')
    identifier(name)
    h = project.h
    cases = read_json(project_path(h.root, spec['cases']))
    require(isinstance(cases, list) and cases, '비교할 입력 사례가 필요합니다')
    ids = [identifier(c.get('id')) for c in cases]
    require(len(set(ids)) == len(ids) and all('input' in c for c in cases), '사례 ID 중복 또는 입력 누락')
    candidates = spec.get('candidates', [])
    require(isinstance(candidates, list) and len(candidates) >= 2, '기준 구현과 비교 구현이 필요합니다')
    candidate_ids = [identifier(c.get('id')) for c in candidates]
    require(len(set(candidate_ids)) == len(candidate_ids), '중복 비교 구현 ID')
    validator = spec.get('validator')
    require(isinstance(validator, dict), '독립 결과 검사 명령이 필요합니다')
    paths = [spec['cases'], *definition['contracts']]
    for command in [*candidates, validator]:
        require(isinstance(command.get('argv'), list) and command['argv'] and all(isinstance(v, str) for v in command['argv']), '비교 명령 argv가 필요합니다')
        require(isinstance(command.get('sources'), list) and command['sources'], '비교 구현/검사 소스 경로가 필요합니다')
        paths.extend(command['sources'])
    before = inventory(h.root, paths)
    require(all(v != 'missing' for v in before.values()), '비교 입력/구현 파일이 없습니다')
    timeout = spec.get('timeout', 10)
    require(type(timeout) in (int, float) and 0 < timeout <= 300, '비교 명령 제한은 0~300초입니다')
    folder = project.folder / 'comparisons' / (name + '-' + uuid.uuid4().hex[:12])
    folder.mkdir(parents=True)
    write_json(folder / 'inputs.json', {'spec': spec, 'cases': cases, 'manifest': before})
    rows = []
    def execute(command, payload, label):
        started = time.monotonic()
        run = h.execute(command['argv'], timeout, input_text=json.dumps(payload, ensure_ascii=False))
        run['elapsed_seconds'] = round(time.monotonic() - started, 4)
        write_json(folder / (label + '.json'), run)
        require(run['exit_code'] == 0 and not run['timed_out'], f'{label}: 실행 실패/중단')
        return json.loads(run['stdout']), run['elapsed_seconds']
    for case in cases:
        for candidate in candidates:
            label = case['id'] + '/' + candidate['id']
            row = {'case': case['id'], 'candidate': candidate['id'], 'input_hash': digest(case['input'])}
            try:
                output, elapsed = execute(candidate, case['input'], label + '/command')
                judged, _ = execute(validator, {'case': case, 'output': output}, label + '/validation')
                require(isinstance(judged, dict) and type(judged.get('valid')) is bool, '검사 결과에 valid boolean이 필요합니다')
                metrics = judged.get('metrics', {})
                require(isinstance(metrics, dict) and all(type(v) in (int, float) and math.isfinite(v) for v in metrics.values()), '비교 지표는 유한 수치여야 합니다')
                row.update(status='valid' if judged['valid'] else 'invalid', metrics=metrics,
                           violations=judged.get('violations', []), elapsed_seconds=elapsed)
            except (HarnessError, ValueError, KeyError, TypeError, RuntimeError) as error:
                row.update(status='error', error=str(error))
            rows.append(row)
    current = before == inventory(h.root, paths)
    result = {'id': name, 'evidence': str(folder), 'source_unchanged': current, 'rows': rows,
              'comparable': current and all(row['status'] != 'error' for row in rows),
              'note': '같은 입력의 실제 출력과 별도 검사 결과입니다. invalid는 우수한 지표로 상쇄하지 않습니다. 전체 최적성이나 제품 수용을 뜻하지 않습니다.'}
    write_json(folder / 'result.json', result)
    return result
