import { describe, expect, it } from 'vitest';
import { resolveHeadlessAgentMode } from '@/lib/agent/headless-mode-guard';

describe('headless agent mode guard', () => {
  it('downgrades default headless agent permissions to read scope', () => {
    expect(resolveHeadlessAgentMode()).toMatchObject({
      effectiveMode: 'agent',
      permissionPolicyMode: 'read',
      downgraded: true,
      reason: 'headless_agent_mode_requires_explicit_opt_in',
    });
  });

  it('keeps IM inbound conversations in read mode unless explicitly opted in', () => {
    expect(resolveHeadlessAgentMode({ entrypoint: 'im' })).toMatchObject({
      entrypoint: 'im',
      effectiveMode: 'agent',
      permissionPolicyMode: 'read',
      downgraded: true,
    });
  });

  it('allows full agent mode only with explicit opt-in', () => {
    expect(resolveHeadlessAgentMode({ allowAgentMode: true })).toMatchObject({
      effectiveMode: 'agent',
      permissionPolicyMode: 'ask',
      downgraded: false,
    });
    expect(resolveHeadlessAgentMode({
      entrypoint: 'im',
      env: { MINDOS_IM_ALLOW_AGENT_MODE: '1' },
    })).toMatchObject({
      effectiveMode: 'agent',
      permissionPolicyMode: 'ask',
      downgraded: false,
    });
  });
});
