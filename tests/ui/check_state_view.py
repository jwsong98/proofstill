import json
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path


def main():
    viewer = Path(sys.argv[1]).resolve()
    browser = shutil.which('google-chrome') or shutil.which('chromium') or '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    checks = r'''<script>
try {
 const data=JSON.parse(document.getElementById('order-flow-data').textContent);
 function check(ok,reason){if(!ok)throw new Error(reason);}
 function chooseStep(index){document.querySelectorAll('[data-step-id]')[index].click();}
 chooseStep(4);
 check(!document.getElementById('state-panel').hidden,'state panel visible');
 check(document.getElementById('state-route').textContent.includes('orders.detail → orders.edit'),'IA transition');
 check(JSON.parse(document.getElementById('state-before').textContent).data.detail.id===1,'actual before state');
 check(JSON.parse(document.getElementById('state-after').textContent).data.draft.amount===10,'actual after state');
 let delta=JSON.parse(document.getElementById('state-delta').textContent);
 check(delta.created.includes('draft')&&delta.removed.includes('detail'),'created and removed');
 check(delta.retained.includes('query')&&delta.retained.includes('page'),'retained navigation state');
 chooseStep(5);delta=JSON.parse(document.getElementById('state-delta').textContent);
 check(delta.changed.includes('draft'),'changed draft');
 chooseStep(2);check(document.getElementById('state-panel').hidden,'ordinary API call has no state observation');
 chooseStep(14);check(JSON.parse(document.getElementById('state-after').textContent).feature==='home','feature exit');
 check(Object.keys(JSON.parse(document.getElementById('state-after').textContent).data).length===0,'exit cleanup');
 chooseStep(13);check(JSON.parse(document.getElementById('state-after').textContent).data.selected_id===2,'stale response ignored');
 document.body.dataset.uiTest='pass';
}catch(error){document.body.dataset.uiTest='fail';document.body.dataset.uiError=error.message;}
</script>'''
    class Body(HTMLParser):
        attributes = {}
        def handle_starttag(self, tag, attrs):
            if tag == 'body':
                self.attributes = dict(attrs)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        page = root / 'viewer.html'
        page.write_text(viewer.read_text().replace('</body>', checks + '</body>'))
        command = [browser, '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
                   '--user-data-dir=' + str(root / 'profile'), '--virtual-time-budget=1500', '--dump-dom', page.as_uri()]
        run = subprocess.run(command, capture_output=True, text=True, timeout=30)
        parsed = Body(); parsed.feed(run.stdout)
        ok = run.returncode == 0 and parsed.attributes.get('data-ui-test') == 'pass'
        print(json.dumps({'ui': 'pass' if ok else 'fail', 'checks': 11 if ok else 0,
                          'reason': parsed.attributes.get('data-ui-error'), 'browser_exit': run.returncode}, ensure_ascii=False))
        return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
