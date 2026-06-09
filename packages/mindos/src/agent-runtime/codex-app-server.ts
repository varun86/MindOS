import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { MindOSSSEvent } from '../session/index.js';

export type CodexAppServerClientInfo = {
  name: string;
  title: string;
  version: string;
};

export type CodexAppServerRequest = {
  method: string;
  id: number;
  params?: Record<string, unknown>;
};

export type CodexAppServerServerRequest = {
  method: string;
  id: number;
  params?: Record<string, unknown>;
};

export type CodexAppServerNotification = {
  method: string;
  params?: Record<string, unknown>;
};

export type CodexAppServerResponse = {
  id: number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

export type CodexAppServerClientResponse = {
  id: number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

export type CodexAppServerMessage =
  | CodexAppServerResponse
  | CodexAppServerNotification
  | CodexAppServerServerRequest;

export type CodexAppServerTransport = {
  send(message: CodexAppServerRequest | CodexAppServerNotification | CodexAppServerClientResponse): void | Promise<void>;
  read(signal?: AbortSignal): AsyncIterable<CodexAppServerMessage>;
  close?(): void | Promise<void>;
};

export type CodexAppServerClientOptions = {
  clientInfo?: CodexAppServerClientInfo;
  handleServerRequest?: (request: CodexAppServerServerRequest) => Promise<unknown> | unknown;
};

export type CodexTurnInput = Array<{ type: 'text'; text: string }>;

export type CodexAppServerClient = {
  initialize(): Promise<void>;
  startThread(input?: { model?: string }): Promise<{ threadId: string }>;
  resumeThread(input: { threadId: string }): Promise<{ threadId: string }>;
  startTurn(input: {
    threadId: string;
    input: CodexTurnInput;
    cwd?: string;
    signal?: AbortSignal;
  }): AsyncIterable<CodexAppServerNotification>;
  interruptTurn?(input: { threadId: string; turnId?: string }): Promise<void>;
  close?(): void | Promise<void>;
};

type PendingRequest = {
  method: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
};

class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = [];
  private readers: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    const reader = this.readers.shift();
    if (reader) {
      reader({ value, done: false });
      return;
    }
    this.values.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const reader of this.readers.splice(0)) {
      reader({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<T>>((resolve) => this.readers.push(resolve));
      },
    };
  }
}

export function createCodexAppServerClient(
  transport: CodexAppServerTransport,
  options: CodexAppServerClientOptions = {},
): CodexAppServerClient {
  const clientInfo = options.clientInfo ?? {
    name: 'mindos',
    title: 'MindOS',
    version: '0.1.0',
  };
  const pending = new Map<number, PendingRequest>();
  const notifications = new AsyncQueue<CodexAppServerNotification>();
  let nextId = 1;
  let readStarted = false;

  const startReadLoop = (signal?: AbortSignal) => {
    if (readStarted) return;
    readStarted = true;
    void (async () => {
      try {
        for await (const message of transport.read(signal)) {
          if (isCodexResponse(message)) {
            const request = pending.get(message.id);
            if (!request) continue;
            pending.delete(message.id);
            if (message.error) {
              request.reject(new Error(formatCodexJsonRpcError(request.method, message.error)));
            } else {
              request.resolve(message.result);
            }
            continue;
          }
          if (isCodexServerRequest(message)) {
            await respondToServerRequest(message);
            continue;
          }
          if (isCodexNotification(message)) notifications.push(message);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        for (const request of pending.values()) request.reject(err);
        pending.clear();
      } finally {
        notifications.close();
      }
    })();
  };

  const request = async (method: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<unknown> => {
    startReadLoop(signal);
    const id = nextId++;
    const response = new Promise<unknown>((resolve, reject) => {
      pending.set(id, { method, resolve, reject });
    });
    await transport.send({ method, id, params });
    return response;
  };

  const notify = async (method: string, params: Record<string, unknown> = {}): Promise<void> => {
    await transport.send({ method, params });
  };

  const respondToServerRequest = async (message: CodexAppServerServerRequest): Promise<void> => {
    try {
      const result = options.handleServerRequest
        ? await options.handleServerRequest(message)
        : defaultCodexServerRequestResult(message);
      await transport.send({ id: message.id, result });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await transport.send({
        id: message.id,
        error: {
          code: -32000,
          message: err.message || `Codex app-server request ${message.method} failed`,
        },
      });
    }
  };

  return {
    async initialize() {
      await request('initialize', { clientInfo });
      await notify('initialized');
    },
    async startThread(input = {}) {
      const params = input.model ? { model: input.model } : {};
      const result = await request('thread/start', params);
      return { threadId: getThreadId(result, 'thread/start') };
    },
    async resumeThread(input) {
      const result = await request('thread/resume', { threadId: input.threadId });
      return { threadId: getThreadId(result, 'thread/resume') ?? input.threadId };
    },
    async *startTurn(input) {
      const params: Record<string, unknown> = {
        threadId: input.threadId,
        input: input.input,
        ...(input.cwd ? { cwd: input.cwd } : {}),
      };
      await request('turn/start', params, input.signal);
      for await (const notification of notifications) {
        yield notification;
        if (isCodexTerminalTurnNotification(notification)) break;
      }
    },
    async interruptTurn(input) {
      await request('turn/interrupt', {
        threadId: input.threadId,
        ...(input.turnId ? { turnId: input.turnId } : {}),
      });
    },
    close: () => transport.close?.(),
  };
}

export function createCodexAppServerStdioTransport(options: {
  command?: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): CodexAppServerTransport {
  const command = options.command ?? 'codex';
  const args = options.args ?? ['app-server'];
  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: { ...process.env, ...(options.env ?? {}) },
  });
  const lines = createInterface({ input: child.stdout });
  let stderr = '';
  let spawnError: Error | null = null;
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  child.once('error', (error) => {
    spawnError = error;
  });
  const childClose = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('close', (code, signal) => resolve({ code, signal }));
  });

  return {
    send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    async *read() {
      try {
        for await (const line of lines) {
          if (typeof line !== 'string' || !line.trim()) continue;
          yield JSON.parse(line) as CodexAppServerMessage;
        }
        const result = await childClose;
        if (spawnError) throw spawnError;
        if (result.code && result.code !== 0) {
          throw new Error(stderr.trim() || `Codex app-server exited with code ${result.code}`);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message) throw err;
        throw new Error(stderr.trim() || 'Codex app-server stopped unexpectedly');
      }
    },
    close() {
      lines.close();
      child.kill();
    },
  };
}

