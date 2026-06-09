import { describe, expect, it, vi } from 'vitest';
import { consumeUIMessageStream } from '@/lib/agent/stream-consumer';
import type { ToolCallPart } from '@/lib/types';

function makeStream(...events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const evt of events) {
        controller.enqueue(encoder.encode(`data:${JSON.stringify(evt)}\n\n`));
      }
      controller.close();
    },
  });
}

function findAskQuestionPart(parts: unknown[]): ToolCallPart | undefined {
  return parts.find((part): part is ToolCallPart => (
    Boolean(part) &&
    typeof part === 'object' &&
    (part as ToolCallPart).type === 'tool-call' &&
    (part as ToolCallPart).toolName === 'ask_user_question'
  ));
}

describe('consumeUIMessageStream user_question events', () => {
  it('creates a structured ask_user_question tool part from user_question_start', async () => {
    const result = await consumeUIMessageStream(makeStream(
      {
        type: 'user_question_start',
        runId: 'run-1',
        toolCallId: 'tool-1',
        questions: [{
          question: 'Choose an implementation path.',
          header: 'Approach',
          options: [
            { label: 'Bridge', description: 'Use upstream package with MindOS UI.', preview: 'Same run continuation.' },
            { label: 'Fork', description: 'Copy upstream code locally.' },
          ],
        }],
      },
      { type: 'done' },
    ), vi.fn());

    const part = findAskQuestionPart(result.parts);
    expect(part).toMatchObject({
      toolCallId: 'tool-1',
      toolName: 'ask_user_question',
      userQuestion: {
        runId: 'run-1',
        status: 'waiting',
        questions: [{
          question: 'Choose an implementation path.',
          header: 'Approach',
          multiSelect: false,
          options: [
            { label: 'Bridge', description: 'Use upstream package with MindOS UI.', preview: 'Same run continuation.' },
            { label: 'Fork', description: 'Copy upstream code locally.' },
          ],
        }],
      },
    });
  });

  it('marks a pending question submitted and stores answers without adding conversation text', async () => {
    const answer = {
      questionIndex: 0,
      question: 'Pick one.',
      kind: 'option',
      answer: 'A',
      preview: 'A preview.',
    };
    const result = await consumeUIMessageStream(makeStream(
      {
        type: 'user_question_start',
        runId: 'run-1',
        toolCallId: 'tool-1',
        questions: [{ question: 'Pick one.', header: 'Choice', options: [{ label: 'A', description: 'A path.' }] }],
      },
      { type: 'user_question_answered', runId: 'run-1', toolCallId: 'tool-1', answers: [answer] },
      { type: 'done' },
    ), vi.fn());

    const part = findAskQuestionPart(result.parts);
    expect(result.content).toBe('');
    expect(part?.userQuestion?.status).toBe('submitted');
    expect(part?.userQuestion?.answers).toEqual([answer]);
  });

  it('marks a pending question cancelled with the backend reason', async () => {
    const result = await consumeUIMessageStream(makeStream(
      {
        type: 'user_question_start',
        runId: 'run-1',
        toolCallId: 'tool-1',
        questions: [{ question: 'Pick one.', header: 'Choice', options: [{ label: 'A', description: 'A path.' }] }],
      },
      { type: 'user_question_cancelled', runId: 'run-1', toolCallId: 'tool-1', reason: 'timeout' },
      { type: 'done' },
    ), vi.fn());

    const part = findAskQuestionPart(result.parts);
    expect(part?.userQuestion).toMatchObject({ status: 'cancelled', reason: 'timeout' });
  });
});
