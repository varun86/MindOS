import { describe, expect, it, vi } from 'vitest';
import {
  getPendingRuntimePermissionCount,
  requestRuntimePermissionForRun,
  resolveRuntimePermission,
  runWithRuntimePermissionBridge,
} from '@/lib/agent/runtime-permission-bridge';

describe('runtime permission bridge', () => {
  it('lets an external runtime request wait on the current Chat Panel run', async () => {
    const send = vi.fn();
    const promise = runWithRuntimePermissionBridge({ runId: 'run-claude', send }, async () => {
      const requestPromise = requestRuntimePermissionForRun('run-claude', {
        runtime: 'claude',
        toolCallId: 'toolu-1',
        toolName: 'Bash',
        input: { command: 'mindos file delete "Profile.md"' },
        options: [
          { id: 'accept', label: 'Allow once', intent: 'allow' },
          { id: 'decline', label: 'Deny', intent: 'deny' },
        ],
        reason: 'Delete a note',
      });

      expect(getPendingRuntimePermissionCount()).toBe(1);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'runtime_permission_request',
        runId: 'run-claude',
        runtime: 'claude',
        toolCallId: 'toolu-1',
        toolName: 'Bash',
      }));
      const requestEvent = send.mock.calls.find(([event]) => event.type === 'runtime_permission_request')?.[0];
      expect(requestEvent?.requestId).toBeTruthy();

      expect(resolveRuntimePermission({
        runId: 'run-claude',
        requestId: requestEvent.requestId,
        decision: 'accept',
      })).toEqual({ ok: true });

      return requestPromise;
    });

    await expect(promise).resolves.toEqual({ decision: 'accept', cancelled: false });
    expect(getPendingRuntimePermissionCount()).toBe(0);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'runtime_permission_resolved',
      decision: 'accept',
      cancelled: false,
    }));
  });

  it('cancels external runtime requests when no Chat Panel run is active', async () => {
    await expect(requestRuntimePermissionForRun('missing-run', {
      runtime: 'claude',
      toolCallId: 'toolu-missing',
      toolName: 'Bash',
      input: {},
      options: [],
    })).resolves.toEqual({ decision: 'cancel', cancelled: true });
  });
});
