import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { cleanupMindRoot, mkTempMindRoot, seedFile } from '../core/helpers';
import {
  getMindSystemAssistants,
  getMindSystemAssistantSummary,
  listMindSystemAssistantSummaries,
} from '@/lib/mind-system-assistants';
import type { MindSystemSlot } from '@/lib/mind-system';

const daoSlot: MindSystemSlot = {
  key: 'dao',
  systemId: 'MIND_DAO',
  label: '道',
  path: 'MIND_DAO',
  role: 'world-model',
  order: 10,
  enabled: true,
};

const faSlot: MindSystemSlot = {
  key: 'fa',
  systemId: 'MIND_FA',
  label: '法',
  path: 'MIND_FA',
  role: 'principles',
  order: 20,
  enabled: true,
};

describe('mind-system assistants', () => {
  it('lets each built-in Mind System space reference multiple assistants without primary flags', () => {
    const assistants = getMindSystemAssistants({ key: 'dao' });

    expect(assistants.map(assistant => assistant.id)).toEqual(['daily-signal', 'decision-synthesizer']);
    expect(assistants[0]).toMatchObject({ schedule: { mode: 'daily' } });
    expect(assistants[1]).toMatchObject({ schedule: { mode: 'manual' } });
    expect(assistants).not.toContainEqual(expect.objectContaining({ primary: expect.anything() }));
  });

  it('counts visible markdown drafts and reports instruction readiness', () => {
    const mindRoot = mkTempMindRoot();
    try {
      seedFile(mindRoot, 'MIND_DAO/INSTRUCTION.md', '# Rules\n');
      seedFile(mindRoot, 'MIND_DAO/Drafts/one.md', '# One\n');
      seedFile(mindRoot, 'MIND_DAO/Drafts/nested/two.md', '# Two\n');
      seedFile(mindRoot, 'MIND_DAO/Drafts/ignored.txt', 'not markdown\n');
      seedFile(mindRoot, 'MIND_DAO/Drafts/.hidden.md', '# Hidden\n');

      const summary = getMindSystemAssistantSummary(mindRoot, daoSlot);

      expect(summary.instructionReady).toBe(true);
      expect(summary.draftCount).toBe(2);
      expect(summary.assistants.map(assistant => assistant.id)).toEqual(['daily-signal', 'decision-synthesizer']);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not invent summaries for hidden or absent slots', () => {
    const mindRoot = mkTempMindRoot();
    try {
      fs.mkdirSync(path.join(mindRoot, 'MIND_DAO'), { recursive: true });

      const summaries = listMindSystemAssistantSummaries(mindRoot, [daoSlot]);

      expect(Object.keys(summaries)).toEqual(['dao']);
      expect(summaries.dao?.instructionReady).toBe(false);
      expect(summaries.dao?.draftCount).toBe(0);
      expect(summaries.fa).toBeUndefined();
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('treats a Drafts file conflict as zero drafts without throwing', () => {
    const mindRoot = mkTempMindRoot();
    try {
      seedFile(mindRoot, 'MIND_FA/INSTRUCTION.md', '# Rules\n');
      seedFile(mindRoot, 'MIND_FA/Drafts', 'file conflict\n');

      const summary = getMindSystemAssistantSummary(mindRoot, faSlot);

      expect(summary.instructionReady).toBe(true);
      expect(summary.draftCount).toBe(0);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('treats an unreadable Drafts directory as zero drafts without throwing', () => {
    const mindRoot = mkTempMindRoot();
    const originalReaddirSync = fs.readdirSync;
    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockImplementation((target, options) => {
      if (String(target).endsWith(`${path.sep}Drafts`)) {
        throw new Error('permission denied');
      }
      return originalReaddirSync(target, options as never) as never;
    });

    try {
      seedFile(mindRoot, 'MIND_FA/INSTRUCTION.md', '# Rules\n');
      seedFile(mindRoot, 'MIND_FA/Drafts/one.md', '# One\n');

      const summary = getMindSystemAssistantSummary(mindRoot, faSlot);

      expect(summary.instructionReady).toBe(true);
      expect(summary.draftCount).toBe(0);
    } finally {
      readdirSpy.mockRestore();
      cleanupMindRoot(mindRoot);
    }
  });
});
