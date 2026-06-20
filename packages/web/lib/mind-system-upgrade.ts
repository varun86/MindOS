import fs from 'fs';
import path from 'path';
import { resolveExistingSafe } from '@/lib/core/security';
import { defaultMindSystemSlots, type MindSystemSlot } from './mind-system';
import {
  getBuiltinAssistantMarkdownFiles,
  getDefaultAssistantPrompt,
  getLegacyAssistantPromptPath,
} from './mind-system-assistants';
import {
  INSTRUCTION_BY_MIND_SYSTEM_SLOT,
  README_BY_MIND_SYSTEM_SLOT,
} from './mind-system-scaffold';

export interface MindSystemUpgradeSkippedPath {
  path: string;
  reason: 'file_conflict' | 'unsafe_path' | 'write_failed';
}

export interface MindSystemUpgradeResult {
  state: 'ready' | 'partial';
  createdPaths: string[];
  existingPaths: string[];
  skippedPaths: MindSystemUpgradeSkippedPath[];
}

export function ensureDefaultMindSystemUpgrade(mindRoot: string): MindSystemUpgradeResult {
  const createdPaths: string[] = [];
  const existingPaths: string[] = [];
  const skippedPaths: MindSystemUpgradeSkippedPath[] = [];

  for (const assistant of getBuiltinAssistantMarkdownFiles()) {
    const promptResult = ensureAssistantMarkdownFile(mindRoot, assistant.assistantId, assistant.path);
    if (promptResult !== 'ready') {
      skippedPaths.push({
        path: assistant.path,
        reason: promptResult,
      });
    }
  }

  for (const slot of defaultMindSystemSlots().sort((a, b) => a.order - b.order)) {
    const result = ensureSlotDirectory(mindRoot, slot);
    if (result === 'created') createdPaths.push(slot.path);
    else if (result === 'existing') existingPaths.push(slot.path);
    else skippedPaths.push({ path: slot.path, reason: result });
  }

  return {
    state: skippedPaths.length > 0 ? 'partial' : 'ready',
    createdPaths,
    existingPaths,
    skippedPaths,
  };
}

function ensureAssistantMarkdownFile(
  mindRoot: string,
  assistantId: string,
  promptPath: string | undefined,
): 'ready' | MindSystemUpgradeSkippedPath['reason'] {
  if (!promptPath) return 'unsafe_path';

  let resolvedPromptPath: string;
  try {
    resolvedPromptPath = resolveExistingSafe(mindRoot, promptPath);
  } catch {
    return 'unsafe_path';
  }

  try {
    if (fs.existsSync(resolvedPromptPath)) {
      return fs.statSync(resolvedPromptPath).isFile() ? 'ready' : 'file_conflict';
    }
    fs.mkdirSync(path.dirname(resolvedPromptPath), { recursive: true });
    fs.writeFileSync(resolvedPromptPath, getAssistantMarkdownContent(mindRoot, assistantId), 'utf-8');
    return 'ready';
  } catch {
    return 'write_failed';
  }
}

function getAssistantMarkdownContent(mindRoot: string, assistantId: string): string {
  const defaultMarkdown = getDefaultAssistantPrompt(assistantId);
  const legacyPrompt = readLegacyAssistantPrompt(mindRoot, assistantId);
  if (!legacyPrompt) return defaultMarkdown;
  return replaceAssistantMarkdownBody(defaultMarkdown, stripLeadingFrontmatter(legacyPrompt));
}

function readLegacyAssistantPrompt(mindRoot: string, assistantId: string): string | null {
  const legacyPath = getLegacyAssistantPromptPath(assistantId);
  let resolvedLegacyPath: string;
  try {
    resolvedLegacyPath = resolveExistingSafe(mindRoot, legacyPath);
  } catch {
    return null;
  }
  try {
    if (!fs.existsSync(resolvedLegacyPath) || !fs.statSync(resolvedLegacyPath).isFile()) return null;
    return fs.readFileSync(resolvedLegacyPath, 'utf-8');
  } catch {
    return null;
  }
}

function replaceAssistantMarkdownBody(defaultMarkdown: string, body: string): string {
  const normalizedBody = body.trim();
  if (!normalizedBody) return defaultMarkdown;
  const normalized = defaultMarkdown.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  if (!match) return normalizedBody.endsWith('\n') ? normalizedBody : `${normalizedBody}\n`;
  return `${match[0].replace(/\n*$/, '\n\n')}${normalizedBody}\n`;
}

function stripLeadingFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return content.trim();
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  if (!match) return content.trim();
  return normalized.slice(match[0].length).replace(/^\n+/, '').trim();
}

function ensureSlotDirectory(
  mindRoot: string,
  slot: MindSystemSlot,
): 'created' | 'existing' | MindSystemUpgradeSkippedPath['reason'] {
  let slotDir: string;
  try {
    slotDir = resolveExistingSafe(mindRoot, slot.path);
  } catch {
    return 'unsafe_path';
  }

  try {
    if (fs.existsSync(slotDir)) {
      if (!fs.statSync(slotDir).isDirectory()) return 'file_conflict';
      ensureScaffoldFiles(slotDir, slot);
      return 'existing';
    }

    fs.mkdirSync(slotDir, { recursive: true });
    ensureScaffoldFiles(slotDir, slot);
    return 'created';
  } catch {
    return 'write_failed';
  }
}

function ensureScaffoldFiles(slotDir: string, slot: MindSystemSlot): void {
  const readmePath = path.join(slotDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, README_BY_MIND_SYSTEM_SLOT[slot.key], 'utf-8');
  }

  const instructionPath = path.join(slotDir, 'INSTRUCTION.md');
  if (!fs.existsSync(instructionPath)) {
    fs.writeFileSync(instructionPath, INSTRUCTION_BY_MIND_SYSTEM_SLOT[slot.key], 'utf-8');
  }

  const draftsPath = path.join(slotDir, 'Drafts');
  if (!fs.existsSync(draftsPath)) {
    fs.mkdirSync(draftsPath);
  }
}
