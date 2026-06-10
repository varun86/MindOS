import { describe, expect, it, vi } from 'vitest';
import {
  createClaudeCodeCliClient,
  createCodexAppServerClient,
  mapCodexAppServerNotificationToSseEvents,
  runMindosAgentRuntimeAskSession,
  type CodexAppServerMessage,
  type CodexAppServerTransport,
  type ClaudeCodeCliTransport,
  type MindOSSSEvent,
} from './agent-runtime.js';

class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = [];
  private readers: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T): void {
    const reader = this.readers.shift();
    if (reader) {
      reader({ value, done: false });
      return;
    }
    this.values.push(value);
  }

  close(): void {
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

function createFakeCodexTransport(): CodexAppServerTransport & { sent: unknown[] } {
  const queue = new AsyncQueue<CodexAppServerMessage>();
  const sent: unknown[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      const record = message as { id?: number; method?: string; params?: Record<string, unknown> };
      if (record.method === 'initialize') {
        queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
      }
      if (record.method === 'thread/start') {
        queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
      }
      if (record.method === 'thread/resume') {
        queue.push({ id: record.id!, result: { thread: { id: record.params?.threadId } } });
      }
      if (record.method === 'turn/start') {
        queue.push({ id: record.id!, result: { turn: { id: 'turn-1' } } });
        queue.push({ method: 'item/agentMessage/delta', params: { delta: 'Hello' } });
        queue.push({ method: 'turn/completed', params: { turn: { id: 'turn-1' }, status: 'completed' } });
      }
    },
    read() {
      return queue;
    },
    close() {
      queue.close();
    },
  };
}

function createFakeClaudeTransport(lines: string[]): ClaudeCodeCliTransport & { argv: string[] | null } {
  return {
    argv: null,
    run(args) {
      this.argv = args;
      return {
        async *[Symbol.asyncIterator]() {
          for (const line of lines) yield line;
        },
      };
    },
  };
}

