import type {
  AgentMode,
  AgentPermissionMode,
  AgentRuntimeIdentity,
  RuntimeSessionBinding,
  NativeRuntimeOptions,
  NativeRuntimeEffort,
  SessionContextSelection,
  SessionWorkDir,
  Message as FrontendMessage,
} from '@/lib/types';
import { apiError, ErrorCodes } from '@/lib/errors';

export type AgentTurnRequestBody = {
  messages: FrontendMessage[];
  /** Per-turn agent behavior. Behavior defaults to the normal agent loop. */
  agentMode?: AgentMode;
  /** Per-turn permission policy compiled by each runtime adapter. */
  permissionMode?: AgentPermissionMode;
  currentFile?: string;
  attachedFiles?: string[];
  uploadedFiles?: Array<{
    name: string;
    content: string;
    mimeType?: string;
    size?: number;
    dataBase64?: string;
  }>;
  maxSteps?: number;
  /** Assistant binding. This is not an ask mode. */
  assistantId?: string;
  /** ACP agent selection: if present, route to ACP instead of MindOS */
  selectedAcpAgent?: { id: string; name: string } | null;
  /** Unified runtime selection. ACP values mirror selectedAcpAgent for compatibility. */
  selectedRuntime?: (AgentRuntimeIdentity & { externalSessionId?: string }) | null;
  /** Typed external runtime binding for native Codex/Claude resume. */
  runtimeBinding?: RuntimeSessionBinding | null;
  /** Session-bound execution cwd. */
  workDir?: SessionWorkDir;
  /** Dynamic selected Spaces / Assistants for this turn. */
  contextSelection?: SessionContextSelection;
  /** Per-request provider override from the chat panel capsule */
  providerOverride?: string;
  /** Per-request model override from the inline model picker */
  modelOverride?: string;
  /** Per-request native runtime controls for Codex / Claude Code. */
  runtimeOptions?: NativeRuntimeOptions;
  /** Per-request MindOS PI agent controls. */
  agentOptions?: { enableThinking?: boolean; thinkingBudget?: number };
  /** MindOS Chat Panel session id for run ledger correlation. */
  chatSessionId?: string;
};

export type AgentSessionTurnRouteContext = {
  params?: Promise<{ sessionId?: string }> | { sessionId?: string };
};

export type AgentTurnRequestContext = {
  headers?: Headers;
  signal?: AbortSignal;
  request?: Request;
};

export function normalizeNativeRuntimeOptions(value: unknown): NativeRuntimeOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const reasoningEffort = record.reasoningEffort === 'low'
    || record.reasoningEffort === 'medium'
    || record.reasoningEffort === 'high'
    || record.reasoningEffort === 'xhigh'
    ? record.reasoningEffort as NativeRuntimeEffort
    : undefined;
  const modelOverride = typeof record.modelOverride === 'string' && record.modelOverride.trim()
    ? record.modelOverride.trim()
    : undefined;
  return {
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(modelOverride ? { modelOverride } : {}),
  };
}

export function validateNativeRuntimeOptions(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.permissionMode !== undefined) {
    return apiError(
      ErrorCodes.INVALID_REQUEST,
      'runtimeOptions.permissionMode is no longer supported; use top-level permissionMode',
      400,
    );
  }
  if (record.agentMode !== undefined) {
    return apiError(
      ErrorCodes.INVALID_REQUEST,
      'runtimeOptions.agentMode is no longer supported; use top-level agentMode',
      400,
    );
  }
  return null;
}

export function normalizeAgentMode(value: unknown): AgentMode | undefined {
  return value === 'default' || value === 'plan' || value === 'goal'
    ? value
    : undefined;
}

export function normalizeAgentPermissionMode(value: unknown): AgentPermissionMode | undefined {
  return value === 'read' || value === 'ask' || value === 'auto' || value === 'full'
    ? value
    : undefined;
}

export function validateAgentMode(value: unknown) {
  if (value === undefined || normalizeAgentMode(value)) return null;
  return apiError(
    ErrorCodes.INVALID_REQUEST,
    'agentMode must be default, plan, or goal',
    400,
  );
}

export function validateAgentPermissionMode(value: unknown) {
  if (value === undefined || normalizeAgentPermissionMode(value)) return null;
  return apiError(
    ErrorCodes.INVALID_REQUEST,
    'permissionMode must be read, ask, auto, or full',
    400,
  );
}

export function normalizeMindosAgentOptions(value: unknown): { enableThinking?: boolean; thinkingBudget?: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const options: { enableThinking?: boolean; thinkingBudget?: number } = {};

  if (typeof record.enableThinking === 'boolean') {
    options.enableThinking = record.enableThinking;
  }

  if (typeof record.thinkingBudget === 'number' && Number.isFinite(record.thinkingBudget)) {
    options.thinkingBudget = Math.min(50000, Math.max(1000, Math.floor(record.thinkingBudget)));
  }

  return options;
}

export function normalizeAssistantId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getLastUserContent(messages: FrontendMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user' && typeof message.content === 'string') return message.content;
  }
  return '';
}

export function getLastUserSkillName(messages: FrontendMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as FrontendMessage & { skillName?: unknown } | undefined;
    if (message?.role !== 'user') continue;
    return typeof message.skillName === 'string' && message.skillName.trim()
      ? message.skillName.trim()
      : undefined;
  }
  return undefined;
}

export function getLastUserImages(messages: FrontendMessage[]): unknown[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    return Array.isArray(message.images) ? message.images : [];
  }
  return [];
}

