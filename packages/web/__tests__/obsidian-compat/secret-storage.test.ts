import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PluginLoader } from '@/lib/obsidian-compat/loader';
import { PluginManager } from '@/lib/obsidian-compat/plugin-manager';
import { ObsidianRuntimeHost } from '@/lib/obsidian-compat/runtime';
import {
  ObsidianSecretStorage,
  normalizeSecretId,
  type ObsidianSecretStorageBackend,
  type ObsidianSecretStorageSummary,
} from '@/lib/obsidian-compat/secret-storage';

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

class MemorySecretStorageBackend implements ObsidianSecretStorageBackend {
  readonly backend = 'test-native-secret-broker';
  readonly encrypted = true;
  readonly calls: Array<{ method: string; pluginId: string; secretId?: string; secret?: string }> = [];
  private readonly entries = new Map<string, Map<string, string>>();

  setSecret(pluginId: string, secretId: string, secret: string): void {
    this.calls.push({ method: 'setSecret', pluginId, secretId, secret });
    const pluginEntries = this.entries.get(pluginId) ?? new Map<string, string>();
    pluginEntries.set(secretId, secret);
    this.entries.set(pluginId, pluginEntries);
  }

  getSecret(pluginId: string, secretId: string): string | null {
    this.calls.push({ method: 'getSecret', pluginId, secretId });
    return this.entries.get(pluginId)?.get(secretId) ?? null;
  }

  listSecrets(pluginId: string): string[] {
    this.calls.push({ method: 'listSecrets', pluginId });
    return Array.from(this.entries.get(pluginId)?.keys() ?? []);
  }

  removePluginSecrets(pluginId: string): number {
    this.calls.push({ method: 'removePluginSecrets', pluginId });
    const count = this.entries.get(pluginId)?.size ?? 0;
    this.entries.delete(pluginId);
    return count;
  }

  getSummary(pluginId: string): ObsidianSecretStorageSummary {
    this.calls.push({ method: 'getSummary', pluginId });
    return {
      backend: this.backend,
      encrypted: this.encrypted,
      pluginId,
      secrets: this.entries.get(pluginId)?.size ?? 0,
    };
  }
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

  it('delegates plugin-scoped operations to an injected backend without creating the local file store', async () => {
    const host = new ObsidianRuntimeHost();
    const backend = new MemorySecretStorageBackend();
    const storage = new ObsidianSecretStorage(mindRoot, () => host.getCurrentPluginId(), undefined, backend);

    await host.runWithPluginContext('native-plugin', async () => {
      await storage.setSecret('api-key', 'native-secret');
      await storage.setSecret('z-token', 'last');
    });

    await expect(host.runWithPluginContext('native-plugin', () => storage.getSecret('api-key'))).resolves.toBe('native-secret');
    await expect(host.runWithPluginContext('native-plugin', () => storage.listSecrets())).resolves.toEqual(['api-key', 'z-token']);
    expect(storage.getSummary('native-plugin')).toMatchObject({
      backend: 'test-native-secret-broker',
      encrypted: true,
      pluginId: 'native-plugin',
      secrets: 2,
    });
    await expect(storage.removePluginSecrets('native-plugin')).resolves.toBe(2);
    expect(storage.getSummary('native-plugin').secrets).toBe(0);
    expect(backend.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'setSecret', pluginId: 'native-plugin', secretId: 'api-key', secret: 'native-secret' }),
      expect.objectContaining({ method: 'getSecret', pluginId: 'native-plugin', secretId: 'api-key' }),
      expect.objectContaining({ method: 'removePluginSecrets', pluginId: 'native-plugin' }),
    ]));
    expect(fs.existsSync(path.join(mindRoot, '.mindos', 'plugins', '.secret-storage.json'))).toBe(false);
    expect(fs.existsSync(path.join(mindRoot, '.mindos', 'plugins', '.secret-storage.key'))).toBe(false);
  });

  it('keeps injected backend failures sanitized in host warnings', async () => {
    const host = new ObsidianRuntimeHost();
    const warn = vi.fn((warning) => host.warn(warning));
    const backend: ObsidianSecretStorageBackend = {
      backend: 'test-failing-secret-broker',
      encrypted: true,
      setSecret: () => {},
      getSecret: () => {
        throw new Error('backend leaked value-to-hide');
      },
      listSecrets: () => [],
      removePluginSecrets: () => 0,
      getSummary: (pluginId) => ({
        backend: 'test-failing-secret-broker',
        encrypted: true,
        pluginId,
        secrets: 0,
      }),
    };
    const storage = new ObsidianSecretStorage(mindRoot, () => host.getCurrentPluginId(), warn, backend);

    await expect(host.runWithPluginContext('broken-plugin', () => storage.getSecret('api-key'))).rejects.toThrow(/SecretStorage backend/);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'broken-plugin',
      code: 'secret-storage-get-failed',
    }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('value-to-hide');
  });

  it('passes the injected backend through PluginManager load and uninstall cleanup', async () => {
    writePlugin(
      'managed-secret-plugin',
      `
        const { Plugin } = require('obsidian');
        module.exports = class ManagedSecretPlugin extends Plugin {
          async onload() {
            await this.app.secretStorage.setSecret('api-key', 'managed-secret');
          }
        };
      `,
    );
    const backend = new MemorySecretStorageBackend();
    const manager = new PluginManager(mindRoot, { secretStorageBackend: backend });

    await manager.discover();
    await manager.enable('managed-secret-plugin');
    await manager.loadEnabledPlugins();

    expect(manager.list().find((item) => item.id === 'managed-secret-plugin')?.runtime.secretStorage).toMatchObject({
      backend: 'test-native-secret-broker',
      encrypted: true,
      pluginId: 'managed-secret-plugin',
      secrets: 1,
    });
    expect(fs.existsSync(path.join(mindRoot, '.mindos', 'plugins', '.secret-storage.json'))).toBe(false);

    await manager.uninstall('managed-secret-plugin');

    expect(backend.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'setSecret', pluginId: 'managed-secret-plugin', secretId: 'api-key', secret: 'managed-secret' }),
      expect.objectContaining({ method: 'removePluginSecrets', pluginId: 'managed-secret-plugin' }),
    ]));
    expect(backend.getSummary('managed-secret-plugin').secrets).toBe(0);
  });
});
