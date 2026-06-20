import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { cleanupMindRoot, mkTempMindRoot } from '../core/helpers';
import { listMindSystemSlots } from '@/lib/mind-system';
import { ensureDefaultMindSystemUpgrade } from '@/lib/mind-system-upgrade';

const DEFAULT_DIRS = ['MIND_DAO', 'MIND_FA', 'MIND_SHU', 'MIND_QI'] as const;
const DEFAULT_ASSISTANT_PROMPTS = [
  '.mindos/assistants/inbox-organizer/prompt.md',
  '.mindos/assistants/dreaming/prompt.md',
  '.mindos/assistants/daily-signal/prompt.md',
  '.mindos/assistants/decision-synthesizer/prompt.md',
  '.mindos/assistants/rule-keeper/prompt.md',
  '.mindos/assistants/boundary-reviewer/prompt.md',
  '.mindos/assistants/method-organizer/prompt.md',
  '.mindos/assistants/checklist-builder/prompt.md',
  '.mindos/assistants/tool-inventory/prompt.md',
  '.mindos/assistants/resource-auditor/prompt.md',
] as const;
const DEFAULT_ASSISTANT_PROFILES = [
  '.mindos/assistants/dreaming/profile.json',
] as const;

describe('default mind-system upgrade', () => {
  it('creates default Mind System folders and unified Space front matter without writing a registry', () => {
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
        expect(fs.statSync(path.join(mindRoot, dir, 'Drafts')).isDirectory()).toBe(true);
      }
      for (const promptPath of DEFAULT_ASSISTANT_PROMPTS) {
        const prompt = fs.readFileSync(path.join(mindRoot, promptPath), 'utf-8');
        expect(prompt).toContain('assistantId:');
        expect(prompt).toContain('## Role');
      }
      const dreamingProfile = JSON.parse(fs.readFileSync(path.join(mindRoot, '.mindos/assistants/dreaming/profile.json'), 'utf-8'));
      expect(dreamingProfile).toEqual({
        name: 'Dreaming',
        description: 'Reviews knowledge-base health and writes review-first Dreaming artifacts.',
        schemaVersion: 1,
        preferredAgent: 'mindos-agent',
        skills: ['mindos'],
        mcp: [],
      });

      const daoInstruction = fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'), 'utf-8');
      expect(daoInstruction).toContain('mindSpace:');
      expect(daoInstruction).toContain('id: dao');
      expect(daoInstruction).toContain('type: system');
      expect(daoInstruction).toContain('source: builtin');
      expect(daoInstruction).toContain('version: 1');
      expect(daoInstruction).toContain('locale: zh');
      expect(daoInstruction).toContain('order: 10');
      expect(listMindSystemSlots(mindRoot).map(slot => slot.key)).toEqual(['dao', 'fa', 'shu', 'qi']);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('is idempotent and does not overwrite existing scaffold files', () => {
    const mindRoot = mkTempMindRoot();
    try {
      fs.mkdirSync(path.join(mindRoot, 'MIND_DAO'), { recursive: true });
      fs.mkdirSync(path.join(mindRoot, 'MIND_DAO', 'Drafts'), { recursive: true });
      fs.writeFileSync(path.join(mindRoot, 'MIND_DAO', 'README.md'), '# Custom Dao\n', 'utf-8');
      fs.writeFileSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'), '# Custom Agent Rules\n', 'utf-8');
      fs.writeFileSync(path.join(mindRoot, 'MIND_DAO', 'Drafts', 'custom.md'), '# Existing Draft\n', 'utf-8');
      fs.mkdirSync(path.join(mindRoot, '.mindos', 'assistants', 'daily-signal'), { recursive: true });
      fs.writeFileSync(
        path.join(mindRoot, '.mindos', 'assistants', 'daily-signal', 'prompt.md'),
        '# Custom Daily Signal Prompt\n',
        'utf-8',
      );
      fs.mkdirSync(path.join(mindRoot, '.mindos', 'assistants', 'inbox-organizer'), { recursive: true });
      fs.writeFileSync(
        path.join(mindRoot, '.mindos', 'assistants', 'inbox-organizer', 'prompt.md'),
        '# Custom Inbox Organizer Prompt\n',
        'utf-8',
      );
      fs.mkdirSync(path.join(mindRoot, '.mindos', 'assistants', 'dreaming'), { recursive: true });
      fs.writeFileSync(
        path.join(mindRoot, '.mindos', 'assistants', 'dreaming', 'prompt.md'),
        '# Custom Dreaming Prompt\n',
        'utf-8',
      );
      fs.writeFileSync(
        path.join(mindRoot, '.mindos', 'assistants', 'dreaming', 'profile.json'),
        '{"name":"Custom Dreaming"}\n',
        'utf-8',
      );

      ensureDefaultMindSystemUpgrade(mindRoot);
      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('ready');
      expect(result.createdPaths).toEqual([]);
      expect(result.existingPaths).toEqual([...DEFAULT_DIRS]);
      expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'README.md'), 'utf-8')).toBe('# Custom Dao\n');
      expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'INSTRUCTION.md'), 'utf-8')).toBe('# Custom Agent Rules\n');
      expect(fs.readFileSync(path.join(mindRoot, 'MIND_DAO', 'Drafts', 'custom.md'), 'utf-8')).toBe('# Existing Draft\n');
      expect(fs.readFileSync(path.join(mindRoot, '.mindos/assistants/daily-signal/prompt.md'), 'utf-8'))
        .toBe('# Custom Daily Signal Prompt\n');
      expect(fs.readFileSync(path.join(mindRoot, '.mindos/assistants/inbox-organizer/prompt.md'), 'utf-8'))
        .toBe('# Custom Inbox Organizer Prompt\n');
      expect(fs.readFileSync(path.join(mindRoot, '.mindos/assistants/dreaming/prompt.md'), 'utf-8'))
        .toBe('# Custom Dreaming Prompt\n');
      expect(fs.readFileSync(path.join(mindRoot, '.mindos/assistants/dreaming/profile.json'), 'utf-8'))
        .toBe('{"name":"Custom Dreaming"}\n');
      expect(fs.readFileSync(path.join(mindRoot, '.mindos/assistants/decision-synthesizer/prompt.md'), 'utf-8'))
        .toContain('assistantId: decision-synthesizer');
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
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/inbox-organizer/prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/daily-signal/prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/decision-synthesizer/prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/rule-keeper/prompt.md'))).toBe(true);
    } finally {
      cleanupMindRoot(mindRoot);
    }
  });

  it('does not write assistant prompts through a symlinked assistant registry', () => {
    const mindRoot = mkTempMindRoot();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mindos-assistant-registry-outside-'));
    try {
      fs.mkdirSync(path.join(mindRoot, '.mindos'), { recursive: true });
      fs.symlinkSync(outside, path.join(mindRoot, '.mindos', 'assistants'), 'dir');

      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('partial');
      expect(result.createdPaths).toEqual([...DEFAULT_DIRS]);
      expect(result.skippedPaths.map(item => item.path).sort()).toEqual([
        ...DEFAULT_ASSISTANT_PROMPTS,
        ...DEFAULT_ASSISTANT_PROFILES,
      ].sort());
      expect(result.skippedPaths.every(item => item.reason === 'unsafe_path')).toBe(true);
      expect(fs.existsSync(path.join(outside, 'inbox-organizer', 'prompt.md'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'dreaming', 'prompt.md'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'dreaming', 'profile.json'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'daily-signal', 'prompt.md'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'resource-auditor', 'prompt.md'))).toBe(false);
    } finally {
      cleanupMindRoot(mindRoot);
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('does not scaffold a Mind System slot through a symlinked slot directory', () => {
    const mindRoot = mkTempMindRoot();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mindos-slot-outside-'));
    try {
      fs.symlinkSync(outside, path.join(mindRoot, 'MIND_DAO'), 'dir');

      const result = ensureDefaultMindSystemUpgrade(mindRoot);

      expect(result.state).toBe('partial');
      expect(result.skippedPaths).toContainEqual({ path: 'MIND_DAO', reason: 'unsafe_path' });
      expect(result.createdPaths).toEqual(['MIND_FA', 'MIND_SHU', 'MIND_QI']);
      expect(fs.existsSync(path.join(outside, 'README.md'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'INSTRUCTION.md'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'Drafts'))).toBe(false);
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/inbox-organizer/prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/daily-signal/prompt.md'))).toBe(true);
      expect(fs.existsSync(path.join(mindRoot, '.mindos/assistants/decision-synthesizer/prompt.md'))).toBe(true);
    } finally {
      cleanupMindRoot(mindRoot);
      fs.rmSync(outside, { recursive: true, force: true });
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
