import type { MindosAskMode } from '@geminilight/mindos/session';
import type { MindosAgentPermissionPolicyMode } from '@geminilight/mindos/agent/tool/permission-policy';

export type HeadlessAgentEntryPoint = 'headless' | 'im' | 'schedule';

export interface HeadlessAgentModeGuardInput {
  entrypoint?: HeadlessAgentEntryPoint;
  allowAgentMode?: boolean;
  env?: Pick<NodeJS.ProcessEnv, 'MINDOS_HEADLESS_ALLOW_AGENT_MODE' | 'MINDOS_IM_ALLOW_AGENT_MODE'>;
}

export interface HeadlessAgentModeGuardDecision {
  effectiveMode: MindosAskMode;
  permissionPolicyMode: MindosAgentPermissionPolicyMode;
  entrypoint: HeadlessAgentEntryPoint;
  downgraded: boolean;
  reason?: 'headless_agent_mode_requires_explicit_opt_in';
}

export function resolveHeadlessAgentMode(input: HeadlessAgentModeGuardInput = {}): HeadlessAgentModeGuardDecision {
  const entrypoint = input.entrypoint ?? 'headless';
  const env = input.env ?? process.env;
  const explicitAllow =
    input.allowAgentMode === true ||
    env.MINDOS_HEADLESS_ALLOW_AGENT_MODE === '1' ||
    (entrypoint === 'im' && env.MINDOS_IM_ALLOW_AGENT_MODE === '1');

  if (explicitAllow) {
    return {
      effectiveMode: 'agent',
      permissionPolicyMode: 'agent',
      entrypoint,
      downgraded: false,
    };
  }

  return {
    effectiveMode: 'agent',
    permissionPolicyMode: 'readonly',
    entrypoint,
    downgraded: true,
    reason: 'headless_agent_mode_requires_explicit_opt_in',
  };
}
