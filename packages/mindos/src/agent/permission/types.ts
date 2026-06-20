export const MINDOS_PERMISSION_MODES = ['read', 'ask', 'auto', 'full'] as const;

export type MindosPermissionMode = typeof MINDOS_PERMISSION_MODES[number];

export type MindosPermissionDecision = 'allow' | 'ask' | 'deny';

export interface MindosFineGrainedPermissions {
  tools?: Record<string, MindosPermissionDecision>;
  paths?: Record<string, MindosPermissionDecision>;
  externalDirectory?: MindosPermissionDecision;
}

export function isMindosPermissionMode(value: unknown): value is MindosPermissionMode {
  return value === 'read' || value === 'ask' || value === 'auto' || value === 'full';
}

export function normalizeMindosPermissionMode(
  value: unknown,
  fallback: MindosPermissionMode = 'ask',
): MindosPermissionMode {
  return isMindosPermissionMode(value) ? value : fallback;
}

export function assertMindosPermissionMode(value: unknown): MindosPermissionMode {
  if (isMindosPermissionMode(value)) return value;
  throw new Error(`Invalid MindOS permission mode: ${String(value)}`);
}

export function readLegacyMindosPermissionMode(
  value: unknown,
  fallback: MindosPermissionMode = 'ask',
): MindosPermissionMode {
  if (isMindosPermissionMode(value)) return value;
  if (value === 'readonly') return 'read';
  if (value === 'agent' || value === 'kb-write') return 'ask';
  return fallback;
}
