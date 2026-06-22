import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  assertSafeObsidianPluginId,
  resolveCanonicalPluginSecretStorageKeyPath,
  resolveCanonicalPluginSecretStoragePath,
} from './plugin-paths';

const SECRET_ID_PATTERN = /^[a-z0-9-]+$/;
const SECRET_STORAGE_VERSION = 1;
const SECRET_STORAGE_BACKEND = 'local-aes-256-gcm-file';
const KEY_BYTES = 32;
const IV_BYTES = 12;

interface StoredSecretEntry {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
  updatedAt: string;
}

interface SecretStorageFile {
  version: typeof SECRET_STORAGE_VERSION;
  backend: typeof SECRET_STORAGE_BACKEND;
  entries: Record<string, Record<string, StoredSecretEntry>>;
}

export interface ObsidianSecretStorageSummary {
  backend: typeof SECRET_STORAGE_BACKEND;
  encrypted: true;
  path: string;
  keyPath: string;
  pluginId: string;
  secrets: number;
}

export interface SecretStorageHostWarning {
  pluginId?: string;
  code: string;
  message: string;
}

export type SecretStorageWarningSink = (warning: SecretStorageHostWarning) => void;

export class ObsidianSecretStorage {
  constructor(
    private readonly mindRoot: string,
    private readonly getActivePluginId: () => string | undefined,
    private readonly warn?: SecretStorageWarningSink,
  ) {}

  async setSecret(id: string, secret: string): Promise<void> {
    const pluginId = this.requirePluginContext();
    const normalizedId = normalizeSecretId(id);
    if (typeof secret !== 'string') {
      throw new Error('[obsidian-compat] SecretStorage.setSecret requires a string secret.');
    }

    const store = this.readStore();
    const pluginEntries = store.entries[pluginId] ?? {};
    pluginEntries[normalizedId] = this.encrypt(secret);
    store.entries[pluginId] = pluginEntries;
    this.writeStore(store);
  }

  async getSecret(id: string): Promise<string | null> {
    const pluginId = this.requirePluginContext();
    const normalizedId = normalizeSecretId(id);
    const entry = this.readStore().entries[pluginId]?.[normalizedId];
    if (!entry) return null;
    return this.decrypt(entry, pluginId, normalizedId);
  }

  async listSecrets(): Promise<string[]> {
    const pluginId = this.requirePluginContext();
    return Object.keys(this.readStore().entries[pluginId] ?? {}).sort();
  }

  removePluginSecrets(pluginId: string): number {
    assertSafeObsidianPluginId(pluginId);
    const store = this.readStore();
    const count = Object.keys(store.entries[pluginId] ?? {}).length;
    if (count === 0) return 0;
    delete store.entries[pluginId];
    this.writeStore(store);
    return count;
  }

  getSummary(pluginId: string): ObsidianSecretStorageSummary {
    assertSafeObsidianPluginId(pluginId);
    return {
      backend: SECRET_STORAGE_BACKEND,
      encrypted: true,
      path: relativeToMindRoot(this.mindRoot, this.storagePath()),
      keyPath: relativeToMindRoot(this.mindRoot, this.keyPath()),
      pluginId,
      secrets: Object.keys(this.readStore().entries[pluginId] ?? {}).length,
    };
  }

  private requirePluginContext(): string {
    const pluginId = this.getActivePluginId();
    if (!pluginId) {
      throw new Error('[obsidian-compat] SecretStorage requires an active plugin context.');
    }
    assertSafeObsidianPluginId(pluginId);
    return pluginId;
  }

