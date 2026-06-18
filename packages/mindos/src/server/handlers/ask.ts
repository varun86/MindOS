import {
  MINDOS_SSE_HEADERS,
  type MindOSSSEvent,
} from '../../session/index.js';

export type MindosAskMessage = Record<string, unknown>;

export type MindosAgentRuntimeKind = 'mindos' | 'acp' | 'codex' | 'claude';

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
  permissionMode?: 'agent' | 'readonly';
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  modelOverride?: string;
};

export type MindosAskStreamRequest = {
  messages: MindosAskMessage[];
  currentFile?: string;
  attachedFiles?: string[];
  uploadedFiles?: MindosUploadedFile[];
  maxSteps?: number;
  mode?: 'agent' | 'organize';
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

export type AskStreamHandlerServices = {
  askStream(input: MindosAskStreamRequest): AsyncIterable<MindOSSSEvent>;
};

export type AskStreamHandlerResult =
  | { ok: true; status: 200; headers: Record<string, string>; body: AsyncIterable<MindOSSSEvent> }
  | { ok: false; status: number; body: { error: string } };

export function handleAskStream(
  body: unknown,
  services: AskStreamHandlerServices,
): AskStreamHandlerResult {
  const parsed = parseAskStreamRequest(body);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    status: 200,
    headers: MINDOS_SSE_HEADERS,
    body: services.askStream(parsed.body),
  };
}

function parseAskStreamRequest(body: unknown):
  | { ok: true; body: MindosAskStreamRequest }
  | { ok: false; status: number; body: { error: string } } {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, body: { error: 'Invalid ask request body' } };
  }

  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages)) {
    return { ok: false, status: 400, body: { error: 'messages must be an array' } };
  }

  const mode = record.mode;
  if (mode !== undefined && mode !== 'agent' && mode !== 'organize') {
    return { ok: false, status: 400, body: { error: 'mode must be agent or organize' } };
  }

  const selectedRuntime = normalizeSelectedRuntime(record);
  const runtimeBinding = normalizeRuntimeSessionBinding(record.runtimeBinding);
  const workDir = normalizeSessionWorkDir(record.workDir);
  const contextSelection = normalizeSessionContextSelection(record.contextSelection);
  const runtimeOptions = normalizeNativeRuntimeOptions(record.runtimeOptions);

  return {
    ok: true,
    body: {
      messages: record.messages.filter((message): message is MindosAskMessage => !!message && typeof message === 'object') as MindosAskMessage[],
      ...(typeof record.currentFile === 'string' ? { currentFile: record.currentFile } : {}),
      ...(Array.isArray(record.attachedFiles) ? { attachedFiles: record.attachedFiles.filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(record.uploadedFiles) ? { uploadedFiles: normalizeUploadedFiles(record.uploadedFiles) } : {}),
      ...(typeof record.maxSteps === 'number' && Number.isFinite(record.maxSteps) ? { maxSteps: record.maxSteps } : {}),
      ...(mode ? { mode } : {}),
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
  const permissionMode = record.permissionMode === 'agent' || record.permissionMode === 'readonly'
    ? record.permissionMode
    : undefined;
  const reasoningEffort = isNativeReasoningEffort(record.reasoningEffort) ? record.reasoningEffort : undefined;
  const modelOverride = cleanString(record.modelOverride, 240);
  if (!permissionMode && !reasoningEffort && !modelOverride) return undefined;
  return {
    ...(permissionMode ? { permissionMode } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(modelOverride ? { modelOverride } : {}),
  };
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
