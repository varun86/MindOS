import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildFileTreeForTest } from '@/lib/fs';
import { ensureDefaultMindSystemUpgrade } from '@/lib/mind-system-upgrade';
import { getBuiltInMindSystemSpace, getSpaceOverview, listWorkspaceSpaces } from '@/lib/space-records';
import { cleanupMindRoot, mkTempMindRoot, seedFile } from '../core/helpers';

describe('space records', () => {
  it('separates built-in Mind System spaces from ordinary workspace spaces', () => {
    const mindRoot = mkTempMindRoot();
    try {
      ensureDefaultMindSystemUpgrade(mindRoot);
      seedFile(mindRoot, 'Projects/README.md', '# Projects\n\nActive project notes.\n');
      seedFile(mindRoot, 'Projects/roadmap.md', '# Roadmap\n');
      seedFile(mindRoot, 'MIND_DAO/Drafts/today.md', '# Today\n');

      const tree = buildFileTreeForTest(mindRoot);
      const overview = getSpaceOverview(mindRoot, tree);

      expect(overview.builtInMindSystemSpaces.map(space => space.slot.key)).toEqual(['dao', 'fa', 'shu', 'qi']);
      expect(overview.builtInMindSystemSpaces[0]).toMatchObject({
        kind: 'builtin-mind-system',
        slot: { path: 'MIND_DAO', label: '道' },
        assistantSummary: {
          assistants: [
            { id: 'daily-signal' },
            { id: 'decision-synthesizer' },
          ],
          draftCount: 1,
          instructionReady: true,
        },
      });
      expect(overview.workspaceSpaces.map(space => space.name)).toEqual(['Projects']);
      expect(overview.workspaceSpaces[0]).toMatchObject({
        path: 'Projects/',
        fileCount: 2,
        description: 'Active project notes.',
      });
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not hide user folders that merely resemble old experiments', () => {
    const mindRoot = mkTempMindRoot();
    try {
      ensureDefaultMindSystemUpgrade(mindRoot);
      for (const dir of ['01 道', '02 法', '05 势', '99 验']) {
        fs.mkdirSync(path.join(mindRoot, dir), { recursive: true });
        seedFile(mindRoot, `${dir}/README.md`, `# ${dir}\n\nCustom space.\n`);
      }

      const workspaceSpaces = listWorkspaceSpaces(mindRoot, buildFileTreeForTest(mindRoot));

      expect(workspaceSpaces.map(space => space.name)).toEqual(['01 道', '02 法', '05 势', '99 验']);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('finds a built-in Mind System space by exact directory path only', () => {
    const mindRoot = mkTempMindRoot();
    try {
      ensureDefaultMindSystemUpgrade(mindRoot);
      fs.mkdirSync(path.join(mindRoot, 'Projects'), { recursive: true });

      const tree = buildFileTreeForTest(mindRoot);

      expect(getBuiltInMindSystemSpace('MIND_DAO', mindRoot, tree)?.slot.key).toBe('dao');
      expect(getBuiltInMindSystemSpace('MIND_DAO/', mindRoot, tree)?.slot.key).toBe('dao');
      expect(getBuiltInMindSystemSpace('Projects', mindRoot, tree)).toBeNull();
      expect(getBuiltInMindSystemSpace('01 道', mindRoot, tree)).toBeNull();
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });
});
