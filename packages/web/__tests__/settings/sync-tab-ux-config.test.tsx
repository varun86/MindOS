// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { messages } from '@/lib/i18n';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null, value: string) {
  if (!input) return;
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : input instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input?.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SyncTab UX: configuration and automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('keeps a hidden setup failure visible after remounting settings', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    let rejectInit!: (error: Error) => void;
    mockApiFetch.mockReturnValue(new Promise((_resolve, reject) => {
      rejectInit = reject;
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    const input = host.querySelector('input[type="text"]') as HTMLInputElement | null;
    await act(async () => {
      setInputValue(input, 'git@example.com:mind/repo.git');
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Connect & Start Sync'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Hide progress'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      rejectInit(new Error('Permission denied (publickey)'));
      await Promise.resolve();
      await Promise.resolve();
    });

    const remountRoot = createRoot(host);
    await act(async () => {
      remountRoot.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Permission denied (publickey)');
    expect(host.textContent).toContain('SSH key may not be configured');
    expect((host.querySelector('input[type="text"]') as HTMLInputElement | null)?.value).toBe('git@example.com:mind/repo.git');
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.includes('Connect & Start Sync'))).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      remountRoot.unmount();
    });
  });

  it('clears a hidden HTTPS setup failure snapshot when the token changes', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    let rejectInit!: (error: Error) => void;
    mockApiFetch.mockReturnValue(new Promise((_resolve, reject) => {
      rejectInit = reject;
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    await act(async () => {
      setInputValue(host.querySelector('#sync-remote-url') as HTMLInputElement | null, 'https://github.com/me/private.git');
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Connect & Start Sync'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Hide progress'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      rejectInit(new Error('Authentication failed'));
      await Promise.resolve();
      await Promise.resolve();
    });

    const remountRoot = createRoot(host);
    await act(async () => {
      remountRoot.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Authentication failed');

    await act(async () => {
      setInputValue(host.querySelector('#sync-access-token') as HTMLInputElement | null, 'ghp_new');
      await Promise.resolve();
    });
    expect(host.textContent).not.toContain('Authentication failed');

    await act(async () => {
      remountRoot.unmount();
    });

    const secondRemountRoot = createRoot(host);
    await act(async () => {
      secondRemountRoot.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).not.toContain('Authentication failed');
    expect((host.querySelector('#sync-remote-url') as HTMLInputElement | null)?.value).toBe('');

    await act(async () => {
      secondRemountRoot.unmount();
    });
  });

  it('requires confirmation before resetting a paused sync configuration', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'reset') return { ok: true, enabled: false };
      return {
        enabled: false,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const resetButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Forget local sync settings'));
    expect(resetButton).toBeTruthy();
    expect(host.textContent).toContain('Keeps your notes and Git repository');

    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'reset' }),
    }));
    expect(host.textContent).toContain('Confirm forget settings?');

    const confirmButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Confirm forget settings?'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'reset' }),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('lets users change the repository directly from an active sync configuration', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'reset') return { ok: true, enabled: false };
      statusReads += 1;
      if (statusReads > 1) {
        return { enabled: false };
      }
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/old-mind.git',
        branch: 'main',
        lastSync: new Date().toISOString(),
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Change repository');
    expect(host.textContent).toContain('connect another remote');
    expect(host.textContent).toContain('git@github.com:me/old-mind.git');

    const changeButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Change repository'));
    expect(changeButton).toBeTruthy();

    await act(async () => {
      changeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'reset' }),
    }));
    expect(host.textContent).toContain('Confirm change repository?');

    const confirmButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Confirm change repository?'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'reset' }),
    }));
    expect(host.textContent).toContain('Connect & Start Sync');
    expect(host.textContent).toContain('Paste a remote URL to continue');

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces refresh failure after reset without pretending setup state is current', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'reset') return { ok: true, enabled: false };
      statusReads += 1;
      if (statusReads > 1) throw new Error('status refresh failed');
      return {
        enabled: false,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Forget local sync settings'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Confirm forget settings?'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('could not refresh sync status');
    expect(host.textContent).toContain('status refresh failed');
    expect(host.textContent).toContain('Forget local sync settings');

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces reset failures when sync configuration is broken', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'reset') throw new Error('reset denied');
      return {
        enabled: true,
        needsSetup: true,
        remote: '(not configured)',
        branch: 'main',
        lastSync: null,
        unpushed: '?',
        conflicts: [],
        lastError: 'Remote not configured. Please re-configure sync.',
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const resetButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Forget local sync settings'));
    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    const confirmButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Confirm forget settings?'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('reset denied');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not show first-time setup when status loading fails', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockRejectedValue(new Error('server unavailable'));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Could not load sync status');
    expect(host.textContent).toContain('server unavailable');
    expect(host.textContent).not.toContain('Connect & Start Sync');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not report a stale cached status as backed up when refresh fails', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    const healthyStatus = {
      enabled: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: new Date().toISOString(),
      unpushed: '0',
      conflicts: [],
      lastError: null,
      autoCommitInterval: 30,
      autoPullInterval: 300,
    };
    mockApiFetch.mockResolvedValueOnce(healthyStatus);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('All notes are backed up');

    mockApiFetch.mockRejectedValueOnce(new Error('server unavailable'));
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible={false} />);
      await Promise.resolve();
    });
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync status may be outdated');
    expect(host.textContent).toContain('server unavailable');
    expect(host.textContent).not.toContain('All notes are backed up');

    await act(async () => {
      root.unmount();
    });
  });

  it('disables active sync mutations when the cached status is stale', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValueOnce({
      enabled: true,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: '2026-06-05T10:00:00.000Z',
      unpushed: '0',
      conflicts: [],
      lastError: null,
      autoCommitInterval: 30,
      autoPullInterval: 300,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    mockApiFetch.mockRejectedValueOnce(new Error('server unavailable'));
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible={false} />);
      await Promise.resolve();
    });
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync status may be outdated');
    const disableButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Disable Auto-sync')) as HTMLButtonElement | undefined;
    const changeButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Change repository')) as HTMLButtonElement | undefined;
    const intervalButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('30s')) as HTMLButtonElement | undefined;
    expect(disableButton?.disabled).toBe(true);
    expect(changeButton?.disabled).toBe(true);
    expect(intervalButton?.disabled).toBe(true);

    await act(async () => {
      disableButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      changeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      intervalButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const writeCalls = mockApiFetch.mock.calls.filter(([, opts]) => {
      const body = (opts as { body?: string } | undefined)?.body;
      if (!body) return false;
      const action = JSON.parse(body).action;
      return action === 'off' || action === 'reset' || action === 'update-intervals';
    });
    expect(writeCalls).toHaveLength(0);

    await act(async () => {
      root.unmount();
    });
  });

  it('blocks first-time setup actions when the cached unconfigured status is stale', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValueOnce({ enabled: false });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Connect & Start Sync');

    mockApiFetch.mockRejectedValueOnce(new Error('server unavailable'));
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible={false} />);
      await Promise.resolve();
    });
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync status may be outdated');
    expect(host.textContent).toContain('server unavailable');
    expect(host.textContent).toContain('Retry');
    expect(host.textContent).not.toContain('Connect & Start Sync');

    await act(async () => {
      root.unmount();
    });
  });

  it('blocks reset actions when a cached broken sync status is stale', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValueOnce({
      enabled: true,
      configured: true,
      needsSetup: true,
      remote: '(not configured)',
      branch: 'main',
      lastSync: null,
      unpushed: '?',
      conflicts: [],
      lastError: 'Remote not configured. Please re-configure sync.',
      autoCommitInterval: 30,
      autoPullInterval: 300,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync configuration is broken');

    mockApiFetch.mockRejectedValueOnce(new Error('status refresh failed'));
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible={false} />);
      await Promise.resolve();
    });
    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync status may be outdated');
    expect(host.textContent).toContain('status refresh failed');
    expect(host.textContent).toContain('Retry');
    expect(host.textContent).not.toContain('Forget local sync settings');

    await act(async () => {
      root.unmount();
    });
  });

  it('enables and disables auto-sync through explicit user actions', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let enabled = false;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'on') {
        enabled = true;
        return { ok: true, enabled: true };
      }
      if (action === 'off') {
        enabled = false;
        return { ok: true, enabled: false };
      }
      return {
        enabled,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const enableButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Enable Auto-sync')) as HTMLButtonElement | undefined;
    expect(enableButton).toBeTruthy();

    await act(async () => {
      enableButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'on' }),
    }));
    expect(host.textContent).toContain('Auto-sync enabled');
    expect(host.textContent).toContain('Active');

    const disableButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Disable Auto-sync')) as HTMLButtonElement | undefined;
    expect(disableButton).toBeTruthy();

    await act(async () => {
      disableButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'off' }),
    }));
    expect(host.textContent).toContain('Auto-sync disabled');
    expect(host.textContent).toContain('Paused');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not show auto-sync success when status refresh fails after toggle', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'on') return { ok: true, enabled: true };
      statusReads += 1;
      if (statusReads > 1) throw new Error('status refresh failed');
      return {
        enabled: false,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Enable Auto-sync'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('could not refresh sync status');
    expect(host.textContent).toContain('status refresh failed');
    expect(host.textContent).not.toContain('Auto-sync enabled');

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces auto-sync toggle failures without changing the cached state', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'on') throw new Error('SYNC_LOCKED: Sync is already running');
      return {
        enabled: false,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const enableButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Enable Auto-sync')) as HTMLButtonElement | undefined;

    await act(async () => {
      enableButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync is already running');
    expect(host.textContent).toContain('Another sync operation is already running');
    expect(host.textContent).toContain('Paused');
    expect(host.textContent).not.toContain('Active');

    await act(async () => {
      root.unmount();
    });
  });

  it('saves automation interval changes and refreshes the displayed status', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let autoCommitInterval = 30;
    let autoPullInterval = 300;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'update-intervals') {
        if (typeof body.autoCommitInterval === 'number') autoCommitInterval = body.autoCommitInterval;
        if (typeof body.autoPullInterval === 'number') autoPullInterval = body.autoPullInterval;
        return { ok: true, autoCommitInterval, autoPullInterval };
      }
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval,
        autoPullInterval,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const autoCommitButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === '30s') as HTMLButtonElement | undefined;
    const autoPullButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === '5min') as HTMLButtonElement | undefined;
    expect(autoCommitButton).toBeTruthy();
    expect(autoPullButton).toBeTruthy();

    await act(async () => {
      autoCommitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('[role="option"]'))
        .find(option => option.textContent?.trim() === '60s')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'update-intervals', autoCommitInterval: 60 }),
    }));
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.trim() === '60s')).toBe(true);
    expect(host.textContent).toContain('Sync settings saved');

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.trim() === '5min')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('[role="option"]'))
        .find(option => option.textContent?.trim() === '10min')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'update-intervals', autoPullInterval: 600 }),
    }));
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.trim() === '10min')).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('does not show interval save success when status refresh fails after saving', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'update-intervals') return { ok: true, autoCommitInterval: 60, autoPullInterval: 300 };
      statusReads += 1;
      if (statusReads > 1) throw new Error('status refresh failed');
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.trim() === '30s')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('[role="option"]'))
        .find(option => option.textContent?.trim() === '60s')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('could not refresh sync status');
    expect(host.textContent).toContain('status refresh failed');
    expect(host.textContent).not.toContain('Sync settings saved');

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces automation interval save failures without moving the select value', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'update-intervals') throw new Error('interval denied');
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.trim() === '30s')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(host.querySelectorAll('[role="option"]'))
        .find(option => option.textContent?.trim() === '60s')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('interval denied');
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.trim() === '30s')).toBe(true);
    expect(host.textContent).not.toContain('Sync settings saved');

    await act(async () => {
      root.unmount();
    });
  });

  it('reloads .gitignore every time the editor is reopened', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let gitignoreReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'gitignore-get') {
        gitignoreReads += 1;
        return { content: gitignoreReads === 1 ? 'node_modules\n' : 'dist\n' };
      }
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const toggle = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Excluded files'));
    expect(toggle).toBeTruthy();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((host.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('node_modules\n');

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((host.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('dist\n');
    expect(gitignoreReads).toBe(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('refreshes sync status after saving .gitignore so dirty changes are visible', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'gitignore-get') return { content: 'node_modules\n' };
      if (action === 'gitignore-save') return { ok: true, content: 'node_modules\ndist\n*.sync-conflict\nINSTRUCTION.md\n' };
      statusReads += 1;
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: statusReads > 1 ? '1' : '0',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const toggle = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Excluded files'));
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const textarea = host.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    await act(async () => {
      setInputValue(textarea, 'node_modules\ndist\n');
      await Promise.resolve();
    });

    const saveButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Save'));
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(statusReads).toBeGreaterThan(1);
    expect((host.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('node_modules\ndist\n*.sync-conflict\nINSTRUCTION.md\n');
    expect(host.textContent).toContain('1 local change');

    await act(async () => {
      root.unmount();
    });
  });

  it('explains when .gitignore stops tracking previously synced files', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'gitignore-get') return { content: 'node_modules\n' };
      if (action === 'gitignore-save') {
        return {
          ok: true,
          content: 'node_modules\nsecret.md\n*.sync-conflict\nINSTRUCTION.md\n',
          stoppedTracking: ['secret.md'],
          syncNeeded: true,
        };
      }
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '1',
        conflicts: [],
        lastError: null,
        autoCommitInterval: 30,
        autoPullInterval: 300,
      };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const toggle = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Excluded files'));
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      setInputValue(host.querySelector('textarea'), 'node_modules\nsecret.md\n');
      await Promise.resolve();
    });

    const saveButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Save'));
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('1 previously synced file will be removed from future syncs');
    expect(host.textContent).toContain('The file stays on this device');
    expect(host.textContent).toContain('older Git history may still contain prior copies');
    expect(host.textContent).toContain('secret.md');

    await act(async () => {
      root.unmount();
    });
  });
});
