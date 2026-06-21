import type { MindosPermissionMode } from '@geminilight/mindos/agent/mindos-pi/permission';

export type HeadlessAgentEntryPoint = 'headless' | 'im' | 'schedule';

export interface HeadlessAgentPermissionGuardInput {
  entrypoint?: HeadlessAgentEntryPoint;
  permissionMode?: MindosPermissionMode;
  env?: Pick<NodeJS.ProcessEnv, 'MINDOS_HEADLESS_PERMISSION_MODE' | 'MINDOS_IM_PERMISSION_MODE'>;
}

export interface HeadlessAgentPermissionGuardDecision {
  permissionPolicyMode: MindosPermissionMode;
  entrypoint: HeadlessAgentEntryPoint;
  downgraded: boolean;
  reason?: 'headless_permission_requires_explicit_opt_in';
}

export function resolveHeadlessAgentPermission(input: HeadlessAgentPermissionGuardInput = {}): HeadlessAgentPermissionGuardDecision {
  const entrypoint = input.entrypoint ?? 'headless';
  const env = input.env ?? process.env;
  const requestedPermissionMode = input.permissionMode
    ?? normalizePermissionMode(entrypoint === 'im' ? env.MINDOS_IM_PERMISSION_MODE : undefined)
    ?? normalizePermissionMode(env.MINDOS_HEADLESS_PERMISSION_MODE);

  if (requestedPermissionMode) {
    return {
      permissionPolicyMode: requestedPermissionMode,
      entrypoint,
      downgraded: false,
    };
  }

  return {
    permissionPolicyMode: 'read',
    entrypoint,
    downgraded: true,
    reason: 'headless_permission_requires_explicit_opt_in',
  };
}

function normalizePermissionMode(value: unknown): MindosPermissionMode | undefined {
  if (value === 'read' || value === 'ask' || value === 'auto' || value === 'full') return value;
  return undefined;
}
