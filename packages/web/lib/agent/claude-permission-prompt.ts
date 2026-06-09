import type { ClaudeCodeCliPermissionPrompt } from '@geminilight/mindos/agent-runtime';

export const CLAUDE_PERMISSION_PROMPT_TOOL = 'mindos_runtime_permission';

export function createClaudePermissionPromptConfig(input: {
  runId: string;
  baseUrl: string;
}): ClaudeCodeCliPermissionPrompt {
  return {
    toolName: CLAUDE_PERMISSION_PROMPT_TOOL,
    mcpConfig: {
      mcpServers: {
        mindos_runtime_permission: {
          type: 'stdio',
          command: process.execPath,
          args: ['-e', CLAUDE_PERMISSION_PROMPT_MCP_SOURCE],
          env: {
            MINDOS_RUNTIME_PERMISSION_BASE_URL: input.baseUrl,
            MINDOS_RUNTIME_PERMISSION_RUN_ID: input.runId,
            MINDOS_RUNTIME_PERMISSION_TOOL: CLAUDE_PERMISSION_PROMPT_TOOL,
          },
        },
      },
    },
  };
}

export function resolveRuntimePermissionBaseUrl(req: Request): string {
  if (process.env.MINDOS_URL) return process.env.MINDOS_URL;
  const url = new URL(req.url);
  const port = process.env.MINDOS_WEB_PORT || url.port;
  if (port) return `${url.protocol}//127.0.0.1:${port}`;
  return url.origin;
}

const CLAUDE_PERMISSION_PROMPT_MCP_SOURCE = String.raw`
const baseUrl = process.env.MINDOS_RUNTIME_PERMISSION_BASE_URL;
const runId = process.env.MINDOS_RUNTIME_PERMISSION_RUN_ID;
const toolName = process.env.MINDOS_RUNTIME_PERMISSION_TOOL || 'mindos_runtime_permission';
let buffer = '';

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function textResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function getNestedRecord(record, key) {
  return isRecord(record[key]) ? record[key] : undefined;
}

function extractToolInput(args) {
  if (!isRecord(args)) return {};
  return args.input
    ?? args.tool_input
    ?? args.toolInput
    ?? args.parameters
    ?? getNestedRecord(args, 'tool')?.input
    ?? args;
}

function extractToolName(args) {
  if (!isRecord(args)) return 'approval_request';
  return firstString(
    args.toolName,
    args.tool_name,
    args.name,
    getNestedRecord(args, 'tool')?.name,
    getNestedRecord(args, 'tool')?.toolName,
  ) || 'approval_request';
}

function fallbackToolCallId() {
  return 'claude-permission-' + Date.now().toString(36);
}

function extractToolCallId(args) {
  if (!isRecord(args)) return fallbackToolCallId();
  return firstString(
    args.toolUseId,
    args.tool_use_id,
    args.tool_call_id,
    args.toolCallId,
    args.id,
    getNestedRecord(args, 'tool')?.id,
  ) || fallbackToolCallId();
}

function extractReason(args) {
  if (!isRecord(args)) return undefined;
  return firstString(args.reason, args.message, args.description, args.decision_reason, args.decisionReason);
}

async function requestDecision(args) {
  if (!baseUrl || !runId) return { decision: 'cancel', cancelled: true };
  const input = extractToolInput(args);
  const response = await fetch(new URL('/api/ask/runtime-permission/request', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runId,
      runtime: 'claude',
      toolCallId: extractToolCallId(args),
      toolName: extractToolName(args),
      input,
      reason: extractReason(args),
      options: [
        { id: 'accept', label: 'Allow once', description: 'Run this action one time.', intent: 'allow' },
        { id: 'decline', label: 'Deny', description: 'Reject this action.', intent: 'deny' },
      ],
    }),
  });
  if (!response.ok) return { decision: 'cancel', cancelled: true };
  return await response.json();
}

async function handleRequest(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mindos-runtime-permission', version: '1.0.0' },
      },
    });
    return;
  }
  if (method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [{
          name: toolName,
          title: 'MindOS Runtime Permission',
          description: 'Ask the MindOS Chat Panel user to approve or deny this Claude Code tool call.',
          inputSchema: { type: 'object', additionalProperties: true },
        }],
      },
    });
    return;
  }
  if (method === 'tools/call') {
    const args = params?.arguments ?? {};
    const decision = await requestDecision(args);
    const allow = decision && !decision.cancelled && decision.decision === 'accept';
    const value = allow
      ? { behavior: 'allow', updatedInput: extractToolInput(args) }
      : { behavior: 'deny', message: 'Denied in MindOS.' };
    send({ jsonrpc: '2.0', id, result: textResult(value) });
    return;
  }
  if (id !== undefined) {
    send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found: ' + method },
    });
  }
}

process.stdin.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let index = buffer.indexOf('\n');
  while (index !== -1) {
    const line = buffer.slice(0, index).replace(/\r$/, '');
    buffer = buffer.slice(index + 1);
    if (line.trim()) {
      Promise.resolve()
        .then(() => handleRequest(JSON.parse(line)))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(message + '\n');
        });
    }
    index = buffer.indexOf('\n');
  }
});
`;
