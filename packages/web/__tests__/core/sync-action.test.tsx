// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

describe('useSyncAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('uses the long sync timeout for manual sync actions', async () => {
    const { useSyncAction } = await import('@/lib/sync-status-store');
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockApiFetch.mockResolvedValue({});

    function Harness() {
      const { syncNow } = useSyncAction(refresh);
      return <button type="button" onClick={() => void syncNow()}>sync</button>;
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      method: 'POST',
      timeout: 120_000,
    }));
    expect(refresh).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps failed sync action errors visible to the caller', async () => {
    const { useSyncAction } = await import('@/lib/sync-status-store');
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockApiFetch.mockRejectedValue(new Error('push failed'));

    function Harness() {
      const { syncNow, syncError } = useSyncAction(refresh);
      return (
        <div>
          <button type="button" onClick={() => void syncNow()}>sync</button>
          <p>{syncError}</p>
        </div>
      );
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('push failed');
    expect(refresh).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('shares in-flight sync state across every sync action entry point', async () => {
    const { useSyncAction } = await import('@/lib/sync-status-store');
    let resolveSync!: () => void;
    mockApiFetch.mockReturnValue(new Promise(resolve => {
      resolveSync = () => resolve({});
    }));
    const refresh = vi.fn().mockResolvedValue(undefined);

    function Harness() {
      const first = useSyncAction(refresh);
      const second = useSyncAction(refresh);
      return (
        <div>
          <button type="button" onClick={() => void first.syncNow()}>first</button>
          <button type="button" onClick={() => void second.syncNow()}>second</button>
          <p>{first.syncing ? 'first syncing' : 'first idle'}</p>
          <p>{second.syncing ? 'second syncing' : 'second idle'}</p>
        </div>
      );
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('first syncing');
    expect(host.textContent).toContain('second syncing');

    await act(async () => {
      resolveSync();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('first idle');
    expect(host.textContent).toContain('second idle');

    await act(async () => {
      root.unmount();
    });
  });

  it('deduplicates same-tick sync actions across entry points', async () => {
    const { useSyncAction } = await import('@/lib/sync-status-store');
    let resolveSync!: () => void;
    mockApiFetch.mockReturnValue(new Promise(resolve => {
      resolveSync = () => resolve({});
    }));
    const refresh = vi.fn().mockResolvedValue(undefined);

    function Harness() {
      const first = useSyncAction(refresh);
      const second = useSyncAction(refresh);
      return (
        <div>
          <button type="button" onClick={() => void first.syncNow()}>first</button>
          <button type="button" onClick={() => void second.syncNow()}>second</button>
        </div>
      );
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    await act(async () => {
      const buttons = host.querySelectorAll('button');
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync();
      await Promise.resolve();
      await Promise.resolve();
      root.unmount();
    });
  });

  it('does not flash success when the refreshed status contains conflicts', async () => {
    const { fetchSharedSyncStatus, resetSyncStatusStoreForTests, useSyncAction } = await import('@/lib/sync-status-store');
    resetSyncStatusStoreForTests();
    mockApiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }],
        lastError: null,
      });

    function Harness() {
      const { syncNow, syncResult } = useSyncAction(() => fetchSharedSyncStatus({ force: true }));
      return (
        <div>
          <button type="button" onClick={() => void syncNow()}>sync</button>
          <p>{syncResult ?? 'none'}</p>
        </div>
      );
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('none');
    expect(host.textContent).not.toContain('success');

    await act(async () => {
      root.unmount();
    });
  });
});
