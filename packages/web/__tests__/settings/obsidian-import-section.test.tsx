// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ObsidianImportSection } from '@/components/settings/ObsidianImportSection';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ObsidianImportSection', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('shows a migration report, imports selected plugins, and exposes handoff links', async () => {
    mocks.apiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/obsidian/compat-report')) {
        return {
          ok: true,
          vaultRoot: '/Users/test/Vault',
          summary: {
            total: 2,
            compatible: 1,
            partial: 0,
            blocked: 1,
            importable: 1,
            selectedByDefault: 1,
            enabledInObsidian: 1,
            hotkeys: 2,
            hasEnabledList: true,
            pluginsDirFound: true,
            support: { ready: 1, limited: 0, review: 0, blocked: 1 },
          },
          migration: {
            defaultSelectionPolicy: 'Source-enabled plugins that are ready or limited are selected by default.',
            sourceVaultUnchanged: true,
            writesTo: '.plugins/<plugin-id>',
            writesConfig: 'obsidian-import.json',
            enableAfterImport: false,
          },
          plugins: [
            {
              id: 'ready-plugin',
              manifest: { id: 'ready-plugin', name: 'Ready Plugin', version: '1.0.0', description: 'Ready to copy' },
              compatibilityLevel: 'compatible',
              compatibility: {
                obsidianApis: ['Plugin', 'addCommand'],
                nodeModules: [],
                supportedApis: ['Plugin', 'addCommand'],
                partialApis: [],
                unsupportedApis: [],
                blockers: [],
              },
              hasStyles: true,
              hasData: true,
              importable: true,
              support: {
                kind: 'ready',
                importable: true,
                defaultSelected: true,
                label: 'Ready',
                summaryLabel: 'ready',
                reason: 'Supported APIs can load through the MindOS Obsidian compatibility host.',
              },
              surfacePreview: [{ id: 'commands', state: 'mounted', count: 1 }],
              coverageSummary: { full: 2, limited: 0, 'snapshot-only': 0, 'catalog-only': 0, 'request-only': 0, unsupported: 0 },
              migrationPlan: {
                copiedFiles: ['manifest.json', 'main.js', 'styles.css', 'data.json', 'obsidian-import.json'],
                sourceVaultUnchanged: true,
                enableAfterImport: false,
                defaultSelected: true,
              },
              obsidianConfig: {
                enabledInObsidian: true,
                hasEnabledList: true,
                hotkeyCount: 2,
                hotkeys: [],
              },
            },
            {
              id: 'blocked-plugin',
              manifest: { id: 'blocked-plugin', name: 'Blocked Plugin', version: '1.0.0' },
              compatibilityLevel: 'blocked',
              compatibility: {
                obsidianApis: ['Plugin'],
                nodeModules: ['electron'],
                supportedApis: ['Plugin'],
                partialApis: [],
                unsupportedApis: [],
                blockers: ['Requires unsupported runtime module: electron'],
              },
              hasStyles: false,
              hasData: false,
              importable: false,
              support: {
                kind: 'blocked',
                importable: false,
                defaultSelected: false,
                label: 'Blocked',
                summaryLabel: 'blocked',
                reason: 'Requires unsupported runtime module: electron',
              },
              surfacePreview: [],
              coverageSummary: { full: 1, limited: 0, 'snapshot-only': 0, 'catalog-only': 0, 'request-only': 0, unsupported: 0 },
              migrationPlan: {
                copiedFiles: ['manifest.json', 'main.js', 'obsidian-import.json'],
                sourceVaultUnchanged: true,
                enableAfterImport: false,
                defaultSelected: false,
              },
              obsidianConfig: {
                enabledInObsidian: false,
                hasEnabledList: true,
                hotkeyCount: 0,
                hotkeys: [],
              },
            },
          ],
          skipped: [
            { dirName: 'broken-plugin', reason: 'manifest.json is missing' },
          ],
        };
      }
      if (url === '/api/obsidian/import' && init?.method === 'POST') {
        return {
          ok: true,
          imported: {
            pluginId: 'ready-plugin',
            copiedFiles: ['manifest.json', 'main.js', 'styles.css', 'data.json', 'obsidian-import.json'],
          },
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => {
      root.render(<ObsidianImportSection initialExpanded />);
      await flushPromises();
    });

    const input = host.querySelector('input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '~/Vault');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
    });

    const scanButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Scan') as HTMLButtonElement;
    await act(async () => {
      scanButton.click();
      await flushPromises();
    });

    expect(host.textContent).toContain('Migration report');
    expect(host.textContent).toContain('Source-enabled plugins that are ready or limited are selected by default.');
    expect(host.textContent).toContain('Ready Plugin');
    expect(host.textContent).toContain('ready 1');
    expect(host.textContent).toContain('Skipped plugin folders');
    expect(host.textContent).toContain('broken-plugin');
    expect(host.textContent).toContain('manifest.json is missing');
    expect(host.textContent).toContain('Copy manifest.json, main.js, styles.css, data.json, obsidian-import.json');
    expect((host.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);

    const importButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Import 1 plugin')) as HTMLButtonElement;
    await act(async () => {
      importButton.click();
      await flushPromises();
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/obsidian/import', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ vaultRoot: '/Users/test/Vault', pluginId: 'ready-plugin' }),
    }));
    expect(host.textContent).toContain('1 imported, 0 failed');
    expect(host.textContent).toContain('Manage installed');
    expect(host.textContent).toContain('Open surfaces');
  });
});
