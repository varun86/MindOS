import {
  MINDOS_SSE_HEADERS,
  type MindOSSSEvent,
} from '../../session/index.js';
import type { MindosPermissionMode } from '../../agent/permission/index.js';

export type MindosAgentTurnMessage = Record<string, unknown>;

export type MindosAgentRuntimeKind = 'mindos' | 'acp' | 'codex' | 'claude';
export type MindosAgentMode = 'default' | 'plan' | 'goal';
export type MindosAgentPermissionMode = MindosPermissionMode;

export type MindosSelectedRuntime = {
  id: string;
  name: string;
  kind: MindosAgentRuntimeKind;
  binaryPath?: string;
  externalSessionId?: string;
};

export type MindosRuntimeSessionBinding = {
  kind: 'codex-thread' | 'claude-session' | 'acp-session';
  runtime: Exclude<MindosAgentRuntimeKind, 'mindos'>;
  runtimeId: string;
  externalSessionId?: string;
  cwd?: string;
  status?: 'active' | 'missing' | 'signed-out' | 'archived' | 'failed';
  updatedAt: number;
};

export type MindosUploadedFile = {
  name: string;
  content: string;
  mimeType?: string;
  size?: number;
  dataBase64?: string;
};

export type MindosSessionWorkDir = {
  path?: string;
  label?: string;
  source?: 'mind-root' | 'project-default' | 'runtime-binding' | 'manual';
  updatedAt?: number;
};

export type MindosContextSpaceRef = {
  path: string;
  label?: string;
  icon?: string;
  source?: 'filesystem' | 'project-default' | 'manual';
};

export type MindosContextAssistantRef = {
  id: string;
  name?: string;
  kind?: 'assistant' | 'agent' | 'skill' | 'team';
  source?: 'local-assistant' | 'builtin' | 'project-default' | 'manual';
};

export type MindosSessionContextSelection = {
  version: 1;
  spaces: MindosContextSpaceRef[];
  assistants: MindosContextAssistantRef[];
  updatedAt?: number;
};

export type MindosNativeRuntimeOptions = {
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  modelOverride?: string;
};

export type MindosAgentTurnRequest = {
  messages: MindosAgentTurnMessage[];
  agentMode?: MindosAgentMode;
  permissionMode?: MindosAgentPermissionMode;
  currentFile?: string;
  attachedFiles?: string[];
  uploadedFiles?: MindosUploadedFile[];
  maxSteps?: number;
  assistantId?: string;
  selectedRuntime?: MindosSelectedRuntime | null;
  runtimeBinding?: MindosRuntimeSessionBinding | null;
  selectedAcpAgent?: { id: string; name: string } | null;
  workDir?: MindosSessionWorkDir;
  contextSelection?: MindosSessionContextSelection;
  runtimeOptions?: MindosNativeRuntimeOptions;
  chatSessionId?: string;
  providerOverride?: string;
  modelOverride?: string;
};

export type AgentTurnStreamHandlerServices = {
  agentTurnStream(input: MindosAgentTurnRequest): AsyncIterable<MindOSSSEvent>;
};

export type AgentTurnStreamHandlerResult =
  | { ok: true; status: 200; headers: Record<string, string>; body: AsyncIterable<MindOSSSEvent> }
  | { ok: false; status: number; body: { error: string } };

export function handleAgentTurnStream(
  body: unknown,
  services: AgentTurnStreamHandlerServices,
): AgentTurnStreamHandlerResult {
  const parsed = parseAgentTurnRequest(body);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    status: 200,
    headers: MINDOS_SSE_HEADERS,
    body: services.agentTurnStream(parsed.body),
  };
}

export function handleAgentSessionTurnStream(
  sessionId: string,
  body: unknown,
  services: AgentTurnStreamHandlerServices,
): AgentTurnStreamHandlerResult {
  const normalized = normalizeAgentSessionTurnBody(sessionId, body);
  if (!normalized.ok) return normalized;
  return handleAgentTurnStream(normalized.body, services);
}

