import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contextUsageLabel, cumulativeUsageLabel } from '../web/contextUsage.ts';

test('context usage uses the latest request total against its model window', () => {
  assert.equal(contextUsageLabel({
    sessionId: 's', turnId: 't', inputTokens: 42_000, cachedInputTokens: 40_000,
    outputTokens: 300, reasoningOutputTokens: 100, modelContextWindow: 258_400,
    raw: { last: { totalTokens: 42_300 }, total: { totalTokens: 180_000 } }, observedAt: 1,
  }), '컨텍스트 42.3K / 258.4K · 16%');
});

test('cumulative usage remains separate from the latest request and unavailable values', () => {
  const usage = { sessionId: 's', turnId: 't', inputTokens: 42_000, cachedInputTokens: 40_000,
    outputTokens: 300, reasoningOutputTokens: 100, modelContextWindow: 258_400,
    raw: { last: { totalTokens: 42_300 }, total: { totalTokens: 180_000 } }, observedAt: 1 };
  assert.equal(cumulativeUsageLabel(usage), '누적 토큰 180,000');
  assert.equal(contextUsageLabel({ ...usage, raw: { total: { totalTokens: 180_000 } } }), '컨텍스트 사용량 미확인');
  assert.equal(cumulativeUsageLabel({ ...usage, raw: { last: { totalTokens: 42_300 } } }), '누적 토큰 미확인');
  for (const totalTokens of [null, '180000', -1, NaN, Infinity]) {
    assert.equal(cumulativeUsageLabel({ ...usage, raw: { total: { totalTokens } } }), '누적 토큰 미확인');
  }
  assert.equal(cumulativeUsageLabel({ ...usage, raw: { total: { totalTokens: 0 } } }), '누적 토큰 0');
  assert.equal(cumulativeUsageLabel(undefined), '누적 토큰 미확인');
});

test('context usage clamps invalid overflow and handles unavailable metadata', () => {
  assert.equal(contextUsageLabel({
    sessionId: 's', turnId: 't', inputTokens: null, cachedInputTokens: null,
    outputTokens: null, reasoningOutputTokens: null, modelContextWindow: 128_000,
    raw: { last: { totalTokens: 200_000 } }, observedAt: 1,
  }), '컨텍스트 128K / 128K · 100%');
  assert.equal(contextUsageLabel(undefined), '컨텍스트 사용량 미확인');
});
