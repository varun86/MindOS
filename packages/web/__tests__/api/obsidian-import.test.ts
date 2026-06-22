import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const importObsidianPlugin = vi.fn();
const scanObsidianVaultPlugins = vi.fn();
const testState = vi.hoisted(() => ({ mindRoot: '/tmp/mindRoot' }));

vi.mock('@/lib/obsidian-compat/obsidian-import', () => ({
  importObsidianPlugin,
  scanObsidianVaultPlugins,
}));

vi.mock('@/lib/settings', () => ({
  readSettings: () => ({ mindRoot: testState.mindRoot }),
}));

async function importRoute() {
  return import('../../app/api/obsidian/import/route');
}

describe('POST /api/obsidian/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.mindRoot = '/tmp/mindRoot';
  });

  it('rejects missing vaultRoot or pluginId', async () => {
    const { POST } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/import', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot: '~/vault' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Missing vaultRoot or pluginId' });
  });

  it('rejects malformed body values', async () => {
    const { POST } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/import', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot: 1, pluginId: 'quickadd-like' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Missing vaultRoot or pluginId' });
  });

  it('imports a plugin and returns compatibility details', async () => {
    scanObsidianVaultPlugins.mockResolvedValue({
      plugins: [
        {
          id: 'quickadd-like',
          manifest: { id: 'quickadd-like', name: 'QuickAdd', version: '1.0.0' },
          sourceDir: '/tmp/vault/.obsidian/plugins/quickadd-like',
          compatibilityLevel: 'partial',
          compatibility: {
            obsidianApis: ['Plugin', 'Modal', 'Notice', 'addCommand'],
            moduleImports: [],
            nodeModules: [],
            unsupportedModules: [],
            supportedApis: ['Plugin', 'addCommand'],
            partialApis: ['Modal', 'Notice'],
            unsupportedApis: [],
            blockers: [],
          },
          hasStyles: false,
          hasData: true,
          obsidianConfig: { enabledInObsidian: true, hasEnabledList: true, hotkeys: [], hotkeyCount: 0 },
        },
      ],
      skipped: [],
      vault: { pluginsDirFound: true, hasEnabledList: true },
    });
    importObsidianPlugin.mockResolvedValue({
      pluginId: 'quickadd-like',
      targetDir: '/tmp/mindRoot/.mindos/plugins/quickadd-like',
      copiedFiles: ['manifest.json', 'main.js', 'data.json', 'obsidian-import.json'],
      obsidianConfig: { enabledInObsidian: true, hasEnabledList: true, hotkeys: [], hotkeyCount: 0 },
    });

    const { POST } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/import', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot: '~/vault', pluginId: 'quickadd-like', targetMindRoot: '/tmp/ignoredRoot' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.plugin.id).toBe('quickadd-like');
    expect(json.plugin.compatibilityLevel).toBe('partial');
    expect(json.plugin.importable).toBe(true);
    expect(json.plugin.support).toMatchObject({ kind: 'limited', importable: true, defaultSelected: true });
    expect(json.plugin.coverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ api: 'Modal', support: 'snapshot-only' }),
      expect.objectContaining({ api: 'Notice', support: 'snapshot-only' }),
    ]));
    expect(json.nextStep).toMatchObject({
      manageHref: '/settings?tab=plugins',
      surfacesHref: '/settings?tab=plugins&panel=surfaces',
    });
    expect(json.plugin.sourceDir).toBeUndefined();
    expect(json.imported.targetDir).toBeUndefined();
    expect(json.imported.targetPath).toBe('.mindos/plugins/quickadd-like');
    expect(json.imported.copiedFiles).toEqual(['manifest.json', 'main.js', 'data.json', 'obsidian-import.json']);
    expect(importObsidianPlugin).toHaveBeenCalledTimes(1);
    expect(importObsidianPlugin).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'quickadd-like',
      targetMindRoot: '/tmp/mindRoot',
    }));
    expect(importObsidianPlugin).not.toHaveBeenCalledWith(expect.objectContaining({
      targetMindRoot: '/tmp/ignoredRoot',
    }));
    expect(scanObsidianVaultPlugins).toHaveBeenCalledTimes(1);
  });

  it('rejects blocked plugins at the import API boundary', async () => {
    scanObsidianVaultPlugins.mockResolvedValue({
      plugins: [
        {
          id: 'desktop-only-like',
          manifest: { id: 'desktop-only-like', name: 'Desktop Only', version: '1.0.0' },
          sourceDir: '/tmp/vault/.obsidian/plugins/desktop-only-like',
          compatibilityLevel: 'blocked',
          compatibility: {
            obsidianApis: ['Plugin'],
            moduleImports: ['electron'],
            nodeModules: ['electron'],
            unsupportedModules: ['electron'],
            supportedApis: ['Plugin'],
            partialApis: [],
            unsupportedApis: [],
            blockers: ['Requires unsupported runtime module: electron'],
          },
          hasStyles: false,
          hasData: false,
          obsidianConfig: { enabledInObsidian: true, hasEnabledList: true, hotkeys: [], hotkeyCount: 0 },
        },
      ],
      skipped: [],
      vault: { pluginsDirFound: true, hasEnabledList: true },
    });

    const { POST } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/import', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot: '~/vault', pluginId: 'desktop-only-like' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: 'Requires unsupported runtime module: electron' });
    expect(importObsidianPlugin).not.toHaveBeenCalled();
  });

  it('returns 404 when plugin is not found in the scanned vault', async () => {
    scanObsidianVaultPlugins.mockResolvedValue({ plugins: [], skipped: [], vault: { pluginsDirFound: true, hasEnabledList: false } });
    const { POST } = await importRoute();
    const req = new NextRequest('http://localhost/api/obsidian/import', {
      method: 'POST',
      body: JSON.stringify({ vaultRoot: '~/vault', pluginId: 'missing-plugin' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'Plugin not found in Obsidian vault' });
  });
});
