import type { MindOSSSEvent } from '../session/index.js';
import {
  createClaudeCodeCliClient,
  createClaudeCodeCliStdioTransport,
  type ClaudeCodeCliClient,
  type ClaudeCodeCliPermissionPrompt,
} from './claude-code-cli.js';
import {
  createCodexAppServerClient,
  createCodexAppServerStdioTransport,
  mapCodexAppServerNotificationToSseEvents,
  type CodexAppServerClient,
  type CodexAppServerServerRequest,
} from './codex-app-server.js';

export type MindosNativeAgentRuntimeKind = 'codex' | 'claude';

export type MindosAgentRuntimeSelection = {
  id: string;
  name: string;
  kind: MindosNativeAgentRuntimeKind;
  externalSessionId?: string;
};

export type MindosAgentRuntimeAskServices = {
  createCodexClient?(options: {
    cwd: string;
    signal?: AbortSignal;
    handleServerRequest?: (request: CodexAppServerServerRequest) => Promise<unknown> | unknown;
  }): CodexAppServerClient | Promise<CodexAppServerClient>;
  createClaudeClient?(options: { cwd: string; signal?: AbortSignal }): ClaudeCodeCliClient | Promise<ClaudeCodeCliClient>;
  createClaudePermissionPrompt?(options: {
    cwd: string;
    signal?: AbortSignal;
  }): ClaudeCodeCliPermissionPrompt | undefined | Promise<ClaudeCodeCliPermissionPrompt | undefined>;
  requestRuntimePermission?(
    request: MindosRuntimePermissionRequest,
    options?: { signal?: AbortSignal },
  ): Promise<MindosRuntimePermissionResult>;
};

export type MindosRuntimePermissionOption = {
  id: string;
  label: string;
  description?: string;
  intent?: 'allow' | 'deny' | 'cancel';
};

export type MindosRuntimePermissionRequest = {
  runtime: 'codex' | 'claude';
  toolCallId: string;
  toolName: string;
  input: unknown;
  options: MindosRuntimePermissionOption[];
  reason?: string;
};

