import fs from 'fs';
import path from 'path';
import { resolveExistingSafe } from '@/lib/core/security';

export const MIND_SYSTEM_CONFIG_RELATIVE_PATH = '.mindos/modules/mind-system.json';

export type MindSystemSlotKey = 'dao' | 'fa' | 'shu' | 'qi';

export interface MindSystemSlot {
  key: MindSystemSlotKey;
  systemId: string;
  label: string;
  path: string;
  role: string;
  order: number;
  enabled: boolean;
}

export interface MindSystemConfig {
  version: 1;
  enabled: boolean;
  slots: Record<MindSystemSlotKey, MindSystemSlot>;
}

const DEFAULT_MIND_SYSTEM_SLOTS: readonly MindSystemSlot[] = [
  { key: 'dao', systemId: 'MIND_DAO', label: '道', path: 'MIND_DAO', role: 'world-model', order: 10, enabled: true },
  { key: 'fa', systemId: 'MIND_FA', label: '法', path: 'MIND_FA', role: 'principles', order: 20, enabled: true },
  { key: 'shu', systemId: 'MIND_SHU', label: '术', path: 'MIND_SHU', role: 'methods', order: 30, enabled: true },
  { key: 'qi', systemId: 'MIND_QI', label: '器', path: 'MIND_QI', role: 'tools-assets', order: 40, enabled: true },
] as const;

const SLOT_KEYS = new Set<MindSystemSlotKey>(DEFAULT_MIND_SYSTEM_SLOTS.map(slot => slot.key));

export function defaultMindSystemConfig(): MindSystemConfig {
  return {
    version: 1,
    enabled: true,
    slots: Object.fromEntries(
      DEFAULT_MIND_SYSTEM_SLOTS.map(slot => [slot.key, { ...slot }]),
    ) as Record<MindSystemSlotKey, MindSystemSlot>,
  };
}

export function getMindSystemConfigPath(mindRoot: string): string {
  return path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH);
}

export function ensureMindSystemConfig(mindRoot: string): MindSystemConfig {
  const configPath = getMindSystemConfigPath(mindRoot);
  const raw = readMindSystemConfigFile(configPath);
  const existing = parseMindSystemConfig(raw);
  const merged = mergeMindSystemConfig(raw);

  if (!existing || JSON.stringify(raw) !== JSON.stringify(merged)) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  }

  return merged;
}

export function readMindSystemConfig(mindRoot: string): MindSystemConfig {
  return ensureMindSystemConfig(mindRoot);
}

export function listMindSystemSlots(mindRoot: string): MindSystemSlot[] {
  const config = readMindSystemConfig(mindRoot);
  if (!config.enabled) return [];
  return Object.values(config.slots)
    .filter(slot => slot.enabled && mindSystemPathExists(mindRoot, slot))
    .map(slot => ({ ...slot }))
    .sort((a, b) => a.order - b.order);
}

export function mindSystemPathExists(mindRoot: string, slot: Pick<MindSystemSlot, 'path'>): boolean {
  try {
    const resolved = resolveExistingSafe(mindRoot, slot.path);
    const instructionPath = resolveExistingSafe(mindRoot, path.join(slot.path, 'INSTRUCTION.md'));
    return fs.statSync(resolved).isDirectory() && fs.statSync(instructionPath).isFile();
  } catch {
    return false;
  }
}

function readMindSystemConfigFile(configPath: string): unknown {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseMindSystemConfig(raw: unknown): MindSystemConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (source.version !== 1 || !source.slots || typeof source.slots !== 'object') return null;
  return mergeMindSystemConfig(source);
}

function mergeMindSystemConfig(raw: unknown): MindSystemConfig {
  const defaults = defaultMindSystemConfig();
  const enabled = raw && typeof raw === 'object' && 'enabled' in raw && typeof (raw as { enabled?: unknown }).enabled === 'boolean'
    ? (raw as { enabled: boolean }).enabled
    : defaults.enabled;
  const rawSlots = raw && typeof raw === 'object' && 'slots' in raw
    ? (raw as { slots?: unknown }).slots
    : undefined;

  if (!rawSlots || typeof rawSlots !== 'object') return { ...defaults, enabled };

  const slots = { ...defaults.slots };
  for (const [key, value] of Object.entries(rawSlots as Record<string, unknown>)) {
    if (!SLOT_KEYS.has(key as MindSystemSlotKey) || !value || typeof value !== 'object') continue;
    const current = slots[key as MindSystemSlotKey];
    const override = value as Record<string, unknown>;
    slots[key as MindSystemSlotKey] = {
      ...current,
      enabled: typeof override.enabled === 'boolean' ? override.enabled : current.enabled,
    };
  }

  return { version: 1, enabled, slots };
}
