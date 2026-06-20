import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/assistant-runs/route';

const askPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ask/runner', () => ({
  runAskRequestBody: askPostMock,
}));

describe('POST /api/assistant-runs', () => {
  beforeEach(() => {
    askPostMock.mockReset();
  });

  it('delegates Inbox Organizer runs to the shared ask-backed streaming runner', async () => {
    askPostMock.mockResolvedValueOnce(new Response('data: {"type":"done"}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }));

    const response = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      headers: { 'accept-language': 'zh-CN' },
      body: JSON.stringify({
        assistantId: 'inbox-organizer',
        trigger: 'manual',
        messages: [{ role: 'user', content: 'Organize this Inbox item.' }],
        uploadedFiles: [{ name: 'capture.md', content: 'source' }],
        providerOverride: 'p_stepfun',
        modelOverride: 'step-2',
        maxSteps: 15,
      }),
    }));

    expect(askPostMock).toHaveBeenCalledTimes(1);
    const delegatedBody = askPostMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const delegatedContext = askPostMock.mock.calls[0]?.[1] as { headers?: Headers; request?: Request; signal?: AbortSignal };
    expect(delegatedContext.headers?.get('accept-language')).toBe('zh-CN');
    expect(delegatedContext.request?.url).toBe('http://localhost/api/assistant-runs');
    expect(delegatedBody).toMatchObject({
      assistantId: 'inbox-organizer',
      mode: 'agent',
      messages: [{ role: 'user', content: 'Organize this Inbox item.' }],
      uploadedFiles: [{ name: 'capture.md', content: 'source' }],
      providerOverride: 'p_stepfun',
      modelOverride: 'step-2',
      maxSteps: 15,
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    await expect(response.text()).resolves.toContain('"type":"done"');
  });

  it('rejects ask-backed assistant runs without messages before touching the ask runner', async () => {
    const response = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({ assistantId: 'inbox-organizer' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_MESSAGES' },
    });
    expect(askPostMock).not.toHaveBeenCalled();
  });

  it('normalizes ask-backed assistant bodies without leaking invalid raw fields', async () => {
    askPostMock.mockResolvedValueOnce(new Response('data: {"type":"done"}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }));

    await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({
        assistantId: 'inbox-organizer',
        messages: [{ role: 'user', content: 'Organize this Inbox item.' }],
        uploadedFiles: 'not-files',
        providerOverride: '   ',
        modelOverride: '',
        runtimeOptions: 'not-options',
        maxSteps: -1,
        selectedRuntime: { id: 'codex', name: 'Codex', kind: 'codex' },
        chatSessionId: 'chat-1',
      }),
    }));

    const delegatedBody = askPostMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(delegatedBody).toMatchObject({
      assistantId: 'inbox-organizer',
      mode: 'agent',
      messages: [{ role: 'user', content: 'Organize this Inbox item.' }],
      selectedRuntime: { id: 'codex', name: 'Codex', kind: 'codex' },
      chatSessionId: 'chat-1',
    });
    expect(delegatedBody).not.toHaveProperty('uploadedFiles');
    expect(delegatedBody).not.toHaveProperty('providerOverride');
    expect(delegatedBody).not.toHaveProperty('modelOverride');
    expect(delegatedBody).not.toHaveProperty('runtimeOptions');
    expect(delegatedBody).not.toHaveProperty('maxSteps');
  });

  it('delegates Dreaming runs to the shared ask runner with the local dreaming tool instruction', async () => {
    askPostMock.mockResolvedValueOnce(new Response('data: {"type":"text_delta","delta":"Dreaming queued"}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }));

    const response = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({
        assistantId: 'dreaming',
        trigger: 'manual',
      }),
    }));

    expect(askPostMock).toHaveBeenCalledTimes(1);
    const delegatedBody = askPostMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(delegatedBody).toMatchObject({
      assistantId: 'dreaming',
      mode: 'agent',
      maxSteps: 16,
    });
    const messages = delegatedBody.messages as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('First call the local `dreaming` tool exactly once');
    expect(messages[0].content).toContain('space: all');
    expect(messages[0].content).toContain('writeArtifacts: true');
    expect(messages[0].content).toContain('.mindos/dreaming');
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('passes Dreaming dry-run scope through the ask prompt instead of running a server branch', async () => {
    askPostMock.mockResolvedValueOnce(new Response('data: {"type":"done"}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }));

    const response = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({
        assistantId: 'dreaming',
        dryRun: true,
        context: {
          space: 'Projects',
        },
      }),
    }));

    expect(response.status).toBe(200);
    const delegatedBody = askPostMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const messages = delegatedBody.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('space: Projects');
    expect(messages[0].content).toContain('writeArtifacts: false');
    expect(messages[0].content).toContain('space "Projects"');
    expect(messages[0].content).toContain('dryRun true');
  });

  it('delegates custom assistant runs through ask with readonly permission', async () => {
    askPostMock.mockResolvedValueOnce(new Response('data: {"type":"done"}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }));

    const response = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({
        assistantId: 'daily-signal',
        messages: [{ role: 'user', content: 'Run this assistant.' }],
        runtimeOptions: { permissionMode: 'agent', reasoningEffort: 'high' },
      }),
    }));

    expect(response.status).toBe(200);
    const delegatedBody = askPostMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(delegatedBody).toMatchObject({
      assistantId: 'daily-signal',
      mode: 'agent',
      messages: [{ role: 'user', content: 'Run this assistant.' }],
      runtimeOptions: { permissionMode: 'readonly', reasoningEffort: 'high' },
    });
  });

  it('rejects unsafe assistant ids and spaces before starting a run', async () => {
    const unsafeAssistant = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({ assistantId: '../dreaming' }),
    }));
    expect(unsafeAssistant.status).toBe(400);
    expect(await unsafeAssistant.json()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ASSISTANT_ID' },
    });

    const unsafeSpace = await POST(new Request('http://localhost/api/assistant-runs', {
      method: 'POST',
      body: JSON.stringify({ assistantId: 'dreaming', context: { space: '../Notes' } }),
    }));
    expect(unsafeSpace.status).toBe(400);
    expect(await unsafeSpace.json()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SPACE' },
    });
    expect(askPostMock).not.toHaveBeenCalled();
  });
});
