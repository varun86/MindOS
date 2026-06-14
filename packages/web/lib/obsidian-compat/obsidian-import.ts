/**
 * Obsidian Plugin Compatibility - Obsidian vault import scanner
 * Scans `.obsidian/plugins` and imports selected plugins into MindOS `.plugins`.
 */

import fs from 'fs';
import path from 'path';
import { analyzePluginCompatibility, getCompatibilityLevel, type CompatibilityLevel, type PluginCompatibilityReport } from './compatibility-report';
import { validateManifest } from './manifest';
import type { PluginManifest } from './types';
import { resolveExistingSafe, resolveSafe } from '@/lib/core/security';

export interface ObsidianPluginHotkey {
  modifiers: string[];
  key: string;
}

export interface ObsidianPluginCommandHotkeys {
  commandId: string;
  hotkeys: ObsidianPluginHotkey[];
}

export interface ObsidianVaultPluginConfig {
  enabledInObsidian: boolean;
  hasEnabledList?: boolean;
  hotkeys: ObsidianPluginCommandHotkeys[];
  hotkeyCount: number;
}

export interface ImportedObsidianPluginConfig extends ObsidianVaultPluginConfig {
  schemaVersion: 1;
  source: 'obsidian';
  pluginId: string;
}

interface ObsidianVaultConfigSnapshot {
  enabledPluginIds: Set<string>;
  hasEnabledList: boolean;
  hotkeys: Map<string, ObsidianPluginHotkey[]>;
}

export interface ScannedObsidianPlugin {
  id: string;
  manifest: PluginManifest;
  sourceDir: string;
  compatibility: PluginCompatibilityReport;
  compatibilityLevel: CompatibilityLevel;
  hasStyles: boolean;
  hasData: boolean;
  obsidianConfig: ObsidianVaultPluginConfig;
}

export interface SkippedPlugin {
  dirName: string;
  reason: string;
}

export interface ScanResult {
  plugins: ScannedObsidianPlugin[];
  skipped: SkippedPlugin[];
  vault: {
    pluginsDirFound: boolean;
    hasEnabledList: boolean;
  };
}

export interface ImportObsidianPluginOptions {
  vaultRoot: string;
  pluginId: string;
  targetMindRoot: string;
}

export interface ImportedObsidianPlugin {
  pluginId: string;
  targetDir: string;
  copiedFiles: string[];
  obsidianConfig: ImportedObsidianPluginConfig;
}

function resolveVaultPluginsDir(vaultRoot: string): string {
  return resolveExistingSafe(vaultRoot, '.obsidian/plugins');
}

function resolvePluginDir(root: string, basePath: string, pluginId: string): string {
  if (!pluginId || pluginId.includes('..') || pluginId.includes('/') || pluginId.includes('\\')) {
    throw new Error(`Plugin path escapes plugins directory: ${pluginId}`);
  }
  try {
    return resolveExistingSafe(root, `${basePath}/${pluginId}`);
  } catch {
    throw new Error(`Plugin path escapes plugins directory: ${pluginId}`);
  }
}

function resolveRegularPluginFile(pluginDir: string, fileName: string): string {
  const filePath = resolveSafe(pluginDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing plugin file: ${fileName}`);
  }
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Plugin file must be a regular file: ${fileName}`);
  }
  return filePath;
}

