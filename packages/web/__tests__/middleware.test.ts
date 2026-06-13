import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { proxy as middleware } from '@/proxy';
import { NextRequest } from 'next/server';
import { signJwt } from '@/lib/jwt';

const mockReadSetupPending = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/lib/setup-state', () => ({
  readSetupPending: mockReadSetupPending,
}));

function makeApiRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/files', { headers });
}

function makePageRequest(path = '/some-page', headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe('middleware — API protection (AUTH_TOKEN)', () => {
  const original = process.env.AUTH_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_TOKEN;
    else process.env.AUTH_TOKEN = original;
  });

  it('allows same-origin requests', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const res = await middleware(makeApiRequest({ 'sec-fetch-site': 'same-origin' }));
    expect(res.status).toBe(200);
  });

  it('rejects API requests without bearer token', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const res = await middleware(makeApiRequest());
    expect(res.status).toBe(401);
  });

  it('rejects API requests with wrong bearer token', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const res = await middleware(makeApiRequest({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('allows API requests with correct bearer token', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const res = await middleware(makeApiRequest({ authorization: 'Bearer secret123' }));
    expect(res.status).toBe(200);
  });

  it('allows /api/health without auth (for check-port self-detection)', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const req = new NextRequest('http://localhost/api/health');
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows /api/auth without auth', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const req = new NextRequest('http://localhost/api/auth');
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});

describe('middleware — CORS headers on /api/* routes', () => {
  it('returns 204 with CORS headers for OPTIONS preflight', async () => {
    const req = new NextRequest('http://localhost/api/files', { method: 'OPTIONS' });
    const res = await middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
  });

  it('attaches CORS headers to normal API responses', async () => {
    delete process.env.AUTH_TOKEN;
    const req = new NextRequest('http://localhost/api/files');
    const res = await middleware(req);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('attaches CORS headers to 401 responses', async () => {
    process.env.AUTH_TOKEN = 'secret123';
    const req = new NextRequest('http://localhost/api/files');
    const res = await middleware(req);
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('middleware — Web UI protection (WEB_PASSWORD)', () => {
  const original = process.env.WEB_PASSWORD;
  const originalSessionSecret = process.env.WEB_SESSION_SECRET;

  beforeEach(() => {
    mockReadSetupPending.mockReset();
    mockReadSetupPending.mockReturnValue(false);
  });

  afterEach(() => {
    if (original === undefined) delete process.env.WEB_PASSWORD;
    else process.env.WEB_PASSWORD = original;
    if (originalSessionSecret === undefined) delete process.env.WEB_SESSION_SECRET;
    else process.env.WEB_SESSION_SECRET = originalSessionSecret;
  });

  it('allows all requests when WEB_PASSWORD is not set', async () => {
    delete process.env.WEB_PASSWORD;
    const res = await middleware(makePageRequest());
    expect(res.status).toBe(200);
  });

  it('lets the root page render Home when setup is complete', async () => {
    delete process.env.WEB_PASSWORD;
    const res = await middleware(makePageRequest('/'));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects the Echo index to the default Echo segment when setup is complete', async () => {
    delete process.env.WEB_PASSWORD;
    const res = await middleware(makePageRequest('/echo'));
    const location = new URL(res.headers.get('location') ?? '');

    expect(res.status).toBe(307);
    expect(location.pathname).toBe('/echo/imprint');
  });

  it('redirects the root page to setup during first-run setup', async () => {
    delete process.env.WEB_PASSWORD;
    mockReadSetupPending.mockReturnValue(true);

    const res = await middleware(makePageRequest('/'));
    const location = new URL(res.headers.get('location') ?? '');

    expect(res.status).toBe(307);
    expect(location.pathname).toBe('/setup');
  });

  it('redirects unauthenticated page requests to /login', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const res = await middleware(makePageRequest('/some-page'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('preserves the query string in login redirects', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const res = await middleware(makePageRequest('/agents?tab=mcp'));
    const location = new URL(res.headers.get('location') ?? '');

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe('/agents?tab=mcp');
    expect(location.searchParams.get('reason')).toBeNull();
  });

  it('marks invalid existing session cookies as expired re-auth redirects', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const res = await middleware(makePageRequest('/view/Notes/a.md?mode=edit', {
      cookie: 'mindos-session=bad.token.value',
    }));
    const location = new URL(res.headers.get('location') ?? '');

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('reason')).toBe('expired');
    expect(location.searchParams.get('redirect')).toBe('/view/Notes/a.md?mode=edit');
  });

  it('marks expired existing session cookies as expired re-auth redirects', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const expiredToken = await signJwt({
      sub: 'user',
      exp: Math.floor(Date.now() / 1000) - 60,
    }, 'secret123');
    const res = await middleware(makePageRequest('/wiki', {
      cookie: `mindos-session=${expiredToken}`,
    }));
    const location = new URL(res.headers.get('location') ?? '');

    expect(location.searchParams.get('reason')).toBe('expired');
    expect(location.searchParams.get('redirect')).toBe('/wiki');
  });

  it('keeps existing sessions valid when the Web UI password changes', async () => {
    process.env.WEB_PASSWORD = 'new-password';
    process.env.WEB_SESSION_SECRET = 'stable-session-secret';
    const token = await signJwt({
      sub: 'user',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, 'stable-session-secret');

    const res = await middleware(makePageRequest('/wiki', {
      cookie: `mindos-session=${token}`,
    }));

    expect(res.status).toBe(200);
  });

  it('allows /login page without cookie', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const res = await middleware(makePageRequest('/login'));
    expect(res.status).toBe(200);
  });

  it('keeps login protection ahead of root Echo redirects', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const res = await middleware(makePageRequest('/'));
    const location = new URL(res.headers.get('location') ?? '');

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBeNull();
  });

  it('lets authenticated root page requests render Home', async () => {
    process.env.WEB_PASSWORD = 'secret123';
    const token = await signJwt({
      sub: 'user',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, 'secret123');

    const res = await middleware(makePageRequest('/', {
      cookie: `mindos-session=${token}`,
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
