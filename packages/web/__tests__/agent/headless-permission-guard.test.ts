import { describe, expect, it } from 'vitest';
import { resolveHeadlessAgentPermission } from '@/lib/agent/headless-permission-guard';

describe('headless agent permission guard', () => {
  it('downgrades default headless agent permissions to read scope', () => {
    expect(resolveHeadlessAgentPermission()).toMatchObject({
      permissionPolicyMode: 'read',
      downgraded: true,
      reason: 'headless_permission_requires_explicit_opt_in',
    });
  });

  it('keeps IM inbound conversations in read mode unless explicitly opted in', () => {
    expect(resolveHeadlessAgentPermission({ entrypoint: 'im' })).toMatchObject({
      entrypoint: 'im',
      permissionPolicyMode: 'read',
      downgraded: true,
    });
  });

  it('allows elevated permission only with explicit permission mode', () => {
    expect(resolveHeadlessAgentPermission({ permissionMode: 'ask' })).toMatchObject({
      permissionPolicyMode: 'ask',
      downgraded: false,
    });
    expect(resolveHeadlessAgentPermission({
      entrypoint: 'im',
      env: { MINDOS_IM_PERMISSION_MODE: 'auto' },
    })).toMatchObject({
      permissionPolicyMode: 'auto',
      downgraded: false,
    });
  });
});
