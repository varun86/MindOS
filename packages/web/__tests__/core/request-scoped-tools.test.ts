import { describe, expect, it } from 'vitest';

describe('getRequestScopedTools', () => {
  it('returns default ask-scoped tools without destructive writes or delegation', async () => {
    const mod = await import('@/lib/agent/tools');
    const tools = mod.getRequestScopedTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toContain('list_files');
    expect(names).toContain('read_file');
    expect(names).toContain('write_file');
    expect(names).toContain('dreaming');

    expect(names).not.toContain('delete_file');
    expect(names).not.toContain('rename_file');
    expect(names).not.toContain('move_file');
    expect(names).not.toContain('edit_lines');
    expect(names).not.toContain('list_acp_agents');
    expect(names).not.toContain('call_acp_agent');
    expect(names).not.toContain('list_remote_agents');
    expect(names).not.toContain('delegate_to_agent');
    expect(names).not.toContain('orchestrate');

    // MCP tools are now handled by pi-mcp-adapter extension,
    // not injected via getRequestScopedTools()
    expect(names).not.toContain('list_mcp_tools');
    expect(names).not.toContain('call_mcp_tool');
    expect(names.some((n) => n.startsWith('mcp__'))).toBe(false);
  }, 15_000);
});
