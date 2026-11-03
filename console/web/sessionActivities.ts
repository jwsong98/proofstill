import type { Message, SessionEvent } from '../server/types.ts';
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
export type Activity = { key: string; createdAt: number; item: Record<string, any>; turnId: string | null;
  agentThreadId?: string | null; displayStatus?: 'interrupted' | 'unverified';
  turnEnd?: { status: 'interrupted' | 'failed'; eventId: number } };
export function sessionActivities(events: SessionEvent[]): Activity[] {
  const activities = new Map<string, Activity>();
  for (const event of events) {
    if (event.method === 'item/commandExecution/outputDelta') {
      const payload = record(event.payload), previous = activities.get(`call:${payload.itemId}`);
      if (previous && typeof payload.delta === 'string') previous.item.aggregatedOutput = (previous.item.aggregatedOutput ?? '') + payload.delta;
      continue;
    }
    if (!['item/started', 'item/completed'].includes(event.method)) continue;
    const payload = record(event.payload), item = record(payload.item);
    if (!['collabAgentToolCall', 'subAgentActivity', 'subAgentResult', 'commandExecution', 'mcpToolCall', 'dynamicToolCall', 'fileChange'].includes(String(item.type))) continue;
    const key = item.type === 'subAgentActivity' ? `sub:${payload.turnId ?? ''}:${item.agentThreadId ?? item.id}` : `call:${item.id}`;
    const previous = activities.get(key);
    activities.set(key, { key, createdAt: previous?.createdAt ?? event.createdAt, item: { ...(previous?.item ?? {}), ...item }, turnId: typeof payload.turnId === 'string' ? payload.turnId : null,
      agentThreadId: typeof payload.agentThreadId === 'string' ? payload.agentThreadId : null });
  }
  for (const event of events) {
    if (event.method !== 'turn/completed') continue;
    const payload = record(event.payload), turn = record(payload.turn);
    if (typeof turn.id !== 'string' || !['interrupted', 'failed'].includes(turn.status)) continue;
    const agentThreadId = typeof payload.agentThreadId === 'string' ? payload.agentThreadId : null;
    for (const activity of activities.values()) {
      if (activity.item.type !== 'commandExecution' || activity.item.status !== 'inProgress'
        || activity.turnId !== turn.id || (activity.agentThreadId ?? null) !== agentThreadId) continue;
      activity.displayStatus = turn.status === 'interrupted' ? 'interrupted' : 'unverified';
      activity.turnEnd = { status: turn.status, eventId: event.id };
    }
  }
  return [...activities.values()];
}

export function isParentTurnEvent(event: SessionEvent): boolean { return !record(event.payload).agentThreadId; }

export type SessionTimelineEntry =
  | { kind: 'message'; key: string; message: Message }
  | { kind: 'activities'; key: string; activities: Activity[] };
export function groupSessionTimeline(messages: Message[], activities: Activity[]): SessionTimelineEntry[] {
  const entries = [
    ...messages.map(message => ({ kind: 'message' as const, createdAt: message.createdAt, key: `message:${message.id}`, message })),
    ...activities.map(activity => ({ kind: 'activity' as const, createdAt: activity.createdAt, key: activity.key, activity })),
  ].sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key));
  const groups: SessionTimelineEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === 'message') { groups.push(entry); continue; }
    const previous = groups.at(-1);
    if (previous?.kind === 'activities') previous.activities.push(entry.activity);
    else groups.push({ kind: 'activities', key: `activities:${entry.key}`, activities: [entry.activity] });
  }
  return groups;
}
