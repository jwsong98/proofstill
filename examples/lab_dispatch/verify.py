"""Independent fixture invariants and negative controls. Does not optimize schedules."""
import copy
import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def time(value):
    result = datetime.fromisoformat(value)
    assert result.utcoffset() == timedelta(hours=9), f'Invalid offset: {value}'
    assert result.second == 0 and result.microsecond == 0, f'Non-minute time: {value}'
    return result


def read_data():
    folder = ROOT / 'participant/data/provided'
    data = {}
    for path in sorted(folder.glob('*.csv')):
        with path.open(encoding='utf-8', newline='') as f:
            data[path.stem] = list(csv.DictReader(f))
    data['manifest'] = json.loads((folder / 'manifest.json').read_text())
    return data


def index(rows, key):
    result = {row[key]: row for row in rows}
    assert len(result) == len(rows), f'Duplicate {key}'
    return result


def check_inputs(data):
    sites = index(data['sites'], 'site_id')
    machines = index(data['machines'], 'machine_id')
    staff = index(data['staff'], 'staff_id')
    jobs = index(data['jobs'], 'job_id')
    manifest = data['manifest']
    assert manifest['service_date_from'] <= manifest['service_date_to']
    for machine in machines.values():
        assert machine['site_id'] in sites and machine['initial_family'] in 'ABC'
    capabilities = set()
    for row in data['capabilities']:
        key = row['machine_id'], row['family']
        assert key not in capabilities and key[0] in machines and key[1] in 'ABC'
        assert math.isfinite(float(row['duration_factor'])) and float(row['duration_factor']) > 0
        capabilities.add(key)
    changes = {(r['from_family'], r['to_family']): int(r['minutes']) for r in data['changeovers']}
    assert len(changes) == len(data['changeovers']) == 9
    assert set(changes) == {(a, b) for a in 'ABC' for b in 'ABC'}
    assert all(v >= 0 for v in changes.values())
    for job in jobs.values():
        assert job['site_id'] in sites, f'Unknown site: {job["job_id"]}'
        assert job['family'] in 'ABC' and int(job['nominal_minutes']) > 0
        assert job['status'] in ['READY', 'HOLD', 'CANCELLED']
        assert job['priority'] in ['RUSH', 'NORMAL']
        assert time(job['due_at']) >= time(job['release_at'])
        assert manifest['service_date_from'] <= job['service_date'] <= manifest['service_date_to']
        assert (time(job['release_at']) - timedelta(hours=6)).date().isoformat() == job['service_date']
        visited = {job['job_id']}
        current = job
        while current['predecessor_id']:
            pid = current['predecessor_id']
            assert pid in jobs and pid not in visited, 'Missing/cyclic predecessor'
            predecessor = jobs[pid]
            assert predecessor['site_id'] == job['site_id'] and predecessor['service_date'] == job['service_date']
            visited.add(pid)
            current = predecessor
    for table, field, objects in [('machine_windows', 'machine_id', machines), ('staff_windows', 'staff_id', staff)]:
        index(data[table], 'window_id')
        by_resource = defaultdict(list)
        for row in data[table]:
            assert row[field] in objects
            start, end = time(row['start_at']), time(row['end_at'])
            assert start < end
            by_resource[row[field]].append((start, end))
            if table == 'staff_windows':
                assert row['site_id'] in sites and set(row['families'].split('|')) <= set('ABC')
        for intervals in by_resource.values():
            intervals.sort()
            assert all(a[1] <= b[0] for a, b in zip(intervals, intervals[1:])), 'Overlapping windows'
    index(data['fixed_runs'], 'reservation_id')
    index(data['fixed_runs'], 'job_id')
    for row in data['fixed_runs']:
        assert row['job_id'] in jobs and jobs[row['job_id']]['status'] == 'READY'
        assert row['machine_id'] in machines and row['staff_id'] in staff
        assert machines[row['machine_id']]['site_id'] == jobs[row['job_id']]['site_id'], 'Fixed site mismatch'
        assert (row['machine_id'], jobs[row['job_id']]['family']) in capabilities, 'Fixed capability mismatch'
        assert time(row['setup_start']) < time(row['process_start']) < time(row['process_end'])
    index(data['history'], 'record_id')
    for row in data['history']:
        assert row['machine_id'] in machines and row['family'] in 'ABC'
        assert int(row['completed_jobs']) >= 0 and int(row['busy_minutes']) >= 0
    return jobs, machines


