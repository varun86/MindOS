import type { MindosAskMode } from '@geminilight/mindos/session';
import type { MindosPermissionMode } from '@geminilight/mindos/agent/mindos-pi/permission';

export type HeadlessAgentEntryPoint = 'headless' | 'im' | 'schedule';

export interface HeadlessAgentModeGuardInput {
  entrypoint?: HeadlessAgentEntryPoint;
  allowAgentMode?: boolean;
  env?: Pick<NodeJS.ProcessEnv, 'MINDOS_HEADLESS_ALLOW_AGENT_MODE' | 'MINDOS_IM_ALLOW_AGENT_MODE'>;
}

export interface HeadlessAgentModeGuardDecision {
  effectiveMode: MindosAskMode;
  permissionPolicyMode: MindosPermissionMode;
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
      permissionPolicyMode: 'ask',
      entrypoint,
      downgraded: false,
    };
  }

  return {
    effectiveMode: 'agent',
    permissionPolicyMode: 'read',
    entrypoint,
    downgraded: true,
    reason: 'headless_agent_mode_requires_explicit_opt_in',
  };
}
