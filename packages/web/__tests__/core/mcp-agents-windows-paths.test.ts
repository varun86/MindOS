import { afterEach, describe, expect, it, vi } from 'vitest';

const originalPlatform = process.platform;
const originalAppData = process.env.APPDATA;

async function importAgentsForWindows(appData: string) {
  vi.resetModules();
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  process.env.APPDATA = appData;
  return import('../../lib/mcp-agents');
}

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  if (originalAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = originalAppData;
  vi.resetModules();
});

describe('MCP agent registry Windows paths', () => {
  it('uses APPDATA for VS Code-family global MCP config paths', async () => {
    const appData = 'C:/Users/Alice/AppData/Roaming';
    const { MCP_AGENTS } = await importAgentsForWindows(appData);

    expect(MCP_AGENTS['github-copilot'].global).toBe(`${appData}/Code/User/mcp.json`);
    expect(MCP_AGENTS['cline'].global).toBe(`${appData}/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`);
    expect(MCP_AGENTS['roo'].global).toBe(`${appData}/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`);
    expect(MCP_AGENTS['trae-cn'].global).toBe(`${appData}/Trae CN/User/mcp.json`);
  });

  it('includes Windows APPDATA presence directories for VS Code-family agents', async () => {
    const appData = 'C:/Users/Alice/AppData/Roaming';
    const { MCP_AGENTS } = await importAgentsForWindows(appData);

    expect(MCP_AGENTS['github-copilot'].presenceDirs).toContain(`${appData}/Code/`);
    expect(MCP_AGENTS['cline'].presenceDirs).toContain(`${appData}/Code/User/globalStorage/saoudrizwan.claude-dev/`);
    expect(MCP_AGENTS['roo'].presenceDirs).toContain(`${appData}/Code/User/globalStorage/rooveterinaryinc.roo-cline/`);
    expect(MCP_AGENTS['trae-cn'].presenceDirs).toContain(`${appData}/Trae CN/`);
  });
});
