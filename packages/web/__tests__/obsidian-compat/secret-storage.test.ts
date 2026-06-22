import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PluginLoader } from '@/lib/obsidian-compat/loader';
import { ObsidianRuntimeHost } from '@/lib/obsidian-compat/runtime';
import { ObsidianSecretStorage, normalizeSecretId } from '@/lib/obsidian-compat/secret-storage';

let mindRoot: string;

function writePlugin(pluginId: string, mainJs: string): string {
  const pluginDir = path.join(mindRoot, '.mindos', 'plugins', pluginId);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
    id: pluginId,
    name: pluginId,
    version: '1.0.0',
  }, null, 2), 'utf-8');
  fs.writeFileSync(path.join(pluginDir, 'main.js'), mainJs, 'utf-8');
  return pluginDir;
}

describe('Obsidian SecretStorage shim', () => {
  beforeEach(() => {
    mindRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mindos-obsidian-secret-'));
  });

  afterEach(() => {
    fs.rmSync(mindRoot, { recursive: true, force: true });
  });

  it('stores encrypted plugin-scoped secrets outside plugin data.json', async () => {
    writePlugin(
      'secret-plugin',
      `
        const { Plugin } = require('obsidian');
        module.exports = class SecretPlugin extends Plugin {
          async onload() {
            await this.app.secretStorage.setSecret('api-key', 'sk-live-secret');
            const value = await this.app.secretStorage.getSecret('api-key');
            await this.saveData({ secretRef: 'api-key', retrieved: value === 'sk-live-secret' });
          }
        };
      `,
    );

    const loader = new PluginLoader(mindRoot);
    await loader.loadPlugin('secret-plugin');

    const dataPath = path.join(mindRoot, '.mindos', 'plugins', 'secret-plugin', 'data.json');
    const dataRaw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    expect(data).toEqual({ secretRef: 'api-key', retrieved: true });
    expect(dataRaw).not.toContain('sk-live-secret');

    const secretStorePath = path.join(mindRoot, '.mindos', 'plugins', '.secret-storage.json');
    const secretStoreRaw = fs.readFileSync(secretStorePath, 'utf-8');
    expect(secretStoreRaw).toContain('secret-plugin');
    expect(secretStoreRaw).toContain('api-key');
    expect(secretStoreRaw).not.toContain('sk-live-secret');

    const summary = loader.getApp().getSecretStorageSummary('secret-plugin');
    expect(summary).toMatchObject({
      backend: 'local-aes-256-gcm-file',
      encrypted: true,
      path: '.mindos/plugins/.secret-storage.json',
      keyPath: '.mindos/plugins/.secret-storage.key',
      pluginId: 'secret-plugin',
      secrets: 1,
    });
  });

  it('isolates secrets between plugin runtime contexts', async () => {
    const host = new ObsidianRuntimeHost();
    const storage = new ObsidianSecretStorage(mindRoot, () => host.getCurrentPluginId());

    await host.runWithPluginContext('alpha-plugin', async () => {
      await storage.setSecret('shared-name', 'alpha-secret');
    });
    await host.runWithPluginContext('beta-plugin', async () => {
      await storage.setSecret('shared-name', 'beta-secret');
    });

    await expect(host.runWithPluginContext('alpha-plugin', () => storage.getSecret('shared-name'))).resolves.toBe('alpha-secret');
    await expect(host.runWithPluginContext('beta-plugin', () => storage.getSecret('shared-name'))).resolves.toBe('beta-secret');
    await expect(host.runWithPluginContext('alpha-plugin', () => storage.listSecrets())).resolves.toEqual(['shared-name']);
  });

  it('rejects calls without plugin context and invalid secret ids', async () => {
    const storage = new ObsidianSecretStorage(mindRoot, () => undefined);

    expect(() => normalizeSecretId('api-key')).not.toThrow();
    expect(() => normalizeSecretId('API_KEY')).toThrow(/lowercase letters/);
    await expect(storage.setSecret('api-key', 'value')).rejects.toThrow(/active plugin context/);
  });

  it('warns without leaking secret values when encrypted payloads cannot be decrypted', async () => {
    const host = new ObsidianRuntimeHost();
    const warn = vi.fn((warning) => host.warn(warning));
    const storage = new ObsidianSecretStorage(mindRoot, () => host.getCurrentPluginId(), warn);

    await host.runWithPluginContext('broken-plugin', () => storage.setSecret('api-key', 'value-to-hide'));

    const storePath = path.join(mindRoot, '.mindos', 'plugins', '.secret-storage.json');
    const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    store.entries['broken-plugin']['api-key'].data = 'not-valid-ciphertext';
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');

    await expect(host.runWithPluginContext('broken-plugin', () => storage.getSecret('api-key'))).rejects.toThrow(/decrypt/);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'broken-plugin',
      code: 'secret-storage-decrypt-failed',
    }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('value-to-hide');
  });
});