function parseAgentTurnRequest(body: unknown):
  | { ok: true; body: MindosAgentTurnRequest }
  | { ok: false; status: number; body: { error: string } } {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, body: { error: 'Invalid agent turn request body' } };
  }

  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages)) {
    return { ok: false, status: 400, body: { error: 'messages must be an array' } };
  }

  if ('mode' in record) {
    return { ok: false, status: 400, body: { error: 'mode is no longer supported' } };
  }
  if (record.agentMode !== undefined && !isMindosAgentMode(record.agentMode)) {
    return { ok: false, status: 400, body: { error: 'agentMode must be default, plan, or goal' } };
  }
  if (record.permissionMode !== undefined && !isMindosPermissionMode(record.permissionMode)) {
    return { ok: false, status: 400, body: { error: 'permissionMode must be read, ask, auto, or full' } };
  }

  const selectedRuntime = normalizeSelectedRuntime(record);
  const runtimeBinding = normalizeRuntimeSessionBinding(record.runtimeBinding);
  const workDir = normalizeSessionWorkDir(record.workDir);
  const contextSelection = normalizeSessionContextSelection(record.contextSelection);
  const runtimeOptionsRecord = record.runtimeOptions && typeof record.runtimeOptions === 'object' && !Array.isArray(record.runtimeOptions)
    ? record.runtimeOptions as Record<string, unknown>
    : undefined;
  if (runtimeOptionsRecord?.permissionMode !== undefined) {
    return {
      ok: false,
      status: 400,
      body: { error: 'runtimeOptions.permissionMode is no longer supported; use top-level permissionMode' },
    };
  }
  if (runtimeOptionsRecord?.agentMode !== undefined) {
    return {
      ok: false,
      status: 400,
      body: { error: 'runtimeOptions.agentMode is no longer supported; use top-level agentMode' },
    };
  }
  const runtimeOptions = normalizeNativeRuntimeOptions(record.runtimeOptions);

  return {
    ok: true,
    body: {
      messages: record.messages.filter((message): message is MindosAgentTurnMessage => !!message && typeof message === 'object') as MindosAgentTurnMessage[],
      ...(isMindosAgentMode(record.agentMode) ? { agentMode: record.agentMode } : {}),
      ...(isMindosPermissionMode(record.permissionMode) ? { permissionMode: record.permissionMode } : {}),
      ...(typeof record.currentFile === 'string' ? { currentFile: record.currentFile } : {}),
      ...(Array.isArray(record.attachedFiles) ? { attachedFiles: record.attachedFiles.filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(record.uploadedFiles) ? { uploadedFiles: normalizeUploadedFiles(record.uploadedFiles) } : {}),
      ...(typeof record.maxSteps === 'number' && Number.isFinite(record.maxSteps) ? { maxSteps: record.maxSteps } : {}),
      ...(typeof record.assistantId === 'string' && record.assistantId.trim() ? { assistantId: record.assistantId.trim() } : {}),
      ...(selectedRuntime !== undefined ? { selectedRuntime } : {}),
      ...(runtimeBinding !== undefined ? { runtimeBinding } : {}),
      ...(isSelectedAcpAgent(record.selectedAcpAgent) ? { selectedAcpAgent: record.selectedAcpAgent } : {}),
      ...(workDir !== undefined ? { workDir } : {}),
      ...(contextSelection !== undefined ? { contextSelection } : {}),
      ...(runtimeOptions !== undefined ? { runtimeOptions } : {}),
      ...(typeof record.chatSessionId === 'string' && record.chatSessionId.trim() ? { chatSessionId: record.chatSessionId.trim() } : {}),
      ...(typeof record.providerOverride === 'string' ? { providerOverride: record.providerOverride } : {}),
      ...(typeof record.modelOverride === 'string' ? { modelOverride: record.modelOverride } : {}),
    },
  };
}

