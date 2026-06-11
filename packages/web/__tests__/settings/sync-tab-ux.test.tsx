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

describe('SyncTab UX: status and first-time setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('leads with a plain-language health summary before Git details', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: new Date().toISOString(),
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

    expect(host.textContent).toContain('All notes are backed up');
    expect(host.textContent).toContain('Next: keep writing');
    expect(host.textContent).toContain('Repository');
    expect(host.textContent).toContain('Automation');
    expect(host.textContent).toContain('Save changes every');
    expect(host.textContent).toContain('Check for updates every');
    expect(host.textContent?.match(/Sync Now/g)).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('turns conflicts into an explicit recovery workflow', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: null,
      unpushed: '2',
      conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }],
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

    expect(host.textContent).toContain('Resolve conflicts to finish sync');
    expect(host.textContent).toContain('Review each file below');
    expect(host.textContent).toContain('Choose which version to keep');
    expect(host.textContent).toContain('notes/today.md');
    expect(host.textContent).not.toContain('Sync Now');
    expect((Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep local')) as HTMLButtonElement | undefined)?.disabled).toBe(true);
    expect((Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined)?.disabled).toBe(true);
    const changeRepository = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Change repository')) as HTMLButtonElement | undefined;
    expect(changeRepository?.disabled).toBe(true);

    await act(async () => {
      changeRepository?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'reset' }),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('does not report a clean repository with no recorded sync as backed up', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: true,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: null,
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

    expect(host.textContent).toContain('Sync is ready');
    expect(host.textContent).toContain('Run Sync Now to create the first backup');
    expect(host.textContent).not.toContain('All notes are backed up');
    expect(host.textContent).not.toContain('Last sync: never');

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces recovery guidance for sync errors', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: null,
      unpushed: '0',
      conflicts: [],
      lastError: 'Permission denied (publickey)',
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

    expect(host.textContent).toContain('Sync needs attention');
    expect(host.textContent).toContain('SSH key may not be configured');
    expect(host.textContent).toContain('Next: fix the issue, then sync again');
    expect(host.textContent?.match(/SSH key may not be configured/g)).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('explains the first-time setup path before asking for credentials', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: false,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.en} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Start with a private Git repository');
    expect(host.textContent).toContain('Paste a remote URL to continue');
    expect(host.textContent).toContain('HTTPS can use a token for private repos');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows a recoverable paused state instead of the first-time setup form', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: false,
      configured: true,
      remote: 'https://github.com/me/mind.git',
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

    expect(host.textContent).toContain('Paused');
    expect(host.textContent).toContain('Enable Auto-sync');
    expect(host.textContent).toContain('Forget local sync settings');
    expect(host.textContent).toContain('Keeps your notes and Git repository');
    expect(host.textContent).not.toContain('Connect & Start Sync');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps conflicts visible when auto-sync is paused', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: false,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: null,
      unpushed: '0',
      conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }],
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

    expect(host.textContent).toContain('Paused');
    expect(host.textContent).toContain('Resolve conflicts to finish sync');
    expect(host.textContent).toContain('notes/today.md');
    expect(host.textContent).not.toContain('Connect & Start Sync');

    await act(async () => {
      root.unmount();
    });
  });

  it('uses paused language when local changes exist while auto-sync is disabled', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: false,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: '2026-06-05T10:00:00.000Z',
      unpushed: '2',
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

    expect(host.textContent).toContain('2 local changes are waiting');
    expect(host.textContent).toContain('Auto-sync is paused');
    expect(host.textContent).toContain('Intervals apply when auto-sync is enabled');
    expect(host.textContent).toContain('Sync Now');
    expect(host.textContent).not.toContain('MindOS will push them automatically');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps manual sync available when auto-sync is paused with no pending local changes', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'now') return { ok: true };
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

    expect(host.textContent).toContain('Sync is paused');
    expect(host.textContent).toContain('run Sync Now manually');
    const syncButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Sync Now')) as HTMLButtonElement | undefined;
    expect(syncButton).toBeDefined();

    await act(async () => {
      syncButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'now' }),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('uses paused language when local change status is unknown while auto-sync is disabled', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: false,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: '2026-06-05T10:00:00.000Z',
      unpushed: '?',
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

    expect(host.textContent).toContain('Sync status unknown');
    expect(host.textContent).toContain('Auto-sync is paused');
    expect(host.textContent).toContain('Unknown');
    expect(host.textContent).not.toContain('? changes');
    expect(host.textContent).not.toContain('retry sync or check the remote repository');

    await act(async () => {
      root.unmount();
    });
  });

  it('localizes paused local-change guidance in Chinese', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: false,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: '2026-06-05T10:00:00.000Z',
      unpushed: '2',
      conflicts: [],
      lastError: null,
      autoCommitInterval: 30,
      autoPullInterval: 300,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncTab t={messages.zh} visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('2 个本地改动等待处理');
    expect(host.textContent).toContain('自动同步已暂停');
    expect(host.textContent).not.toContain('Auto-sync is paused');
    expect(host.textContent).not.toContain('local changes are waiting');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not report unknown unpushed status as backed up', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockResolvedValue({
      enabled: true,
      configured: true,
      remote: 'git@github.com:me/mind.git',
      branch: 'main',
      lastSync: null,
      unpushed: '?',
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

    expect(host.textContent).toContain('Sync status unknown');
    expect(host.textContent).not.toContain('All notes are backed up');

    await act(async () => {
      root.unmount();
    });
  });

  it('accepts ssh:// git remote URLs in first-time setup', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    mockApiFetch.mockResolvedValue({ success: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    const input = host.querySelector('input[type="text"]') as HTMLInputElement | null;
    await act(async () => {
      setInputValue(input, 'ssh://git@example.com/mind/repo.git');
      await Promise.resolve();
    });

    const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync')) as HTMLButtonElement | undefined;
    expect(connectButton?.disabled).toBe(false);
    expect(host.textContent).not.toContain('Invalid Git URL');

    await act(async () => {
      connectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: expect.stringContaining('ssh://git@example.com/mind/repo.git'),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('allows HTTPS setup without a token and associates labels with inputs', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    mockApiFetch.mockResolvedValue({ success: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    const remoteInput = host.querySelector('#sync-remote-url') as HTMLInputElement | null;
    expect(host.querySelector('label[for="sync-remote-url"]')?.textContent).toContain('Git Remote URL');

    await act(async () => {
      setInputValue(remoteInput, 'https://github.com/me/private.git');
      await Promise.resolve();
    });

    const tokenInput = host.querySelector('#sync-access-token') as HTMLInputElement | null;
    const branchInput = host.querySelector('#sync-branch') as HTMLInputElement | null;
    expect(host.querySelector('label[for="sync-access-token"]')?.textContent).toContain('optional; needed for private HTTPS repos');
    expect(host.querySelector('label[for="sync-branch"]')?.textContent).toContain('Branch');
    expect(tokenInput).toBeTruthy();
    expect(branchInput?.value).toBe('main');

    const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync')) as HTMLButtonElement | undefined;
    expect(connectButton?.disabled).toBe(false);
    expect(host.textContent).toContain('Optional for public repositories');
    expect(host.textContent).not.toContain('require an access token');

    await act(async () => {
      connectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledOnce();
    const [, requestInit] = mockApiFetch.mock.calls[0] as [string, { body?: string }];
    const body = JSON.parse(requestInit.body ?? '{}');
    expect(body).toMatchObject({
      action: 'init',
      remote: 'https://github.com/me/private.git',
      branch: 'main',
    });
    expect(body).not.toHaveProperty('token');

    await act(async () => {
      root.unmount();
    });
  });

  it('submits an HTTPS access token when the user provides one', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    mockApiFetch.mockResolvedValue({ success: true });
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
      setInputValue(host.querySelector('#sync-access-token') as HTMLInputElement | null, 'ghp_secret');
      await Promise.resolve();
    });

    const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync')) as HTMLButtonElement | undefined;
    await act(async () => {
      connectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const [, requestInit] = mockApiFetch.mock.calls[0] as [string, { body?: string }];
    const body = JSON.parse(requestInit.body ?? '{}');
    expect(body.token).toBe('ghp_secret');

    await act(async () => {
      root.unmount();
    });
  });

  it('redacts embedded HTTPS credentials from setup progress copy', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    let resolveInit!: () => void;
    mockApiFetch.mockReturnValue(new Promise(resolve => {
      resolveInit = () => resolve({ success: true });
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    await act(async () => {
      setInputValue(host.querySelector('#sync-remote-url') as HTMLInputElement | null, 'https://oauth2:ghp_secret@github.com/me/private.git');
      await Promise.resolve();
    });

    const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync')) as HTMLButtonElement | undefined;
    expect(connectButton?.disabled).toBe(false);

    await act(async () => {
      connectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Connecting to https://github.com/me/private.git');
    expect(host.textContent).not.toContain('ghp_secret');

    await act(async () => {
      resolveInit();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('formats first-time setup lock errors without exposing lock internals', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    mockApiFetch.mockRejectedValue(new Error('SYNC_LOCKED: Sync is already running (owner=manual-sync, pid=123, startedAt=2026-06-09T01:02:03.000Z)'));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    await act(async () => {
      setInputValue(host.querySelector('#sync-remote-url') as HTMLInputElement | null, 'git@example.com:mind/repo.git');
      await Promise.resolve();
    });

    const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync'));
    await act(async () => {
      connectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync is already running');
    expect(host.textContent).toContain('Another sync operation is already running');
    expect(host.textContent).not.toContain('pid=123');
    expect(host.textContent).not.toContain('owner=manual-sync');

    await act(async () => {
      root.unmount();
    });
  });

  it('rejects branch names that Git will reject before starting setup', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={vi.fn()} />);
      await Promise.resolve();
    });

    const inputs = Array.from(host.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
    const remoteInput = inputs[0];
    const branchInput = inputs.find(input => input.value === 'main') ?? inputs[1];

    await act(async () => {
      setInputValue(remoteInput, 'git@example.com:mind/repo.git');
      await Promise.resolve();
    });

    for (const invalidBranch of ['/main', 'main/', 'foo.lock', 'foo@{bar}']) {
      await act(async () => {
        setInputValue(branchInput, invalidBranch);
        await Promise.resolve();
      });
      const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync')) as HTMLButtonElement | undefined;
      expect(connectButton?.disabled).toBe(true);
      expect(host.textContent).toContain('Use a valid Git branch name');
      expect(host.textContent).toContain('Branch names must be valid Git refs');
    }

    expect(mockApiFetch).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('hides setup progress without enabling a second init request', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    let resolveInit!: () => void;
    mockApiFetch.mockReturnValue(new Promise(resolve => {
      resolveInit = () => resolve({ success: true });
    }));
    const onInitComplete = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={onInitComplete} />);
      await Promise.resolve();
    });

    const input = host.querySelector('input[type="text"]') as HTMLInputElement | null;
    await act(async () => {
      setInputValue(input, 'git@example.com:mind/repo.git');
      await Promise.resolve();
    });

    const connectButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Connect & Start Sync'));
    await act(async () => {
      connectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    const hideButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Hide progress'));
    await act(async () => {
      hideButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync setup is still running');
    expect(host.textContent).toContain('git@example.com:mind/repo.git');
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.includes('Connect & Start Sync'))).toBe(false);
    expect(input?.disabled).toBe(true);
    const branchInput = Array.from(host.querySelectorAll('input'))
      .find(candidate => candidate.value === 'main') as HTMLInputElement | undefined;
    expect(branchInput?.disabled).toBe(true);

    await act(async () => {
      resolveInit();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps setup locked after hidden progress is remounted', async () => {
    const SyncEmptyState = (await import('@/components/settings/SyncEmptyState')).default;
    let resolveInit!: () => void;
    mockApiFetch.mockReturnValue(new Promise(resolve => {
      resolveInit = () => resolve({ success: true });
    }));
    const onInitComplete = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SyncEmptyState t={messages.en} onInitComplete={onInitComplete} />);
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

    const remountRoot = createRoot(host);
    await act(async () => {
      remountRoot.render(<SyncEmptyState t={messages.en} onInitComplete={onInitComplete} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Sync setup is still running');
    expect(host.textContent).toContain('git@example.com:mind/repo.git');
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.includes('Connect & Start Sync'))).toBe(false);
    expect((host.querySelector('input[type="text"]') as HTMLInputElement | null)?.disabled).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInit();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onInitComplete).toHaveBeenCalled();

    await act(async () => {
      remountRoot.unmount();
    });
  });
});
