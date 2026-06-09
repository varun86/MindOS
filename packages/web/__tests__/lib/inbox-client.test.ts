import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveInboxFiles,
  fetchInboxFiles,
  InboxClientError,
  saveInboxFiles,
} from '@/lib/inbox-client';

describe('inbox-client', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws a normalized error message from failed Inbox GET responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'MIND_ROOT is not configured' }),
    })));

    await expect(fetchInboxFiles('Load failed')).rejects.toMatchObject({
      name: 'InboxClientError',
      message: 'MIND_ROOT is not configured',
      status: 400,
    } satisfies Partial<InboxClientError>);
  });

  it('normalizes save results without treating skipped files as saved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        saved: [{ original: 'ok.md', path: 'Inbox/ok.md' }],
        skipped: [{ name: 'bad.exe', reason: 'unsupported format' }],
      }),
    })));

    await expect(saveInboxFiles([{ name: 'ok.md', content: 'ok' }], 'Save failed'))
      .resolves.toEqual({
        saved: [{ original: 'ok.md', path: 'Inbox/ok.md' }],
        skipped: [{ name: 'bad.exe', reason: 'unsupported format' }],
      });
  });

  it('normalizes archive results so UI can distinguish notFound from archived', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        archived: [{ original: 'ok.md', archivedPath: '.mindos/archive/ok.md' }],
        notFound: ['ghost.md'],
      }),
    })));

    await expect(archiveInboxFiles(['ok.md', 'ghost.md'], 'Remove failed'))
      .resolves.toEqual({
        archived: [{ original: 'ok.md', archivedPath: '.mindos/archive/ok.md' }],
        notFound: ['ghost.md'],
      });
  });
});