function normalizeAgentSessionTurnBody(sessionId: string, body: unknown):
  | { ok: true; body: unknown }
  | { ok: false; status: number; body: { error: string } } {
  if (!sessionId.trim()) {
    return { ok: false, status: 400, body: { error: 'sessionId is required' } };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, body: { error: 'Invalid agent session turn request body' } };
  }

  const record = body as Record<string, unknown>;
  if ('mode' in record || 'mode' in (objectField(record, 'options') ?? {})) {
    return { ok: false, status: 400, body: { error: 'mode is no longer supported' } };
  }
  const options = objectField(record, 'options');
  if (options?.agentMode !== undefined) {
    return { ok: false, status: 400, body: { error: 'options.agentMode is no longer supported; use top-level agentMode' } };
  }
  if (options?.permissionMode !== undefined) {
    return { ok: false, status: 400, body: { error: 'options.permissionMode is no longer supported; use top-level permissionMode' } };
  }
  if (Array.isArray(record.messages)) {
    return { ok: true, body: { ...record, chatSessionId: sessionId } };
  }

  const message = objectField(record, 'message');
  const text = stringField(message, 'text') ?? stringField(message, 'content') ?? stringField(record, 'prompt');
  const images = arrayField(message, 'images') ?? arrayField(record, 'images');
  if (!text && (!images || images.length === 0)) {
    return { ok: false, status: 400, body: { error: 'message.text is required' } };
  }

  const context = objectField(record, 'context');
  const runtimeOptions = objectField(options, 'runtimeOptions') ?? pickRuntimeOptions(options) ?? objectField(record, 'runtimeOptions');
  return {
    ok: true,
    body: {
      messages: [{
        role: 'user',
        content: text ?? '',
        timestamp: Date.now(),
        ...(images ? { images } : {}),
        ...(stringField(message, 'skillName') ? { skillName: stringField(message, 'skillName') } : {}),
      }],
      chatSessionId: sessionId,
      ...(isMindosAgentMode(record.agentMode) ? { agentMode: record.agentMode } : {}),
      ...(isMindosPermissionMode(record.permissionMode) ? { permissionMode: record.permissionMode } : {}),
      ...(stringField(record, 'assistantId') ? { assistantId: stringField(record, 'assistantId') } : {}),
      ...(stringField(context, 'currentFile') ?? stringField(record, 'currentFile')
        ? { currentFile: stringField(context, 'currentFile') ?? stringField(record, 'currentFile') }
        : {}),
      ...(arrayField(context, 'attachedFiles') ?? arrayField(record, 'attachedFiles')
        ? { attachedFiles: stringArrayField(context, 'attachedFiles') ?? stringArrayField(record, 'attachedFiles') ?? [] }
        : {}),
      ...(arrayField(context, 'uploadedFiles') ?? arrayField(record, 'uploadedFiles')
        ? { uploadedFiles: arrayField(context, 'uploadedFiles') ?? arrayField(record, 'uploadedFiles') }
        : {}),
      ...(objectField(context, 'workDir') ?? objectField(record, 'workDir')
        ? { workDir: objectField(context, 'workDir') ?? objectField(record, 'workDir') }
        : {}),
      ...(objectField(context, 'contextSelection') ?? objectField(context, 'selection') ?? objectField(record, 'contextSelection')
        ? { contextSelection: objectField(context, 'contextSelection') ?? objectField(context, 'selection') ?? objectField(record, 'contextSelection') }
        : {}),
      ...(objectField(record, 'runtime') ?? objectField(record, 'selectedRuntime')
        ? { selectedRuntime: objectField(record, 'runtime') ?? objectField(record, 'selectedRuntime') }
        : {}),
      ...(objectField(record, 'runtimeBinding') ? { runtimeBinding: objectField(record, 'runtimeBinding') } : {}),
      ...(runtimeOptions ? { runtimeOptions } : {}),
      ...(objectField(record, 'agentOptions') ?? objectField(options, 'agentOptions')
        ? { agentOptions: objectField(record, 'agentOptions') ?? objectField(options, 'agentOptions') }
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

function normalizeUploadedFiles(files: unknown[]): MindosUploadedFile[] {
  return files
    .filter((file): file is Record<string, unknown> => !!file && typeof file === 'object')
    .filter((file) => typeof file.name === 'string' && typeof file.content === 'string')
    .map((file) => ({
      name: file.name as string,
      content: file.content as string,
      ...(typeof file.mimeType === 'string' && file.mimeType.trim() ? { mimeType: file.mimeType } : {}),
      ...(typeof file.size === 'number' && Number.isFinite(file.size) ? { size: file.size } : {}),
      ...(typeof file.dataBase64 === 'string' && file.dataBase64 ? { dataBase64: file.dataBase64 } : {}),
    }));
}

function cleanString(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeSessionWorkDir(value: unknown): MindosSessionWorkDir | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const source = isSessionWorkDirSource(record.source) ? record.source : undefined;
  const path = cleanString(record.path, 1200);
  const label = cleanString(record.label, 160);
  const updatedAt = cleanNumber(record.updatedAt);
  if (!source && !path && !label && updatedAt === undefined) return undefined;
  return {
    ...(source ? { source } : {}),
    ...(path ? { path } : {}),
    ...(label ? { label } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}

function normalizeSessionContextSelection(value: unknown): MindosSessionContextSelection | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const updatedAt = cleanNumber(record.updatedAt);
  return {
    version: 1,
    spaces: Array.isArray(record.spaces)
      ? record.spaces.map(normalizeContextSpaceRef).filter((item): item is MindosContextSpaceRef => item !== null).slice(0, 8)
      : [],
    assistants: Array.isArray(record.assistants)
      ? record.assistants.map(normalizeContextAssistantRef).filter((item): item is MindosContextAssistantRef => item !== null).slice(0, 6)
      : [],
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}

function normalizeContextSpaceRef(value: unknown): MindosContextSpaceRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const spacePath = cleanString(record.path, 400)?.replace(/\\/g, '/').trim();
  const label = cleanString(record.label, 160);
  const icon = cleanString(record.icon, 40);
  if (!spacePath) return null;
  return {
    path: spacePath,
    ...(label ? { label } : {}),
    ...(icon ? { icon } : {}),
    ...(isContextSpaceSource(record.source) ? { source: record.source } : {}),
  };
}

function normalizeContextAssistantRef(value: unknown): MindosContextAssistantRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = cleanString(record.id, 120)?.toLowerCase();
  const name = cleanString(record.name, 160);
  if (!id) return null;
  return {
    id,
    ...(name ? { name } : {}),
    ...(isContextAssistantKind(record.kind) ? { kind: record.kind } : {}),
    ...(isContextAssistantSource(record.source) ? { source: record.source } : {}),
  };
}

function normalizeNativeRuntimeOptions(value: unknown): MindosNativeRuntimeOptions | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const reasoningEffort = isNativeReasoningEffort(record.reasoningEffort) ? record.reasoningEffort : undefined;
  const modelOverride = cleanString(record.modelOverride, 240);
  if (!reasoningEffort && !modelOverride) return undefined;
  return {
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(modelOverride ? { modelOverride } : {}),
  };
}

function isMindosAgentMode(value: unknown): value is MindosAgentMode {
  return value === 'default' || value === 'plan' || value === 'goal';
}

function isMindosPermissionMode(value: unknown): value is MindosPermissionMode {
  return value === 'read' || value === 'ask' || value === 'auto' || value === 'full';
}

function isSelectedAcpAgent(value: unknown): value is { id: string; name: string } | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.name === 'string';
}

function normalizeRuntimeSessionBinding(value: unknown): MindosRuntimeSessionBinding | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (!isRuntimeSessionKind(record.kind) || !isExternalRuntimeKind(record.runtime)) return undefined;
  if (typeof record.runtimeId !== 'string' || typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return undefined;
  const binding: MindosRuntimeSessionBinding = {
    kind: record.kind,
    runtime: record.runtime,
    runtimeId: record.runtimeId,
    updatedAt: record.updatedAt,
  };
  if (typeof record.externalSessionId === 'string') binding.externalSessionId = record.externalSessionId;
  if (typeof record.cwd === 'string') binding.cwd = record.cwd;
  if (isRuntimeSessionStatus(record.status)) binding.status = record.status;
  return binding;
}

function isRuntimeSessionKind(value: unknown): value is MindosRuntimeSessionBinding['kind'] {
  return value === 'codex-thread' || value === 'claude-session' || value === 'acp-session';
}

function isExternalRuntimeKind(value: unknown): value is MindosRuntimeSessionBinding['runtime'] {
  return value === 'acp' || value === 'codex' || value === 'claude';
}

function isRuntimeSessionStatus(value: unknown): value is NonNullable<MindosRuntimeSessionBinding['status']> {
  return value === 'active' || value === 'missing' || value === 'signed-out' || value === 'archived' || value === 'failed';
}

function normalizeSelectedRuntime(record: Record<string, unknown>): MindosSelectedRuntime | null | undefined {
  if (record.selectedRuntime === null) return null;
  if (isSelectedRuntime(record.selectedRuntime)) {
    const runtime = record.selectedRuntime as Record<string, unknown>;
    return {
      id: runtime.id as string,
      name: runtime.name as string,
      kind: runtime.kind as MindosAgentRuntimeKind,
      ...(typeof runtime.binaryPath === 'string' && runtime.binaryPath.trim()
        ? { binaryPath: runtime.binaryPath }
        : {}),
      ...(typeof runtime.externalSessionId === 'string' && runtime.externalSessionId
        ? { externalSessionId: runtime.externalSessionId }
        : {}),
    };
  }

  if (!isSelectedAcpAgent(record.selectedAcpAgent) || record.selectedAcpAgent === null) {
    return record.selectedAcpAgent === null ? null : undefined;
  }

  return {
    ...record.selectedAcpAgent,
    kind: 'acp',
  };
}

function isSelectedRuntime(value: unknown): value is MindosSelectedRuntime {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string'
    && typeof record.name === 'string'
    && isAgentRuntimeKind(record.kind)
  );
}

function isAgentRuntimeKind(value: unknown): value is MindosAgentRuntimeKind {
  return value === 'mindos' || value === 'acp' || value === 'codex' || value === 'claude';
}

function isSessionWorkDirSource(value: unknown): value is NonNullable<MindosSessionWorkDir['source']> {
  return value === 'mind-root' || value === 'project-default' || value === 'runtime-binding' || value === 'manual';
}

function isContextSpaceSource(value: unknown): value is NonNullable<MindosContextSpaceRef['source']> {
  return value === 'filesystem' || value === 'project-default' || value === 'manual';
}

function isContextAssistantKind(value: unknown): value is NonNullable<MindosContextAssistantRef['kind']> {
  return value === 'assistant' || value === 'agent' || value === 'skill' || value === 'team';
}

function isContextAssistantSource(value: unknown): value is NonNullable<MindosContextAssistantRef['source']> {
  return value === 'local-assistant' || value === 'builtin' || value === 'project-default' || value === 'manual';
}

function isNativeReasoningEffort(value: unknown): value is NonNullable<MindosNativeRuntimeOptions['reasoningEffort']> {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh';
}
