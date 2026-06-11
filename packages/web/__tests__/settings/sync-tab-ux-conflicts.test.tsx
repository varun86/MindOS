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

describe('SyncTab UX: conflict recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('does not report .gitignore save failure when only the follow-up status refresh fails', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'gitignore-get') return { content: 'node_modules\n' };
      if (action === 'gitignore-save') return { ok: true, content: 'node_modules\ndist\n*.sync-conflict\nINSTRUCTION.md\n' };
      statusReads += 1;
      if (statusReads > 1) throw new Error('status refresh failed');
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
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      setInputValue(host.querySelector('textarea'), 'node_modules\ndist\n');
      await Promise.resolve();
    });

    const saveButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Save'));
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((host.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('node_modules\ndist\n*.sync-conflict\nINSTRUCTION.md\n');
    expect(host.textContent).toContain('Saved');
    expect(host.textContent).toContain('Saved, but failed to refresh sync status');
    expect(host.textContent).toContain('status refresh failed');
    expect(host.textContent).not.toContain('Failed to save .gitignore');

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

  it('does not allow resolving a conflict after a transient preview failure', async () => {
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
    await act(async () => {
      fileButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const keepLocal = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep local')) as HTMLButtonElement | undefined;
    const keepRemote = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    expect(keepLocal?.disabled).toBe(true);
    expect(keepRemote?.disabled).toBe(true);

    await act(async () => {
      keepLocal?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const resolveCallsAfterFirstClick = mockApiFetch.mock.calls.filter(([, opts]) => {
      const body = (opts as { body?: string } | undefined)?.body;
      return body ? JSON.parse(body).action === 'resolve-conflict' : false;
    });
    expect(resolveCallsAfterFirstClick).toHaveLength(0);
    expect(host.textContent).not.toContain('Confirm keep local?');

    await act(async () => {
      root.unmount();
    });
  });

  it('allows confirmed keep-local when the remote backup is explicitly unavailable', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'resolve-conflict') return { ok: true };
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z', noBackup: true }],
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

    expect(host.textContent).toContain('Remote backup unavailable');
    const keepLocal = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep local')) as HTMLButtonElement | undefined;
    const keepRemote = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    expect(keepLocal?.disabled).toBe(false);
    expect(keepRemote?.disabled).toBe(true);

    await act(async () => {
      keepLocal?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Confirm keep local?');

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Confirm keep local?'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'resolve-conflict', file: 'notes/today.md', strategy: 'keep-local' }),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('allows keeping a remote deletion after the deletion preview loads', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'conflict-preview') return { local: 'local text', remote: '' };
      if (body.action === 'resolve-conflict') return { ok: true };
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts: [{ file: 'notes/deleted.md', localExists: true, remoteExists: false }],
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

    expect(host.textContent).toContain('Remote deleted');
    const fileButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('notes/deleted.md'));
    await act(async () => {
      fileButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('(deleted remotely)');
    const keepRemote = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    expect(keepRemote?.disabled).toBe(false);

    await act(async () => {
      keepRemote?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'resolve-conflict', file: 'notes/deleted.md', strategy: 'keep-remote' }),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('does not reuse a resolved conflict preview for the next conflict row', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let conflicts = [
      { file: 'notes/a.md', time: '2026-06-05T10:00:00.000Z' },
      { file: 'notes/b.md' },
    ];
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'conflict-preview') {
        return body.file === 'notes/a.md'
          ? { local: 'local A', remote: 'remote A' }
          : { local: 'local B', remote: 'remote B' };
      }
      if (body.action === 'resolve-conflict') {
        conflicts = conflicts.filter(conflict => conflict.file !== body.file);
        return { ok: true };
      }
      return {
        enabled: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts,
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

    const firstFile = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('notes/a.md'));
    await act(async () => {
      firstFile?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('local A');
    expect(host.textContent).toContain('remote A');

    await act(async () => {
      Array.from(host.querySelectorAll('button'))
        .find(button => button.textContent?.includes('Keep local'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('notes/b.md');
    expect(host.textContent).toContain('unknown');
    expect(host.textContent).not.toContain('local A');
    expect(host.textContent).not.toContain('remote A');
    expect((Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined)?.disabled).toBe(true);

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

  it('reports refresh failure separately after a conflict resolution succeeds', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const action = opts?.body ? JSON.parse(opts.body).action : undefined;
      if (action === 'conflict-preview') return { local: 'local text', remote: 'remote text' };
      if (action === 'resolve-conflict') return { ok: true };
      statusReads += 1;
      if (statusReads > 1) throw new Error('status refresh failed');
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

    const keepRemote = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    await act(async () => {
      keepRemote?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Conflict resolution may have been saved');
    expect(host.textContent).toContain('Retry status refresh');
    expect(host.textContent).not.toContain('Failed to resolve conflict');
    expect((Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined)?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('applies the remote conflict version after a successful preview', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let conflicts = [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }];
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'conflict-preview') return { local: 'local text', remote: 'remote text' };
      if (body.action === 'resolve-conflict') {
        conflicts = conflicts.filter(conflict => conflict.file !== body.file);
        return { ok: true };
      }
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: null,
        unpushed: '0',
        conflicts,
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

    expect(host.textContent).toContain('local text');
    expect(host.textContent).toContain('remote text');
    const keepRemote = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    expect(keepRemote?.disabled).toBe(false);

    await act(async () => {
      keepRemote?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({ action: 'resolve-conflict', file: 'notes/today.md', strategy: 'keep-remote' }),
    }));
    expect(host.textContent).not.toContain('notes/today.md');
    expect(host.textContent).not.toContain('Resolve conflicts to finish sync');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows sync attention when conflict resolution is saved locally but upload fails', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let conflicts = [{ file: 'notes/today.md', time: '2026-06-05T10:00:00.000Z' }];
    let lastError: string | null = null;
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'conflict-preview') return { local: 'local text', remote: 'remote text' };
      if (body.action === 'resolve-conflict') {
        conflicts = [];
        lastError = 'Conflict resolved locally, but upload failed: remote rejected the push';
        return { ok: true, uploaded: false, warning: lastError };
      }
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '1',
        conflicts,
        lastError,
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

    const keepRemote = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    await act(async () => {
      keepRemote?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).not.toContain('Resolve conflicts to finish sync');
    expect(host.textContent).toContain('Sync needs attention');
    expect(host.textContent).toContain('Conflict resolved locally, but upload failed');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps the upload warning visible when conflict resolution status refresh fails', async () => {
    const { SyncTab } = await import('@/components/settings/SyncTab');
    let statusReads = 0;
    const warning = 'Conflict resolved locally, but upload is waiting: 1 earlier local commit would also be uploaded.';
    mockApiFetch.mockImplementation(async (_url: string, opts?: { body?: string }) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.action === 'conflict-preview') return { local: 'local text', remote: 'remote text' };
      if (body.action === 'resolve-conflict') {
        return { ok: true, uploaded: false, warning };
      }
      statusReads += 1;
      if (statusReads > 1) throw new Error('status endpoint unavailable');
      return {
        enabled: true,
        configured: true,
        remote: 'git@github.com:me/mind.git',
        branch: 'main',
        lastSync: '2026-06-05T10:00:00.000Z',
        unpushed: '1',
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

    const keepRemote = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Keep remote')) as HTMLButtonElement | undefined;
    await act(async () => {
      keepRemote?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Conflict resolved locally, but upload is waiting');
    expect(host.textContent).toContain('could not refresh sync status');
    expect(host.textContent).toContain('status endpoint unavailable');

    await act(async () => {
      root.unmount();
    });
  });
});
