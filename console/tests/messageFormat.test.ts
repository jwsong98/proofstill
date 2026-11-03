import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inlineTokens } from '../web/messageFormat.ts';

test('message format distinguishes safe links, local references, inline code, and text', () => {
  const ticks = String.fromCharCode(96);
  const tokens = inlineTokens(`문장 ${ticks}code${ticks} [공식](https://example.com/docs) [App.tsx](/workspace/App.tsx:12)`);
  assert(tokens.some(token => token.kind === 'code' && token.text === 'code'));
  assert(tokens.some(token => token.kind === 'link' && token.href === 'https://example.com/docs'));
  assert(tokens.some(token => token.kind === 'reference' && token.target === '/workspace/App.tsx:12'));
});

test('unsafe markdown targets remain references instead of executable links', () => {
  assert.deepEqual(inlineTokens('[실행하지 않기](javascript:alert)'), [{ kind: 'reference', label: '실행하지 않기', target: 'javascript:alert', href: null }]);
});
