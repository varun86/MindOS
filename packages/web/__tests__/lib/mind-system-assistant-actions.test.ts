import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildMindSystemAssistantRunPrompt,
  openMindSystemAssistantRun,
} from '@/lib/mind-system-assistant-actions';
import { openAskModal } from '@/hooks/useAskModal';

vi.mock('@/hooks/useAskModal', () => ({
  openAskModal: vi.fn(),
}));

const input = {
  spaceTitle: 'Dao',
  assistantName: 'Daily signal curator',
  assistantDesc: 'Turns direction, opportunity, and risk signals into a draft.',
  spacePath: 'MIND_DAO',
  promptPath: '.mindos/assistants/daily-signal/prompt.md',
  runPrompt: (
    spaceTitle: string,
    assistantName: string,
    assistantDesc: string,
    spacePath: string,
    promptPath: string,
  ) => [
    `space=${spaceTitle}`,
    `assistant=${assistantName}`,
    `desc=${assistantDesc}`,
    `path=${spacePath}`,
    `prompt=${promptPath}`,
    `drafts=${spacePath}/Drafts/`,
  ].join('\n'),
};

describe('mind-system assistant actions', () => {
  beforeEach(() => {
    vi.mocked(openAskModal).mockClear();
  });

  it('builds the run prompt through the localized prompt factory', () => {
    expect(buildMindSystemAssistantRunPrompt(input)).toContain('drafts=MIND_DAO/Drafts/');
    expect(buildMindSystemAssistantRunPrompt(input)).toContain('prompt=.mindos/assistants/daily-signal/prompt.md');
  });

  it('opens Ask as a user-triggered assistant run', () => {
    openMindSystemAssistantRun(input);

    expect(openAskModal).toHaveBeenCalledWith(
      expect.stringContaining('assistant=Daily signal curator'),
      'user',
    );
  });
});
