export type AssistantPermissionPolicyMode = 'readonly' | 'kb-write' | 'agent';
export type AssistantAskPermissionPolicyMode = AssistantPermissionPolicyMode;
export type AssistantPermissionLevel = 'full-access';

export const ASSISTANT_RUN_REGISTRY = {
  'inbox-organizer': 'full-access',
  dreaming: 'full-access',
} as const satisfies Record<string, AssistantPermissionLevel>;

export function assistantPermissionLevelToPolicyMode(permission: AssistantPermissionLevel): AssistantPermissionPolicyMode {
  switch (permission) {
    case 'full-access':
      return 'agent';
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

export function resolveAssistantAskPermissionPolicyMode(
  assistantId: string | undefined,
  fallback: AssistantAskPermissionPolicyMode,
): AssistantAskPermissionPolicyMode {
  return getAssistantPermissionMode(assistantId) ?? fallback;
}

export function isRegisteredAssistantRun(assistantId: string | undefined): boolean {
  return Boolean(getAssistantPermissionLevel(assistantId));
}
