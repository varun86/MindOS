import * as childProcess from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMindosClient, MindosHttpError, resolveMindosServerSpawn } from './client.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

const mockExecFileSync = vi.mocked(childProcess.execFileSync);

describe('MindOS client SDK boundary', () => {
  it('sends JSON requests with bearer auth and normalized paths', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMindosClient({
      baseUrl: 'http://127.0.0.1:4567/',
      token: 'test-token',
      fetch: fetchMock,
    });

    const result = await client.post('/api/ask', { message: 'hello' });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://127.0.0.1:4567/api/ask');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ message: 'hello' }));
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-token');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('returns text responses when an API route is not JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('plain text', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const client = createMindosClient({ port: 4567, fetch: fetchMock });

    await expect(client.get<string>('api/logs')).resolves.toBe('plain text');
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://127.0.0.1:4567/api/logs');
  });

  it('throws structured errors for non-2xx responses', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMindosClient({ baseUrl: 'http://localhost:3456', fetch: fetchMock });

    await expect(client.health()).rejects.toMatchObject({
      name: 'MindosHttpError',
      status: 403,
      url: 'http://localhost:3456/api/health',
      body: { error: 'nope' },
    } satisfies Partial<MindosHttpError>);
  });

  it('provides typed helpers for health, files, search, settings, and MCP status routes', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/health') return Response.json({ ok: true, service: 'mindos', version: '1.0.0' });
      if (path === '/api/files') return Response.json({ files: ['b.md'], total: 2, offset: 1, limit: 1 });
      if (path === '/api/search') return Response.json([{ path: 'hello.md' }]);
      if (path === '/api/settings') {
        return init?.method === 'POST' ? Response.json({ ok: true }) : Response.json({ mindRoot: '/tmp/mind' });
      }
      if (path === '/api/mcp/status') return Response.json({
        running: true,
        transport: 'http',
        endpoint: 'http://localhost:8567/mcp',
        port: 8567,
        toolCount: 24,
        authConfigured: true,
        localIP: null,
        connectionMode: { cli: true, mcp: true },
      });
      return Response.json({ error: 'not found' }, { status: 404 });
    });
    const client = createMindosClient({ baseUrl: 'http://localhost:3456', fetch: fetchMock });

    await expect(client.health()).resolves.toMatchObject({ ok: true, service: 'mindos' });
    await expect(client.files({ limit: 1, offset: 1 })).resolves.toEqual({
      files: ['b.md'],
      total: 2,
      offset: 1,
      limit: 1,
    });
    await expect(client.search('hello', {
      limit: 5,
      scope: 'Projects',
      file_type: 'md',
      modified_after: '2026-01-01T00:00:00.000Z',
    })).resolves.toEqual([{ path: 'hello.md' }]);
    await expect(client.settings()).resolves.toEqual({ mindRoot: '/tmp/mind' });
    await expect(client.updateSettings({ mindRoot: '/tmp/next' })).resolves.toEqual({ ok: true });
    await expect(client.mcpStatus()).resolves.toMatchObject({ running: true, port: 8567 });

    expect(String(fetchMock.mock.calls[1]![0])).toBe('http://localhost:3456/api/files?limit=1&offset=1');
    expect(String(fetchMock.mock.calls[2]![0])).toBe('http://localhost:3456/api/search?q=hello&limit=5&scope=Projects&file_type=md&modified_after=2026-01-01T00%3A00%3A00.000Z');
    expect(fetchMock.mock.calls[4]![1]?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[5]![0])).toBe('http://localhost:3456/api/mcp/status');
  });

  it('streams ask events from SSE responses', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data:{"type":"text_delta","delta":"hel'));
        controller.enqueue(encoder.encode('lo"}\n\n'));
        controller.enqueue(encoder.encode('data: not-json\n\n'));
        controller.enqueue(encoder.encode('data:{"type":"done"}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    const client = createMindosClient({ baseUrl: 'http://localhost:3456', fetch: fetchMock });

    const events = [];
    for await (const event of client.askStream({ messages: [{ role: 'user', content: 'Hi' }] })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text_delta', delta: 'hello' },
      { type: 'done' },
    ]);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://localhost:3456/api/ask');
    expect(fetchMock.mock.calls[0]![1]?.method).toBe('POST');
  });
});

describe('resolveMindosServerSpawn', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    mockExecFileSync.mockReset();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('uses a shell for Windows cmd launchers only', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockExecFileSync.mockReturnValue('C:\\Users\\test\\AppData\\Roaming\\npm\\mindos.cmd\r\n' as any);

    expect(resolveMindosServerSpawn('mindos')).toEqual({
      command: 'C:\\Users\\test\\AppData\\Roaming\\npm\\mindos.cmd',
      shell: true,
    });
    expect(mockExecFileSync).toHaveBeenCalledWith('where', ['mindos'], expect.any(Object));
  });

  it('does not use a shell for Windows exe launchers', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockExecFileSync.mockReturnValue('C:\\Program Files\\MindOS\\mindos.exe\r\n' as any);

    expect(resolveMindosServerSpawn('mindos')).toEqual({
      command: 'C:\\Program Files\\MindOS\\mindos.exe',
      shell: false,
    });
  });

  it('does not shell-evaluate unresolved command names with metacharacters', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not found');
    });

    expect(resolveMindosServerSpawn('mindos && calc')).toEqual({
      command: 'mindos && calc',
      shell: false,
    });
  });
});
