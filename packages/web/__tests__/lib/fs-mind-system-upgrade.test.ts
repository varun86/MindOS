import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getTestMindRoot } from '../setup';
import { getFileTree, invalidateCache } from '@/lib/fs';

const DEFAULT_DIRS = ['MIND_DAO', 'MIND_FA', 'MIND_SHU', 'MIND_QI'] as const;

describe('file tree mind-system upgrade entrypoint', () => {
  it('creates default Mind System folders before building the tree', () => {
    const mindRoot = getTestMindRoot();
    invalidateCache();

    const tree = getFileTree();

    expect(tree).toHaveLength(DEFAULT_DIRS.length);
    expect(tree.map(node => node.name)).toEqual(expect.arrayContaining([...DEFAULT_DIRS]));
    for (const dir of DEFAULT_DIRS) {
      expect(fs.statSync(path.join(mindRoot, dir)).isDirectory()).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, dir, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, dir, 'INSTRUCTION.md'))).toBe(true);
    }
    expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'), 'utf-8'))
      .toContain('type: system');
  });
});