def violations(data, plan):
    jobs, machines = check_inputs(data)
    allocations = plan['allocations']
    errors = []
    def need(condition, code):
        if not condition:
            errors.append(code)
    period = plan.get('period', {'from': data['manifest']['service_date_from'], 'to': data['manifest']['service_date_to']})
    assert data['manifest']['service_date_from'] <= period['from'] <= period['to'] <= data['manifest']['service_date_to']
    target = {jid for jid, j in jobs.items() if j['status'] == 'READY' and period['from'] <= j['service_date'] <= period['to']}
    counts = Counter(a['job_id'] for a in allocations)
    need(set(counts) == target and all(n == 1 for n in counts.values()), 'COVERAGE')
    capabilities = {(r['machine_id'], r['family']): float(r['duration_factor']) for r in data['capabilities']}
    change = {(r['from_family'], r['to_family']): int(r['minutes']) for r in data['changeovers']}
    by_machine, by_staff = defaultdict(list), defaultdict(list)
    by_job = {a['job_id']: a for a in allocations}
    period_fixed = [r for r in data['fixed_runs'] if r['job_id'] in target]
    fixed_ids = {r['job_id'] for r in period_fixed}
    for a in allocations:
        if a['job_id'] not in jobs or a['machine_id'] not in machines:
            errors.append('REFERENCE')
            continue
        j, m = jobs[a['job_id']], machines[a['machine_id']]
        s, p, e = map(time, [a['setup_start'], a['process_start'], a['process_end']])
        need(s < p < e, 'TIME_ORDER')
        need(m['site_id'] == j['site_id'], 'SITE')
        need(s >= time(j['release_at']), 'RELEASE')
        factor = capabilities.get((a['machine_id'], j['family']))
        need(factor is not None, 'CAPABILITY')
        if factor is not None:
            need(e - p == timedelta(minutes=math.ceil(int(j['nominal_minutes']) * factor)), 'DURATION')
        if j['priority'] == 'RUSH':
            need(e <= time(j['due_at']), 'RUSH_DUE')
        need(any(w['machine_id'] == a['machine_id'] and time(w['start_at']) <= s and e <= time(w['end_at'])
                 for w in data['machine_windows']), 'MACHINE_WINDOW')
        need(any(w['staff_id'] == a['staff_id'] and w['site_id'] == j['site_id'] and j['family'] in w['families'].split('|')
                 and time(w['start_at']) <= s and p <= time(w['end_at']) for w in data['staff_windows']), 'STAFF_WINDOW')
        if j['predecessor_id']:
            predecessor = by_job.get(j['predecessor_id'])
            need(predecessor is not None and s >= time(predecessor['process_end']) + timedelta(minutes=10), 'PREDECESSOR')
        need(a['fixed'] == (a['job_id'] in fixed_ids), 'FIXED_FLAG')
        by_machine[a['machine_id']].append((s, p, e, j['family']))
        by_staff[a['staff_id']].append((s, p))
    for mid, rows in by_machine.items():
        rows.sort()
        previous_family = machines[mid]['initial_family']
        previous_end = None
        for s, p, e, family in rows:
            need(previous_end is None or s >= previous_end, 'MACHINE_OVERLAP')
            need(p - s == timedelta(minutes=change[previous_family, family] + 5 + plan['setup_buffer_minutes']), 'SETUP')
            previous_family, previous_end = family, e
    for rows in by_staff.values():
        rows.sort()
        need(all(a[1] <= b[0] for a, b in zip(rows, rows[1:])), 'STAFF_OVERLAP')
    for fixed in period_fixed:
        actual = by_job.get(fixed['job_id'])
        need(actual is not None and all(actual[k] == v for k, v in fixed.items() if k != 'reservation_id'), 'FIXED')
    return sorted(set(errors))


