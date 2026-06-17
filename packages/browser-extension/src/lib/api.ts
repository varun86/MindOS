/* ── MindOS API Client ── */

import type { ClipperConfig, MindOSSpace, FileApiResponse } from './types';

const REQUEST_TIMEOUT = 8000;

export function normalizeMindosUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

/** Fetch with timeout + auth */
async function apiFetch(
  config: ClipperConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const baseUrl = normalizeMindosUrl(config.mindosUrl);
    if (!baseUrl) throw new Error('Missing MindOS URL');

    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (config.authToken) {
      headers.set('Authorization', `Bearer ${config.authToken}`);
    }

    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonObject(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const data = await res.json();
    return data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function responseError(res: Response, data: Record<string, unknown> | null, fallback: string): string {
  if (res.status === 401 || res.status === 403) return 'Invalid auth token';
  const serverError = typeof data?.error === 'string' ? data.error : null;
  return serverError ?? `${fallback} (${res.status})`;
}

function requestError(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === 'AbortError') return 'Request timed out';
  if (err instanceof TypeError) return 'Cannot reach MindOS — is it running?';
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Check if MindOS is running and token is valid */
export async function testConnection(config: ClipperConfig): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    // Health check (no auth required)
    const healthRes = await apiFetch(config, '/api/health');
    if (!healthRes.ok) {
      return { ok: false, error: `Server returned ${healthRes.status}` };
    }

    // Auth check — try listing spaces
    const spacesRes = await apiFetch(config, '/api/file?op=list_spaces');
    if (spacesRes.status === 401 || spacesRes.status === 403) {
      return { ok: false, error: 'Invalid auth token' };
    }
    if (!spacesRes.ok) {
      return { ok: false, error: `Auth check failed (${spacesRes.status})` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: requestError(err, 'Cannot reach MindOS — is it running?') };
  }
}

/** List available spaces (top-level directories) */
export async function listSpaces(config: ClipperConfig): Promise<MindOSSpace[]> {
  try {
    const res = await apiFetch(config, '/api/file?op=list_spaces');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.spaces ?? []) as MindOSSpace[];
  } catch {
    return [];
  }
}

/** List all directory paths (flat list for hierarchical picker) */
export async function listDirs(config: ClipperConfig): Promise<string[]> {
  const res = await apiFetch(config, '/api/file?op=list_dirs');
  const data = await readJsonObject(res);
  if (!res.ok) {
    throw new Error(responseError(res, data, 'Could not load spaces'));
  }

  const dirs = data?.dirs;
  if (!Array.isArray(dirs)) return [];
  return dirs.filter((dir): dir is string => typeof dir === 'string');
}

/** Save markdown to Inbox */
export async function saveToInbox(
  config: ClipperConfig,
  fileName: string,
  markdown: string,
  source = 'web-clipper',
): Promise<FileApiResponse> {
  try {
    const res = await apiFetch(config, '/api/inbox', {
      method: 'POST',
      body: JSON.stringify({
        files: [{ name: fileName, content: markdown, encoding: 'text' }],
        source,
      }),
    });
    let data: any;
    try {
      data = await res.json();
    } catch {
      return { error: `Server returned invalid response (${res.status})` };
    }
    if (!res.ok) {
      return { error: responseError(res, data, 'Server error') };
    }
    return { ok: true };
  } catch (err) {
    return { error: requestError(err, 'Cannot reach MindOS — is it running?') };
  }
}

/** Create file in a specific space */
export async function createFile(
  config: ClipperConfig,
  space: string,
  fileName: string,
  content: string,
  source = 'web-clipper',
): Promise<FileApiResponse> {
  const path = space ? `${space.replace(/\/+$/, '')}/${fileName}` : fileName;
  try {
    const res = await apiFetch(config, '/api/file', {
      method: 'POST',
      body: JSON.stringify({ op: 'create_file', path, content, source }),
    });
    let data: any;
    try {
      data = await res.json();
    } catch {
      return { error: `Server returned invalid response (${res.status})` };
    }
    if (!res.ok) {
      return { error: responseError(res, data, 'Server error') };
    }
    return { ok: true };
  } catch (err) {
    return { error: requestError(err, 'Cannot reach MindOS — is it running?') };
  }
}
