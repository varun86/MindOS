// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { messages } from '@/lib/i18n';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (!input) return;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input?.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SyncTab UX', () => {
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
    expect(host.textContent).toContain('HTTPS needs a token for private repos');

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
    expect(host.textContent).toContain('Reset & Re-configure');
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
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent?.includes('Connect & Start Sync'))).toBe(false);

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

    const resetButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Reset & Re-configure'));
    expect(resetButton).toBeTruthy();

    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'reset' }),
    }));
    expect(host.textContent).toContain('Confirm reset?');

    const confirmButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Confirm reset?'));
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
      if (action === 'gitignore-save') return { ok: true };
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
    expect(host.textContent).toContain('1 local change');

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces conflict preview failures inline', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'conflict-preview') throw new Error('preview service failed');
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }],
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

    const fileButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('notes/today.md'));
    expect(fileButton).toBeTruthy();

    await act(async () => {
      fileButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Failed to load conflict preview');
    expect(host.textContent).toContain('preview service failed');
    expect(host.textContent).toContain('Retry');

    await act(async () => {
      root.unmount();
    });
  });

  it('allows keeping the local file when conflict preview fails', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'conflict-preview') throw new Error('preview service failed');
      if (action === 'resolve-conflict') return { ok: true };
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }],
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

    const fileButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('notes/today.md'));
    await act(async () => {
      fileButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const keepLocal = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep local')) as HTMLButtonElement | undefined;
    const keepRemote = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    expect(keepLocal?.disabled).toBe(false);
    expect(keepRemote?.disabled).toBe(true);

    await act(async () => {
      keepLocal?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'resolve-conflict', file: 'notes/today.md', strategy: 'keep-local', remote: 'notes/today.md', branch: 'keep-local' }),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces conflict resolution failures and restores the action buttons', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'conflict-preview') return { local: 'local text', remote: 'remote text' };
      if (action === 'resolve-conflict') throw new Error('resolve failed');
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }],
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

    const fileButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('notes/today.md'));
    await act(async () => {
      fileButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const keepLocal = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep local'));
    expect(keepLocal?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      keepLocal?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Failed to resolve conflict');
    expect(host.textContent).toContain('resolve failed');
    expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep local'))?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
