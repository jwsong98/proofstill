import json
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from proofstill.trace import Flow
from proofstill.trace_view import write_trace_view


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts, self.active, self.payload = [], None, ''

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.active = dict(attrs)
            self.scripts.append(self.active)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.active = None

    def handle_data(self, text):
        if self.active is not None and self.active.get('id') == 'order-flow-data':
            self.payload += text


class TraceViewTests(unittest.TestCase):
    def render(self, value):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'flow.jsonl'
            with Flow('data', path=path) as flow:
                flow.step('read', 'API 응답을 조회한다', lambda: value)
            page = write_trace_view(path, Path(tmp) / 'flow.html')
            parser = Scripts(); parser.feed(page.read_text())
            return parser

    def test_template_like_data_is_preserved_exactly(self):
        value = {'text': '__SCRIPT__ __DATA__ __CSS__ __SOURCE__'}
        parsed = self.render(value)
        data = json.loads(parsed.payload)
        self.assertEqual(data['steps'][0]['output'], value)

    def test_html_like_api_data_does_not_create_executable_elements(self):
        value = {'text': '</script><script>throw new Error("injected")</script><img src=x onerror=alert(1)>'}
        parsed = self.render(value)
        self.assertEqual(len(parsed.scripts), 2)
        self.assertEqual(json.loads(parsed.payload)['steps'][0]['output'], value)
