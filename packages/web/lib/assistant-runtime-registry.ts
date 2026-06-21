export type AssistantPermissionPolicyMode = 'read' | 'ask' | 'auto' | 'full';
export type AssistantPermissionLevel = 'trusted-write';

export const ASSISTANT_RUN_REGISTRY = {
  'inbox-organizer': 'trusted-write',
  dreaming: 'trusted-write',
} as const satisfies Record<string, AssistantPermissionLevel>;

export function assistantPermissionLevelToPolicyMode(permission: AssistantPermissionLevel): AssistantPermissionPolicyMode {
  switch (permission) {
    case 'trusted-write':
      return 'ask';
  }
}

export function getAssistantPermissionLevel(assistantId: string | undefined): AssistantPermissionLevel | undefined {
  if (!assistantId) return undefined;
  return ASSISTANT_RUN_REGISTRY[assistantId as keyof typeof ASSISTANT_RUN_REGISTRY];
}

export function getAssistantPermissionMode(assistantId: string | undefined): AssistantPermissionPolicyMode | undefined {
  const permission = getAssistantPermissionLevel(assistantId);
  return permission ? assistantPermissionLevelToPolicyMode(permission) : undefined;
}

export function resolveAssistantPermissionMode(
  assistantId: string | undefined,
  fallback: AssistantPermissionPolicyMode,
): AssistantPermissionPolicyMode {
  return getAssistantPermissionMode(assistantId) ?? fallback;
}

export function isRegisteredAssistantRun(assistantId: string | undefined): boolean {
  return Boolean(getAssistantPermissionLevel(assistantId));
}