export function mapCodexAppServerNotificationToSseEvents(notification: CodexAppServerNotification): MindOSSSEvent[] {
  const toolEvents = mapCodexRuntimeToolNotification(notification);
  if (toolEvents.length > 0) return toolEvents;

  if (notification.method === 'error') {
    return [{ type: 'error', message: getCodexErrorMessage(notification.params, 'Codex app-server error') }];
  }

  if (notification.method === 'item/agentMessage/delta') {
    const delta = getStringParam(notification.params, 'delta') ?? getStringParam(notification.params, 'text');
    return delta ? [{ type: 'text_delta', delta }] : [];
  }

  if (notification.method === 'item/thinking/delta') {
    const delta = getStringParam(notification.params, 'delta') ?? getStringParam(notification.params, 'text');
    return delta ? [{ type: 'thinking_delta', delta }] : [];
  }

  if (
    notification.method === 'item/reasoning/textDelta'
    || notification.method === 'item/reasoning/summaryTextDelta'
    || notification.method === 'item/reasoning/summaryPartAdded'
  ) {
    const delta = getStringParam(notification.params, 'delta')
      ?? getStringParam(notification.params, 'text')
      ?? getStringParam(notification.params, 'summary');
    return delta ? [{ type: 'thinking_delta', delta }] : [];
  }

  if (notification.method === 'turn/completed') {
    const status = getCodexTurnStatus(notification.params);
    if (status && status !== 'completed' && status !== 'success') {
      return [{ type: 'error', message: getCodexErrorMessage(notification.params, `Codex turn ${status}`) }];
    }
    return [{ type: 'done' }];
  }

  if (notification.method === 'turn/failed') {
    return [{ type: 'error', message: getCodexErrorMessage(notification.params, 'Codex turn failed') }];
  }

  return [];
}

function mapCodexRuntimeToolNotification(notification: CodexAppServerNotification): MindOSSSEvent[] {
  const method = notification.method;
  const lower = method.toLowerCase();
  if (!/(tool|command|exec|approval|permission|patch)/.test(lower)) return [];

  const params = notification.params ?? {};
  const toolCallId = getCodexToolCallId(method, params);
  const toolName = getCodexToolName(method, params);
  if (!toolCallId || !toolName) return [];

  if (/(end|ended|complete|completed|result|output|failed|error|rejected|denied|approved|allowed)/.test(lower)) {
    return [{
      type: 'tool_end',
      toolCallId,
      output: getCodexToolOutput(params),
      isError: /(failed|error|rejected|denied)/.test(lower) || params.isError === true || params.error !== undefined,
    }];
  }

  if (/(start|started|begin|began|added|call|request|requested|created)/.test(lower)) {
    return [{
      type: 'tool_start',
      toolCallId,
      toolName,
      args: getCodexToolInput(params),
      runtime: 'codex',
    }];
  }

  return [];
}

