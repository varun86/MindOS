import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFile,
  listDirs,
  normalizeMindosUrl,
  saveToInbox,
} from '../packages/browser-extension/src/lib/api';
import type { ClipperConfig } from '../packages/browser-extension/src/lib/types';

const config: ClipperConfig = {
  mindosUrl: 'localhost:3456/',
  authToken: 'token-123',
};

describe('browser extension API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes user-entered MindOS URLs before requests', async () => {
    expect(normalizeMindosUrl('localhost:3456/')).toBe('http://localhost:3456');
    expect(normalizeMindosUrl(' https://mindos.local/// ')).toBe('https://mindos.local');

    mockedFetch().mockResolvedValue(jsonResponse({ dirs: ['Inbox', 42, 'Projects'] }));

    await expect(listDirs(config)).resolves.toEqual(['Inbox', 'Projects']);

    const [url, init] = mockedFetch().mock.calls[0];
    expect(url).toBe('http://localhost:3456/api/file?op=list_dirs');
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-123');
  });

  it('surfaces directory loading auth failures instead of pretending there are no spaces', async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ error: 'expired' }, 401));

    await expect(listDirs(config)).rejects.toThrow('Invalid auth token');
  });

  it('returns server save errors with the most useful message available', async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ error: 'duplicate file' }, 409));

    await expect(saveToInbox(config, 'clip.md', '# Clip')).resolves.toEqual({
      error: 'duplicate file',
    });
  });

  it('builds nested file paths without duplicating separators', async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ ok: true }));

    await expect(createFile(config, 'Projects/Alpha/', 'clip.md', '# Clip')).resolves.toEqual({
      ok: true,
    });

    const [, init] = mockedFetch().mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      op: 'create_file',
      path: 'Projects/Alpha/clip.md',
      source: 'web-clipper',
    });
  });
});

function mockedFetch() {
  return vi.mocked(globalThis.fetch);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
