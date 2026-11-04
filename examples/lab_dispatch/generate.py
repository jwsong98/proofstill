"""Reproducible synthetic inputs and a private feasibility witness, not a solver."""
import csv
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'participant/data/provided'
TZ = timezone(timedelta(hours=9))
CHANGE = {('A', 'A'): 0, ('A', 'B'): 25, ('A', 'C'): 40,
          ('B', 'A'): 20, ('B', 'B'): 0, ('B', 'C'): 15,
          ('C', 'A'): 35, ('C', 'B'): 10, ('C', 'C'): 0}


def stamp(day, minutes):
    return (datetime(2026, 11, 9, tzinfo=TZ) + timedelta(days=day, minutes=minutes)).isoformat(timespec='minutes')


def write(name, fields, rows, folder=DATA):
    with (folder / name).open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def generate():
    DATA.mkdir(parents=True, exist_ok=True)
    tables = {name: [] for name in ['sites', 'machines', 'capabilities', 'jobs', 'changeovers',
                                   'machine_windows', 'staff_windows', 'fixed_runs', 'history', 'staff']}
    allocations = []
    for site in ['N', 'S']:
        sid, staff = f'SITE-{site}', f'T-{site}'
        tables['sites'].append(dict(site_id=sid, name={'N': '북부 시험실', 'S': '남부 시험실'}[site]))
        tables['staff'].append(dict(staff_id=staff, display_name=f'준비담당-{site}'))
        for day in range(4):
            for w, (begin, end) in enumerate([(480, 1080), (1200, 1620)]):
                tables['staff_windows'].append(dict(window_id=f'SW-{site}-{day}-{w}', staff_id=staff,
                    site_id=sid, families='A|B|C', start_at=stamp(day, begin), end_at=stamp(day, end)))
        for mi in [1, 2]:
            mid = f'M-{site}{mi}'
            tables['machines'].append(dict(machine_id=mid, site_id=sid, name=f'{site} 시험기 {mi}', initial_family='B'))
            families = ['A', 'B'] if mi == 1 else ['A', 'B', 'C']
            for family in families:
                tables['capabilities'].append(dict(machine_id=mid, family=family, duration_factor='1.25' if mi == 2 else '1'))
            previous_family = 'B'
            for day in range(4):
                for w, (begin, end) in enumerate([(480, 1080), (1200, 1620)]):
                    tables['machine_windows'].append(dict(window_id=f'MW-{mid}-{day}-{w}', machine_id=mid,
                        start_at=stamp(day, begin), end_at=stamp(day, end)))
                prior_id = ''
                for j, start in enumerate([480, 600, 720, 840, 1260, 1440]):
                    start += (mi - 1) * 60
                    family = (['A', 'B', 'A', 'B', 'A', 'B'] if mi == 1 else ['A', 'C', 'B', 'A', 'B', 'C'])[j]
                    status = 'HOLD' if day == 1 and j == 4 else 'CANCELLED' if day == 2 and j == 4 else 'READY'
                    jid = f'J{len(tables["jobs"]) + 1:04d}'
                    duration = 30 + (j % 3) * 7
                    setup = CHANGE[previous_family, family] + 5
                    process_start = start + setup
                    process_end = process_start + math.ceil(duration * (1.25 if mi == 2 else 1))
                    tables['jobs'].append(dict(job_id=jid, requester_id=f'U-{site}-{j % 3 + 1}', site_id=sid,
                        service_date=stamp(day, 0)[:10], family=family, nominal_minutes=duration,
                        release_at=stamp(day, start), due_at=stamp(day, start + (40 if j == 2 else 110)),
                        priority='RUSH' if j in [0, 1, 5] else 'NORMAL', status=status,
                        predecessor_id=prior_id if j == 3 else ''))
                    prior_id = jid
                    if status != 'READY':
                        continue
                    allocation = dict(job_id=jid, machine_id=mid, staff_id=staff,
                        setup_start=stamp(day, start), process_start=stamp(day, process_start),
                        process_end=stamp(day, process_end), fixed=mi == 1 and j == 0)
                    allocations.append(allocation)
                    if allocation['fixed']:
                        tables['fixed_runs'].append(dict(reservation_id=f'FIX-{jid}', **{k: v for k, v in allocation.items() if k != 'fixed'}))
                    previous_family = family
            for d in range(3):
                tables['history'].append(dict(record_id=f'H-{mid}-{d}', service_date=f'2026-11-0{4+d}',
                    machine_id=mid, family='A', completed_jobs=3+d, busy_minutes=100+d*30))
    tables['changeovers'] = [dict(from_family=a, to_family=b, minutes=m) for (a, b), m in CHANGE.items()]
    for name, rows in tables.items():
        write(name + '.csv', list(rows[0]), rows)
    (DATA / 'manifest.json').write_text(json.dumps(dict(dataset_id='provided', revision='1',
        service_date_from='2026-11-09', service_date_to='2026-11-12', timezone='Asia/Seoul'), indent=2) + '\n')
    private = ROOT / 'facilitator/witness.json'
    private.write_text(json.dumps(dict(setup_buffer_minutes=0, allocations=allocations), indent=2) + '\n')
    bottleneck(tables)
    print(json.dumps({name: len(rows) for name, rows in tables.items()}))