function formatCodexJsonRpcError(method: string, error: { code?: number; message?: string; data?: unknown }): string {
  const parts = [
    error.message?.trim() || `Codex app-server ${method} failed`,
    typeof error.code === 'number' ? `method=${method} code=${error.code}` : `method=${method}`,
    error.data !== undefined ? `data=${safeJson(error.data)}` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isCodexResponse(message: CodexAppServerMessage): message is CodexAppServerResponse {
  return typeof (message as CodexAppServerResponse).id === 'number'
    && typeof (message as CodexAppServerServerRequest).method !== 'string';
}

function isCodexNotification(message: CodexAppServerMessage): message is CodexAppServerNotification {
  return typeof (message as CodexAppServerNotification).method === 'string'
    && typeof (message as CodexAppServerServerRequest).id !== 'number';
}

function isCodexServerRequest(message: CodexAppServerMessage): message is CodexAppServerServerRequest {
  return typeof (message as CodexAppServerServerRequest).id === 'number'
    && typeof (message as CodexAppServerServerRequest).method === 'string';
}

function isCodexTerminalTurnNotification(notification: CodexAppServerNotification): boolean {
  return (
    notification.method === 'error'
    || notification.method === 'turn/completed'
    || notification.method === 'turn/failed'
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getThreadId(result: unknown, method: string): string {
  const record = asRecord(result);
  const thread = asRecord(record?.thread);
  const id = thread?.id;
  if (typeof id !== 'string' || !id) {
    throw new Error(`Codex app-server ${method} did not return a thread id`);
  }
  return id;
}

function getStringParam(params: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = params?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getCodexToolCallId(method: string, params: Record<string, unknown>): string {
  const direct = getStringParam(params, 'toolCallId')
    ?? getStringParam(params, 'callId')
    ?? getStringParam(params, 'itemId')
    ?? getStringParam(params, 'requestId')
    ?? getStringParam(params, 'id');
  if (direct) return direct;

  const item = asRecord(params.item);
  const nested = getStringField(item, 'id') ?? getStringField(item, 'callId');
  return nested ?? `codex-${method}`;
}

function getCodexToolName(method: string, params: Record<string, unknown>): string {
  const direct = getStringParam(params, 'toolName')
    ?? getStringParam(params, 'name')
    ?? getStringParam(params, 'tool')
    ?? getStringParam(params, 'commandName');
  if (direct) return direct;
  if (getStringParam(params, 'command')) return 'Bash';
  if (method.toLowerCase().includes('approval') || method.toLowerCase().includes('permission')) return 'approval_request';

  const item = asRecord(params.item);
  return getStringField(item, 'name') ?? getStringField(item, 'toolName') ?? method.split('/').at(-1) ?? method;
}

function getCodexToolInput(params: Record<string, unknown>): unknown {
  return params.input
    ?? params.arguments
    ?? params.args
    ?? params.command
    ?? asRecord(params.item)?.input
    ?? params;
}

function getCodexToolOutput(params: Record<string, unknown>): string {
  const direct = getStringParam(params, 'output')
    ?? getStringParam(params, 'result')
    ?? getStringParam(params, 'message')
    ?? getStringParam(params, 'text');
  if (direct) return direct;

  const error = asRecord(params.error);
  const errorMessage = getStringField(error, 'message') ?? getStringField(error, 'detail');
  if (errorMessage) return errorMessage;

  const item = asRecord(params.item);
  const itemOutput = getStringField(item, 'output') ?? getStringField(item, 'result');
  if (itemOutput) return itemOutput;

  return safeJson(params);
}

function getCodexTurnStatus(params: Record<string, unknown> | undefined): string | undefined {
  const direct = getStringParam(params, 'status');
  if (direct) return direct;
  const turn = asRecord(params?.turn);
  const nested = turn?.status;
  return typeof nested === 'string' ? nested : undefined;
}

function getCodexErrorMessage(params: Record<string, unknown> | undefined, fallback: string): string {
  const direct = getStringParam(params, 'message') ?? getStringParam(params, 'errorMessage');
  if (direct) return direct;

  const error = asRecord(params?.error);
  const errorMessage = getStringField(error, 'message') ?? getStringField(error, 'detail');
  if (errorMessage) return errorMessage;

  const turn = asRecord(params?.turn);
  const turnError = asRecord(turn?.error);
  const turnMessage = getStringField(turnError, 'message')
    ?? getStringField(turnError, 'detail')
    ?? getStringField(turn, 'message');
  if (turnMessage) return turnMessage;

  const status = getCodexTurnStatus(params);
  return status ? `${fallback}: ${status}` : fallback;
}

function getStringField(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function defaultCodexServerRequestResult(request: CodexAppServerServerRequest): unknown {
  if (/requestApproval|approval|permission/i.test(request.method)) {
    return { decision: 'cancel' };
  }
  throw new Error(`Unhandled Codex app-server request: ${request.method}`);
}
