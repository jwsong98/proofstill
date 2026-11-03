import type { FeatureCheckInput, HandoffSnapshot, ImplementationProgress, Graph, GraphContext, GraphEdge, GraphNode, Message, NodeInput, NodePatch, Page, Project, Session, SessionEvent, Usage } from '../server/types.ts';
export type PendingRequest = { id: string; method: string; params: Record<string, unknown> };
export type SessionDetail = { session: Session; messages: Message[]; events: SessionEvent[]; usage: Usage[]; pending: PendingRequest[]; activeTurnId?: string | null };
export type RemoteThread = { id: string; name?: string | null; title?: string | null; preview?: string; cwd?: string; createdAt?: number | null; updatedAt?: number | null; recencyAt?: number | null; lastConversationAt?: number | null };
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function request<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch('/api' + path, { method: options.method ?? 'GET', signal: options.signal,
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  if (!response.ok) {
    let message = `요청에 실패했어요 (${response.status}).`;
    try { const result = await response.json(); if (typeof result.error === 'string') message = result.error; } catch { /* Keep the HTTP failure when no JSON body was returned. */ }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const project = (id: string) => `/projects/${encodeURIComponent(id)}`;
const session = (id: string) => `/sessions/${encodeURIComponent(id)}`;
function pageQuery(cursor?: string | null, limit = 20) { const q = new URLSearchParams({ limit: String(limit) }); if (cursor) q.set('cursor', cursor); return q; }
export function normalizeSession(data: SessionDetail): SessionDetail {
  return { ...data, messages: data.messages ?? [], events: data.events ?? [], usage: data.usage ?? [], pending: data.pending ?? [] };
}
export const api = {
  handoff: (id: string, signal?: AbortSignal) => request<HandoffSnapshot>(`${project(id)}/handoff`, { signal }),
  linkHarnessRequirement: (id: string, taskId: string, requirementId: string) => request<GraphNode>(`${project(id)}/handoff/link`, { method: 'POST', body: { taskId, requirementId } }),
  saveImplementation: (id: string, body: { source: string; taskId: string; requirementId: string; implementation: ImplementationProgress }) => request<ImplementationProgress>(`${project(id)}/handoff/implementation`, { method: 'PUT', body }),
  defineChecks: (id: string, nodeId: string, checks: FeatureCheckInput[]) => request(`${project(id)}/nodes/${encodeURIComponent(nodeId)}/checks`, { method: 'POST', body: { checks } }),
  code: (id: string, path: string) => request<{ path: string; content: string; truncated: boolean }>(`${project(id)}/handoff/code?${new URLSearchParams({ path })}`),
  handoffUrl: (id: string) => '/api' + project(id) + '/handoff/export',
  projects: () => request<Project[]>('/projects'),
  createProject: (input: { name: string; rootPath: string }) => request<Project>('/projects', { method: 'POST', body: input }),
  codexStatus: () => request<{ connected: boolean; account?: unknown; error?: string }>('/codex/status'),
  graph: (id: string, signal?: AbortSignal) => request<Graph>(`${project(id)}/graph`, { signal }),
  files: (id: string) => request<{ items: string[]; truncated: boolean }>(`${project(id)}/files`),
  createNode: (id: string, body: NodeInput) => request<GraphNode>(`${project(id)}/nodes`, { method: 'POST', body }),
  updateNode: (id: string, nodeId: string, body: NodePatch) => request<GraphNode>(`${project(id)}/nodes/${encodeURIComponent(nodeId)}`, { method: 'PATCH', body }),
  deleteNode: (id: string, nodeId: string) => request<void>(`${project(id)}/nodes/${encodeURIComponent(nodeId)}`, { method: 'DELETE' }),
  createEdge: (id: string, body: { sourceId: string; targetId: string; kind: GraphEdge['kind']; reason?: string }) => request<GraphEdge>(`${project(id)}/edges`, { method: 'POST', body }),
  deleteEdge: (id: string, edgeId: string) => request<void>(`${project(id)}/edges/${encodeURIComponent(edgeId)}`, { method: 'DELETE' }),
  captureFile: (id: string, body: { path: string; startLine?: number; endLine?: number; title?: string }) => request<GraphNode>(`${project(id)}/evidence/file`, { method: 'POST', body }),
  captureMessage: (id: string, sessionId: string, messageId: string) => request<GraphNode>(`${project(id)}/evidence/message`, { method: 'POST', body: { sessionId, messageId } }),
  context: (id: string, nodeIds: string[]) => request<GraphContext>(`${project(id)}/context`, { method: 'POST', body: { nodeIds } }),
  contextUrl: (id: string, nodeIds: string[]) => '/api' + project(id) + '/context?' + new URLSearchParams({ nodeIds: nodeIds.join(',') }),
  sessions: (id: string, cursor?: string | null) => request<Page<Session>>(`${project(id)}/sessions?${pageQuery(cursor)}`),
  createSession: (id: string, input: { title?: string; nodeIds?: string[]; role?: string }) => request<Session>(`${project(id)}/sessions`, { method: 'POST', body: input }),
  session: async (id: string, signal?: AbortSignal) => normalizeSession(await request<SessionDetail>(session(id), { signal })),
  syncSession: (id: string, signal?: AbortSignal) => request<SessionDetail>(`${session(id)}/sync`, { method: 'POST', body: {}, signal }),
  send: (id: string, content: string, clientMessageId?: string) => request<{ message: Message; turn: unknown }>(`${session(id)}/messages`, { method: 'POST', body: { content, clientMessageId } }),
  respond: (id: string, requestId: string, decision: 'accept' | 'decline' | 'cancel') => request<{ ok: true }>(`${session(id)}/requests/${encodeURIComponent(requestId)}`, { method: 'POST', body: { decision } }),
  interrupt: (id: string) => request<{ ok: true }>(`${session(id)}/interrupt`, { method: 'POST', body: {} }),
  remoteThreads: (projectId: string, cursor?: string | null) => request<Page<RemoteThread>>('/codex/threads?' + new URLSearchParams({ ...Object.fromEntries(pageQuery(cursor)), projectId })),
  importSession: (id: string, threadId: string) => request<Session>(`${project(id)}/sessions/import`, { method: 'POST', body: { threadId } }),
  analyzeGraph: (id: string, input: { nodeIds?: string[]; instruction?: string }) => request<Session>(`${project(id)}/graph/analyze`, { method: 'POST', body: input }),
};
export function subscribeSession(id: string, onEvent: (event: SessionEvent) => void, onError: () => void, onOpen?: () => void) {
  const stream = new EventSource('/api' + session(id) + '/events');
  stream.onmessage = message => { try { onEvent(JSON.parse(message.data) as SessionEvent); } catch { onError(); } };
  stream.onerror = onError;
  stream.onopen = () => onOpen?.();
  return () => stream.close();
}
