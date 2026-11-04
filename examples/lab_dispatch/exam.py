"""Run one timed Codex exam with a frozen stakeholder and auditable CLI usage."""
import argparse
import json
import os
import signal
import subprocess
import tempfile
import time
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from proofstill.usage import UsageTracker, aggregate_calls
from proofstill.execution import ExecutionControl, stop_process

MODELS = {'exam': 'gpt-6.1-sol', 'stakeholder': 'gpt-5.6-terra'}


def stamp():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False, prefix=path.name + '.', suffix='.tmp') as handle:
        handle.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        temporary = Path(handle.name)
    temporary.replace(path)


def summarize(path):
    thread_id, usage, messages = None, [], []
    if path.exists():
        for line in path.read_text(errors='replace').splitlines():
            try: event = json.loads(line)
            except ValueError: continue
            if event.get('type') == 'thread.started': thread_id = event.get('thread_id')
            if event.get('type') == 'turn.completed' and event.get('usage'): usage.append(event['usage'])
            item = event.get('item', {})
            if event.get('type') == 'item.completed' and item.get('type') == 'agent_message': messages.append(item.get('text', ''))
    return {'thread_id': thread_id, 'usage': usage, 'last_message': messages[-1] if messages else None}


def execute(root, role, prompt, resume=None, phase='exam'):
    config = json.loads((root / 'config.json').read_text())
    state = json.loads((root / 'state.json').read_text())
    if phase == 'exam' and ExecutionControl(root / 'control.json').reason():
        raise RuntimeError('The exam has ended')
    target = root / 'calls' / (str(time.time_ns()) + '-' + role)
    target.mkdir(parents=True)
    (target / 'prompt.txt').write_text(prompt)
    workspace = Path(config['workspace']) if role == 'exam' else root / 'frozen/facilitator'
    argv = [config['codex'], 'exec', '--ignore-user-config', '--model', MODELS[role],
            '--sandbox', 'danger-full-access', '--skip-git-repo-check', '--json', '--color', 'never',
            '-C', str(workspace), '--output-last-message', str(target / 'answer.txt')]
    argv += ['resume', resume, '-'] if resume else ['-']
    started = time.time()
    tracker = UsageTracker(target / 'usage.json', thread_id=resume)
    control = ExecutionControl(root / 'control.json') if phase == 'exam' else ExecutionControl()
    with (target / 'prompt.txt').open('rb') as stdin, (target / 'events.jsonl').open('wb') as stdout, (target / 'stderr.log').open('wb') as stderr:
        process = subprocess.Popen(argv, cwd=workspace, stdin=stdin, stdout=stdout, stderr=stderr,
                                   start_new_session=True, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', **control.environment()})
        control.register(process, role)
        save(target / 'run.json', {'role': role, 'model': MODELS[role], 'phase': phase, 'started_at': stamp(),
                                  'started_epoch': started, 'pid': process.pid})
        limit = started + 120 if phase == 'setup' else float('inf')
        timed_out = False
        offset = 0
        try:
            while process.poll() is None:
                with (target / 'events.jsonl').open() as events:
                    events.seek(offset)
                    while True:
                        pos = events.tell()
                        line = events.readline()
                        if not line.endswith('\n'):
                            events.seek(pos)
                            break
                        try: tracker.observe(json.loads(line))
                        except ValueError: pass
                    offset = events.tell()
                tracker.poll()
                if time.time() >= limit or control.reason():
                    timed_out = True
                    break
                time.sleep(.2)
        finally:
            stop_process(process)
            for line in (target / 'events.jsonl').read_text().splitlines():
                try: tracker.observe(json.loads(line))
                except ValueError: pass
            tracker.poll(force=True)
            control.update(usage_observation=tracker.snapshot())
            control.finish(control.reason() or ('wall' if timed_out else None), process.returncode)
            save(target / 'run.json', {**json.loads((target / 'run.json').read_text()),
                 'finished_at': stamp(), 'elapsed_seconds': round(time.time() - started, 3),
                 'exit_code': process.returncode, 'timed_out': timed_out,
                 'usage_observation': tracker.snapshot()})
    result = {**json.loads((target / 'run.json').read_text()), 'finished_at': stamp(),
              'elapsed_seconds': round(time.time() - started, 3), 'exit_code': process.returncode,
              'timed_out': timed_out, 'usage_observation': tracker.snapshot(), **summarize(target / 'events.jsonl')}
    result['answer'] = (target / 'answer.txt').read_text() if (target / 'answer.txt').exists() else result['last_message']
    save(target / 'run.json', result)
    if process.returncode != 0:
        raise RuntimeError(f'{role} failed (exit {process.returncode}); inspect {target}')
    return result


def metrics(root):
    calls = []
    for path in sorted((root / 'calls').glob('*/run.json')):
        call = json.loads(path.read_text())
        observation = path.parent / 'usage.json'
        if observation.exists():
            call['usage_observation'] = json.loads(observation.read_text())
        calls.append(call)
    totals = aggregate_calls(calls)
    config = json.loads((root / 'config.json').read_text())
    # Harness keeps copies of event logs; count each independent thread once.
    review_threads = {}
    for path in Path(config['workspace']).glob('.proofstill/**/attempt-*.events.jsonl'):
        record = summarize(path)
        observation = path.with_name(path.name.replace('.events.jsonl', '.usage.json'))
        if observation.exists():
            record['usage_observation'] = json.loads(observation.read_text())
        if record['thread_id']: review_threads[record['thread_id']] = {**record, 'source': str(path)}
    result = {'state': json.loads((root / 'state.json').read_text()), 'totals': totals,
              'harness_reviews': list(review_threads.values()), 'calls': calls,
              'token_note': 'cached_input_tokens is a subset of input_tokens; do not add it twice. Missing usage is unknown, not zero.'}
    save(root / 'metrics.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['stakeholder-init', 'ask', 'start', 'status'])
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('question', nargs='?')
    args = parser.parse_args()
    root = args.run.resolve()
    if args.command == 'stakeholder-init':
        result = execute(root, 'stakeholder', 'Read AGENTS.md and policies.json and the public documents in ../workspace. Act as the defined stakeholder. Output only the specified first greeting. Do not edit files or solve the implementation.', phase='setup')
        save(root / 'stakeholder.json', {'thread_id': result['thread_id']})
        print(result['answer'])
    elif args.command == 'ask':
        if not args.question: parser.error('ask requires a question')
        stakeholder = json.loads((root / 'stakeholder.json').read_text())
        result = execute(root, 'stakeholder', args.question, resume=stakeholder['thread_id'])
        # Only this reply is exposed to the examinee; no private policy/tool trace.
        record = {'asked_at': result['started_at'], 'question': args.question, 'answer': result['answer'],
                  'thread_id': result['thread_id'], 'model': result['model'], 'usage': result['usage']}
        config = json.loads((root / 'config.json').read_text())
        replies = Path(config['workspace']) / 'stakeholder-replies.jsonl'
        with replies.open('a') as f: f.write(json.dumps(record, ensure_ascii=False) + '\n')
        metrics(root)
        print(result['answer'])
    elif args.command == 'start':
        state = json.loads((root / 'state.json').read_text())
        if state.get('started_at'): raise RuntimeError('This exam has already started')
        now = time.time()
        config = json.loads((root / 'config.json').read_text())
        duration = config.get('duration_minutes', 30)
        save(root / 'control.json', {'started_epoch': now, 'deadline_epoch': now + duration * 60})
        state.update(status='running', started_at=stamp(), started_epoch=now, deadline_epoch=now + duration * 60)
        save(root / 'state.json', state)
        try:
            result = execute(root, 'exam', (root / 'exam-prompt.txt').read_text())
            state.update(status='submitted', finished_at=stamp(), thread_id=result['thread_id'])
        except BaseException as error:
            state.update(status='time_limit' if ExecutionControl(root / 'control.json').reason() else 'failed', finished_at=stamp(), error=str(error))
            raise
        finally:
            state['deadline_epoch'] = json.loads((root / 'control.json').read_text())['deadline_epoch']
            state['elapsed_seconds'] = round(time.time() - now, 3)
            save(root / 'state.json', state)
            metrics(root)
    else:
        result = metrics(root)
        print(json.dumps({'state': result['state'], 'totals': result['totals']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    def interrupt(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupt)
    main()
