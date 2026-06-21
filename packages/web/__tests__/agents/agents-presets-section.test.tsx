// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import AgentsPresetsSection from '@/components/agents/AgentsPresetsSection';
import { messages } from '@/lib/i18n';

vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const localAssistantsPayload = {
  root: '.mindos/assistants',
  assistants: [
    {
      id: 'inbox-organizer',
      name: 'Inbox Organizer',
      description: 'Review staged Inbox material.',
      version: 1,
      mode: 'subagent',
      runtime: 'mindos',
      model: 'default',
      permissionMode: 'ask',
      hidden: true,
      preferredAgent: 'mindos-agent',
      skills: [],
      mcp: [],
      source: 'builtin',
      deletable: false,
      format: 'markdown',
      paths: {
        root: '.mindos/assistants',
        prompt: '.mindos/assistants/inbox-organizer.md',
        profile: '.mindos/assistants/inbox-organizer.md',
        file: '.mindos/assistants/inbox-organizer.md',
      },
      promptPath: '.mindos/assistants/inbox-organizer.md',
      profilePath: '.mindos/assistants/inbox-organizer.md',
      promptReady: true,
      profileReady: true,
      promptTitle: 'Inbox Organizer',
      promptPreview: 'Review staged Inbox material and preserve sources.',
      prompt: {
        exists: true,
        content: `# Inbox Organizer

## Role

Review staged Inbox material and preserve sources.

## Inputs

- Inbox notes
- Local decisions

## Output

Write an organization proposal.

## Boundaries

- Keep source notes unchanged.
`,
      },
      health: {
        state: 'ready',
        issues: [],
      },
    },
    {
      id: 'research-scout',
      name: 'Research Scout',
      description: 'Prepare a reading queue.',
      version: 1,
      mode: 'subagent',
      runtime: 'codex',
      model: 'default',
      permissionMode: 'ask',
      preferredAgent: 'codex',
      skills: [],
      mcp: [],
      source: 'custom',
      deletable: true,
      format: 'markdown',
      paths: {
        root: '.mindos/assistants',
        prompt: '.mindos/assistants/research-scout.md',
        profile: '.mindos/assistants/research-scout.md',
        file: '.mindos/assistants/research-scout.md',
      },
      promptPath: '.mindos/assistants/research-scout.md',
      profilePath: '.mindos/assistants/research-scout.md',
      promptReady: true,
      profileReady: true,
      promptPreview: 'Prepare a reading queue from local research notes.',
      prompt: {
        exists: true,
        content: `# Research Scout

## Role

Prepare a reading queue from local research notes.
`,
      },
      health: {
        state: 'ready',
        issues: [],
      },
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockAssistantsFetch(
  payload: { root: string; assistants: Array<Record<string, unknown>> } = localAssistantsPayload,
  options?: { failAssistants?: boolean },
) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href === '/api/assistants' && init?.method === 'DELETE') {
      return jsonResponse({ ok: true });
    }
    if (href === '/api/assistants') {
      if (options?.failAssistants) return jsonResponse({ error: 'boom' }, 500);
      return jsonResponse(payload);
    }
    if (href === '/api/file' && init?.method === 'POST') {
      return jsonResponse({ ok: true });
    }
    if (href === '/api/ask' && init?.method === 'POST') {
      return new Response('data: {"type":"text_delta","delta":"Run summary"}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    if (href === '/api/assistant-runs' && init?.method === 'POST') {
      return new Response('data: {"type":"text_delta","delta":"Run summary"}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function flushEffects() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function renderSection(onLibraryCountChange = vi.fn()): Promise<{ host: HTMLDivElement; root: Root; onLibraryCountChange: ReturnType<typeof vi.fn> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(<AgentsPresetsSection copy={messages.en.agentsContent.presets} onLibraryCountChange={onLibraryCountChange} />);
    await flushEffects();
  });

  return { host, root, onLibraryCountChange };
}

function clickButton(host: HTMLElement, label: string) {
  const button = Array.from(host.querySelectorAll('button'))
    .find(item => item.textContent?.includes(label));
  expect(button, `button ${label}`).toBeTruthy();
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('AgentsPresetsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('loads Assistant profiles from /api/assistants instead of static presets', async () => {
    const fetchMock = mockAssistantsFetch();
    const onLibraryCountChange = vi.fn();
    const { host, root } = await renderSection(onLibraryCountChange);

    expect(fetchMock).toHaveBeenCalledWith('/api/assistants', { cache: 'no-store' });
    expect(onLibraryCountChange).toHaveBeenCalledWith(2);
    expect(host.textContent).toContain('Inbox Organizer');
    expect(host.textContent).toContain('Research Scout');
    expect(host.textContent).toContain('Review staged Inbox material and preserve sources.');
    expect(host.textContent).toContain('Inbox notes');
    expect(host.textContent).toContain('Local decisions');
    expect(host.textContent).not.toContain('Skill Librarian');

    await act(async () => {
      root.unmount();
    });
  });

  it('places assistant filters, search, and creation in the cross-column toolbar', async () => {
    mockAssistantsFetch();
    const { host, root } = await renderSection();

    const shell = host.querySelector('[data-assistant-shell]');
    const commandCenter = host.querySelector('[data-assistant-command-center]');
    expect(commandCenter).not.toBeNull();
    expect(shell?.firstElementChild).toBe(commandCenter);
    expect(commandCenter!.closest('[data-assistant-command-column="library"]')).toBeNull();
    expect(commandCenter!.textContent).toContain('All assistants');
    expect(commandCenter!.textContent).toContain('Built-in');
    expect(commandCenter!.textContent).toContain('Custom');
    expect(commandCenter!.textContent).toContain('New Assistant');
    expect(commandCenter!.querySelector('input[aria-label="Search assistants..."]')).not.toBeNull();

    expect(host.querySelector('[data-assistant-command-column="workspace"] button[data-assistant-run="inbox-organizer"]')).not.toBeNull();
    expect(Array.from(host.querySelectorAll('button[data-assistant-run="inbox-organizer"]'))).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders markdown Assistant resources without leaking local files', async () => {
    mockAssistantsFetch();
    const { host, root } = await renderSection();

    await act(async () => {
      clickButton(host, 'Resources');
      await flushEffects();
    });

    expect(host.textContent).toContain('Not defined yet');
    expect(host.textContent).not.toContain('.mindos/assistants/inbox-organizer.md');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps local prompt and profile file paths out of the visible Assistant details', async () => {
    mockAssistantsFetch();
    const { host, root } = await renderSection();

    expect(host.textContent).not.toContain('.mindos/assistants/inbox-organizer.md');
    expect(host.textContent).not.toContain('.mindos/assistants');
    expect(host.textContent).not.toContain('Local files');

    await act(async () => {
      clickButton(host, 'Prompt');
      await flushEffects();
    });

    expect(host.textContent).not.toContain('Prompt ready');
    expect(host.textContent).not.toContain('.mindos/assistants/inbox-organizer.md');

    await act(async () => {
      clickButton(host, 'Resources');
      await flushEffects();
    });

    expect(host.textContent).toContain('Not defined yet');
    expect(host.textContent).not.toContain('.mindos/assistants/inbox-organizer.md');

    await act(async () => {
      root.unmount();
    });
  });

  it('saves prompt edits to the selected local prompt file', async () => {
    const fetchMock = mockAssistantsFetch();
    const { host, root } = await renderSection();

    await act(async () => {
      clickButton(host, 'Prompt');
      await flushEffects();
    });

    const textarea = host.querySelector('textarea[data-assistant-prompt-editor="inbox-organizer"]') as HTMLTextAreaElement;
    expect(textarea.value).toContain('# Inbox Organizer');

    const editedPrompt = `# Inbox Organizer

## Role

Use the edited review policy.

## Inputs

- Inbox notes
- Local decisions

## Output

Write an updated morning brief.

## Boundaries

- Keep source notes unchanged.
`;

    await act(async () => {
      setTextareaValue(textarea, editedPrompt);
      await flushEffects();
    });

    expect(host.textContent).toContain('Unsaved changes');

    await act(async () => {
      clickButton(host, 'Save prompt');
      await flushEffects();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/file', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    }));
    const saveCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/file' && init?.method === 'POST');
    const saveRequest = JSON.parse(saveCall![1]!.body as string);
    expect(saveRequest.path).toBe('.mindos/assistants/inbox-organizer.md');
    expect(saveRequest.content).toContain('version: 1');
    expect(saveRequest.content).toContain('mode: subagent');
    expect(saveRequest.content).toContain('runtime: mindos');
    expect(saveRequest.content).toContain(editedPrompt);
    expect(host.textContent).not.toContain('Unsaved changes');

    await act(async () => {
      clickButton(host, 'Overview');
      await flushEffects();
    });

    expect(host.textContent).toContain('Use the edited review policy.');
    expect(host.textContent).toContain('Inbox notes');
    expect(host.textContent).toContain('Local decisions');
    expect(host.textContent).toContain('Write an updated morning brief.');
    expect(host.textContent).toContain('Keep source notes unchanged.');
    expect(host.textContent).not.toContain('Review staged Inbox material and preserve sources.');

    await act(async () => {
      root.unmount();
    });
  });

  it('saves profile edits back to the Assistant Markdown frontmatter', async () => {
    const fetchMock = mockAssistantsFetch();
    const { host, root } = await renderSection();

    await act(async () => {
      clickButton(host, 'Profile');
      await flushEffects();
    });

    const nameInput = host.querySelector('input[data-assistant-profile-name="inbox-organizer"]') as HTMLInputElement;
    const agentInput = host.querySelector('input[data-assistant-profile-agent="inbox-organizer"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(nameInput, 'Inbox Curator');
      setInputValue(agentInput, 'claude-code');
      await flushEffects();
    });

    await act(async () => {
      host.querySelector('button[data-assistant-profile-save="inbox-organizer"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEffects();
    });

    const postCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/file' && init?.method === 'POST');
    expect(postCall).toBeTruthy();
    const request = JSON.parse(postCall![1]!.body as string);
    expect(request.path).toBe('.mindos/assistants/inbox-organizer.md');
    expect(request.content).toContain('name: Inbox Curator');
    expect(request.content).toContain('description: Review staged Inbox material.');
    expect(request.content).toContain('version: 1');
    expect(request.content).toContain('mode: subagent');
    expect(request.content).toContain('runtime: claude-code');
    expect(request.content).not.toContain('schemaVersion');
    expect(request.content).not.toContain('skills:');
    expect(request.content).not.toContain('mcp:');
    expect(host.textContent).not.toContain('Profile JSON needs repair');
    expect(host.textContent).toContain('Inbox Curator');

    await act(async () => {
      root.unmount();
    });
  });

  it('protects built-in Assistants from deletion in the UI', async () => {
    mockAssistantsFetch();
    const { host, root } = await renderSection();

    const deleteButton = host.querySelector('button[data-assistant-delete="inbox-organizer"]') as HTMLButtonElement;
    expect(deleteButton).toBeNull();
    expect(host.querySelector('[data-assistant-detail-actions="inbox-organizer"]')).toBeTruthy();
    expect(host.textContent).toContain('Protected');

    await act(async () => {
      root.unmount();
    });
  });

  it('runs and deletes custom Assistants', async () => {
    const fetchMock = mockAssistantsFetch();
    const { host, root } = await renderSection();

    await act(async () => {
      host.querySelector('button[data-assistant-library-row="research-scout"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEffects();
    });

    expect(host.textContent).toContain('Custom');
    const deleteButton = host.querySelector('button[data-assistant-delete="research-scout"]') as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(false);

    await act(async () => {
      host.querySelector('button[data-assistant-run="research-scout"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEffects();
    });

    const askCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/assistant-runs' && init?.method === 'POST');
    expect(askCall).toBeTruthy();
    const askBody = JSON.parse(askCall![1]!.body as string);
    expect(askBody).not.toHaveProperty('mode');
    expect(askBody.assistantId).toBe('research-scout');
    expect(askBody.runtimeOptions).toEqual({ permissionMode: 'read' });
    expect(askBody.messages[0].content).toContain('Research Scout');
    expect(askBody.messages[0].content).toContain('read mode');
    expect(host.textContent).toContain('Run summary');

    await act(async () => {
      deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEffects();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/assistants', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ id: 'research-scout' }),
    }));
    expect(host.textContent).not.toContain('Research Scout');

    await act(async () => {
      root.unmount();
    });
  });

  it('runs Dreaming through the AssistantRun endpoint', async () => {
    const fetchMock = mockAssistantsFetch({
      ...localAssistantsPayload,
      assistants: [
        {
          id: 'dreaming',
          name: 'Dreaming',
          description: 'Review knowledge-base health.',
          version: 1,
          mode: 'subagent',
          runtime: 'mindos',
          model: 'default',
          permissionMode: 'ask',
          hidden: true,
          preferredAgent: 'mindos-agent',
          skills: [],
          mcp: [],
          source: 'builtin',
          deletable: false,
          format: 'markdown',
          paths: {
            root: '.mindos/assistants',
            prompt: '.mindos/assistants/dreaming.md',
            profile: '.mindos/assistants/dreaming.md',
            file: '.mindos/assistants/dreaming.md',
          },
          promptPath: '.mindos/assistants/dreaming.md',
          profilePath: '.mindos/assistants/dreaming.md',
          promptReady: true,
          profileReady: true,
          promptTitle: 'Dreaming',
          promptPreview: 'Review the local knowledge base for maintenance signals.',
          prompt: {
            exists: true,
            content: `# Dreaming

## Role

Review the local knowledge base for maintenance signals.
`,
          },
          health: {
            state: 'ready',
            issues: [],
          },
        },
        ...localAssistantsPayload.assistants,
      ],
    });
    const { host, root } = await renderSection();

    await act(async () => {
      host.querySelector('button[data-assistant-library-row="dreaming"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEffects();
    });

    await act(async () => {
      host.querySelector('button[data-assistant-run="dreaming"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEffects();
    });

    const assistantRunCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/assistant-runs' && init?.method === 'POST');
    expect(assistantRunCall).toBeTruthy();
    expect(JSON.parse(assistantRunCall![1]!.body as string)).toEqual({
      assistantId: 'dreaming',
      trigger: 'manual',
    });
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/ask' && init?.method === 'POST')).toBe(false);
    expect(host.textContent).toContain('Run summary');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders an empty local-library state', async () => {
    mockAssistantsFetch({ root: '.mindos/assistants', assistants: [] });
    const onLibraryCountChange = vi.fn();
    const { host, root } = await renderSection(onLibraryCountChange);

    expect(onLibraryCountChange).toHaveBeenCalledWith(0);
    expect(host.textContent).toContain('No local assistants found');
    expect(host.textContent).toContain('Create an Assistant profile to add one.');
    expect(host.textContent).not.toContain('.mindos/assistants');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders a retryable load failure', async () => {
    mockAssistantsFetch(localAssistantsPayload, { failAssistants: true });
    const onLibraryCountChange = vi.fn();
    const { host, root } = await renderSection(onLibraryCountChange);

    expect(onLibraryCountChange).toHaveBeenCalledWith(0);
    expect(host.textContent).toContain('Failed to load assistants.');
    expect(host.textContent).toContain('Retry');

    await act(async () => {
      root.unmount();
    });
  });
});
