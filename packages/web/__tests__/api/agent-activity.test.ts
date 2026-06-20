import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { testMindRoot } from '../setup';
import { GET, POST } from '../../app/api/agent-activity/route';

function root() {
  return testMindRoot;
}

function post(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/agent-activity', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/agent-activity', () => {
  it('appends audit events through the activity API', async () => {
    const res = await POST(post({
      ts: '2026-03-25T12:00:00.000Z',
      tool: 'mindos_search_notes',
      params: { query: 'agent' },
      result: 'ok',
      message: '1 result',
      agentName: 'codex',
    }));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ ok: true, count: 1 });

    const newLogPath = path.join(root(), '.mindos', 'agent-audit-log.json');
    expect(fs.existsSync(newLogPath)).toBe(true);
    const latest = JSON.parse(fs.readFileSync(newLogPath, 'utf-8').trim()) as { tool: string; op: string; agentName: string };
    expect(latest).toMatchObject({
      tool: 'mindos_search_notes',
      op: 'append',
      agentName: 'codex',
    });
  });

  it('lists events written through the activity API', async () => {
    await POST(post({ ts: '2026-03-25T12:00:00.000Z', tool: 'first_tool', params: {}, result: 'ok' }));
    await POST(post({ ts: '2026-03-25T12:01:00.000Z', tool: 'second_tool', params: {}, result: 'ok' }));

    const res = await GET(new NextRequest('http://localhost/api/agent-activity?limit=10'));

    expect(res.status).toBe(200);
    const body = await res.json() as { events: Array<{ tool: string }> };
    expect(body.events.map((event) => event.tool)).toEqual(['second_tool', 'first_tool']);
  });
});
