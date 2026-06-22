import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const scanObsidianVaultPlugins = vi.fn();

vi.mock('@/lib/obsidian-compat/obsidian-import', () => ({
  scanObsidianVaultPlugins,
}));

async function importRoute() {
  return import('../../app/api/obsidian/compat-report/route');
}

describe('GET /api/obsidian/compat-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing vaultRoot', async () => {
    const { GET } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/compat-report');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Missing vaultRoot' });
  });

  it('expands ~/ paths and returns compatibility summary', async () => {
    scanObsidianVaultPlugins.mockImplementation(async (vaultRoot: string) => ({
      plugins: [
        {
          id: 'style-settings-like',
          manifest: { id: 'style-settings-like', name: 'Style Settings', version: '1.0.0' },
          sourceDir: '/tmp/vault/.obsidian/plugins/style-settings-like',
          compatibilityLevel: 'compatible',
          compatibility: { obsidianApis: ['PluginSettingTab'], moduleImports: [], nodeModules: [], unsupportedModules: [], supportedApis: ['PluginSettingTab'], partialApis: [], unsupportedApis: [], blockers: [] },
          hasStyles: true,
          hasData: true,
          obsidianConfig: { enabledInObsidian: true, hasEnabledList: true, hotkeys: [], hotkeyCount: 0 },
        },
        {
          id: 'desktop-only-like',
          manifest: { id: 'desktop-only-like', name: 'Desktop Only', version: '1.0.0' },
          sourceDir: '/tmp/vault/.obsidian/plugins/desktop-only-like',
          compatibilityLevel: 'blocked',
          compatibility: { obsidianApis: ['Plugin'], moduleImports: ['electron'], nodeModules: ['electron'], unsupportedModules: ['electron'], supportedApis: ['Plugin'], partialApis: [], unsupportedApis: [], blockers: ['Requires unsupported runtime module: electron'] },
          hasStyles: false,
          hasData: false,
          obsidianConfig: { enabledInObsidian: true, hasEnabledList: true, hotkeys: [], hotkeyCount: 0 },
        },
        {
          id: 'kanban-like',
          manifest: { id: 'kanban-like', name: 'Kanban', version: '1.0.0' },
          sourceDir: '/tmp/vault/.obsidian/plugins/kanban-like',
          compatibilityLevel: 'partial',
          compatibility: { obsidianApis: ['Plugin', 'registerMarkdownCodeBlockProcessor'], moduleImports: [], nodeModules: [], unsupportedModules: [], supportedApis: ['Plugin'], partialApis: ['registerMarkdownCodeBlockProcessor'], unsupportedApis: [], blockers: [] },
          hasStyles: true,
          hasData: false,
          obsidianConfig: {
            enabledInObsidian: false,
            hasEnabledList: true,
            hotkeys: [{ commandId: 'kanban-like:open', hotkeys: [{ modifiers: ['Mod'], key: 'K' }] }],
            hotkeyCount: 1,
          },
        },
      ],
      skipped: [
        {
          dirName: 'broken-plugin',
          reason: `ENOENT: no such file or directory, open '${vaultRoot}/.obsidian/plugins/broken-plugin/main.js'`,
        },
      ],
      vault: {
        pluginsDirFound: true,
        hasEnabledList: true,
      },
    }));

    const { GET } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/compat-report?vaultRoot=~/vault');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.summary).toMatchObject({
      total: 3,
      compatible: 1,
      partial: 1,
      blocked: 1,
      importable: 2,
      support: { ready: 1, limited: 1, review: 0, blocked: 1 },
      selectedByDefault: 1,
      enabledInObsidian: 2,
      hotkeys: 1,
      hasEnabledList: true,
      pluginsDirFound: true,
    });
    expect(json.migration).toMatchObject({
      sourceVaultUnchanged: true,
      writesTo: '.mindos/plugins/<plugin-id>',
      enableAfterImport: false,
    });
    expect(json.plugins).toHaveLength(3);
    expect(json.plugins.find((plugin: { id: string }) => plugin.id === 'style-settings-like')?.importable).toBe(true);
    expect(json.plugins.find((plugin: { id: string }) => plugin.id === 'kanban-like')?.importable).toBe(true);
    expect(json.plugins.find((plugin: { id: string }) => plugin.id === 'desktop-only-like')?.importable).toBe(false);
    expect(json.plugins.find((plugin: { id: string }) => plugin.id === 'kanban-like')).toMatchObject({
      support: { kind: 'limited', defaultSelected: false },
      coverage: expect.arrayContaining([
        expect.objectContaining({ api: 'registerMarkdownCodeBlockProcessor', support: 'limited' }),
      ]),
      migrationPlan: {
        copiedFiles: ['manifest.json', 'main.js', 'styles.css', 'obsidian-import.json'],
        sourceVaultUnchanged: true,
        enableAfterImport: false,
        defaultSelected: false,
      },
    });
    expect(json.skipped).toEqual([
      {
        dirName: 'broken-plugin',
        reason: expect.stringContaining('<vault>/.obsidian/plugins/broken-plugin/main.js'),
      },
    ]);
    expect(scanObsidianVaultPlugins).toHaveBeenCalledTimes(1);
    expect(scanObsidianVaultPlugins.mock.calls[0][0]).not.toContain('~/');
    expect(json.skipped[0].reason).not.toContain(scanObsidianVaultPlugins.mock.calls[0][0]);
  });
});
