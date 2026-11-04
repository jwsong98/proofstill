import argparse
import json
import sys
from .workflow import Harness, HarnessError


def main():
    parser = argparse.ArgumentParser(prog='proofstill')
    parser.add_argument('--root', default='.', help='대상 프로젝트 경로')
    parser.add_argument('--codex', default='codex', help='독립 리뷰용 Codex CLI 실행 파일')
    parser.add_argument('--review-timeout', type=int, default=300)
    parser.add_argument('--review-idle-timeout', type=float, default=None, help='선택적 무출력 제한 초. 기본은 wall 제한만 적용')
    parser.add_argument('--review-retries', type=int, default=0, help='명시적으로 허용한 재시도 횟수(0~2)')
    parser.add_argument('--run-control', help='자식 실행과 공유할 deadline/cancel JSON')
    parser.add_argument('--model', help='독립 리뷰에서 사용할 모델. 생략하면 Codex 설정을 유지')
    parser.add_argument('--ignore-user-config', action='store_true', help='이번 리뷰만 Codex 기본 설정으로 실행. auth는 유지')
    commands = parser.add_subparsers(dest='command', required=True)
    control = commands.add_parser('control', help='공유 실행 제한 변경/취소')
    control.add_argument('path')
    control.add_argument('--minutes', type=float, help='최초 시작으로부터 제한 분')
    control.add_argument('--cancel', action='store_true')
    init = commands.add_parser('init', help='기능 정의와 기준 고정')
    init.add_argument('plan')
    revise = commands.add_parser('revise', help='요구 ID를 유지하며 변경 기준과 이유를 새 revision으로 보존')
    revise.add_argument('feature')
    revise.add_argument('plan')
    revise.add_argument('--reason', required=True)
    revise.add_argument('--source', required=True)
    test = commands.add_parser('test', help='고정 명령으로 Red/Green 실행')
    test.add_argument('feature')
    test.add_argument('phase', choices=['red', 'green'], nargs='?', default='green')
    test.add_argument('--kind', choices=['unit', 'integration'])
    test.add_argument('--module')
    test.add_argument('--force', action='store_true', help='현재 Green 결과도 다시 실행')
    review = commands.add_parser('review', help='새 세션으로 독립 검토')
    review.add_argument('feature')
    review.add_argument('stage', choices=['criteria', 'implementation'], nargs='?', default='implementation')
    review.add_argument('--force', action='store_true', help='현재 독립 판정도 새 세션에서 다시 검토')
    handoff = commands.add_parser('handoff', help='현재 요구별 구현·검증 JSON 조회')
    handoff.add_argument('feature', nargs='?')
    implement = commands.add_parser('implement', help='요구별 구현 기록 — 검증 판정과 분리')
    implement.add_argument('feature')
    implement.add_argument('requirement')
    implement.add_argument('--status', required=True, choices=['unknown', 'not_started', 'in_progress', 'partial', 'implemented'])
    implement.add_argument('--path', action='append', default=[])
    implement.add_argument('--remaining', default='')
    implement.add_argument('--note', default='')
    checkpoint = commands.add_parser('checkpoint', help='다음 행동과 가정을 현재 코드 버전과 함께 보존')
    checkpoint.add_argument('feature')
    checkpoint.add_argument('--next', required=True, dest='next_action')
    checkpoint.add_argument('--assumption', action='append', default=None)
    decision = commands.add_parser('decision', help='사람 결정 대기 또는 실제 답변·출처 기록')
    decision.add_argument('feature')
    decision.add_argument('decision_id')
    decision.add_argument('--question', required=True)
    decision.add_argument('--answer', default='')
    decision.add_argument('--source', default='')
    trace = commands.add_parser('trace', help='데이터 흐름 기록 검증·UI 조회기 생성')
    trace.add_argument('action', choices=['verify', 'view'])
    trace.add_argument('path')
    trace.add_argument('--expect', help='구현 전에 고정한 기대 흐름 JSON')
    trace.add_argument('--output', help='HTML 저장 위치')
    for name in ['status', 'report', 'cleanup', 'brief']:
        command = commands.add_parser(name)
        command.add_argument('feature')
    args = parser.parse_args()
    h = Harness(args.root, codex=args.codex, review_timeout=args.review_timeout,
                model=args.model, ignore_user_config=args.ignore_user_config,
                review_idle_timeout=args.review_idle_timeout, review_retries=args.review_retries, run_control=args.run_control)
    try:
        if args.command == 'control':
            from .execution import configure
            print(json.dumps(configure(args.path, minutes=args.minutes, cancel=args.cancel)))
        elif args.command == 'trace':
            from .contract import read_json
            from .trace_check import verify_trace
            expected = read_json(args.expect) if args.expect else None
            if args.action == 'verify':
                result = verify_trace(args.path, expected)
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 0 if result['valid'] else 1
            from .trace_view import write_trace_view
            from pathlib import Path
            print(write_trace_view(args.path, args.output or str(Path(args.path).with_suffix('.html')), expected))
        elif args.command == 'handoff':
            from .handoff import snapshot
            folder = h.root / '.proofstill/evidence'
            features = [args.feature] if args.feature else sorted(p.name for p in folder.iterdir() if p.is_dir() and (p / 'plan.json').is_file() and (p / 'state.json').is_file()) if folder.is_dir() else []
            rows, errors = [], []
            for feature in features:
                try:
                    rows.extend(snapshot(h, feature))
                except (HarnessError, KeyError, TypeError, OSError, ValueError) as error:
                    errors.append({'taskId': feature, 'message': str(error)})
            print(json.dumps({'rows': rows, 'errors': errors}, ensure_ascii=False))
        elif args.command == 'checkpoint':
            print(json.dumps(h.checkpoint(args.feature, args.next_action, args.assumption), ensure_ascii=False))
        elif args.command == 'decision':
            print(json.dumps(h.decision(args.feature, args.decision_id, args.question, args.answer, args.source), ensure_ascii=False))
        elif args.command == 'brief':
            from .handoff import briefing
            print(briefing(h, args.feature), end='')
        elif args.command == 'implement':
            print(json.dumps(h.implement(args.feature, args.requirement, args.status, args.path, args.remaining, args.note), ensure_ascii=False))
        elif args.command == 'init':
            print(h.init(args.plan))
        elif args.command == 'revise':
            print(json.dumps(h.revise(args.feature, args.plan, args.reason, args.source), ensure_ascii=False))
        elif args.command == 'test':
            result = h.run(args.feature, args.phase, kind=args.kind, module=args.module, reuse=not args.force)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if all(r['accepted'] for r in result) else 1
        elif args.command == 'review':
            print(json.dumps(h.review(args.feature, args.stage, reuse=not args.force), ensure_ascii=False, indent=2))
        elif args.command == 'status':
            result = h.status(args.feature)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result['complete'] else 1
        elif args.command == 'report':
            print(h.report(args.feature))
        elif args.command == 'cleanup':
            h.cleanup(args.feature)
            print('임시 상태 정리 완료. 보고·증거는 보존했습니다.')
        return 0
    except (HarnessError, ValueError) as error:
        print(f'proofstill: {error}', file=sys.stderr)
        return 2


def cli():
    import signal
    def interrupt(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupt)
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)


if __name__ == '__main__':
    cli()