function maybeResolveRegularPluginFile(pluginDir: string, fileName: string): string | null {
  try {
    const filePath = resolveSafe(pluginDir, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Plugin file must not be a symlink: ${fileName}`);
    }
    return stats.isFile() ? filePath : null;
  } catch (err) {
    if (err instanceof Error && /must not be a symlink/.test(err.message)) {
      throw err;
    }
    return null;
  }
}

function readManifest(pluginDir: string): PluginManifest {
  const manifestPath = resolveRegularPluginFile(pluginDir, 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return validateManifest(JSON.parse(raw));
}

function readMainCode(pluginDir: string): string {
  return fs.readFileSync(resolveRegularPluginFile(pluginDir, 'main.js'), 'utf-8');
}

function readJsonFile(root: string, relativePath: string): unknown | null {
  try {
    const filePath = resolveExistingSafe(root, relativePath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readObsidianEnabledPluginIds(vaultRoot: string): { ids: Set<string>; hasEnabledList: boolean } {
  const enabledListPath = path.join(vaultRoot, '.obsidian', 'community-plugins.json');
  const hasEnabledList = fs.existsSync(enabledListPath);
  const parsed = readJsonFile(vaultRoot, '.obsidian/community-plugins.json');
  if (Array.isArray(parsed)) {
    return {
      ids: new Set(parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)),
      hasEnabledList,
    };
  }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.enabledPlugins)) {
      return {
        ids: new Set(record.enabledPlugins.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)),
        hasEnabledList,
      };
    }
    return {
      ids: new Set(Object.entries(record)
        .filter(([, enabled]) => enabled === true)
        .map(([pluginId]) => pluginId)),
      hasEnabledList,
    };
  }
  return { ids: new Set(), hasEnabledList };
}

function normalizeHotkey(value: unknown): ObsidianPluginHotkey | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { modifiers?: unknown; key?: unknown };
  if (typeof record.key !== 'string' || record.key.trim().length === 0) return null;
  const modifiers = Array.isArray(record.modifiers)
    ? record.modifiers.filter((modifier): modifier is string => typeof modifier === 'string' && modifier.trim().length > 0)
    : [];
  return {
    modifiers,
    key: record.key.trim(),
  };
}

function normalizeHotkeyList(value: unknown): ObsidianPluginHotkey[] {
  if (Array.isArray(value)) {
    return value.map(normalizeHotkey).filter((hotkey): hotkey is ObsidianPluginHotkey => hotkey !== null);
  }
  if (value && typeof value === 'object') {
    const record = value as { hotkeys?: unknown };
    if (Array.isArray(record.hotkeys)) {
      return normalizeHotkeyList(record.hotkeys);
    }
    const hotkey = normalizeHotkey(value);
    return hotkey ? [hotkey] : [];
  }
  return [];
}

function readObsidianHotkeys(vaultRoot: string): Map<string, ObsidianPluginHotkey[]> {
  const parsed = readJsonFile(vaultRoot, '.obsidian/hotkeys.json');
  const hotkeys = new Map<string, ObsidianPluginHotkey[]>();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return hotkeys;
  }

  for (const [commandId, value] of Object.entries(parsed as Record<string, unknown>)) {
    const list = normalizeHotkeyList(value);
    if (list.length > 0) {
      hotkeys.set(commandId, list);
    }
  }
  return hotkeys;
}

function readObsidianVaultConfigSnapshot(vaultRoot: string): ObsidianVaultConfigSnapshot {
  const enabled = readObsidianEnabledPluginIds(vaultRoot);
  return {
    enabledPluginIds: enabled.ids,
    hasEnabledList: enabled.hasEnabledList,
    hotkeys: readObsidianHotkeys(vaultRoot),
  };
}

function obsidianVaultPluginConfigFromSnapshot(snapshot: ObsidianVaultConfigSnapshot, pluginId: string): ObsidianVaultPluginConfig {
  const hotkeys = Array.from(snapshot.hotkeys.entries())
    .filter(([commandId]) => commandId === pluginId || commandId.startsWith(`${pluginId}:`) || commandId.startsWith(`obsidian:${pluginId}:`))
    .map(([commandId, list]) => ({ commandId, hotkeys: list }))
    .sort((a, b) => a.commandId.localeCompare(b.commandId, 'en'));

  return {
    enabledInObsidian: snapshot.enabledPluginIds.has(pluginId),
    hasEnabledList: snapshot.hasEnabledList,
    hotkeys,
    hotkeyCount: hotkeys.reduce((sum, item) => sum + item.hotkeys.length, 0),
  };
}

export function readObsidianVaultPluginConfig(vaultRoot: string, pluginId: string): ObsidianVaultPluginConfig {
  return obsidianVaultPluginConfigFromSnapshot(readObsidianVaultConfigSnapshot(vaultRoot), pluginId);
}

function toImportedObsidianPluginConfig(pluginId: string, config: ObsidianVaultPluginConfig): ImportedObsidianPluginConfig {
  return {
    schemaVersion: 1,
    source: 'obsidian',
    pluginId,
    enabledInObsidian: config.enabledInObsidian,
    hasEnabledList: config.hasEnabledList,
    hotkeys: config.hotkeys,
    hotkeyCount: config.hotkeyCount,
  };
}

export function readImportedObsidianPluginConfig(mindRoot: string, pluginId: string): ImportedObsidianPluginConfig | null {
  try {
    const pluginDir = resolvePluginDir(mindRoot, '.plugins', pluginId);
    const parsed = readJsonFile(pluginDir, 'obsidian-import.json');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Partial<ImportedObsidianPluginConfig>;
    if (record.schemaVersion !== 1 || record.source !== 'obsidian' || record.pluginId !== pluginId) {
      return null;
    }
    const hotkeys = Array.isArray(record.hotkeys)
      ? record.hotkeys
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const commandId = (item as { commandId?: unknown }).commandId;
          if (typeof commandId !== 'string' || commandId.trim().length === 0) return null;
          const list = normalizeHotkeyList((item as { hotkeys?: unknown }).hotkeys);
          return list.length > 0 ? { commandId: commandId.trim(), hotkeys: list } : null;
        })
        .filter((item): item is ObsidianPluginCommandHotkeys => item !== null)
      : [];
    return {
      schemaVersion: 1,
      source: 'obsidian',
      pluginId,
      enabledInObsidian: record.enabledInObsidian === true,
      hasEnabledList: record.hasEnabledList === true,
      hotkeys,
      hotkeyCount: hotkeys.reduce((sum, item) => sum + item.hotkeys.length, 0),
    };
  } catch {
    return null;
  }
}

export async function scanObsidianVaultPlugins(vaultRoot: string): Promise<ScanResult> {
  let pluginsDir: string;
  try {
    pluginsDir = resolveVaultPluginsDir(vaultRoot);
  } catch {
    return { plugins: [], skipped: [], vault: { pluginsDirFound: false, hasEnabledList: false } };
  }
  if (!fs.existsSync(pluginsDir)) {
    return { plugins: [], skipped: [], vault: { pluginsDirFound: false, hasEnabledList: false } };
  }

  const entries = fs.readdirSync(pluginsDir);
  const obsidianConfigSnapshot = readObsidianVaultConfigSnapshot(vaultRoot);
  const plugins: ScannedObsidianPlugin[] = [];
  const skipped: SkippedPlugin[] = [];
  const seenPluginIds = new Set<string>();

  for (const entry of entries) {
    const pluginDir = path.resolve(path.join(pluginsDir, entry));
    if (!fs.existsSync(pluginDir) || !fs.lstatSync(pluginDir).isDirectory()) {
      continue;
    }

    try {
      const manifest = readManifest(pluginDir);
      if (manifest.id !== entry) {
        throw new Error(`Plugin folder name "${entry}" does not match manifest id "${manifest.id}".`);
      }
      if (seenPluginIds.has(manifest.id)) {
        throw new Error(`Duplicate Obsidian plugin id: ${manifest.id}`);
      }
      seenPluginIds.add(manifest.id);
      const code = readMainCode(pluginDir);
      const compatibility = analyzePluginCompatibility(code, manifest);
      const obsidianConfig = obsidianVaultPluginConfigFromSnapshot(obsidianConfigSnapshot, manifest.id);
      plugins.push({
        id: manifest.id,
        manifest,
        sourceDir: pluginDir,
        compatibility,
        compatibilityLevel: getCompatibilityLevel(compatibility),
        hasStyles: maybeResolveRegularPluginFile(pluginDir, 'styles.css') !== null,
        hasData: maybeResolveRegularPluginFile(pluginDir, 'data.json') !== null,
        obsidianConfig,
      });
    } catch (err) {
      skipped.push({
        dirName: entry,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    plugins: plugins.sort((a, b) => a.id.localeCompare(b.id, 'en')),
    skipped,
    vault: {
      pluginsDirFound: true,
      hasEnabledList: obsidianConfigSnapshot.hasEnabledList,
    },
  };
}

export async function importObsidianPlugin(options: ImportObsidianPluginOptions): Promise<ImportedObsidianPlugin> {
  const sourceDir = resolvePluginDir(options.vaultRoot, '.obsidian/plugins', options.pluginId);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Obsidian plugin not found: ${options.pluginId}`);
  }
  const sourceManifest = readManifest(sourceDir);
  if (sourceManifest.id !== options.pluginId) {
    throw new Error(`Obsidian plugin manifest id does not match requested plugin: ${options.pluginId}`);
  }

  let targetDir: string;
  try {
    resolveExistingSafe(options.targetMindRoot, '.plugins');
    targetDir = resolveExistingSafe(options.targetMindRoot, `.plugins/${options.pluginId}`);
  } catch {
    throw new Error(`Plugin target path escapes .plugins directory: ${options.pluginId}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const copiedFiles: string[] = [];
  for (const fileName of ['manifest.json', 'main.js', 'styles.css', 'data.json']) {
    const from = maybeResolveRegularPluginFile(sourceDir, fileName);
    if (!from) continue;
    const to = path.join(targetDir, fileName);
    fs.copyFileSync(from, to);
    copiedFiles.push(fileName);
  }
  const obsidianConfig = toImportedObsidianPluginConfig(
    options.pluginId,
    readObsidianVaultPluginConfig(options.vaultRoot, options.pluginId),
  );
  fs.writeFileSync(
    path.join(targetDir, 'obsidian-import.json'),
    JSON.stringify(obsidianConfig, null, 2),
    'utf-8',
  );
  copiedFiles.push('obsidian-import.json');

  return {
    pluginId: options.pluginId,
    targetDir,
    copiedFiles,
    obsidianConfig,
  };
}
