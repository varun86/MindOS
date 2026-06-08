import type { MindOSSSEvent } from '../session/index.js';
import {
  createClaudeCodeCliClient,
  createClaudeCodeCliStdioTransport,
  type ClaudeCodeCliClient,
} from './claude-code-cli.js';
import {
  createCodexAppServerClient,
  createCodexAppServerStdioTransport,
  mapCodexAppServerNotificationToSseEvents,
  type CodexAppServerClient,
} from './codex-app-server.js';

export type MindosNativeAgentRuntimeKind = 'codex' | 'claude';

export type MindosAgentRuntimeSelection = {
  id: string;
  name: string;
  kind: MindosNativeAgentRuntimeKind;
  externalSessionId?: string;
};

export type MindosAgentRuntimeAskServices = {
  createCodexClient?(options: { cwd: string; signal?: AbortSignal }): CodexAppServerClient | Promise<CodexAppServerClient>;
  createClaudeClient?(options: { cwd: string; signal?: AbortSignal }): ClaudeCodeCliClient | Promise<ClaudeCodeCliClient>;
};

export type MindosAgentRuntimeAskOptions = {
  runtime: MindosAgentRuntimeSelection;
  cwd: string;
  prompt: string;
  signal?: AbortSignal;
  send(event: MindOSSSEvent): void;
  services?: MindosAgentRuntimeAskServices;
};

export type MindosAgentRuntimeAskResult = {
  externalSessionId?: string;
  error?: Error;
};

export async function runMindosAgentRuntimeAskSession(
  options: MindosAgentRuntimeAskOptions,
): Promise<MindosAgentRuntimeAskResult> {
  if (options.runtime.kind === 'claude') {
    return runClaudeAskSession(options);
  }

  return runCodexAskSession(options);
}

async function runClaudeAskSession(options: MindosAgentRuntimeAskOptions): Promise<MindosAgentRuntimeAskResult> {
  let client: ClaudeCodeCliClient | undefined;
  let sessionId = options.runtime.externalSessionId;

  try {
    client = await resolveClaudeClient(options);
    for await (const event of client.startTurn({
      prompt: options.prompt,
      cwd: options.cwd,
      ...(sessionId ? { sessionId } : {}),
      signal: options.signal,
    })) {
      if (event.type === 'session_id') {
        sessionId = event.sessionId;
        options.send({
          type: 'runtime_binding',
          runtime: 'claude',
          externalSessionId: event.sessionId,
          cwd: options.cwd,
        });
        continue;
      }
      options.send(event);
    }

    return sessionId ? { externalSessionId: sessionId } : {};
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.send({ type: 'error', message: `Claude Code native runtime error: ${err.message}` });
    return { error: err, ...(sessionId ? { externalSessionId: sessionId } : {}) };
  } finally {
    await client?.close?.();
  }
}

async function runCodexAskSession(options: MindosAgentRuntimeAskOptions): Promise<MindosAgentRuntimeAskResult> {
  let client: CodexAppServerClient | undefined;
  let threadId = options.runtime.externalSessionId;

  try {
    client = await resolveCodexClient(options);
    await client.initialize();
    const thread = threadId
      ? await client.resumeThread({ threadId })
      : await client.startThread();
    threadId = thread.threadId;
    options.send({
      type: 'runtime_binding',
      runtime: 'codex',
      externalSessionId: threadId,
      cwd: options.cwd,
    });

    const abortListener = () => {
      if (threadId) void client?.interruptTurn?.({ threadId }).catch(() => {});
    };
    options.signal?.addEventListener('abort', abortListener, { once: true });
    try {
      for await (const notification of client.startTurn({
        threadId,
        cwd: options.cwd,
        input: [{ type: 'text', text: options.prompt }],
        signal: options.signal,
      })) {
        for (const event of mapCodexAppServerNotificationToSseEvents(notification)) {
          options.send(event);
        }
      }
    } finally {
      options.signal?.removeEventListener('abort', abortListener);
    }

    return { externalSessionId: threadId };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.send({ type: 'error', message: `Codex native runtime error: ${err.message}` });
    return { error: err, ...(threadId ? { externalSessionId: threadId } : {}) };
  } finally {
    await client?.close?.();
  }
}

async function resolveCodexClient(options: MindosAgentRuntimeAskOptions): Promise<CodexAppServerClient> {
  if (options.services?.createCodexClient) {
    return options.services.createCodexClient({ cwd: options.cwd, signal: options.signal });
  }

  return createCodexAppServerClient(createCodexAppServerStdioTransport({ cwd: options.cwd }));
}

async function resolveClaudeClient(options: MindosAgentRuntimeAskOptions): Promise<ClaudeCodeCliClient> {
  if (options.services?.createClaudeClient) {
    return options.services.createClaudeClient({ cwd: options.cwd, signal: options.signal });
  }

  return createClaudeCodeCliClient(createClaudeCodeCliStdioTransport());
}
