import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { getDesktopHome } from './desktop-home';
import { localBrowseNeedsSetupWizard, shouldSeedWebSetupPendingForLocal } from './mindos-desktop-config';

export const DESKTOP_HOME = getDesktopHome();

export const CONFIG_DIR = path.join(DESKTOP_HOME, '.mindos');

export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export const PID_PATH = path.join(CONFIG_DIR, 'mindos.pid');

export const DEFAULT_WEB_PORT = 3456;

export const DEFAULT_MCP_PORT = 8781;

export interface MindOSConfig {
  ai?: Record<string, unknown>;
  mindRoot?: string;
  /** Legacy key; Next readSettings maps sopRoot → mindRoot — Desktop must match */
  sopRoot?: string;
  port?: number;
  mcpPort?: number;
  authToken?: string;
  webPassword?: string;
  desktopMode?: 'local' | 'remote';
  /** @see wiki/specs/spec-desktop-bundled-mindos.md */
  mindosRuntimePolicy?: 'prefer-newer' | 'bundled-only' | 'user-only';
  mindosRuntimeRoot?: string;
  mindosRuntimeStrictCompat?: boolean;
  minMindOsVersion?: string;
  maxTestedMindOsVersion?: string;
  /** Shared with Next `readSettings` — true until setup wizard completes */
  setupPending?: boolean;
  [key: string]: unknown;
}

let cachedConfig: MindOSConfig | null = null;

export function atomicWriteConfig(data: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = CONFIG_PATH + '.tmp';
  writeFileSync(tmp, data, 'utf-8');
  renameSync(tmp, CONFIG_PATH);
}

export function readMindOsConfigFileUncached(): MindOSConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = readFileSync(CONFIG_PATH, 'utf-8').trim();
    if (!raw) return {};
    return JSON.parse(raw) as MindOSConfig;
  } catch (err) {
    console.warn('[MindOS] config.json is corrupt or unreadable, using defaults:', err instanceof Error ? err.message : err);
    return {};
  }
}

export function loadConfig(): MindOSConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = readMindOsConfigFileUncached();
  ensureAuthToken(cachedConfig);
  return cachedConfig;
}

function ensureAuthToken(config: MindOSConfig): void {
  if (config.authToken) return;
  const token = randomBytes(24).toString('hex').slice(0, 24);
  config.authToken = token;
  try {
    atomicWriteConfig(JSON.stringify(config, null, 2));
    console.info('[MindOS] Auto-generated authToken (no onboard config found)');
  } catch (err) {
    console.warn('[MindOS] Failed to save auto-generated authToken:', err instanceof Error ? err.message : err);
  }
}

export function invalidateConfig(): void { cachedConfig = null; }

export function needsDesktopModeSelectAtLaunch(): boolean {
  if (!existsSync(CONFIG_PATH)) return true;
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8').trim();
    if (!raw) return true;
    const j = JSON.parse(raw) as MindOSConfig;
    if (j.desktopMode !== 'local' && j.desktopMode !== 'remote') return true;
    return false;
  } catch {
    return true;
  }
}

export function resolveLocalMindOsBrowseUrl(baseUrl: string): string {
  const u = baseUrl.replace(/\/$/, '');
  const j = readMindOsConfigFileUncached();
  if (localBrowseNeedsSetupWizard(j)) {
    return `${u}/setup?force=1`;
  }
  return u;
}

export function saveDesktopMode(mode: 'local' | 'remote', opts?: { allowSeedWebSetup?: boolean }): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  invalidateConfig();
  const existing = readMindOsConfigFileUncached();
  const merged: MindOSConfig = { ...existing, desktopMode: mode };
  if (opts?.allowSeedWebSetup && shouldSeedWebSetupPendingForLocal(mode, existing)) {
    merged.setupPending = true;
  }
  atomicWriteConfig(JSON.stringify(merged, null, 2));
  cachedConfig = merged;
}
