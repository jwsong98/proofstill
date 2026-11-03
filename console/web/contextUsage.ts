import type { Usage } from '../server/types.ts';

const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const tokenK = (value: number) => `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;

export function contextUsageLabel(usage: Usage | undefined): string {
  const limit = usage?.modelContextWindow;
  const latest = record(record(usage?.raw)?.last)?.totalTokens;
  if (!finite(limit) || limit <= 0 || !finite(latest) || latest < 0) return '컨텍스트 사용량 미확인';
  const used = Math.min(latest, limit);
  const percent = Math.round(used / limit * 100);
  return `컨텍스트 ${tokenK(used)} / ${tokenK(limit)} · ${percent}%`;
}

export function cumulativeUsageLabel(usage: Usage | undefined): string {
  const total = record(record(usage?.raw)?.total)?.totalTokens;
  return finite(total) && total >= 0 ? `누적 토큰 ${total.toLocaleString('en-US')}` : '누적 토큰 미확인';
}