  private encrypt(secret: string): StoredSecretEntry {
    const key = this.readOrCreateKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
      updatedAt: new Date().toISOString(),
    };
  }

  private decrypt(entry: StoredSecretEntry, pluginId: string, secretId: string): string {
    try {
      if (entry.alg !== 'aes-256-gcm') {
        throw new Error(`Unsupported algorithm: ${entry.alg}`);
      }
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.readOrCreateKey(),
        Buffer.from(entry.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(entry.data, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf-8');
    } catch (error) {
      this.warn?.({
        pluginId,
        code: 'secret-storage-decrypt-failed',
        message: `SecretStorage could not decrypt "${secretId}": ${error instanceof Error ? error.message : String(error)}`,
      });
      throw new Error(`[obsidian-compat] Failed to decrypt SecretStorage entry "${secretId}".`);
    }
  }

  private readStore(): SecretStorageFile {
    const filePath = this.storagePath();
    if (!fs.existsSync(filePath)) {
      return emptyStore();
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<SecretStorageFile>;
      if (parsed.version !== SECRET_STORAGE_VERSION || parsed.backend !== SECRET_STORAGE_BACKEND) {
        return emptyStore();
      }
      return {
        version: SECRET_STORAGE_VERSION,
        backend: SECRET_STORAGE_BACKEND,
        entries: normalizeEntries(parsed.entries),
      };
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: SecretStorageFile): void {
    const filePath = this.storagePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 });
    chmodBestEffort(filePath);
  }

  private readOrCreateKey(): Buffer {
    const filePath = this.keyPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      const key = Buffer.from(raw, 'base64');
      if (key.length !== KEY_BYTES) {
        throw new Error('[obsidian-compat] SecretStorage key has an invalid length.');
      }
      return key;
    }

    const key = crypto.randomBytes(KEY_BYTES);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, key.toString('base64'), { encoding: 'utf-8', mode: 0o600 });
    chmodBestEffort(filePath);
    return key;
  }

  private storagePath(): string {
    return resolveCanonicalPluginSecretStoragePath(this.mindRoot);
  }

  private keyPath(): string {
    return resolveCanonicalPluginSecretStorageKeyPath(this.mindRoot);
  }
}

export function normalizeSecretId(id: string): string {
  const normalized = id.trim();
  if (!SECRET_ID_PATTERN.test(normalized)) {
    throw new Error(`[obsidian-compat] SecretStorage id must contain only lowercase letters, numbers, and dashes: ${id}`);
  }
  return normalized;
}

export function removeObsidianPluginSecrets(mindRoot: string, pluginId: string): number {
  return new ObsidianSecretStorage(mindRoot, () => pluginId).removePluginSecrets(pluginId);
}

function emptyStore(): SecretStorageFile {
  return {
    version: SECRET_STORAGE_VERSION,
    backend: SECRET_STORAGE_BACKEND,
    entries: {},
  };
}

function normalizeEntries(value: unknown): Record<string, Record<string, StoredSecretEntry>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries: Record<string, Record<string, StoredSecretEntry>> = {};
  for (const [pluginId, pluginValue] of Object.entries(value)) {
    if (!pluginValue || typeof pluginValue !== 'object' || Array.isArray(pluginValue)) continue;
    try {
      assertSafeObsidianPluginId(pluginId);
    } catch {
      continue;
    }
    const pluginEntries: Record<string, StoredSecretEntry> = {};
    for (const [secretId, entry] of Object.entries(pluginValue)) {
      if (!isStoredSecretEntry(entry)) continue;
      try {
        pluginEntries[normalizeSecretId(secretId)] = entry;
      } catch {
        continue;
      }
    }
    if (Object.keys(pluginEntries).length > 0) {
      entries[pluginId] = pluginEntries;
    }
  }
  return entries;
}

function isStoredSecretEntry(value: unknown): value is StoredSecretEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Partial<StoredSecretEntry>;
  return entry.alg === 'aes-256-gcm'
    && typeof entry.iv === 'string'
    && typeof entry.tag === 'string'
    && typeof entry.data === 'string'
    && typeof entry.updatedAt === 'string';
}

function relativeToMindRoot(mindRoot: string, filePath: string): string {
  return path.relative(mindRoot, filePath).replace(/\\/g, '/');
}

function chmodBestEffort(filePath: string): void {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod is best effort on platforms/filesystems that do not preserve POSIX modes.
  }
}
