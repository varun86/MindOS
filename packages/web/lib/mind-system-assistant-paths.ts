export const MINDOS_ASSISTANT_PROMPT_ROOT = '.mindos/assistants';
export const MINDOS_ASSISTANT_ROOT = MINDOS_ASSISTANT_PROMPT_ROOT;

const ASSISTANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isSafeAssistantId(assistantId: string): boolean {
  return ASSISTANT_ID_PATTERN.test(assistantId);
}

export function getAssistantPromptPath(assistantId: string): string {
  return getAssistantMarkdownPath(assistantId);
}

export function getAssistantProfilePath(assistantId: string): string {
  return getAssistantMarkdownPath(assistantId);
}

export function getAssistantMarkdownPath(assistantId: string): string {
  if (!isSafeAssistantId(assistantId)) {
    throw new Error(`Unsafe assistant id: ${assistantId}`);
  }
  return `${MINDOS_ASSISTANT_ROOT}/${assistantId}.md`;
}

export function getLegacyAssistantPromptPath(assistantId: string): string {
  if (!isSafeAssistantId(assistantId)) {
    throw new Error(`Unsafe assistant id: ${assistantId}`);
  }
  return `${MINDOS_ASSISTANT_ROOT}/${assistantId}/prompt.md`;
}

export function getLegacyAssistantProfilePath(assistantId: string): string {
  if (!isSafeAssistantId(assistantId)) {
    throw new Error(`Unsafe assistant id: ${assistantId}`);
  }
  return `${MINDOS_ASSISTANT_ROOT}/${assistantId}/profile.json`;
}
