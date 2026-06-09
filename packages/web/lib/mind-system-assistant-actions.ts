'use client';

import { openAskModal } from '@/hooks/useAskModal';

export interface MindSystemAssistantRunActionInput {
  spaceTitle: string;
  assistantName: string;
  assistantDesc: string;
  spacePath: string;
  runPrompt: (
    spaceTitle: string,
    assistantName: string,
    assistantDesc: string,
    spacePath: string,
  ) => string;
}

export function buildMindSystemAssistantRunPrompt(input: MindSystemAssistantRunActionInput): string {
  return input.runPrompt(
    input.spaceTitle,
    input.assistantName,
    input.assistantDesc,
    input.spacePath,
  );
}

export function openMindSystemAssistantRun(input: MindSystemAssistantRunActionInput): void {
  openAskModal(buildMindSystemAssistantRunPrompt(input), 'user');
}
