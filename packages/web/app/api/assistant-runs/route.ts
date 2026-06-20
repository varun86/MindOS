export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { LocalAttachment, Message } from '@/lib/types';
import { buildAssistantAskRequestBody } from '@/lib/assistant-runner';
import { DREAMING_ASSISTANT_ID, buildDreamingAssistantRunPrompt } from '@/lib/dreaming-assistant';
import { isRegisteredAssistantRun } from '@/lib/assistant-runtime-registry';
import { handleRouteErrorSimple } from '@/lib/errors';
import { runAskRequestBody, type AskRouteRequestBody } from '../ask/runner';

class AssistantRunError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantRunError';
  }
}

const SAFE_ASSISTANT_ID = /^[a-z0-9][a-z0-9-]*$/;

export async function POST(req: Request) {
  const body = await readJsonBody(req);

  try {
    const record = objectBody(body);
    const assistantId = normalizeAssistantId(record.assistantId);
    if (!assistantId) {
      throw new AssistantRunError(400, 'INVALID_ASSISTANT_ID', 'Invalid assistant id.');
    }
    return runAskRequestBody(createAssistantAskBody(record, assistantId), {
      headers: req.headers,
      signal: req.signal,
      request: req,
    });
  } catch (error) {
    if (error instanceof AssistantRunError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return handleRouteErrorSimple(error);
  }
}

function createAssistantAskBody(
  body: Record<string, unknown>,
  assistantId: string,
): AskRouteRequestBody {
  const messages = resolveAssistantMessages(body, assistantId);
  if (messages.length === 0) {
    throw new AssistantRunError(400, 'INVALID_MESSAGES', 'Assistant Runs require at least one message.');
  }

  const askBody = buildAssistantAskRequestBody({
    assistantId,
    messages,
    uploadedFiles: normalizeUploadedFiles(body.uploadedFiles),
    maxSteps: normalizePositiveInteger(body.maxSteps) ?? defaultAssistantMaxSteps(assistantId),
    providerOverride: normalizeOptionalString(body.providerOverride),
    modelOverride: normalizeOptionalString(body.modelOverride),
    runtimeOptions: normalizeAssistantRuntimeOptions(body.runtimeOptions, assistantId),
  }) as AskRouteRequestBody;

  return copyAskRouteContextFields(askBody, body);
}

function copyAskRouteContextFields(
  askBody: AskRouteRequestBody,
  body: Record<string, unknown>,
): AskRouteRequestBody {
  const contextFields = [
    'currentFile',
    'attachedFiles',
    'selectedAcpAgent',
    'selectedRuntime',
    'runtimeBinding',
    'workDir',
    'contextSelection',
    'agentOptions',
    'chatSessionId',
  ] as const satisfies ReadonlyArray<keyof AskRouteRequestBody>;
  const target = askBody as Record<string, unknown>;
  for (const field of contextFields) {
    if (body[field] !== undefined) target[field] = body[field];
  }
  return askBody;
}

function resolveAssistantMessages(
  body: Record<string, unknown>,
  assistantId: string,
): Message[] {
  const messages = normalizeMessages(body.messages);
  if (messages.length > 0) return messages;
  if (assistantId === DREAMING_ASSISTANT_ID) {
    return [{
      role: 'user',
      content: buildDreamingAssistantRunPrompt({
        space: normalizeSpace(readContextSpace(body)),
        dryRun: body.dryRun === true,
      }),
    }];
  }
  return [];
}

function defaultAssistantMaxSteps(assistantId: string): number | undefined {
  return assistantId === DREAMING_ASSISTANT_ID ? 16 : undefined;
}

function normalizeAssistantRuntimeOptions(
  value: unknown,
  assistantId: string,
): Record<string, unknown> | undefined {
  const runtimeOptions = objectBodyOrUndefined(value);
  if (isRegisteredAssistantRun(assistantId)) return runtimeOptions;
  return {
    ...runtimeOptions,
    permissionMode: 'read',
  };
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function objectBodyOrUndefined(value: unknown): Record<string, unknown> | undefined {
  const record = objectBody(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

function normalizeAssistantId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return SAFE_ASSISTANT_ID.test(normalized) ? normalized : undefined;
}

function readContextSpace(record: Record<string, unknown>): unknown {
  const context = objectBody(record.context);
  return context.space ?? record.space;
}

function normalizeSpace(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');
  if (!normalized) return undefined;
  const segments = normalized.split('/');
  if (segments.some(segment => segment === '.' || segment === '..' || segment.includes('\0'))) {
    throw new AssistantRunError(400, 'INVALID_SPACE', 'Invalid assistant run space.');
  }
  return normalized;
}

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Message => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.role === 'string' && typeof record.content === 'string';
  });
}

function normalizeUploadedFiles(value: unknown): LocalAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is LocalAttachment => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.name === 'string' && typeof record.content === 'string';
  });
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}
