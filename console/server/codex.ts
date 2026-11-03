import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';

export type RpcId = string | number;
export type CodexNotification = { method: string; params: any };
export type CodexServerRequest = CodexNotification & { id: RpcId };
export type CodexOptions = { command?: string; args?: string[]; cwd?: string; timeoutMs?: number; incomingTimeoutMs?: number };
type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };

export class CodexRpcError extends Error {
  code: number | undefined;
  constructor(message: string, code?: number) { super(message); this.name = 'CodexRpcError'; this.code = code; }
}

// Codex's local app-server owns authentication and model calls. The browser never receives credentials.
export class CodexClient extends EventEmitter {
  private options: CodexOptions;
  private child: ChildProcessWithoutNullStreams | null = null;
  private starting: Promise<void> | null = null;
  private ready = false;
  private closed = false;
  private nextId = 1;
  private buffer = '';
  private stderr = '';
  private pending = new Map<RpcId, Pending>();
  private incoming = new Map<RpcId, { request: CodexServerRequest; timer: NodeJS.Timeout }>();

  constructor(options: CodexOptions = {}) { super(); this.options = options; }

  start(): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Codex client is closed'));
    if (this.ready) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = this.initialize().finally(() => { this.starting = null; });
    return this.starting;
  }

  private async initialize(): Promise<void> {
    this.buffer = '';
    this.stderr = '';
    const child = spawn(this.options.command ?? 'codex', this.options.args ?? ['app-server', '--stdio'], {
      cwd: this.options.cwd, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.read(chunk));
    // Keep diagnostics bounded, but do not expose raw CLI stderr: it may contain auth details.
    child.stderr.on('data', (chunk: string) => { this.stderr = (this.stderr + chunk).slice(-8192); });
    child.stdin.on('error', () => { this.disconnect(new Error('Codex app-server input stream closed'), child); child.kill(); });
    child.on('error', (error: NodeJS.ErrnoException) => {
      this.disconnect(new Error(`Could not start Codex app-server (${error.code ?? 'process error'})`), child);
    });
    child.on('exit', (code, signal) => {
      this.disconnect(new Error(`Codex app-server exited (${signal ?? code ?? 'unknown'})`), child);
    });
    try {
      await this.rpc('initialize', {
        clientInfo: { name: 'proofstill', title: 'Proofstill', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      });
      if (this.closed || this.child !== child) throw new Error('Codex app-server disconnected during initialization');
      this.write({ method: 'initialized', params: {} });
      this.ready = true;
    } catch (error) {
      if (this.child === child) {
        this.disconnect(error instanceof Error ? error : new Error('Codex initialization failed'), child);
        child.kill();
      }
      throw error;
    }
  }

  async request(method: string, params: unknown = {}): Promise<any> {
    await this.start();
    return this.rpc(method, params);
  }

  private rpc(method: string, params: unknown): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, this.options.timeoutMs ?? 30_000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.write({ id, method, params }); }
      catch (error) {
        clearTimeout(timer); this.pending.delete(id);
        reject(error instanceof Error ? error : new Error('Codex request failed'));
      }
    });
  }

  respond(id: RpcId, result: unknown): void {
    const incoming = this.incoming.get(id);
    if (!incoming) throw new Error('Codex server request is no longer pending');
    clearTimeout(incoming.timer); this.incoming.delete(id);
    this.write({ id, result });
  }

  private write(message: unknown): void {
    if (!this.child || this.child.stdin.destroyed || this.closed) throw new Error('Codex app-server is not connected');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }

  private read(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 32 * 1024 * 1024) {
      const child = this.child;
      this.disconnect(new Error('Codex app-server frame is too large'), child);
      child?.kill(); return;
    }
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); }
      catch {
        const child = this.child;
        this.disconnect(new Error('Invalid Codex app-server JSON frame'), child);
        child?.kill(); return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) continue;
      const hasId = typeof message.id === 'string' || typeof message.id === 'number';
      if (typeof message.method === 'string') {
        if (hasId) this.handleRequest({ id: message.id, method: message.method, params: message.params ?? {} });
        else this.emit('notification', { method: message.method, params: message.params ?? {} });
      } else if (hasId) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        clearTimeout(pending.timer); this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new CodexRpcError(safeMessage(message.error.message), message.error.code));
        } else pending.resolve(message.result);
      }
    }
  }

  private handleRequest(request: CodexServerRequest): void {
    if (this.incoming.has(request.id)) return;
    const timer = setTimeout(() => {
      if (!this.incoming.has(request.id)) return;
      this.decline(request.id);
      this.emit('requestExpired', request);
    }, this.options.incomingTimeoutMs ?? 300_000);
    this.incoming.set(request.id, { request, timer });
    if (!this.listenerCount('request')) { this.decline(request.id); return; }
    try { this.emit('request', request); }
    catch { this.decline(request.id); }
  }

  private decline(id: RpcId): void {
    const pending = this.incoming.get(id);
    if (!pending) return;
    const method = pending.request.method;
    try {
      if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
        this.respond(id, { decision: 'decline' });
      } else if (method === 'item/tool/call') {
        this.respond(id, { success: false, contentItems: [{ type: 'inputText', text: 'Tool is not available in this client.' }] });
      } else if (method === 'item/permissions/requestApproval') {
        this.respond(id, { permissions: {}, scope: 'turn' });
      } else if (method === 'item/tool/requestUserInput') {
        this.respond(id, { answers: {} });
      } else if (method === 'mcpServer/elicitation/request') {
        this.respond(id, { action: 'decline', content: null });
      } else {
        clearTimeout(pending.timer); this.incoming.delete(id);
        this.write({ id, error: { code: -32601, message: 'Unsupported client request' } });
      }
    } catch {
      clearTimeout(pending.timer); this.incoming.delete(id);
    }
  }

  private disconnect(error: Error, child: ChildProcessWithoutNullStreams | null): void {
    if (!child || this.child !== child) return;
    this.child = null; this.ready = false; this.buffer = ''; this.stderr = '';
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    for (const incoming of this.incoming.values()) clearTimeout(incoming.timer);
    this.incoming.clear();
    if (!this.closed) this.emit('disconnected', error);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    const child = this.child;
    this.closed = true;
    if (!child) return;
    this.disconnect(new Error('Codex client is closed'), child);
    child.stdin.end();
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 1000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGTERM');
    });
  }
}

function safeMessage(value: unknown): string {
  if (typeof value !== 'string') return 'Codex app-server request failed';
  return value.slice(0, 2048)
    .replace(/\b(?:sk|sess)-[A-Za-z0-9_-]{8,}\b/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/("?(?:access_token|refresh_token|api_key)"?\s*[:=]\s*)[^\s,}]+/gi, '$1[redacted]');
}
