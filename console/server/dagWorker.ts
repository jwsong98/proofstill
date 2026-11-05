import { CodexClient } from './codex.ts';
import type { CodexTransport } from './service.ts';

export type WorkerInput = { root: string; prompt: string; instructions: string; signal: AbortSignal };
export type DagWorker = (input: WorkerInput) => Promise<string>;

// Each task has a separate transport so unrelated turns cannot complete its promise.
export function codexWorker(factory: () => CodexTransport = () => new CodexClient()): DagWorker {
  return async ({ root, prompt, instructions, signal }) => {
    const client = factory();
    let threadId: string | undefined, turnId: string | undefined;
    let summary = '', finished = false;
    let finish!: (error?: Error) => void;
    const completion = new Promise<string>((resolve, reject) => {
      finish = error => { if (finished) return; finished = true; error ? reject(error) : resolve(summary); };
    });
    // A disconnection may arrive before thread/start resolves.
    void completion.catch(() => {});
    const notification = ({ method, params }: any) => {
      if (!threadId || params?.threadId !== threadId) return;
      if (method === 'item/completed' && params.item?.type === 'agentMessage') summary += params.item.text + '\n';
      if (method === 'turn/completed' && (!turnId || params.turn?.id === turnId))
        finish(params.turn?.status === 'completed' ? undefined : new Error(`Codex turn ${params.turn?.status ?? 'unknown'}`));
    };
    const disconnected = (error: Error) => finish(error);
    const request = (request: any) => {
      try {
        client.respond(request.id, request.method === 'item/permissions/requestApproval'
          ? { permissions: {}, scope: 'turn' } : { decision: 'decline' });
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    };
    const abort = () => {
      if (threadId && turnId) void client.request('turn/interrupt', { threadId, turnId }).catch(() => {});
      finish(new Error('DAG 실행이 중단되었습니다.')); client.close();
    };
    client.on('notification', notification); client.on('disconnected', disconnected); client.on('request', request);
    signal.addEventListener('abort', abort, { once: true });
    try {
      if (signal.aborted) throw new Error('DAG 실행이 중단되었습니다.');
      const catalog = await client.request('model/list', {});
      const model = catalog.data?.find((model: any) => model.isDefault) ?? catalog.data?.[0];
      if (!model) throw new Error('사용 가능한 Codex 모델이 없습니다.');
      const response = await client.request('thread/start', { model: model.model ?? model.id, cwd: root,
        approvalPolicy: 'never', sandbox: 'workspace-write', ephemeral: true, developerInstructions: instructions });
      threadId = response.thread?.id;
      if (!threadId) throw new Error('Codex thread ID가 없습니다.');
      if (signal.aborted) throw new Error('DAG 실행이 중단되었습니다.');
      const started = await client.request('turn/start', { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }],
        approvalPolicy: 'never', sandboxPolicy: { type: 'workspaceWrite', writableRoots: [root], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false } });
      turnId = started.turn?.id;
      return await completion;
    } finally {
      signal.removeEventListener('abort', abort);
      client.off('notification', notification); client.off('disconnected', disconnected); client.off('request', request); client.close();
    }
  };
}
