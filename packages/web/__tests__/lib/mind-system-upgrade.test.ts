import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { cleanupMindRoot, mkTempMindRoot } from '../core/helpers';
import { MIND_SYSTEM_CONFIG_RELATIVE_PATH, listMindSystemSlots } from '@/lib/mind-system';
import { ensureDefaultMindSystemUpgrade } from '@/lib/mind-system-upgrade';

const DEFAULT_DIRS = ['MIND_DAO', 'MIND_FA', 'MIND_SHU', 'MIND_QI'] as const;

describe('default mind-system upgrade', () => {
  it('creates default Mind System folders, scaffolds, and normalized config', () => {
    const mindRoot = mkTempMindRoot();
    try {
      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('ready');
      expect(result.createdPaths).toEqual([...DEFAULT_DIRS]);
      expect(result.skippedPaths).toEqual([]);
      for (const dir of DEFAULT_DIRS) {
        expect(fs.statSync(path.join(mindRoot, dir)).isDirectory()).toBe(true);
        expect(fs.existsSync(path.join(mindRoot, dir, 'README.md'))).toBe(true);
        expect(fs.existsSync(path.join(mindRoot, dir, 'INSTRUCTION.md'))).toBe(true);
      }

      const config = JSON.parse(fs.readFileSync(path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH), 'utf-8'));
      expect(config.enabled).toBe(true);
      expect(Object.keys(config.slots)).toEqual(['dao', 'fa', 'shu', 'qi']);
      expect(config.slots.dao).toMatchObject({ systemId: 'MIND_DAO', path: 'MIND_DAO', label: '道' });
      expect(listMindSystemSlots(mindRoot).map(slot => slot.key)).toEqual(['dao', 'fa', 'shu', 'qi']);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('is idempotent and does not overwrite existing scaffold files', () => {
    const mindRoot = mkTempMindRoot();
    try {
      fs.mkdirSync(path.join(mindRoot, 'MIND_DAO'), { recursive: true });
      fs.writeFileSync(path.join(mindRoot, 'MIND_DAO', 'README.md'), '# Custom Dao\n', 'utf-8');
      fs.writeFileSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'), '# Custom Agent Rules\n', 'utf-8');

      ensureDefaultMindSystemUpgrade(mindRoot);
      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('ready');
      expect(result.createdPaths).toEqual([]);
      expect(result.existingPaths).toEqual([...DEFAULT_DIRS]);
      expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'README.md'), 'utf-8')).toBe('# Custom Dao\n');
      expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'), 'utf-8')).toBe('# Custom Agent Rules\n');
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('skips a slot when the target path exists as a file', () => {
    const mindRoot = mkTempMindRoot();
    try {
      fs.writeFileSync(path.join(mindRoot, 'MIND_DAO'), 'not a directory', 'utf-8');

      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('partial');
      expect(result.skippedPaths).toEqual([{ path: 'MIND_DAO', reason: 'file_conflict' }]);
      expect(result.createdPaths).toEqual(['MIND_FA', 'MIND_SHU', 'MIND_QI']);
      expect(listMindSystemSlots(mindRoot).map(slot => slot.key)).toEqual(['fa', 'shu', 'qi']);
      expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO'), 'utf-8')).toBe('not a directory');
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not create folders when the mind system is hidden', () => {
    const mindRoot = mkTempMindRoot();
    try {
      const configPath = path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({
        version: 1,
        enabled: false,
        slots: {},
      }, null, 2), 'utf-8');

      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result).toEqual({
        state: 'hidden',
        createdPaths: [],
        existingPaths: [],
        skippedPaths: [],
      });
      for (const dir of DEFAULT_DIRS) {
        expect(fs.existsSync(path.join(mindRoot, dir))).toBe(false);
      }
      expect(listMindSystemSlots(mindRoot)).toEqual([]);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not recognize old experiment folders or user-created similar folders', () => {
    const mindRoot = mkTempMindRoot();
    try {
      for (const dir of ['01 道', '02 法', '03 术', '04 器', 'Dao', 'Fa', 'Shu', 'Qi', 'Principles', '方法论']) {
        fs.mkdirSync(path.join(mindRoot, dir), { recursive: true });
      }

      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('ready');
      expect(result.createdPaths).toEqual([...DEFAULT_DIRS]);
      for (const dir of ['01 道', '02 法', '03 术', '04 器', 'Dao', 'Fa', 'Shu', 'Qi', 'Principles', '方法论']) {
        expect(fs.statSync(path.join(mindRoot, dir)).isDirectory()).toBe(true);
      }
      expect(listMindSystemSlots(mindRoot).map(slot => slot.path)).toEqual([...DEFAULT_DIRS]);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });
});
