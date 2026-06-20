import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleAgentActivity, handleAgentActivityPost } from './agent-activity.js';

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'mindos-agent-activity-'));
}

describe('handlers/agent-activity', () => {
  it('appends audit events through the product-owned activity endpoint', () => {
    const root = makeRoot();

    const response = handleAgentActivityPost({
      ts: '2026-01-01T00:00:00.000Z',
      tool: 'mindos_read_file',
      params: { path: 'README.md' },
      result: 'ok',
      message: 'read',
      agentName: 'codex',
    }, { mindRoot: root });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ok: true, count: 1 });

    const raw = readFileSync(join(root, '.mindos', 'agent-audit-log.json'), 'utf-8');
    expect(JSON.parse(raw.trim())).toMatchObject({
      tool: 'mindos_read_file',
      result: 'ok',
      agentName: 'codex',
      op: 'append',
    });
  });

  it('rejects malformed activity append payloads', () => {
    const root = makeRoot();

    const response = handleAgentActivityPost({ params: {}, result: 'ok' }, { mindRoot: root });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('missing tool') });
    expect(existsSync(join(root, '.mindos', 'agent-audit-log.json'))).toBe(false);
  });

  it('does not write audit logs through symlinked metadata directories', () => {
    const root = makeRoot();
    const outside = makeRoot();
    try {
      symlinkSync(outside, join(root, '.mindos'), 'dir');

      const response = handleAgentActivityPost({
        tool: 'mindos_write_file',
        params: { path: 'note.md' },
        result: 'ok',
      }, { mindRoot: root });

      expect(response.status).toBe(403);
      expect(existsSync(join(outside, 'agent-audit-log.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('lists appended events newest-first', async () => {
    const root = makeRoot();
    handleAgentActivityPost({ ts: '2026-01-01T00:00:00.000Z', tool: 'first', params: {}, result: 'ok' }, { mindRoot: root });
    handleAgentActivityPost({ ts: '2026-01-02T00:00:00.000Z', tool: 'second', params: {}, result: 'ok' }, { mindRoot: root });

    const response = await handleAgentActivity(new URLSearchParams({ limit: '10' }), { mindRoot: root });

    expect(response.status).toBe(200);
    if (!('events' in response.body)) throw new Error('Expected events payload');
    expect(response.body.events.map((event) => event.tool)).toEqual(['second', 'first']);
  });
});