def main():
    data = read_data()
    plan = json.loads((ROOT / 'facilitator/witness.json').read_text())
    assert not violations(data, plan), violations(data, plan)
    controls = []
    def reject(label, expected, modify, input_change=False):
        d, p = copy.deepcopy(data), copy.deepcopy(plan)
        modify(d, p)
        if input_change:
            try:
                check_inputs(d)
            except AssertionError:
                controls.append(label)
                return
            raise AssertionError(f'Input mutation accepted: {label}')
        found = violations(d, p)
        assert expected in found, (label, expected, found)
        controls.append(label)
    reject('missing assignment', 'COVERAGE', lambda d, p: p['allocations'].pop())
    reject('duplicate assignment', 'COVERAGE', lambda d, p: p['allocations'].append(dict(p['allocations'][0])))
    reject('unknown site', None, lambda d, p: d['jobs'][10].update(site_id='SITE-X'), True)
    reject('cyclic predecessor', None, lambda d, p: d['jobs'][0].update(predecessor_id=d['jobs'][0]['job_id']), True)
    reject('wrong service day', None, lambda d, p: d['jobs'][5].update(service_date='2026-11-10'), True)
    reject('rush impossible', 'RUSH_DUE', lambda d, p: d['jobs'][1].update(due_at=d['jobs'][1]['release_at']))
    reject('hold still allocated', 'COVERAGE', lambda d, p: d['jobs'][9].update(status='HOLD'))
    reject('new buffer conflicts with fixed', 'SETUP', lambda d, p: p.update(setup_buffer_minutes=15))
    reject('fixed moved', 'FIXED', lambda d, p: p['allocations'][0].update(staff_id='T-S'))
    reject('duration shortened', 'DURATION', lambda d, p: p['allocations'][1].update(process_end=p['allocations'][1]['process_start']))
    reject('before release', 'RELEASE', lambda d, p: p['allocations'][1].update(setup_start='2026-11-09T09:59+09:00'))
    reject('maintenance window', 'MACHINE_WINDOW', lambda d, p: d['machine_windows'][0].update(start_at='2026-11-09T08:30+09:00'))
    reject('staff qualification', 'STAFF_WINDOW', lambda d, p: d['staff_windows'][0].update(families='C'))
    reject('wrong directional setup', 'SETUP', lambda d, p: d['changeovers'][1].update(minutes='20'))
    reject('predecessor handoff', 'PREDECESSOR', lambda d, p: d['jobs'][3].update(predecessor_id=d['jobs'][5]['job_id']))
    # Set the second device's first preparation to the same time as the first device.
    reject('shared staff overlap', 'STAFF_OVERLAP', lambda d, p: p['allocations'][22].update(setup_start=p['allocations'][0]['setup_start'], process_start=p['allocations'][0]['process_start']))
    reject('same machine overlap', 'MACHINE_OVERLAP', lambda d, p: p['allocations'][1].update(setup_start=p['allocations'][0]['setup_start']))
    overnight = sum(time(j['release_at']).date().isoformat() != j['service_date'] for j in data['jobs'])
    # Ensure the mutation brief references the intended rows rather than stale IDs.
    assert data['jobs'][9]['job_id'] == 'J0010' and data['jobs'][9]['status'] == 'READY'
    assert not any(j['predecessor_id'] == 'J0010' for j in data['jobs'])
    assert overnight == 16
    # A one-day plan starts from initial_family, including on the second day.
    partial = copy.deepcopy(plan)
    partial['period'] = {'from': '2026-11-10', 'to': '2026-11-10'}
    jobs = index(data['jobs'], 'job_id')
    partial['allocations'] = [a for a in partial['allocations'] if jobs[a['job_id']]['service_date'] == '2026-11-10']
    # M2 ended the previous day with C; its independent initial state is B.
    for a in partial['allocations']:
        if a['machine_id'].endswith('2') and jobs[a['job_id']]['release_at'].endswith('09:00+09:00'):
            a['process_start'] = (time(a['setup_start']) + timedelta(minutes=25)).isoformat(timespec='minutes')
            a['process_end'] = (time(a['process_start']) + timedelta(minutes=38)).isoformat(timespec='minutes')
    assert not violations(data, partial), violations(data, partial)
    invalid_partial = copy.deepcopy(partial)
    invalid_partial['allocations'].append(plan['allocations'][0])
    assert 'COVERAGE' in violations(data, invalid_partial)
    print(json.dumps({'result': 'PASS', 'jobs': len(data['jobs']), 'ready': len(plan['allocations']),
        'overnight_jobs': overnight, 'negative_controls': len(controls) + 1, 'partial_period': 'PASS', 'controls': controls}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
