import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import type { MindOSSSEvent } from '../session/index.js';

export type ClaudeCodeCliTransport = {
  run(args: string[], options: { cwd: string; signal?: AbortSignal }): AsyncIterable<string>;
  close?(): void | Promise<void>;
};

export type ClaudeCodeCliClient = {
  startTurn(input: {
    prompt: string;
    cwd: string;
    sessionId?: string;
    signal?: AbortSignal;
  }): AsyncIterable<ClaudeCodeCliEvent>;
  close?(): void | Promise<void>;
};

export type ClaudeCodeCliEvent =
  | { type: 'session_id'; sessionId: string }
  | MindOSSSEvent;

type ClaudeCodeCliState = {
  emittedText: boolean;
  emittedDone: boolean;
};

export function createClaudeCodeCliClient(transport: ClaudeCodeCliTransport): ClaudeCodeCliClient {
  return {
    async *startTurn(input) {
      const args = buildClaudeCodeCliArgs(input);
      const state: ClaudeCodeCliState = { emittedText: false, emittedDone: false };
      let lastSessionId: string | null = null;

      for await (const line of transport.run(args, { cwd: input.cwd, signal: input.signal })) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const record = JSON.parse(trimmed) as Record<string, unknown>;
        const sessionId = getStringField(record, 'session_id');
        if (sessionId && sessionId !== lastSessionId) {
          lastSessionId = sessionId;
          yield { type: 'session_id', sessionId };
        }

        for (const event of mapClaudeCodeCliRecordToSseEvents(record, state)) {
          yield event;
        }
      }

      if (!state.emittedDone) {
        yield { type: 'done' };
      }
    },
    close: () => transport.close?.(),
  };
}

export function createClaudeCodeCliStdioTransport(options: {
  command?: string;
  env?: NodeJS.ProcessEnv;
} = {}): ClaudeCodeCliTransport {
  const command = options.command ?? 'claude';
  let child: ChildProcessByStdio<null, Readable, Readable> | null = null;

  return {
    run(args, runOptions) {
      const proc = spawn(command, args, {
        cwd: runOptions.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...(options.env ?? {}) },
      });
      child = proc;

      const lines = createInterface({ input: proc.stdout });
      let stderr = '';
      proc.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });

      const abort = () => proc.kill();
      runOptions.signal?.addEventListener('abort', abort, { once: true });

      const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        proc.once('exit', (code, signal) => resolve({ code, signal }));
      });

      return (async function* () {
        try {
          for await (const line of lines) {
            if (typeof line === 'string') yield line;
          }
          const result = await exit;
          if (result.code && result.code !== 0) {
            const message = stderr.trim() || `Claude Code exited with code ${result.code}`;
            throw new Error(message);
          }
        } finally {
          runOptions.signal?.removeEventListener('abort', abort);
          lines.close();
        }
      })();
    },
    close() {
      child?.kill();
    },
  };
}

function buildClaudeCodeCliArgs(input: { prompt: string; sessionId?: string }): string[] {
  return [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'default',
    ...(input.sessionId ? ['--resume', input.sessionId] : []),
    input.prompt,
  ];
}

function mapClaudeCodeCliRecordToSseEvents(
  record: Record<string, unknown>,
  state: ClaudeCodeCliState,
): MindOSSSEvent[] {
  if (record.type === 'assistant' || record.type === 'user') {
    return contentBlocksFromRecord(record).flatMap((block) => mapClaudeContentBlock(block, state));
  }

  if (record.type === 'result') {
    state.emittedDone = true;
    if (record.is_error === true || record.subtype === 'error') {
      return [{ type: 'error', message: getResultText(record) || 'Claude Code turn failed' }];
    }
    const resultText = getStringField(record, 'result');
    return [
      ...(!state.emittedText && resultText ? [{ type: 'text_delta' as const, delta: resultText }] : []),
      { type: 'done' },
    ];
  }

  return [];
}

function mapClaudeContentBlock(
  block: Record<string, unknown>,
  state: ClaudeCodeCliState,
): MindOSSSEvent[] {
  if (block.type === 'text') {
    const text = getStringField(block, 'text');
    if (!text) return [];
    state.emittedText = true;
    return [{ type: 'text_delta', delta: text }];
  }

  if (block.type === 'thinking') {
    const text = getStringField(block, 'thinking') ?? getStringField(block, 'text');
    return text ? [{ type: 'thinking_delta', delta: text }] : [];
  }

  if (block.type === 'tool_use') {
    const toolCallId = getStringField(block, 'id');
    const toolName = getStringField(block, 'name');
    if (!toolCallId || !toolName) return [];
    return [{
      type: 'tool_start',
      toolCallId,
      toolName,
      args: block.input,
    }];
  }

  if (block.type === 'tool_result') {
    const toolCallId = getStringField(block, 'tool_use_id');
    if (!toolCallId) return [];
    return [{
      type: 'tool_end',
      toolCallId,
      output: stringifyClaudeToolResult(block.content),
      isError: block.is_error === true,
    }];
  }

  return [];
}

function contentBlocksFromRecord(record: Record<string, unknown>): Array<Record<string, unknown>> {
  const message = asRecord(record.message);
  const content = Array.isArray(message?.content) ? message.content : record.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((item) => {
    const block = asRecord(item);
    return block ? [block] : [];
  });
}

function stringifyClaudeToolResult(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const block = asRecord(item);
      return getStringField(block, 'text') ?? JSON.stringify(item);
    }).join('\n');
  }
  return value === undefined ? '' : JSON.stringify(value);
}

function getResultText(record: Record<string, unknown>): string {
  return getStringField(record, 'result') ?? getStringField(record, 'message') ?? '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getStringField(record: Record<string, unknown> | null, field: string): string | undefined {
  const value = record?.[field];
  return typeof value === 'string' && value ? value : undefined;
}
