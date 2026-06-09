import fs from 'fs';
import path from 'path';
import { resolveExistingSafe } from '@/lib/core/security';
import type { MindSystemSlot, MindSystemSlotKey } from './mind-system';

export type AssistantScheduleMode = 'manual' | 'daily' | 'weekly';

export interface AssistantSchedule {
  mode: AssistantScheduleMode;
}

export interface MindSystemSpaceAssistant {
  id: string;
  schedule: AssistantSchedule;
}

export interface MindSystemSpaceAssistantConfig {
  assistants: MindSystemSpaceAssistant[];
}

export interface MindSystemAssistantSummary {
  assistants: MindSystemSpaceAssistant[];
  draftCount: number;
  instructionReady: boolean;
}

export const MIND_SYSTEM_ASSISTANT_CONFIGS: Record<MindSystemSlotKey, MindSystemSpaceAssistantConfig> = {
  dao: {
    assistants: [
      {
        id: 'daily-signal',
        schedule: { mode: 'daily' },
      },
      {
        id: 'decision-synthesizer',
        schedule: { mode: 'manual' },
      },
    ],
  },
  fa: {
    assistants: [
      {
        id: 'rule-keeper',
        schedule: { mode: 'manual' },
      },
      {
        id: 'boundary-reviewer',
        schedule: { mode: 'manual' },
      },
    ],
  },
  shu: {
    assistants: [
      {
        id: 'method-organizer',
        schedule: { mode: 'manual' },
      },
      {
        id: 'checklist-builder',
        schedule: { mode: 'manual' },
      },
    ],
  },
  qi: {
    assistants: [
      {
        id: 'tool-inventory',
        schedule: { mode: 'manual' },
      },
      {
        id: 'resource-auditor',
        schedule: { mode: 'manual' },
      },
    ],
  },
};

export function getMindSystemAssistants(slot: Pick<MindSystemSlot, 'key'>): MindSystemSpaceAssistant[] {
  return MIND_SYSTEM_ASSISTANT_CONFIGS[slot.key].assistants.map(assistant => ({ ...assistant }));
}

export function getMindSystemAssistantSummary(
  mindRoot: string,
  slot: Pick<MindSystemSlot, 'key' | 'path'>,
): MindSystemAssistantSummary {
  const assistants = getMindSystemAssistants(slot);
  return {
    assistants,
    draftCount: countDraftFiles(mindRoot, slot.path),
    instructionReady: instructionFileExists(mindRoot, slot.path),
  };
}

export function listMindSystemAssistantSummaries(
  mindRoot: string,
  slots: Array<Pick<MindSystemSlot, 'key' | 'path'>>,
): Partial<Record<MindSystemSlotKey, MindSystemAssistantSummary>> {
  return Object.fromEntries(
    slots.map(slot => [slot.key, getMindSystemAssistantSummary(mindRoot, slot)]),
  ) as Partial<Record<MindSystemSlotKey, MindSystemAssistantSummary>>;
}

function instructionFileExists(mindRoot: string, spacePath: string): boolean {
  try {
    const instructionPath = resolveExistingSafe(mindRoot, path.join(spacePath, 'INSTRUCTION.md'));
    return fs.statSync(instructionPath).isFile();
  } catch {
    return false;
  }
}

function countDraftFiles(mindRoot: string, spacePath: string): number {
  let draftsDir: string;
  try {
    draftsDir = resolveExistingSafe(mindRoot, path.join(spacePath, 'Drafts'));
  } catch {
    return 0;
  }

  try {
    const stat = fs.statSync(draftsDir);
    if (!stat.isDirectory()) return 0;
    return countFilesRecursive(draftsDir);
  } catch {
    return 0;
  }
}

function countFilesRecursive(dir: string): number {
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesRecursive(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count += 1;
      }
    }
  } catch {
    return 0;
  }
  return count;
}