def bottleneck(base):
    """An urgent C-only job competes with an earlier-due flexible A job."""
    folder = ROOT / 'participant/data/datasets/bottleneck'
    folder.mkdir(parents=True, exist_ok=True)
    tables = {name: [] for name in base}
    tables['sites'] = [base['sites'][0]]
    tables['machines'] = base['machines'][:2]
    tables['capabilities'] = [r for r in base['capabilities'] if r['machine_id'].startswith('M-N')]
    tables['changeovers'] = base['changeovers']
    tables['staff'] = [base['staff'][0]]
    tables['machine_windows'] = [dict(window_id='W-' + m['machine_id'], machine_id=m['machine_id'],
        start_at=stamp(0, 480), end_at=stamp(0, 720)) for m in tables['machines']]
    tables['staff_windows'] = [dict(window_id='SW-N', staff_id='T-N', site_id='SITE-N', families='A|B|C',
        start_at=stamp(0, 480), end_at=stamp(0, 720))]
    for jid, family, minutes, due, priority, predecessor in [
        ('B001', 'A', 70, 575, 'RUSH', ''),
        ('B002', 'A', 30, 555, 'NORMAL', ''),
        ('B003', 'C', 30, 563, 'RUSH', ''),
        ('B004', 'B', 30, 630, 'NORMAL', 'B003'),
    ]:
        tables['jobs'].append(dict(job_id=jid, requester_id='U-N-1', site_id='SITE-N',
            service_date='2026-11-09', family=family, nominal_minutes=minutes, release_at=stamp(0, 480),
            due_at=stamp(0, due), priority=priority, status='READY', predecessor_id=predecessor))
    allocations = []
    for jid, machine, start, process, end in [
        ('B001', 'M-N1', 480, 505, 575), ('B002', 'M-N1', 575, 580, 610),
        ('B003', 'M-N2', 505, 525, 563), ('B004', 'M-N2', 580, 595, 633),
    ]:
        allocations.append(dict(job_id=jid, machine_id=machine, staff_id='T-N', setup_start=stamp(0, start),
            process_start=stamp(0, process), process_end=stamp(0, end), fixed=jid == 'B001'))
    tables['fixed_runs'] = [dict(reservation_id='FIX-B001', **{k: v for k, v in allocations[0].items() if k != 'fixed'})]
    for name, rows in tables.items():
        write(name + '.csv', list(base[name][0]), rows, folder)
    (folder / 'manifest.json').write_text(json.dumps(dict(dataset_id='bottleneck', revision='1',
        service_date_from='2026-11-09', service_date_to='2026-11-09', timezone='Asia/Seoul'), indent=2) + '\n')
    (ROOT / 'facilitator/bottleneck-witness.json').write_text(json.dumps(
        dict(setup_buffer_minutes=0, allocations=allocations), indent=2) + '\n')


if __name__ == '__main__':
    generate()
