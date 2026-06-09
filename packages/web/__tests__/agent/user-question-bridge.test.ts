import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  answerAskUserQuestion,
  askUserQuestionViaBridge,
  cancelAskUserQuestion,
  getPendingAskUserQuestionCount,
  runWithAskUserQuestionBridge,
} from '@/lib/agent/user-question-bridge';

const params = {
  questions: [
    {
      question: 'Which implementation should MindOS use?',
      header: 'Approach',
      options: [
        { label: 'Bridge', description: 'Use the upstream tool and MindOS UI bridge.' },
        { label: 'Fork', description: 'Copy the upstream implementation locally.' },
      ],
    },
  ],
};

const normalizedQuestions = [{
  ...params.questions[0],
  multiSelect: false,
}];

afterEach(() => {
  vi.useRealTimers();
});

describe('ask user question bridge', () => {
  it('emits a start event and resolves the pending tool call with answers', async () => {
    const send = vi.fn();
    const promise = runWithAskUserQuestionBridge(
      { runId: 'run-1', send },
      () => askUserQuestionViaBridge({ toolCallId: 'tool-1', params }),
    );

    expect(getPendingAskUserQuestionCount()).toBe(1);
    expect(send).toHaveBeenCalledWith({
      type: 'user_question_start',
      runId: 'run-1',
      toolCallId: 'tool-1',
      questions: normalizedQuestions,
    });

    const answer = {
      questionIndex: 0,
      question: params.questions[0].question,
      kind: 'option' as const,
      answer: 'Bridge',
    };
    expect(answerAskUserQuestion({ runId: 'run-1', toolCallId: 'tool-1', answers: [answer] })).toEqual({ ok: true });

    await expect(promise).resolves.toEqual({ answers: [answer], cancelled: false });
    expect(getPendingAskUserQuestionCount()).toBe(0);
    expect(send).toHaveBeenLastCalledWith({
      type: 'user_question_answered',
      runId: 'run-1',
      toolCallId: 'tool-1',
      answers: [answer],
    });
  });

  it('cancels a pending question without leaving pending state behind', async () => {
    const send = vi.fn();
    const promise = runWithAskUserQuestionBridge(
      { runId: 'run-2', send },
      () => askUserQuestionViaBridge({ toolCallId: 'tool-2', params }),
    );

    expect(cancelAskUserQuestion({ runId: 'run-2', toolCallId: 'tool-2', reason: 'user_cancelled' })).toEqual({ ok: true });

    await expect(promise).resolves.toEqual({ answers: [], cancelled: true, error: 'user_cancelled' });
    expect(getPendingAskUserQuestionCount()).toBe(0);
    expect(send).toHaveBeenLastCalledWith({
      type: 'user_question_cancelled',
      runId: 'run-2',
      toolCallId: 'tool-2',
      reason: 'user_cancelled',
    });
  });

  it('returns 404 for a stale answer or cancel request', () => {
    expect(answerAskUserQuestion({ runId: 'missing', toolCallId: 'tool', answers: [] })).toEqual({
      ok: false,
      status: 404,
      error: 'Question is no longer pending.',
    });
    expect(cancelAskUserQuestion({ runId: 'missing', toolCallId: 'tool' })).toEqual({
      ok: false,
      status: 404,
      error: 'Question is no longer pending.',
    });
  });

  it('aborts exactly once and removes the abort listener after normal answer', async () => {
    const send = vi.fn();
    const controller = new AbortController();
    const promise = runWithAskUserQuestionBridge(
      { runId: 'run-3', send },
      () => askUserQuestionViaBridge({ toolCallId: 'tool-3', params, signal: controller.signal }),
    );

    expect(answerAskUserQuestion({
      runId: 'run-3',
      toolCallId: 'tool-3',
      answers: [{ questionIndex: 0, question: params.questions[0].question, kind: 'option', answer: 'Bridge' }],
    })).toEqual({ ok: true });

    await expect(promise).resolves.toMatchObject({ cancelled: false });
    controller.abort();

    expect(send.mock.calls.filter(([event]) => event.type === 'user_question_cancelled')).toHaveLength(0);
  });
});