describe('agent runtime adapters', () => {
  it('drives Codex app-server over JSON-RPC and streams turn notifications', async () => {
    const transport = createFakeCodexTransport();
    const client = createCodexAppServerClient(transport, {
      clientInfo: { name: 'mindos_test', title: 'MindOS Test', version: '0.0.0' },
    });

    await client.initialize();
    const thread = await client.startThread({ cwd: '/tmp/mind' });
    const notifications = [];
    for await (const notification of client.startTurn({
      threadId: thread.threadId,
      cwd: '/tmp/mind',
      input: [{ type: 'text', text: 'Summarize this repo.' }],
    })) {
      notifications.push(notification);
    }

    expect(transport.sent).toEqual([
      {
        method: 'initialize',
        id: 1,
        params: {
          clientInfo: { name: 'mindos_test', title: 'MindOS Test', version: '0.0.0' },
          capabilities: { experimentalApi: true },
        },
      },
      { method: 'initialized', params: {} },
      { method: 'thread/start', id: 2, params: {} },
      {
        method: 'turn/start',
        id: 3,
        params: {
          threadId: 'thr-new',
          cwd: '/tmp/mind',
          input: [{ type: 'text', text: 'Summarize this repo.' }],
        },
      },
    ]);
    expect(notifications).toEqual([
      { method: 'item/agentMessage/delta', params: { delta: 'Hello' } },
      { method: 'turn/completed', params: { turn: { id: 'turn-1' }, status: 'completed' } },
    ]);
  });

  it('uses a Codex-compatible default app-server client identity', async () => {
    const transport = createFakeCodexTransport();
    const client = createCodexAppServerClient(transport);

    await client.initialize();

    expect(transport.sent[0]).toEqual({
      method: 'initialize',
      id: 1,
      params: {
        clientInfo: { name: 'codex-mindos', title: 'Codex MindOS', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      },
    });
  });

  it('maps Codex notifications into MindOS SSE events', () => {
    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/agentMessage/delta',
      params: { delta: 'Hello' },
    })).toEqual([{ type: 'text_delta', delta: 'Hello' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/thinking/delta',
      params: { delta: 'Thinking' },
    })).toEqual([{ type: 'thinking_delta', delta: 'Thinking' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/reasoning/textDelta',
      params: { text: 'Reasoning' },
    })).toEqual([{ type: 'thinking_delta', delta: 'Reasoning' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'turn/completed',
      params: { status: 'completed' },
    })).toEqual([{ type: 'done' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'turn/completed',
      params: { status: 'failed', message: 'Missing credentials' },
    })).toEqual([{ type: 'error', message: 'Missing credentials' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'turn/completed',
      params: {
        turn: {
          status: 'failed',
          error: { message: 'Missing environment variable: `STAFF_KEY`.' },
        },
      },
    })).toEqual([{ type: 'error', message: 'Missing environment variable: `STAFF_KEY`.' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'error',
      params: { message: 'Codex app-server unavailable' },
    })).toEqual([{ type: 'error', message: 'Codex app-server unavailable' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'error',
      params: { error: { message: 'Missing environment variable: `STAFF_KEY`.' } },
    })).toEqual([{ type: 'error', message: 'Missing environment variable: `STAFF_KEY`.' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'turn/failed',
      params: { error: { message: 'Provider env is missing' } },
    })).toEqual([{ type: 'error', message: 'Provider env is missing' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/command/started',
      params: {
        id: 'cmd-1',
        command: 'mindos file delete "Profile.md"',
        description: 'Delete a note',
      },
    })).toEqual([{
      type: 'tool_start',
      toolCallId: 'cmd-1',
      toolName: 'Bash',
      args: 'mindos file delete "Profile.md"',
      runtime: 'codex',
    }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/permission/requested',
      params: {
        requestId: 'perm-1',
        toolName: 'Bash',
        command: 'mindos file delete "Profile.md"',
      },
    })).toEqual([{
      type: 'tool_start',
      toolCallId: 'perm-1',
      toolName: 'Bash',
      args: 'mindos file delete "Profile.md"',
      runtime: 'codex',
    }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/started',
      params: {
        item: {
          id: 'cmd-official-1',
          type: 'commandExecution',
          command: 'mindos search "permission"',
          status: 'running',
        },
      },
    })).toEqual([{
      type: 'tool_start',
      toolCallId: 'cmd-official-1',
      toolName: 'Bash',
      args: 'mindos search "permission"',
      runtime: 'codex',
    }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/commandExecution/outputDelta',
      params: {
        itemId: 'cmd-official-1',
        delta: 'Found 3 notes.\n',
      },
    })).toEqual([{
      type: 'tool_delta',
      toolCallId: 'cmd-official-1',
      toolName: 'Bash',
      delta: 'Found 3 notes.\n',
      runtime: 'codex',
    }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/completed',
      params: {
        item: {
          id: 'cmd-official-1',
          type: 'commandExecution',
          status: 'failed',
          error: { message: 'Command failed' },
        },
      },
    })).toEqual([{
      type: 'tool_end',
      toolCallId: 'cmd-official-1',
      toolName: 'Bash',
      output: 'Command failed',
      isError: true,
    }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'item/completed',
      params: {
        item: {
          id: 'mcp-tool-1',
          type: 'mcpToolCall',
          server: { name: 'mindos' },
          tool: { name: 'search', result: 'Found 3 notes.' },
          status: 'completed',
        },
      },
    })).toEqual([{
      type: 'tool_end',
      toolCallId: 'mcp-tool-1',
      toolName: 'mindos.search',
      output: 'Found 3 notes.',
      isError: false,
    }]);
  });

  it('includes the Codex JSON-RPC method, code, and data when a request fails', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const transport: CodexAppServerTransport = {
      send(message) {
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({
            id: record.id!,
            error: {
              code: -32600,
              message: '',
              data: { expected: ['thread/start', 'turn/start'] },
            },
          });
        }
      },
      read() {
        return queue;
      },
    };

    const client = createCodexAppServerClient(transport);
    await expect(client.initialize()).rejects.toThrow(
      'Codex app-server initialize failed method=initialize code=-32600 data={"expected":["thread/start","turn/start"]}',
    );
  });

  it('rejects a Codex JSON-RPC request when transport send fails', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const transport: CodexAppServerTransport = {
      send(message) {
        const record = message as { method?: string };
        if (record.method === 'initialize') {
          throw new Error('stdio pipe closed');
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    const client = createCodexAppServerClient(transport);
    await expect(client.initialize()).rejects.toThrow('stdio pipe closed');
    await client.close?.();
  });

  it('rejects a Codex turn start request when the run is aborted', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const transport: CodexAppServerTransport = {
      send(message) {
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
        }
        if (record.method === 'thread/start') {
          queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    const client = createCodexAppServerClient(transport);
    await client.initialize();
    const thread = await client.startThread();
    const controller = new AbortController();
    const iterator = client.startTurn({
      threadId: thread.threadId,
      input: [{ type: 'text', text: 'Continue.' }],
      signal: controller.signal,
    })[Symbol.asyncIterator]();

    const next = iterator.next();
    controller.abort();
    await expect(next).rejects.toThrow('Codex app-server turn/start aborted.');
    await client.close?.();
  });

  it('rejects a Codex JSON-RPC request that never receives a response', async () => {
    vi.useFakeTimers();
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const transport: CodexAppServerTransport = {
      send() {},
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };
    const client = createCodexAppServerClient(transport);

    try {
      const pending = client.initialize();
      const rejection = expect(pending).rejects.toThrow('Codex app-server initialize timed out after 60000ms.');
      await vi.advanceTimersByTimeAsync(60_000);
      await rejection;
    } finally {
      await client.close?.();
      vi.useRealTimers();
    }
  });

  it('maps Codex app-server error notifications into visible stream errors', () => {
    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'error',
      params: { message: 'STAFF_KEY is not configured' },
    })).toEqual([{ type: 'error', message: 'STAFF_KEY is not configured' }]);

    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'error',
      params: {
        error: {
          code: 'auth_missing',
          message: 'Sign in to Codex',
        },
      },
    })).toEqual([{ type: 'error', message: 'Sign in to Codex' }]);
  });

  it('does not treat failed Codex turn/completed notifications as done', () => {
    expect(mapCodexAppServerNotificationToSseEvents({
      method: 'turn/completed',
      params: {
        turn: {
          id: 'turn-1',
          status: 'failed',
          error: { message: 'model unavailable' },
        },
      },
    })).toEqual([{ type: 'error', message: 'model unavailable' }]);
  });

  it('ends a Codex turn stream after turn/failed', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const sent: unknown[] = [];
    const transport: CodexAppServerTransport = {
      send(message) {
        sent.push(message);
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
        }
        if (record.method === 'thread/start') {
          queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
        }
        if (record.method === 'turn/start') {
          queue.push({ id: record.id!, result: { turn: { id: 'turn-1' } } });
          queue.push({ method: 'turn/failed', params: { message: 'model unavailable' } });
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    const client = createCodexAppServerClient(transport);
    await client.initialize();
    const thread = await client.startThread({ cwd: '/tmp/mind' });
    const notifications = [];
    for await (const notification of client.startTurn({
      threadId: thread.threadId,
      cwd: '/tmp/mind',
      input: [{ type: 'text', text: 'Summarize this repo.' }],
    })) {
      notifications.push(notification);
    }

    expect(notifications).toEqual([
      { method: 'turn/failed', params: { message: 'model unavailable' } },
    ]);
  });

  it('ends a Codex turn stream after app-server error notifications', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const transport: CodexAppServerTransport = {
      send(message) {
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
        }
        if (record.method === 'thread/start') {
          queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
        }
        if (record.method === 'turn/start') {
          queue.push({ id: record.id!, result: { turn: { id: 'turn-1' } } });
          queue.push({ method: 'error', params: { message: 'STAFF_KEY is not configured' } });
          queue.push({ method: 'turn/completed', params: { turn: { id: 'turn-1', status: 'failed' } } });
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    const client = createCodexAppServerClient(transport);
    await client.initialize();
    const thread = await client.startThread({ cwd: '/tmp/mind' });
    const notifications = [];
    for await (const notification of client.startTurn({
      threadId: thread.threadId,
      cwd: '/tmp/mind',
      input: [{ type: 'text', text: 'Summarize this repo.' }],
    })) {
      notifications.push(notification);
    }

    expect(notifications).toEqual([
      { method: 'error', params: { message: 'STAFF_KEY is not configured' } },
    ]);
  });

  it('runs a Codex native Ask session and returns the external thread binding', async () => {
    const events: MindOSSSEvent[] = [];
    const transport = createFakeCodexTransport();
    const result = await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'codex', id: 'codex', name: 'Codex' },
      cwd: '/tmp/mind',
      prompt: 'Summarize this repo.',
      send: (event) => events.push(event),
      services: {
        createCodexClient: () => createCodexAppServerClient(transport),
      },
    });

    expect(result).toEqual({ externalSessionId: 'thr-new' });
    expect(events).toEqual([
      { type: 'runtime_binding', runtime: 'codex', externalSessionId: 'thr-new', cwd: '/tmp/mind' },
      { type: 'text_delta', delta: 'Hello' },
      { type: 'done' },
    ]);
  });

  it('resumes an existing Codex thread when the runtime carries an external session id', async () => {
    const transport = createFakeCodexTransport();
    await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'codex', id: 'codex', name: 'Codex', externalSessionId: 'thr-existing' },
      cwd: '/tmp/mind',
      prompt: 'Continue.',
      send: () => {},
      services: {
        createCodexClient: () => createCodexAppServerClient(transport),
      },
    });

    expect(transport.sent).toContainEqual({
      method: 'thread/resume',
      id: 2,
      params: { threadId: 'thr-existing' },
    });
    expect(transport.sent).not.toContainEqual({
      method: 'thread/start',
      id: 2,
      params: {},
    });
  });

  it('answers Codex app-server approval requests through the runtime permission service', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const sent: unknown[] = [];
    let requestedPermission: unknown;
    const transport: CodexAppServerTransport & { sent: unknown[] } = {
      sent,
      send(message) {
        sent.push(message);
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
        }
        if (record.method === 'thread/start') {
          queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
        }
        if (record.method === 'turn/start') {
          queue.push({ id: record.id!, result: { turn: { id: 'turn-1' } } });
          queue.push({
            id: 99,
            method: 'item/commandExecution/requestApproval',
            params: {
              itemId: 'cmd-1',
              command: 'mindos file delete "Profile.md"',
              reason: 'Delete a note',
            },
          });
          queue.push({ method: 'item/agentMessage/delta', params: { delta: 'Deleted.' } });
          queue.push({ method: 'turn/completed', params: { turn: { id: 'turn-1' }, status: 'completed' } });
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    const events: MindOSSSEvent[] = [];
    await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'codex', id: 'codex', name: 'Codex' },
      cwd: '/tmp/mind',
      prompt: 'Delete it.',
      send: (event) => events.push(event),
      services: {
        createCodexClient: ({ handleServerRequest }) => createCodexAppServerClient(transport, { handleServerRequest }),
        requestRuntimePermission: async (request) => {
          requestedPermission = request;
          return { decision: 'accept' };
        },
      },
    });

    expect(requestedPermission).toMatchObject({
      runtime: 'codex',
      toolCallId: 'cmd-1',
      toolName: 'Bash',
      reason: 'Delete a note',
      input: {
        method: 'item/commandExecution/requestApproval',
        command: 'mindos file delete "Profile.md"',
      },
    });
    expect(transport.sent).toContainEqual({
      id: 99,
      result: { decision: 'accept' },
    });
    expect(events).toContainEqual({ type: 'text_delta', delta: 'Deleted.' });
  });

  it('answers Codex app-server user input requests through the question service', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const sent: unknown[] = [];
    let requestedQuestion: unknown;
    const transport: CodexAppServerTransport & { sent: unknown[] } = {
      sent,
      send(message) {
        sent.push(message);
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
        }
        if (record.method === 'thread/start') {
          queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
        }
        if (record.method === 'turn/start') {
          queue.push({ id: record.id!, result: { turn: { id: 'turn-1' } } });
          queue.push({
            id: 100,
            method: 'item/tool/requestUserInput',
            params: {
              requestId: 'question-1',
              questions: [{
                question: 'Delete the CV review note?',
                header: 'Delete confirmation',
                options: [
                  { label: 'Delete', description: 'Remove the note.' },
                  { label: 'Keep', description: 'Leave it unchanged.' },
                ],
              }],
            },
          });
          queue.push({ method: 'turn/completed', params: { turn: { id: 'turn-1' }, status: 'completed' } });
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'codex', id: 'codex', name: 'Codex' },
      cwd: '/tmp/mind',
      prompt: 'Delete it.',
      send: () => {},
      services: {
        createCodexClient: ({ handleServerRequest }) => createCodexAppServerClient(transport, { handleServerRequest }),
        requestUserQuestion: async (request) => {
          requestedQuestion = request;
          return {
            answers: [{
              questionIndex: 0,
              question: 'Delete the CV review note?',
              kind: 'option',
              answer: 'Delete',
            }],
          };
        },
      },
    });

    expect(requestedQuestion).toMatchObject({
      runtime: 'codex',
      toolCallId: 'question-1',
      questions: [{
        question: 'Delete the CV review note?',
        header: 'Delete confirmation',
        options: [
          { label: 'Delete', description: 'Remove the note.' },
          { label: 'Keep', description: 'Leave it unchanged.' },
        ],
      }],
    });
    expect(transport.sent).toContainEqual({
      id: 100,
      result: {
        answers: [{
          questionIndex: 0,
          question: 'Delete the CV review note?',
          kind: 'option',
          answer: 'Delete',
        }],
      },
    });
  });

  it('cancels a pending Codex user input request when app-server resolves it first', async () => {
    const queue = new AsyncQueue<CodexAppServerMessage>();
    const sent: unknown[] = [];
    let sawAbort = false;
    const transport: CodexAppServerTransport & { sent: unknown[] } = {
      sent,
      send(message) {
        sent.push(message);
        const record = message as { id?: number; method?: string };
        if (record.method === 'initialize') {
          queue.push({ id: record.id!, result: { userAgent: 'codex-test' } });
        }
        if (record.method === 'thread/start') {
          queue.push({ id: record.id!, result: { thread: { id: 'thr-new' } } });
        }
        if (record.method === 'turn/start') {
          queue.push({ id: record.id!, result: { turn: { id: 'turn-1' } } });
          queue.push({
            id: 100,
            method: 'item/tool/requestUserInput',
            params: {
              requestId: 'question-1',
              questions: [{ question: 'Continue?', header: 'Continue', options: ['Yes', 'No'] }],
            },
          });
          queue.push({ method: 'serverRequest/resolved', params: { requestId: 'question-1' } });
          queue.push({ method: 'turn/completed', params: { turn: { id: 'turn-1' }, status: 'completed' } });
        }
      },
      read() {
        return queue;
      },
      close() {
        queue.close();
      },
    };

    await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'codex', id: 'codex', name: 'Codex' },
      cwd: '/tmp/mind',
      prompt: 'Continue?',
      send: () => {},
      services: {
        createCodexClient: ({ handleServerRequest }) => createCodexAppServerClient(transport, { handleServerRequest }),
        requestUserQuestion: (_request, callOptions) => new Promise((resolve) => {
          callOptions?.signal?.addEventListener('abort', () => {
            sawAbort = true;
            resolve({ answers: [], cancelled: true, error: 'server_request_resolved' });
          }, { once: true });
        }),
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(sawAbort).toBe(true);
    expect(transport.sent).toContainEqual({
      id: 100,
      result: { cancelled: true, answers: [], error: 'server_request_resolved' },
    });
  });

  it('streams Claude Code CLI output and returns the session binding', async () => {
    const events: MindOSSSEvent[] = [];
    const transport = createFakeClaudeTransport([
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 'claude-session-1' }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } }),
      JSON.stringify({ type: 'result', subtype: 'success', session_id: 'claude-session-1' }),
    ]);

    const result = await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'claude', id: 'claude', name: 'Claude Code' },
      cwd: '/tmp/mind',
      prompt: 'Review this.',
      send: (event) => events.push(event),
      services: {
        createClaudeClient: () => createClaudeCodeCliClient(transport),
      },
    });

    expect(transport.argv).toEqual([
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'default',
      'Review this.',
    ]);
    expect(result).toEqual({ externalSessionId: 'claude-session-1' });
    expect(events).toEqual([
      { type: 'runtime_binding', runtime: 'claude', externalSessionId: 'claude-session-1', cwd: '/tmp/mind' },
      { type: 'text_delta', delta: 'Hello' },
      { type: 'done' },
    ]);
  });

  it('adds a Claude Code permission prompt MCP bridge when configured', async () => {
    const transport = createFakeClaudeTransport([
      JSON.stringify({ type: 'result', subtype: 'success', session_id: 'claude-session-2' }),
    ]);

    const client = createClaudeCodeCliClient(transport);
    const events = [];
    for await (const event of client.startTurn({
      prompt: 'Delete it.',
      cwd: '/tmp/mind',
      permissionPrompt: {
        toolName: 'mcp__mindos_runtime_permission__mindos_runtime_permission',
        mcpConfig: {
          mcpServers: {
            mindos_runtime_permission: {
              type: 'stdio',
              command: 'node',
              args: ['permission-server.mjs'],
            },
          },
        },
      },
    })) {
      events.push(event);
    }

    const argv = transport.argv ?? [];
    expect(argv).toContain('--mcp-config');
    expect(argv).toContain('--permission-prompt-tool');
    expect(argv).toContain('mcp__mindos_runtime_permission__mindos_runtime_permission');
    const mcpConfigArg = argv[argv.indexOf('--mcp-config') + 1] ?? '';
    expect(JSON.parse(mcpConfigArg)).toMatchObject({
      mcpServers: {
        mindos_runtime_permission: {
          type: 'stdio',
          command: 'node',
        },
      },
    });
    expect(events).toContainEqual({ type: 'done' });
  });

  it('passes the per-run Claude permission prompt service into the CLI adapter', async () => {
    const transport = createFakeClaudeTransport([
      JSON.stringify({ type: 'result', subtype: 'success', session_id: 'claude-session-3' }),
    ]);

    await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'claude', id: 'claude', name: 'Claude Code' },
      cwd: '/tmp/mind',
      prompt: 'Delete it.',
      send: () => {},
      services: {
        createClaudeClient: () => createClaudeCodeCliClient(transport),
        createClaudePermissionPrompt: () => ({
          toolName: 'mcp__mindos_runtime_permission__mindos_runtime_permission',
          mcpConfig: '{"mcpServers":{"mindos_runtime_permission":{"type":"stdio","command":"node"}}}',
        }),
      },
    });

    expect(transport.argv).toContain('--permission-prompt-tool');
    expect(transport.argv).toContain('mcp__mindos_runtime_permission__mindos_runtime_permission');
  });

  it('maps Claude Code Bash tool use into a native runtime tool event', async () => {
    const transport = createFakeClaudeTransport([
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [{
            type: 'tool_use',
            id: 'toolu-1',
            name: 'Bash',
            input: {
              command: 'mindos file delete "Profile.md"',
              description: 'Delete a note',
            },
          }],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          content: [{
            type: 'tool_result',
            tool_use_id: 'toolu-1',
            content: 'Deleted Profile.md',
          }],
        },
      }),
      JSON.stringify({ type: 'result', subtype: 'success' }),
    ]);

    const client = createClaudeCodeCliClient(transport);
    const events = [];
    for await (const event of client.startTurn({ prompt: 'Delete it.', cwd: '/tmp/mind' })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'tool_start',
        toolCallId: 'toolu-1',
        toolName: 'Bash',
        args: {
          command: 'mindos file delete "Profile.md"',
          description: 'Delete a note',
        },
        runtime: 'claude',
      },
      {
        type: 'tool_end',
        toolCallId: 'toolu-1',
        output: 'Deleted Profile.md',
        isError: false,
      },
      { type: 'done' },
    ]);
  });

  it('maps Claude Code permission denied system events into visible native runtime tool errors', async () => {
    const transport = createFakeClaudeTransport([
      JSON.stringify({
        type: 'system',
        subtype: 'permission_denied',
        tool_use_id: 'toolu-denied',
        tool_name: 'Bash',
        reason: 'User denied this command.',
        blockedPath: '/tmp/mind/Profile.md',
      }),
      JSON.stringify({ type: 'result', subtype: 'success' }),
    ]);

    const client = createClaudeCodeCliClient(transport);
    const events = [];
    for await (const event of client.startTurn({ prompt: 'Delete it.', cwd: '/tmp/mind' })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'tool_start',
        toolCallId: 'toolu-denied',
        toolName: 'Bash',
        args: {
          reason: 'User denied this command.',
          blockedPath: '/tmp/mind/Profile.md',
        },
        runtime: 'claude',
      },
      {
        type: 'tool_end',
        toolCallId: 'toolu-denied',
        output: 'User denied this command.',
        isError: true,
      },
      { type: 'done' },
    ]);
  });

  it('maps Claude Code API retry system events into visible runtime status', async () => {
    const transport = createFakeClaudeTransport([
      JSON.stringify({
        type: 'system',
        subtype: 'api_retry',
        attempt: 1,
        max_retries: 10,
        retry_delay_ms: 548,
        error_status: 429,
        error: 'rate_limit',
        session_id: 'claude-retry-session',
      }),
      JSON.stringify({ type: 'result', subtype: 'success' }),
    ]);

    const client = createClaudeCodeCliClient(transport);
    const events = [];
    for await (const event of client.startTurn({ prompt: 'Say hi.', cwd: '/tmp/mind' })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'session_id', sessionId: 'claude-retry-session' },
      {
        type: 'status',
        visible: true,
        message: 'Claude Code HTTP 429; retrying (1/10). Retrying in 1s.',
      },
      { type: 'done' },
    ]);
  });

  it('resumes an existing Claude Code session when the runtime carries an external session id', async () => {
    const transport = createFakeClaudeTransport([
      JSON.stringify({ type: 'result', subtype: 'success', session_id: 'claude-existing' }),
    ]);

    await runMindosAgentRuntimeAskSession({
      runtime: { kind: 'claude', id: 'claude', name: 'Claude Code', externalSessionId: 'claude-existing' },
      cwd: '/tmp/mind',
      prompt: 'Continue.',
      send: () => {},
      services: {
        createClaudeClient: () => createClaudeCodeCliClient(transport),
      },
    });

    expect(transport.argv).toContain('--resume');
    expect(transport.argv).toContain('claude-existing');
  });
});
