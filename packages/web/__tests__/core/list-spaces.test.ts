import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { summarizeTopLevelSpaces } from '@/lib/core/list-spaces';
import type { FileNode } from '@/lib/core/types';
import { mkTempMindRoot, cleanupMindRoot, seedFile } from './helpers';

describe('summarizeTopLevelSpaces', () => {
  let mindRoot: string;

  beforeEach(() => {
    mindRoot = mkTempMindRoot();
  });
  afterEach(() => {
    cleanupMindRoot(mindRoot);
  });

  it('maps tree nodes and reads README description', () => {
    seedFile(mindRoot, 'Alpha/x.md', '1');
    seedFile(mindRoot, 'Alpha/INSTRUCTION.md', '# Alpha instructions\n');
    seedFile(mindRoot, 'Alpha/README.md', '# A\n\nbeta desc');
    const tree: FileNode[] = [
      {
        name: 'Alpha',
        path: 'Alpha',
        type: 'directory',
        children: [
          { name: 'INSTRUCTION.md', path: 'Alpha/INSTRUCTION.md', type: 'file', extension: '.md' },
          { name: 'x.md', path: 'Alpha/x.md', type: 'file', extension: '.md' },
        ],
      },
    ];
    const rows = summarizeTopLevelSpaces(mindRoot, tree);
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('Alpha');
    expect(rows[0].fileCount).toBe(2);
    expect(rows[0].description).toBe('beta desc');
  });

  it('skips top-level dirs without INSTRUCTION.md', () => {
    seedFile(mindRoot, 'Alpha/README.md', '# A\n\nbeta desc');
    const tree: FileNode[] = [
      {
        name: 'Alpha',
        path: 'Alpha',
        type: 'directory',
        children: [{ name: 'README.md', path: 'Alpha/README.md', type: 'file', extension: '.md' }],
      },
    ];

    expect(summarizeTopLevelSpaces(mindRoot, tree)).toEqual([]);
  });

  it('skips hidden top-level dirs', () => {
    const tree: FileNode[] = [
      {
        name: '.hidden',
        path: '.hidden',
        type: 'directory',
        children: [{ name: 'a.md', path: '.hidden/a.md', type: 'file', extension: '.md' }],
      },
    ];
    expect(summarizeTopLevelSpaces(mindRoot, tree)).toHaveLength(0);
  });
});
