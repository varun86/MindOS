import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'os';
import path from 'path';

const originalPlatform = process.platform;
const originalAppData = process.env.APPDATA;
const originalLocalAppData = process.env.LOCALAPPDATA;

async function importAgentsForWindows(appData: string, localAppData = 'C:/Users/Alice/AppData/Local') {
  vi.resetModules();
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  process.env.APPDATA = appData;
  process.env.LOCALAPPDATA = localAppData;
  return import('../../lib/mcp-agents');
}

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  if (originalAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = originalAppData;
  if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = originalLocalAppData;
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

  it('uses LOCALAPPDATA and APPDATA for Warp presence directories', async () => {
    const appData = 'C:/Users/Alice/AppData/Roaming';
    const localAppData = 'C:/Users/Alice/AppData/Local';
    const { MCP_AGENTS } = await importAgentsForWindows(appData, localAppData);

    expect(MCP_AGENTS['warp'].presenceDirs).toContain('~/.warp/');
    expect(MCP_AGENTS['warp'].presenceDirs).toContain(`${localAppData}/warp/Warp/data/`);
    expect(MCP_AGENTS['warp'].presenceDirs).toContain(`${localAppData}/warp/WarpPreview/data/`);
    expect(MCP_AGENTS['warp'].presenceDirs).toContain(`${localAppData}/warp/Warp/config/`);
    expect(MCP_AGENTS['warp'].presenceDirs).toContain(`${appData}/warp/Warp/data/`);
  });

  it('expands Windows tilde-style paths', async () => {
    const { expandHome } = await importAgentsForWindows('C:/Users/Alice/AppData/Roaming');

    expect(expandHome('~\\.agent\\skills')).toBe(path.resolve(os.homedir(), '.agent\\skills'));
  });
});
