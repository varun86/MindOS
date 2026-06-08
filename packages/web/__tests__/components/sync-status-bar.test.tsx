// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const mockFetchStatus = vi.fn();
const mockSyncNow = vi.fn();

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    t: {
      sidebar: {
        sync: {
          syncStale: 'Sync status stale',
          syncStaleHint: 'MindOS could not refresh sync status.',
          retry: 'Retry',
          syncNow: 'Sync now',
        },
      },
    },
  }),
}));

vi.mock('@/lib/sync-status-store', () => ({
  useSyncStatus: () => ({
    status: {
      enabled: true,
      configured: true,
      remote: 'git@example.com:mind/repo.git',
      branch: 'main',
      conflicts: [],
      lastError: null,
      unpushed: '0',
    },
    loaded: true,
    error: 'status request failed',
    stale: true,
    fetchStatus: mockFetchStatus,
  }),
  useSyncAction: () => ({
    syncing: false,
    syncResult: null,
    syncError: null,
    syncNow: mockSyncNow,
  }),
}));

describe('SyncStatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('retries status refresh instead of starting sync when the status is stale', async () => {
    const SyncStatusBar = (await import('@/components/SyncStatusBar')).default;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncStatusBar onOpenSyncSettings={vi.fn()} />);
      await Promise.resolve();
    });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[title="Retry"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockFetchStatus).toHaveBeenCalledTimes(1);
    expect(mockSyncNow).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
