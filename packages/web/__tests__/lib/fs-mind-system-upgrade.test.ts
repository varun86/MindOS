import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getTestMindRoot } from '../setup';
import { MIND_SYSTEM_CONFIG_RELATIVE_PATH } from '@/lib/mind-system';
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
  });

  it('does not create default folders when the mind system is hidden', () => {
    const mindRoot = getTestMindRoot();
    const configPath = path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      version: 1,
      enabled: false,
      slots: {},
    }, null, 2), 'utf-8');
    invalidateCache();

    expect(getFileTree()).toEqual([]);
    for (const dir of DEFAULT_DIRS) {
      expect(fs.existsSync(path.join(mindRoot, dir))).toBe(false);
    }
  });
});
