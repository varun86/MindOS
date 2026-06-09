import { AsyncLocalStorage } from 'node:async_hooks';

export type AskUserQuestionOption = {
  label: string;
  description: string;
  preview?: string;
};

export type AskUserQuestionQuestion = {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
};

export type AskUserQuestionParams = {
  questions: AskUserQuestionQuestion[];
};

export type AskUserQuestionAnswer = {
  questionIndex: number;
  question: string;
  kind: 'option' | 'custom' | 'chat' | 'multi';
  answer: string | null;
  selected?: string[];
  notes?: string;
  preview?: string;
};

export type AskUserQuestionResult = {
  answers: AskUserQuestionAnswer[];
  cancelled: boolean;
  error?: string;
};

export type UserQuestionStartEvent = {
  type: 'user_question_start';
  runId: string;
  toolCallId: string;
  questions: AskUserQuestionQuestion[];
};

export type UserQuestionAnsweredEvent = {
  type: 'user_question_answered';
  runId: string;
  toolCallId: string;
  answers: AskUserQuestionAnswer[];
};

export type UserQuestionCancelledEvent = {
  type: 'user_question_cancelled';
  runId: string;
  toolCallId: string;
  reason: string;
};

export type AskUserQuestionBridgeSend = (
  event: UserQuestionStartEvent | UserQuestionAnsweredEvent | UserQuestionCancelledEvent,
) => void;

export type AskUserQuestionBridgeContext = {
  runId: string;
  send: AskUserQuestionBridgeSend;
  timeoutMs?: number;
};

type PendingQuestion = {
  runId: string;
  toolCallId: string;
  params: AskUserQuestionParams;
  send: AskUserQuestionBridgeSend;
  resolve: (result: AskUserQuestionResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

type AskUserQuestionBridgeGlobalState = {
  bridgeContext: AsyncLocalStorage<AskUserQuestionBridgeContext>;
  pendingQuestions: Map<string, PendingQuestion>;
};

const BRIDGE_GLOBAL_KEY = Symbol.for('mindos.askUserQuestionBridge');

function getGlobalBridgeState(): AskUserQuestionBridgeGlobalState {
  const root = globalThis as typeof globalThis & {
    [BRIDGE_GLOBAL_KEY]?: AskUserQuestionBridgeGlobalState;
  };
  root[BRIDGE_GLOBAL_KEY] ??= {
    bridgeContext: new AsyncLocalStorage<AskUserQuestionBridgeContext>(),
    pendingQuestions: new Map<string, PendingQuestion>(),
  };
  return root[BRIDGE_GLOBAL_KEY];
}

const bridgeState = getGlobalBridgeState();
const bridgeContext = bridgeState.bridgeContext;
const pendingQuestions = bridgeState.pendingQuestions;

function pendingKey(runId: string, toolCallId: string): string {
  return `${runId}:${toolCallId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeQuestions(params: unknown): AskUserQuestionQuestion[] {
  if (!isRecord(params) || !Array.isArray(params.questions)) return [];
  return params.questions
    .filter(isRecord)
    .map((question) => ({
      question: typeof question.question === 'string' ? question.question : '',
      header: typeof question.header === 'string' ? question.header : '',
      multiSelect: question.multiSelect === true,
      options: Array.isArray(question.options)
        ? question.options.filter(isRecord).map((option) => ({
          label: typeof option.label === 'string' ? option.label : '',
          description: typeof option.description === 'string' ? option.description : '',
          ...(typeof option.preview === 'string' ? { preview: option.preview } : {}),
        }))
        : [],
    }));
}

function cancelled(reason: string): AskUserQuestionResult {
  return { answers: [], cancelled: true, error: reason };
}

export function runWithAskUserQuestionBridge<T>(
  context: AskUserQuestionBridgeContext,
  callback: () => Promise<T>,
): Promise<T> {
  return bridgeContext.run(context, callback);
}

export function hasAskUserQuestionBridge(): boolean {
  return Boolean(bridgeContext.getStore());
}

export async function askUserQuestionViaBridge(input: {
  toolCallId: string;
  params: unknown;
  signal?: AbortSignal;
}): Promise<AskUserQuestionResult> {
  const context = bridgeContext.getStore();
  if (!context) return cancelled('no_bridge');

  const questions = normalizeQuestions(input.params);
  const params: AskUserQuestionParams = { questions };
  const key = pendingKey(context.runId, input.toolCallId);

  if (pendingQuestions.has(key)) return cancelled('duplicate_question');

  return await new Promise<AskUserQuestionResult>((resolve, reject) => {
    let abort: (() => void) | undefined;
    const finish = (result: AskUserQuestionResult) => {
      const pending = pendingQuestions.get(key);
      if (!pending) return;
      clearTimeout(pending.timeout);
      if (abort) input.signal?.removeEventListener('abort', abort);
      pendingQuestions.delete(key);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      context.send({
        type: 'user_question_cancelled',
        runId: context.runId,
        toolCallId: input.toolCallId,
        reason: 'timeout',
      });
      finish(cancelled('timeout'));
    }, context.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    pendingQuestions.set(key, {
      runId: context.runId,
      toolCallId: input.toolCallId,
      params,
      send: context.send,
      resolve: finish,
      reject,
      timeout,
    });

    abort = () => {
      context.send({
        type: 'user_question_cancelled',
        runId: context.runId,
        toolCallId: input.toolCallId,
        reason: 'aborted',
      });
      finish(cancelled('aborted'));
    };

    if (input.signal?.aborted) {
      abort();
      return;
    }

    input.signal?.addEventListener('abort', abort, { once: true });

    context.send({
      type: 'user_question_start',
      runId: context.runId,
      toolCallId: input.toolCallId,
      questions,
    });
  });
}

export function answerAskUserQuestion(input: {
  runId: string;
  toolCallId: string;
  answers: AskUserQuestionAnswer[];
  cancelled?: boolean;
}): { ok: true } | { ok: false; status: number; error: string } {
  const key = pendingKey(input.runId, input.toolCallId);
  const pending = pendingQuestions.get(key);
  if (!pending) return { ok: false, status: 404, error: 'Question is no longer pending.' };

  const result: AskUserQuestionResult = {
    answers: Array.isArray(input.answers) ? input.answers : [],
    cancelled: input.cancelled === true,
  };

  pending.send(input.cancelled === true
    ? {
        type: 'user_question_cancelled',
        runId: input.runId,
        toolCallId: input.toolCallId,
        reason: 'user_cancelled',
      }
    : {
        type: 'user_question_answered',
        runId: input.runId,
        toolCallId: input.toolCallId,
        answers: result.answers,
      });
  pending.resolve(result);
  return { ok: true };
}

export function cancelAskUserQuestion(input: {
  runId: string;
  toolCallId: string;
  reason?: string;
}): { ok: true } | { ok: false; status: number; error: string } {
  const key = pendingKey(input.runId, input.toolCallId);
  const pending = pendingQuestions.get(key);
  if (!pending) return { ok: false, status: 404, error: 'Question is no longer pending.' };
  pending.send({
    type: 'user_question_cancelled',
    runId: input.runId,
    toolCallId: input.toolCallId,
    reason: input.reason ?? 'user_cancelled',
  });
  pending.resolve(cancelled(input.reason ?? 'user_cancelled'));
  return { ok: true };
}

export function getPendingAskUserQuestionCount(): number {
  return pendingQuestions.size;
}
