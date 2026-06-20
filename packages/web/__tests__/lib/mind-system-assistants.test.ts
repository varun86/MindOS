import { describe, expect, it } from 'vitest';
import {
  MINDOS_CONTEXT_ASSISTANT_IDS,
  getAssistantProfilePath,
  getAssistantPromptPath,
  getDefaultAssistantPrompt,
  getMindosContextAssistants,
} from '@/lib/mind-system-assistants';

describe('mind-system assistants', () => {
  it('keeps MindOS context assistants as global prompt templates, not Space-owned assistants', () => {
    const assistants = getMindosContextAssistants();

    expect(assistants.map(assistant => assistant.assistantId)).toEqual([...MINDOS_CONTEXT_ASSISTANT_IDS]);
    expect(assistants[0]).toEqual({
      assistantId: 'daily-signal',
      promptPath: '.mindos/assistants/daily-signal/prompt.md',
    });
    expect(assistants.every(assistant => !('profilePath' in assistant))).toBe(true);
  });

  it('uses a flat hidden assistant path registry and rejects unsafe assistant ids', () => {
    expect(getAssistantPromptPath('daily-signal')).toBe('.mindos/assistants/daily-signal/prompt.md');
    expect(getAssistantProfilePath('daily-signal')).toBe('.mindos/assistants/daily-signal/profile.json');
    expect(() => getAssistantPromptPath('../daily-signal')).toThrow(/Unsafe assistant id/);
    expect(() => getAssistantProfilePath('../daily-signal')).toThrow(/Unsafe assistant id/);
    expect(() => getAssistantPromptPath('Daily Signal')).toThrow(/Unsafe assistant id/);
  });

  it('returns built-in prompts for known assistants and a safe fallback for custom ids', () => {
    expect(getDefaultAssistantPrompt('daily-signal')).toContain('assistantId: daily-signal');
    expect(getDefaultAssistantPrompt('daily-signal')).toContain('# Daily Signal');
    expect(getDefaultAssistantPrompt('resource-auditor')).toContain('assistantId: resource-auditor');
    expect(getDefaultAssistantPrompt('custom-helper')).toContain('assistantId: custom-helper');
    expect(getDefaultAssistantPrompt('custom-helper')).toContain('# custom-helper');
  });
});
