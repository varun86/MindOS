import fs from 'fs';
import path from 'path';
import { resolveExistingSafe } from '@/lib/core/security';
import { splitMarkdownFrontmatter, type FrontmatterValue } from './parsing/frontmatter';

export type MindSystemSlotKey = 'dao' | 'fa' | 'shu' | 'qi';

export interface MindSystemSlot {
  key: MindSystemSlotKey;
  systemId: string;
  label: string;
  path: string;
  role: string;
  order: number;
}

const DEFAULT_MIND_SYSTEM_SLOTS: readonly MindSystemSlot[] = [
  { key: 'dao', systemId: 'MIND_DAO', label: '道', path: 'MIND_DAO', role: 'world-model', order: 10 },
  { key: 'fa', systemId: 'MIND_FA', label: '法', path: 'MIND_FA', role: 'principles', order: 20 },
  { key: 'shu', systemId: 'MIND_SHU', label: '术', path: 'MIND_SHU', role: 'methods', order: 30 },
  { key: 'qi', systemId: 'MIND_QI', label: '器', path: 'MIND_QI', role: 'tools-assets', order: 40 },
] as const;

const SLOT_KEYS = new Set<MindSystemSlotKey>(DEFAULT_MIND_SYSTEM_SLOTS.map(slot => slot.key));
const DEFAULT_SLOT_BY_KEY = new Map<MindSystemSlotKey, MindSystemSlot>(
  DEFAULT_MIND_SYSTEM_SLOTS.map(slot => [slot.key, slot]),
);

export function defaultMindSystemSlots(): MindSystemSlot[] {
  return DEFAULT_MIND_SYSTEM_SLOTS.map(slot => ({ ...slot }));
}

export function listMindSystemSlots(mindRoot: string): MindSystemSlot[] {
  const slotsByKey = new Map<MindSystemSlotKey, MindSystemSlot>();
  for (const slot of listFrontmatterMindSystemSlots(mindRoot)) {
    slotsByKey.set(slot.key, slot);
  }

  for (const slot of DEFAULT_MIND_SYSTEM_SLOTS) {
    if (slotsByKey.has(slot.key) || !mindSystemPathExists(mindRoot, slot)) continue;
    slotsByKey.set(slot.key, { ...slot });
  }

  return [...slotsByKey.values()]
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

function listFrontmatterMindSystemSlots(mindRoot: string): MindSystemSlot[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(mindRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const slots: MindSystemSlot[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const spaceId = readMindSystemSpaceId(mindRoot, entry.name);
    if (!spaceId || !SLOT_KEYS.has(spaceId)) continue;
    const defaults = DEFAULT_SLOT_BY_KEY.get(spaceId);
    if (!defaults) continue;
    slots.push({
      ...defaults,
      path: entry.name,
      order: readMindSpaceOrder(mindRoot, entry.name) ?? defaults.order,
    });
  }
  return slots;
}

function readMindSystemSpaceId(mindRoot: string, spacePath: string): MindSystemSlotKey | null {
  let instructionPath: string;
  try {
    instructionPath = resolveExistingSafe(mindRoot, path.join(spacePath, 'INSTRUCTION.md'));
  } catch {
    return null;
  }

  try {
    const parsed = splitMarkdownFrontmatter(fs.readFileSync(instructionPath, 'utf-8'));
    const mindSpace = parsed.frontmatter?.entries.find(entry => entry.key === 'mindSpace')?.value;
    if (!isFrontmatterObject(mindSpace)) return null;
    if (mindSpace.source !== 'builtin' || mindSpace.type !== 'system') return null;
    return typeof mindSpace.id === 'string' && SLOT_KEYS.has(mindSpace.id as MindSystemSlotKey)
      ? mindSpace.id as MindSystemSlotKey
      : null;
  } catch {
    return null;
  }
}

function readMindSpaceOrder(mindRoot: string, spacePath: string): number | null {
  let instructionPath: string;
  try {
    instructionPath = resolveExistingSafe(mindRoot, path.join(spacePath, 'INSTRUCTION.md'));
  } catch {
    return null;
  }

  try {
    const parsed = splitMarkdownFrontmatter(fs.readFileSync(instructionPath, 'utf-8'));
    const mindSpace = parsed.frontmatter?.entries.find(entry => entry.key === 'mindSpace')?.value;
    if (!isFrontmatterObject(mindSpace)) return null;
    return typeof mindSpace.order === 'number' && Number.isFinite(mindSpace.order)
      ? mindSpace.order
      : null;
  } catch {
    return null;
  }
}

function isFrontmatterObject(value: FrontmatterValue | undefined): value is Record<string, FrontmatterValue> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}
