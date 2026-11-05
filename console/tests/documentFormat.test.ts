import test from 'node:test';
import assert from 'node:assert/strict';
import { documentFormat, prettyJson } from '../web/documentFormat.ts';

test('CSV preserves quoted delimiters, line breaks and escaped quotes', () => {
  assert.deepEqual(documentFormat('\uFEFF항목,설명\r\n"등록,조회","첫 줄\n""둘째 줄"""\r\n', 'data.csv'), {
    kind: 'csv', rows: [['항목', '설명'], ['등록,조회', '첫 줄\n"둘째 줄"']],
  });
  assert.equal(documentFormat('"닫히지 않은 값', 'data.csv').kind, 'invalid');
  assert.equal(documentFormat('이 문장은, CSV 표가 아닙니다.').kind, 'markdown');
});

test('JSON formatting preserves source numbers and duplicate fields', async () => {
  const content = '{"id":900719925474099312345,"id":2,"text":"<script>"}';
  assert.equal(documentFormat(content).kind, 'json');
  const formatted = await prettyJson(content);
  assert.match(formatted, /900719925474099312345/);
  assert.equal((formatted.match(/"id"/g) ?? []).length, 2);
  assert.match(formatted, /\n {2}"id"/);
  assert.equal(documentFormat('{"id":', 'value.json').kind, 'invalid');
});

test('Markdown extensions keep comma-delimited prose in Markdown', () => {
  assert.equal(documentFormat('# 제목\n\n**강조**, 설명\n값,값', 'guide.md').kind, 'markdown');
});
