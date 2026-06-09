import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLAUDE_PERMISSION_PROMPT_TOOL,
  createClaudePermissionPromptConfig,
  resolveRuntimePermissionBaseUrl,
} from '@/lib/agent/claude-permission-prompt';

let child: ReturnType<typeof spawn> | null = null;

afterEach(() => {
  child?.kill();
  child = null;
});

async function readJsonLine(lines: ReturnType<typeof createInterface>): Promise<Record<string, unknown>> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timed out waiting for MCP response.')), 1000);
  });
  return await Promise.race([
    (async () => {
      while (true) {
        const [line] = await once(lines, 'line') as [string];
        if (!line.trim()) continue;
        return JSON.parse(line) as Record<string, unknown>;
      }
    })(),
    timeout,
  ]);
}

describe('Claude Code permission prompt MCP config', () => {
  it('creates a per-run stdio MCP server that lists the permission tool', async () => {
    const prompt = createClaudePermissionPromptConfig({
      runId: 'run-mcp',
      baseUrl: 'http://127.0.0.1:4567',
    });
    expect(prompt.toolName).toBe(CLAUDE_PERMISSION_PROMPT_TOOL);
    const mcpConfig = prompt.mcpConfig as {
      mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
    };
    const server = mcpConfig.mcpServers.mindos_runtime_permission;

    child = spawn(server.command, server.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...server.env },
    });
    const lines = createInterface({ input: child.stdout });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    })}\n`);
    const init = await readJsonLine(lines);
    expect(init).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: { name: 'mindos-runtime-permission' },
      },
    });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    })}\n`);
    const tools = await readJsonLine(lines);
    expect(tools).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          { name: CLAUDE_PERMISSION_PROMPT_TOOL },
        ],
      },
    });
  });

  it('prefers a local loopback URL when the request has a port', () => {
    expect(resolveRuntimePermissionBaseUrl(new Request('http://21.6.243.108:4567/api/ask'))).toBe('http://127.0.0.1:4567');
  });
});