export type MindosRuntimePermissionResult = {
  decision: string;
  cancelled?: boolean;
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
    const permissionPrompt = await options.services?.createClaudePermissionPrompt?.({
      cwd: options.cwd,
      signal: options.signal,
    });
    for await (const event of client.startTurn({
      prompt: options.prompt,
      cwd: options.cwd,
      ...(sessionId ? { sessionId } : {}),
      ...(permissionPrompt ? { permissionPrompt } : {}),
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
    client = await resolveCodexClient(options, async (request) => {
      return handleCodexServerRequest(request, options);
    });
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

async function resolveCodexClient(
  options: MindosAgentRuntimeAskOptions,
  handleServerRequest?: (request: CodexAppServerServerRequest) => Promise<unknown> | unknown,
): Promise<CodexAppServerClient> {
  if (options.services?.createCodexClient) {
    return options.services.createCodexClient({ cwd: options.cwd, signal: options.signal, handleServerRequest });
  }

  return createCodexAppServerClient(
    createCodexAppServerStdioTransport({ cwd: options.cwd }),
    { handleServerRequest },
  );
}

async function resolveClaudeClient(options: MindosAgentRuntimeAskOptions): Promise<ClaudeCodeCliClient> {
  if (options.services?.createClaudeClient) {
    return options.services.createClaudeClient({ cwd: options.cwd, signal: options.signal });
  }

  return createClaudeCodeCliClient(createClaudeCodeCliStdioTransport());
}

async function handleCodexServerRequest(
  request: CodexAppServerServerRequest,
  options: MindosAgentRuntimeAskOptions,
): Promise<unknown> {
  if (!isCodexApprovalRequest(request)) {
    throw new Error(`Unhandled Codex app-server request: ${request.method}`);
  }

  const permissionRequest = buildCodexPermissionRequest(request);
  const result = options.services?.requestRuntimePermission
    ? await options.services.requestRuntimePermission(permissionRequest, { signal: options.signal })
    : { decision: 'cancel', cancelled: true };

  if (request.method === 'item/permissions/requestApproval') {
    return codexPermissionsApprovalResult(request, result);
  }

  return {
    decision: result.cancelled ? 'cancel' : normalizeCodexApprovalDecision(result.decision),
  };
}

function isCodexApprovalRequest(request: CodexAppServerServerRequest): boolean {
  return request.method === 'item/commandExecution/requestApproval'
    || request.method === 'item/fileChange/requestApproval'
    || request.method === 'item/permissions/requestApproval'
    || /approval|permission/i.test(request.method);
}

function buildCodexPermissionRequest(request: CodexAppServerServerRequest): MindosRuntimePermissionRequest {
  const params = request.params ?? {};
  const toolCallId = getString(params, 'itemId')
    ?? getString(params, 'requestId')
    ?? getString(params, 'callId')
    ?? getString(params, 'id')
    ?? `codex-approval-${request.id}`;
  const command = getString(params, 'command')
    ?? getString(params, 'cmd')
    ?? getString(params, 'shellCommand');
  const toolName = request.method === 'item/fileChange/requestApproval'
    ? 'file_change_approval'
    : command
      ? 'Bash'
      : 'approval_request';

  return {
    runtime: 'codex',
    toolCallId,
    toolName,
    input: {
      method: request.method,
      ...params,
    },
    options: getCodexPermissionOptions(params, request.method),
    ...(getString(params, 'reason') ?? getString(params, 'message') ? {
      reason: getString(params, 'reason') ?? getString(params, 'message'),
    } : {}),
  };
}

function getCodexPermissionOptions(params: Record<string, unknown>, method: string): MindosRuntimePermissionOption[] {
  const fromParams = [
    ...stringArray(params.availableDecisions),
    ...stringArray(params.decisions),
    ...stringArray(params.options),
  ].map(decisionOption);
  if (fromParams.length > 0) return dedupeOptions(fromParams);

  const defaults = method === 'item/permissions/requestApproval'
    ? ['accept', 'acceptForSession', 'decline']
    : ['accept', 'acceptForSession', 'decline'];
  return defaults.map(decisionOption);
}

function decisionOption(id: string): MindosRuntimePermissionOption {
  const labels: Record<string, string> = {
    accept: 'Allow once',
    acceptForSession: 'Allow session',
    decline: 'Deny',
    cancel: 'Cancel',
    deny: 'Deny',
  };
  const descriptions: Record<string, string> = {
    accept: 'Run this action one time.',
    acceptForSession: 'Run this action and remember the same rule for this Codex session.',
    decline: 'Reject this action.',
    cancel: 'Cancel the pending action.',
  };
  return {
    id,
    label: labels[id] ?? id,
    ...(descriptions[id] ? { description: descriptions[id] } : {}),
    intent: id === 'accept' || id === 'acceptForSession' ? 'allow' : id === 'decline' || id === 'deny' ? 'deny' : 'cancel',
  };
}

function dedupeOptions(options: MindosRuntimePermissionOption[]): MindosRuntimePermissionOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.id || seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

function normalizeCodexApprovalDecision(decision: string): string {
  if (decision === 'accept' || decision === 'acceptForSession' || decision === 'decline' || decision === 'cancel') {
    return decision;
  }
  if (decision === 'deny' || decision === 'denied') return 'decline';
  return 'cancel';
}

function codexPermissionsApprovalResult(
  request: CodexAppServerServerRequest,
  result: MindosRuntimePermissionResult,
): Record<string, unknown> {
  const decision = result.cancelled ? 'cancel' : normalizeCodexApprovalDecision(result.decision);
  if (decision === 'decline' || decision === 'cancel') return { permissions: {} };
  const requestedPermissions = request.params?.permissions && typeof request.params.permissions === 'object'
    ? request.params.permissions
    : {};
  return {
    permissions: requestedPermissions,
    ...(decision === 'acceptForSession' ? { scope: 'session' } : {}),
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}
