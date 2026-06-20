import fs from 'fs';
import path from 'path';
import { getFileTree, getMindRoot } from '@/lib/fs';
import { resolveExistingSafe } from '@/lib/core/security';
import type { FileNode } from '@/lib/core/types';
import { listMindSystemSlots, type MindSystemSlot } from './mind-system';

export interface SpaceInfo {
  name: string;
  path: string;
  fileCount: number;
  description: string;
}

export interface BuiltInMindSystemSpaceRecord {
  kind: 'builtin-mind-system';
  slot: MindSystemSlot;
  fileCount: number;
  description: string;
}

export interface SpaceOverview {
  workspaceSpaces: SpaceInfo[];
  builtInMindSystemSpaces: BuiltInMindSystemSpaceRecord[];
}

export function getSpaceOverview(
  mindRoot: string = getMindRoot(),
  tree: FileNode[] = getFileTree(),
): SpaceOverview {
  const mindSystemSlots = listMindSystemSlots(mindRoot);
  return {
    workspaceSpaces: listWorkspaceSpaces(mindRoot, tree, mindSystemSlots),
    builtInMindSystemSpaces: listBuiltInMindSystemSpaces(mindRoot, tree, mindSystemSlots),
  };
}

export function listWorkspaceSpaces(
  mindRoot: string = getMindRoot(),
  tree: FileNode[] = getFileTree(),
  mindSystemSlots: MindSystemSlot[] = listMindSystemSlots(mindRoot),
): SpaceInfo[] {
  const mindSystemPaths = new Set(mindSystemSlots.map(slot => normalizeSpacePath(slot.path)));
  return listTopLevelSpaces(mindRoot, tree)
    .filter(space => !mindSystemPaths.has(normalizeSpacePath(space.path)));
}

export function listBuiltInMindSystemSpaces(
  mindRoot: string = getMindRoot(),
  tree: FileNode[] = getFileTree(),
  mindSystemSlots: MindSystemSlot[] = listMindSystemSlots(mindRoot),
): BuiltInMindSystemSpaceRecord[] {
  const topLevelSpaces = new Map(
    listTopLevelSpaces(mindRoot, tree).map(space => [normalizeSpacePath(space.path), space]),
  );

  return mindSystemSlots.map(slot => {
    const topLevelSpace = topLevelSpaces.get(normalizeSpacePath(slot.path));
    return {
      kind: 'builtin-mind-system',
      slot,
      fileCount: topLevelSpace?.fileCount ?? 0,
      description: topLevelSpace?.description ?? extractDescription(mindRoot, slot.path),
    };
  });
}

export function getBuiltInMindSystemSpace(
  spacePath: string,
  mindRoot: string = getMindRoot(),
  tree: FileNode[] = getFileTree(),
  mindSystemSlots: MindSystemSlot[] = listMindSystemSlots(mindRoot),
): BuiltInMindSystemSpaceRecord | null {
  const normalizedPath = normalizeSpacePath(spacePath);
  const slot = mindSystemSlots.find(item => normalizeSpacePath(item.path) === normalizedPath);
  if (!slot) return null;
  return listBuiltInMindSystemSpaces(mindRoot, tree, [slot])[0] ?? null;
}

export function listTopLevelSpaces(
  mindRoot: string = getMindRoot(),
  tree: FileNode[] = getFileTree(),
): SpaceInfo[] {
  return tree
    .filter(node => node.type === 'directory' && !node.name.startsWith('.') && hasInstructionFile(node))
    .map(node => ({
      name: node.name,
      path: `${node.path.replace(/\/+$/, '')}/`,
      fileCount: countFiles(node),
      description: extractDescription(mindRoot, node.path),
    }));
}

function countFiles(node: FileNode): number {
  if (node.type === 'file') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
}

function extractDescription(mindRoot: string, spacePath: string): string {
  try {
    const readmePath = resolveExistingSafe(mindRoot, path.join(spacePath, 'README.md'));
    const content = fs.readFileSync(readmePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
}

function normalizeSpacePath(spacePath: string): string {
  return spacePath.replace(/\/+$/, '');
}

function hasInstructionFile(node: FileNode): boolean {
  return node.isSpace === true
    || (node.children ?? []).some(child => child.type === 'file' && child.name === 'INSTRUCTION.md');
}
