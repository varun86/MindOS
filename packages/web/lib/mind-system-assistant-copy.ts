import type { MindSystemSpaceAssistant } from './mind-system-assistants';

export interface MindSystemAssistantCopy {
  id: string;
  name: string;
  desc: string;
}

export function resolveMindSystemAssistantCopy(
  assistant: Pick<MindSystemSpaceAssistant, 'id'>,
  copies: readonly MindSystemAssistantCopy[],
): MindSystemAssistantCopy {
  return copies.find(copy => copy.id === assistant.id) ?? {
    id: assistant.id,
    name: assistant.id,
    desc: '',
  };
}

export function resolveMindSystemAssistantCopies(
  assistants: Array<Pick<MindSystemSpaceAssistant, 'id'>>,
  copies: readonly MindSystemAssistantCopy[],
): MindSystemAssistantCopy[] {
  return assistants.map(assistant => resolveMindSystemAssistantCopy(assistant, copies));
}
