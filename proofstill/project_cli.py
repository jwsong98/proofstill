"""CLI for project work packets; feature commands remain the verification primitives."""
import json
from .project import Project


def configure(commands):
    project = commands.add_parser('project', help='제품·핵심 로직 작업을 계약에 맞춰 병행하고 보강')
    actions = project.add_subparsers(dest='project_action', required=True)
    for name in ['init', 'sync']:
        command = actions.add_parser(name)
        command.add_argument('definition')
        if name == 'sync':
            command.add_argument('--reason', required=True)
            command.add_argument('--source', required=True)
    for name in ['status', 'requirements', 'test']:
        command = actions.add_parser(name)
        command.add_argument('project_id')
        if name == 'test':
            command.add_argument('--jobs', type=int, default=2)
    for name in ['packet', 'claim', 'release']:
        command = actions.add_parser(name)
        command.add_argument('project_id')
        command.add_argument('work')
        if name != 'packet':
            command.add_argument('--owner', required=True)
    command = actions.add_parser('question')
    command.add_argument('project_id')
    command.add_argument('work')
    command.add_argument('question_id')
    command.add_argument('--question', required=True)
    command.add_argument('--answer', default='')
    command.add_argument('--source', default='')

    command = actions.add_parser('compare')
    command.add_argument('project_id')
    command.add_argument('case_set')


def run(h, args):
    action = args.project_action
    if action in ('init', 'sync'):
        p = Project.create(h, args.definition, reason=getattr(args, 'reason', ''), source=getattr(args, 'source', ''))
        result = p.status()
    else:
        p = Project(h, args.project_id)
        if action == 'status':
            result = p.status()
        elif action == 'packet':
            result = p.packet(args.work)
        elif action in ('claim', 'release'):
            result = p.claim(args.work, args.owner, release=action == 'release')
        elif action == 'question':
            result = p.question(args.work, args.question_id, args.question, args.answer, args.source)
        elif action == 'test':
            result = p.run(jobs=args.jobs)
        elif action == 'compare':
            from .comparison import compare
            result = compare(p, args.case_set)
        elif action == 'requirements':
            print(p.requirements())
            return 0
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if action == 'compare':
        return 0 if result['comparable'] else 1
    if action == 'test':
        return 0 if not result['blocked'] and all(w['passed'] for w in result['work'].values()) else 1
    return 0