export function normalizeAgentSessionTurnBody(
  rawBody: unknown,
  sessionId: string,
): { ok: true; body: AgentTurnRequestBody } | { ok: false; message: string } {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { ok: false, message: 'Invalid agent session turn request body' };
  }

  const record = rawBody as Record<string, unknown>;
  if ('mode' in record || 'mode' in (objectField(record, 'options') ?? {})) {
    return { ok: false, message: 'mode is no longer supported' };
  }
  const options = objectField(record, 'options');
  if (options?.agentMode !== undefined) {
    return { ok: false, message: 'options.agentMode is no longer supported; use top-level agentMode' };
  }
  if (options?.permissionMode !== undefined) {
    return { ok: false, message: 'options.permissionMode is no longer supported; use top-level permissionMode' };
  }
  if (Array.isArray(record.messages)) {
    return {
      ok: true,
      body: {
        ...(record as unknown as AgentTurnRequestBody),
        chatSessionId: sessionId,
      },
    };
  }

  const messageRecord = objectField(record, 'message');
  const text = stringField(messageRecord, 'text') ?? stringField(messageRecord, 'content') ?? stringField(record, 'prompt');
  const images = arrayField(messageRecord, 'images') ?? arrayField(record, 'images');
  if (!text && (!images || images.length === 0)) {
    return { ok: false, message: 'message.text is required' };
  }

  const context = objectField(record, 'context');
  const runtimeOptions = objectField(options, 'runtimeOptions') ?? pickRuntimeOptions(options) ?? record.runtimeOptions;
  const message: FrontendMessage = {
    role: 'user',
    content: text ?? '',
    timestamp: Date.now(),
    ...(images ? { images: images as FrontendMessage['images'] } : {}),
    ...(stringField(messageRecord, 'skillName') ? { skillName: stringField(messageRecord, 'skillName') } : {}),
  };

  return {
    ok: true,
    body: {
      messages: [message],
      chatSessionId: sessionId,
      ...(normalizeAgentMode(record.agentMode) ? { agentMode: normalizeAgentMode(record.agentMode) } : {}),
      ...(normalizeAgentPermissionMode(record.permissionMode) ? { permissionMode: normalizeAgentPermissionMode(record.permissionMode) } : {}),
      ...(stringField(record, 'assistantId') ? { assistantId: stringField(record, 'assistantId') } : {}),
      ...(stringField(context, 'currentFile') ?? stringField(record, 'currentFile')
        ? { currentFile: stringField(context, 'currentFile') ?? stringField(record, 'currentFile') }
        : {}),
      ...(arrayField(context, 'attachedFiles') ?? arrayField(record, 'attachedFiles')
        ? { attachedFiles: stringArrayField(context, 'attachedFiles') ?? stringArrayField(record, 'attachedFiles') ?? [] }
        : {}),
      ...(arrayField(context, 'uploadedFiles') ?? arrayField(record, 'uploadedFiles')
        ? { uploadedFiles: (arrayField(context, 'uploadedFiles') ?? arrayField(record, 'uploadedFiles')) as AgentTurnRequestBody['uploadedFiles'] }
        : {}),
      ...(objectField(context, 'workDir') ?? objectField(record, 'workDir')
        ? { workDir: (objectField(context, 'workDir') ?? objectField(record, 'workDir')) as AgentTurnRequestBody['workDir'] }
        : {}),
      ...(objectField(context, 'contextSelection') ?? objectField(context, 'selection') ?? objectField(record, 'contextSelection')
        ? { contextSelection: (objectField(context, 'contextSelection') ?? objectField(context, 'selection') ?? objectField(record, 'contextSelection')) as AgentTurnRequestBody['contextSelection'] }
        : {}),
      ...(objectField(record, 'runtime') ?? objectField(record, 'selectedRuntime')
        ? { selectedRuntime: (objectField(record, 'runtime') ?? objectField(record, 'selectedRuntime')) as AgentTurnRequestBody['selectedRuntime'] }
        : {}),
      ...(objectField(record, 'runtimeBinding')
        ? { runtimeBinding: objectField(record, 'runtimeBinding') as AgentTurnRequestBody['runtimeBinding'] }
        : {}),
      ...(runtimeOptions && typeof runtimeOptions === 'object' && !Array.isArray(runtimeOptions)
        ? { runtimeOptions: runtimeOptions as AgentTurnRequestBody['runtimeOptions'] }
        : {}),
      ...(objectField(record, 'agentOptions') ?? objectField(options, 'agentOptions')
        ? { agentOptions: (objectField(record, 'agentOptions') ?? objectField(options, 'agentOptions')) as AgentTurnRequestBody['agentOptions'] }
        : {}),
      ...(typeof record.maxSteps === 'number' && Number.isFinite(record.maxSteps) ? { maxSteps: record.maxSteps } : {}),
      ...(stringField(record, 'providerOverride') ? { providerOverride: stringField(record, 'providerOverride') } : {}),
      ...(stringField(record, 'modelOverride') ?? stringField(options, 'modelOverride')
        ? { modelOverride: stringField(record, 'modelOverride') ?? stringField(options, 'modelOverride') }
        : {}),
    },
  };
}

function objectField(record: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function arrayField(record: Record<string, unknown> | undefined, key: string): unknown[] | undefined {
  const value = record?.[key];
  return Array.isArray(value) ? value : undefined;
}

function stringArrayField(record: Record<string, unknown> | undefined, key: string): string[] | undefined {
  const values = arrayField(record, key)?.filter((item): item is string => typeof item === 'string');
  return values && values.length > 0 ? values : undefined;
}

function pickRuntimeOptions(record: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!record) return undefined;
  const runtimeOptions: Record<string, unknown> = {};
  for (const key of ['reasoningEffort', 'modelOverride']) {
    if (record[key] !== undefined) runtimeOptions[key] = record[key];
  }
  return Object.keys(runtimeOptions).length > 0 ? runtimeOptions : undefined;
}
