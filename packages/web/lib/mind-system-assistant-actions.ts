'use client';

import { openAskModal } from '@/hooks/useAskModal';

export interface MindSystemAssistantRunActionInput {
  spaceTitle: string;
  assistantName: string;
  assistantDesc: string;
  spacePath: string;
  promptPath: string;
  runPrompt: (
    spaceTitle: string,
    assistantName: string,
    assistantDesc: string,
    spacePath: string,
    promptPath: string,
  ) => string;
}

export function buildMindSystemAssistantRunPrompt(input: MindSystemAssistantRunActionInput): string {
  return input.runPrompt(
    input.spaceTitle,
    input.assistantName,
    input.assistantDesc,
    input.spacePath,
    input.promptPath,
  );
}

export function openMindSystemAssistantRun(input: MindSystemAssistantRunActionInput): void {
  openAskModal(buildMindSystemAssistantRunPrompt(input), 'user');
}
