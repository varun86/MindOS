// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import AskUserQuestionBlock from '@/components/ask/AskUserQuestionBlock';
import type { ToolCallPart } from '@/lib/types';

const basePart: ToolCallPart = {
  type: 'tool-call',
  toolCallId: 'tool-1',
  toolName: 'ask_user_question',
  input: undefined,
  state: 'running',
  userQuestion: {
    runId: 'run-1',
    status: 'waiting',
    questions: [
      {
        question: 'Which implementation path should MindOS use?',
        header: 'Approach',
        options: [
          { label: 'Bridge', description: 'Use upstream package with MindOS UI.', preview: 'Same run continuation.' },
          { label: 'Fork', description: 'Copy upstream implementation locally.' },
        ],
      },
    ],
  },
};

function renderBlock(part: ToolCallPart = basePart) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<AskUserQuestionBlock part={part} />);
  });
  return {
    host,
    cleanup() {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('HTMLInputElement value setter not found');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AskUserQuestionBlock', () => {
  it('submits a selected option as an answer payload', async () => {
    const view = renderBlock();

    act(() => {
      buttonByText(view.host, 'Bridge').click();
    });

    await act(async () => {
      buttonByText(view.host, 'Submit').click();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith('/api/agent/user-question', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      runId: 'run-1',
      toolCallId: 'tool-1',
      answers: [{
        questionIndex: 0,
        question: 'Which implementation path should MindOS use?',
        kind: 'option',
        answer: 'Bridge',
        preview: 'Same run continuation.',
      }],
    });

    view.cleanup();
  });

  it('submits a custom single-question answer', async () => {
    const view = renderBlock();
    const input = view.host.querySelector('input') as HTMLInputElement;

    await act(async () => {
      setInputValue(input, 'Use upstream, but keep the MindOS card compact.');
    });

    await act(async () => {
      buttonByText(view.host, 'Submit').click();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.answers).toEqual([{
      questionIndex: 0,
      question: 'Which implementation path should MindOS use?',
      kind: 'custom',
      answer: 'Use upstream, but keep the MindOS card compact.',
    }]);

    view.cleanup();
  });

  it('sends cancel action for a pending question', async () => {
    const view = renderBlock();

    await act(async () => {
      buttonByText(view.host, 'Cancel').click();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      action: 'cancel',
      runId: 'run-1',
      toolCallId: 'tool-1',
      reason: 'user_cancelled',
    });

    view.cleanup();
  });

  it('renders submitted answers as locked selections', () => {
    const view = renderBlock({
      ...basePart,
      state: 'done',
      userQuestion: {
        ...basePart.userQuestion!,
        status: 'submitted',
        answers: [{
          questionIndex: 0,
          question: 'Which implementation path should MindOS use?',
          kind: 'option',
          answer: 'Bridge',
          preview: 'Same run continuation.',
        }],
      },
    });

    expect(view.host.textContent).toContain('Clarification complete');
    expect(view.host.textContent).toContain('Answers submitted');
    expect(view.host.textContent).toContain('Same run continuation.');
    expect(buttonByText(view.host, 'Bridge').getAttribute('aria-pressed')).toBe('true');
    expect(Array.from(view.host.querySelectorAll('button')).some(item => item.textContent?.includes('Submit'))).toBe(false);
    expect(Array.from(view.host.querySelectorAll('button')).some(item => item.textContent?.includes('Cancel'))).toBe(false);

    view.cleanup();
  });
});
