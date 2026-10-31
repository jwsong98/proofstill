"""Run local-only browser checks: python3 tests/ui/check_trace_view.py <viewer.html>."""
import argparse
import json
from html.parser import HTMLParser
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('viewer')
    parser.add_argument('--browser')
    args = parser.parse_args()
    browser = args.browser or shutil.which('google-chrome') or shutil.which('chromium')
    if not browser:
        candidate = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        browser = str(candidate) if candidate.is_file() else None
    if not browser:
        raise SystemExit('Chrome/Chromium is required; UI check was NOT executed.')
    script = r'''
<script>
try {
 const data = JSON.parse(document.getElementById('order-flow-data').textContent);
 const steps = data.steps;
 function check(ok, reason) { if (!ok) throw new Error(reason); }
 check(steps.length === 7, 'expected two iterations and final query');
 check(document.querySelectorAll('[data-step-id]').length === 7, 'all steps visible');
 document.querySelectorAll('[data-step-id]')[2].click();
 check(document.querySelector('[data-selected-step]').dataset.selectedStep === steps[2].id, 'step selection');
 check(document.getElementById('step-description').textContent === steps[2].description, 'work explanation');
 check(JSON.parse(document.getElementById('input-data').textContent).payload.amount === 20, 'actual transferred input');
 check(JSON.parse(document.getElementById('context-data').textContent).multiplier === 2, 'context snapshot');
 check(JSON.parse(document.getElementById('output-data').textContent).processed.id === 1, 'actual output');
 check(document.getElementById('context-version').textContent.includes('0'), 'context version');
 check(document.getElementById('ui-mapping').textContent.includes('#process'), 'declared UI mapping');
 const upstream = document.querySelector('#bindings [data-source-step]');
 check(upstream, 'data provenance link'); upstream.click();
 check(document.querySelector('[data-selected-step]').dataset.selectedStep === steps[1].id, 'navigate upstream');
 const downstream = document.querySelector('#consumers [data-target-step]');
 check(downstream && downstream.dataset.targetStep===steps[2].id, 'actual next data consumer'); downstream.click();
 check(document.querySelector('[data-selected-step]').dataset.selectedStep === steps[2].id, 'navigate downstream');
 const search = document.getElementById('search'); search.value = 'orders.lookup'; search.dispatchEvent(new Event('input'));
 check(document.querySelectorAll('[data-step-id]').length === 3, 'repeated operation filter');
 document.querySelectorAll('[data-step-id]')[2].click();
 check(JSON.parse(document.getElementById('output-data').textContent).items.length === 0, 'last query differs from earlier iterations');
 search.value = 'no-matching-operation'; search.dispatchEvent(new Event('input'));
 check(document.querySelectorAll('[data-step-id]').length === 0, 'empty search state');
 check(!document.getElementById('empty-state').hidden, 'empty state visible');
 document.getElementById('theme-toggle').click();
 check(document.documentElement.dataset.theme === 'dark', 'theme control');
 document.body.dataset.uiTest = 'pass';
} catch (error) { document.body.dataset.uiTest = 'fail'; document.body.dataset.uiError = error.message; }
</script>'''
    class Body(HTMLParser):
        attributes = {}
        def handle_starttag(self, tag, attrs):
            if tag == 'body':
                self.attributes = dict(attrs)

    def check_page(root, name, document, checks):
        html = root / (name + '.html')
        html.write_text(document.replace('</body>', checks + '</body>'))
        command = [browser, '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
                   '--user-data-dir=' + str(root / (name + '-profile')), '--virtual-time-budget=1500', '--dump-dom', html.as_uri()]
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        parsed = Body(); parsed.feed(result.stdout)
        if result.returncode != 0 or parsed.attributes.get('data-ui-test') != 'pass':
            print(json.dumps({'ui': 'fail', 'case': name, 'reason': parsed.attributes.get('data-ui-error', 'browser did not execute checks'), 'exit_code': result.returncode}, ensure_ascii=False))
            print(result.stderr[-1000:])
            return False
        return True

    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        if not check_page(root, 'orders', Path(args.viewer).read_text(), script):
            return 1
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        from proofstill.trace import Flow
        from proofstill.trace_view import write_trace_view
        with Flow('non-adjacent', path=root / 'non-adjacent.jsonl') as flow:
            source = flow.step('source', '출처', lambda: {'id': 7})
            flow.step('unrelated', '이 출력을 사용하지 않는 작업', lambda: None)
            flow.step('consumer', '첫 단계 결과를 사용하는 작업', lambda item: item, inputs={'item': source.ref()})
        viewer = write_trace_view(root / 'non-adjacent.jsonl', root / 'non-adjacent.html')
        non_adjacent = r'''<script>
try {
 const data=JSON.parse(document.getElementById('order-flow-data').textContent);
 const consumer=document.querySelector('#consumers [data-target-step]');
 if(!consumer || consumer.dataset.targetStep!==data.steps[2].id) throw new Error('must link actual non-adjacent consumer');
 consumer.click();
 if(document.querySelector('[data-selected-step]').dataset.selectedStep!==data.steps[2].id) throw new Error('consumer navigation');
 document.querySelectorAll('[data-step-id]')[1].click();
 if(document.querySelector('#consumers [data-target-step]')) throw new Error('unrelated step has no consumer');
 document.body.dataset.uiTest='pass';
} catch(error) {document.body.dataset.uiTest='fail';document.body.dataset.uiError=error.message;}
</script>'''
        if not check_page(root, 'non-adjacent', viewer.read_text(), non_adjacent):
            return 1
        print(json.dumps({'ui': 'pass', 'checks': ['step selection', 'description', 'inputs', 'context', 'output', 'context version', 'upstream navigation', 'downstream navigation', 'non-adjacent consumers', 'repeated queries', 'UI mapping', 'empty search', 'theme']}, ensure_ascii=False))
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
