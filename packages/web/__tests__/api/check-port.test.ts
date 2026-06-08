import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { createServer } from 'node:net';

async function importRoute() {
  return await import('../../app/api/setup/check-port/route');
}

function makeReq(body: Record<string, unknown>, port?: number) {
  const url = port
    ? `http://localhost:${port}/api/setup/check-port`
    : 'http://localhost/api/setup/check-port';
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function getFreePort(): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.unref();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const allocatedPort = typeof address === 'object' && address ? address.port : 0;
        server.close((error) => {
          if (error) reject(error);
          else resolve(allocatedPort);
        });
      });
    });
    if (port >= 1024) return port;
  }
  throw new Error('Could not allocate a valid free test port');
}

describe('POST /api/setup/check-port — validation', () => {
  it('rejects missing port', async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('rejects port below 1024', async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq({ port: 80 }));
    expect(res.status).toBe(400);
  });

  it('rejects port above 65535', async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq({ port: 70000 }));
    expect(res.status).toBe(400);
  });

  it('rejects port 0', async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq({ port: 0 }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/setup/check-port — availability', () => {
  it('reports available for unused high port', async () => {
    const { POST } = await importRoute();
    const port = await getFreePort();
    const res = await POST(makeReq({ port }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
  });
});

describe('POST /api/setup/check-port — self-detection', () => {
  it('recognizes port from request URL as self (skips network check)', async () => {
    const { POST } = await importRoute();
    // Simulate checking port 3013 while the request itself arrives on port 3013
    const res = await POST(makeReq({ port: 3013 }, 3013));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.isSelf).toBe(true);
  });

  it('does NOT mark a different port as self', async () => {
    const { POST } = await importRoute();
    // Request arrives on 3013, but checks a real free port.
    const unusedPort = await getFreePort();
    const res = await POST(makeReq({ port: unusedPort }, 3013));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should be available (unused) but NOT isSelf
    expect(body.available).toBe(true);
    expect(body.isSelf).toBe(false);
  });

  it('works for any arbitrary self port (e.g. 5555)', async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq({ port: 5555 }, 5555));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.isSelf).toBe(true);
  });

  it('falls back to network check when no port in request URL', async () => {
    const { POST } = await importRoute();
    // No port in URL → getListeningPort returns 0 → no fast path
    const unusedPort = await getFreePort();
    const res = await POST(makeReq({ port: unusedPort }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.isSelf).toBe(false);
  });
});
