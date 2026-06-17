import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { cleanupMindRoot, mkTempMindRoot } from '../core/helpers';
import {
  MIND_SYSTEM_CONFIG_RELATIVE_PATH,
  ensureMindSystemConfig,
  getMindSystemConfigPath,
  listMindSystemSlots,
  mindSystemPathExists,
} from '@/lib/mind-system';
import { applySpaceKits, applyTemplate } from '@/lib/template';

describe('mind-system registry', () => {
  it('creates the hidden mind-system registry without creating visible content folders', () => {
    const mindRoot = mkTempMindRoot();
    try {
      const config = ensureMindSystemConfig(mindRoot);
      const configPath = getMindSystemConfigPath(mindRoot);

      expect(fs.existsSync(configPath)).toBe(true);
      expect(Object.keys(config.slots)).toEqual(['dao', 'fa', 'shu', 'qi']);
      expect(config.slots.dao.systemId).toBe('MIND_DAO');
      expect(config.slots.dao.path).toBe('MIND_DAO');
      expect(fs.existsSync(path.join(mindRoot, 'MIND_DAO'))).toBe(false);
      expect(fs.existsSync(path.join(mindRoot, '99 验'))).toBe(false);
      expect(listMindSystemSlots(mindRoot)).toEqual([]);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('normalizes legacy slot metadata while adding new default slots', () => {
    const mindRoot = mkTempMindRoot();
    try {
      const configPath = path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({
        version: 1,
        slots: {
          dao: {
            systemId: 'MINDOS_DAO',
            label: '方向',
            path: '世界模型',
            role: 'custom-world-model',
            order: 1,
            enabled: true,
          },
          shi: {
            label: '势',
            path: '05 势',
            role: 'current-context',
            order: 50,
            enabled: true,
          },
          yan: {
            label: '验',
            path: '99 验',
            role: 'review-loop',
            order: 990,
            enabled: true,
          },
        },
      }, null, 2), 'utf-8');

      const config = ensureMindSystemConfig(mindRoot);
      expect(config.slots.dao.systemId).toBe('MIND_DAO');
      expect(config.slots.dao.label).toBe('道');
      expect(config.slots.dao.path).toBe('MIND_DAO');
      expect(config.slots.dao.role).toBe('world-model');
      expect(config.slots.fa.systemId).toBe('MIND_FA');
      expect(config.slots.fa.path).toBe('MIND_FA');
      expect('shi' in config.slots).toBe(false);
      expect('yan' in config.slots).toBe(false);

      const persisted = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as typeof config;
      expect(Object.keys(persisted.slots)).toEqual(['dao', 'fa', 'shu', 'qi']);
      expect(persisted.slots.dao.label).toBe('道');
      expect(persisted.slots.dao.path).toBe('MIND_DAO');
      expect('shi' in persisted.slots).toBe(false);
      expect('yan' in persisted.slots).toBe(false);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('lists Dao, Fa, Shu, and Qi as special UI slots while leaving Shi and Yan as normal folders', () => {
    const mindRoot = mkTempMindRoot();
    try {
      for (const dir of ['MIND_DAO', 'MIND_FA', 'MIND_SHU', 'MIND_QI', '05 势', '99 验']) {
        fs.mkdirSync(path.join(mindRoot, dir), { recursive: true });
      }
      const slots = listMindSystemSlots(mindRoot);

      expect(slots.map(slot => slot.key)).toEqual(['dao', 'fa', 'shu', 'qi']);
      expect(mindSystemPathExists(mindRoot, slots[0])).toBe(true);
      expect(mindSystemPathExists(mindRoot, slots[1])).toBe(true);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not expose configured system slots when their visible folders are missing', () => {
    const mindRoot = mkTempMindRoot();
    try {
      fs.mkdirSync(path.join(mindRoot, 'MIND_DAO'), { recursive: true });
      fs.writeFileSync(path.join(mindRoot, 'MIND_FA'), '# Not a folder', 'utf-8');
      const slots = listMindSystemSlots(mindRoot);

      expect(slots.map(slot => slot.key)).toEqual(['dao']);
      expect(slots.some(slot => slot.key === 'fa')).toBe(false);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not expose any system slots when the mind system is hidden', () => {
    const mindRoot = mkTempMindRoot();
    try {
      const configPath = path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({
        version: 1,
        enabled: false,
        slots: {
          dao: { path: 'MIND_DAO' },
        },
      }, null, 2), 'utf-8');
      fs.mkdirSync(path.join(mindRoot, 'MIND_DAO'), { recursive: true });

      const config = ensureMindSystemConfig(mindRoot);
      expect(config.enabled).toBe(false);
      expect(listMindSystemSlots(mindRoot)).toEqual([]);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('is upgraded when setup applies any built-in template', () => {
    const mindRoot = mkTempMindRoot();
    try {
      applyTemplate('empty', mindRoot);

      expect(fs.existsSync(path.join(mindRoot, MIND_SYSTEM_CONFIG_RELATIVE_PATH))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, 'MIND_DAO', 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'))).toBe(true);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('applies Space Kits with skip-existing and relative receipt paths', () => {
    const mindRoot = mkTempMindRoot();
    try {
      const existingReadme = path.join(mindRoot, '产品', 'README.md');
      fs.mkdirSync(path.dirname(existingReadme), { recursive: true });
      fs.writeFileSync(existingReadme, '# Custom product space', 'utf-8');

      const result = applySpaceKits(['product', 'social'], mindRoot, 'zh');

      expect(result.installed).toMatchObject([
        { id: 'product', locale: 'zh', copied: ['产品/INSTRUCTION.md'], skipped: ['产品/README.md'] },
        { id: 'social', locale: 'zh', copied: ['社交/README.md', '社交/INSTRUCTION.md'], skipped: [] },
      ]);
      expect(fs.readFileSync(existingReadme, 'utf-8')).toBe('# Custom product space');
      expect(fs.existsSync(path.join(mindRoot, '社交', 'README.md'))).toBe(true);

      const receiptPath = path.join(mindRoot, '.mindos', 'setup', 'space-kits.json');
      const receiptText = fs.readFileSync(receiptPath, 'utf-8');
      expect(receiptText).not.toContain(mindRoot);
      const receipt = JSON.parse(receiptText) as { installed: Array<{ id: string; copied: string[]; skipped: string[] }> };
      expect(receipt.installed.map(item => item.id)).toEqual(['product', 'social']);
      expect(receipt.installed[0].skipped).toEqual(['产品/README.md']);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('replaces the receipt entry when the same Space Kit locale is installed again', () => {
    const mindRoot = mkTempMindRoot();
    try {
      applySpaceKits(['product'], mindRoot, 'en');
      applySpaceKits(['product'], mindRoot, 'en');

      const receiptPath = path.join(mindRoot, '.mindos', 'setup', 'space-kits.json');
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8')) as { installed: Array<{ id: string; locale: string }> };
      expect(receipt.installed.filter(item => item.id === 'product' && item.locale === 'en')).toHaveLength(1);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });
});
