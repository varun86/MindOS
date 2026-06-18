import type {
  ChatSession,
  ContextAssistantRef,
  ContextSpaceRef,
  SessionContextSelection,
  SessionWorkDir,
  SessionWorkDirSource,
} from '@/lib/types';

export const MAX_CONTEXT_SPACES = 8;
export const MAX_CONTEXT_ASSISTANTS = 6;

const WORKDIR_SOURCES = new Set<SessionWorkDirSource>([
  'mind-root',
  'project-default',
  'runtime-binding',
  'manual',
]);

const ASSISTANT_KINDS = new Set<NonNullable<ContextAssistantRef['kind']>>([
  'assistant',
  'agent',
  'skill',
  'team',
]);

const ASSISTANT_SOURCES = new Set<NonNullable<ContextAssistantRef['source']>>([
  'local-assistant',
  'builtin',
  'project-default',
  'manual',
]);

const SPACE_SOURCES = new Set<NonNullable<ContextSpaceRef['source']>>([
  'filesystem',
  'project-default',
  'manual',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function cleanSpacePath(value: unknown): string | undefined {
  const raw = cleanString(value, 400);
  if (!raw) return undefined;
  return raw.replace(/\\/g, '/').trim() || undefined;
}

function cleanAssistantId(value: unknown): string | undefined {
  const raw = cleanString(value, 120);
  if (!raw) return undefined;
  return raw.toLowerCase();
}

function cleanTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

export function defaultSessionWorkDir(updatedAt?: number): SessionWorkDir {
  return {
    source: 'mind-root',
    label: 'Mind root',
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function defaultSessionContextSelection(updatedAt?: number): SessionContextSelection {
  return {
    version: 1,
    spaces: [],
    assistants: [],
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function normalizeSessionWorkDirForClient(input: unknown, now?: number): SessionWorkDir {
  if (!isRecord(input)) return defaultSessionWorkDir(now);
  const sourceRaw = cleanString(input.source, 80);
  const source: SessionWorkDirSource = sourceRaw && WORKDIR_SOURCES.has(sourceRaw as SessionWorkDirSource)
    ? sourceRaw as SessionWorkDirSource
    : 'mind-root';
  const path = cleanString(input.path, 1200);
  const label = cleanString(input.label, 160);
  const updatedAt = cleanTimestamp(input.updatedAt) ?? now;
  return {
    source,
    ...(path ? { path } : {}),
    ...(label ? { label } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function normalizeSpaceRef(input: unknown): ContextSpaceRef | null {
  if (!isRecord(input)) return null;
  const path = cleanSpacePath(input.path);
  if (!path) return null;
  const sourceRaw = cleanString(input.source, 80);
  const source = sourceRaw && SPACE_SOURCES.has(sourceRaw as NonNullable<ContextSpaceRef['source']>)
    ? sourceRaw as NonNullable<ContextSpaceRef['source']>
    : undefined;
  const label = cleanString(input.label, 160);
  const icon = cleanString(input.icon, 40);
  return {
    path,
    ...(label ? { label } : {}),
    ...(icon ? { icon } : {}),
    ...(source ? { source } : {}),
  };
}

function normalizeAssistantRef(input: unknown): ContextAssistantRef | null {
  if (!isRecord(input)) return null;
  const id = cleanAssistantId(input.id);
  if (!id) return null;
  const kindRaw = cleanString(input.kind, 80);
  const sourceRaw = cleanString(input.source, 80);
  const kind = kindRaw && ASSISTANT_KINDS.has(kindRaw as NonNullable<ContextAssistantRef['kind']>)
    ? kindRaw as NonNullable<ContextAssistantRef['kind']>
    : 'assistant';
  const source = sourceRaw && ASSISTANT_SOURCES.has(sourceRaw as NonNullable<ContextAssistantRef['source']>)
    ? sourceRaw as NonNullable<ContextAssistantRef['source']>
    : undefined;
  const name = cleanString(input.name, 160);
  return {
    id,
    kind,
    ...(name ? { name } : {}),
    ...(source ? { source } : {}),
  };
}

export function normalizeSessionContextSelectionForClient(input: unknown, now?: number): SessionContextSelection {
  const record = isRecord(input) ? input : {};
  const spaces: ContextSpaceRef[] = [];
  const seenSpaces = new Set<string>();
  for (const item of Array.isArray(record.spaces) ? record.spaces : []) {
    const normalized = normalizeSpaceRef(item);
    if (!normalized || seenSpaces.has(normalized.path)) continue;
    seenSpaces.add(normalized.path);
    spaces.push(normalized);
    if (spaces.length >= MAX_CONTEXT_SPACES) break;
  }

  const assistants: ContextAssistantRef[] = [];
  const seenAssistants = new Set<string>();
  for (const item of Array.isArray(record.assistants) ? record.assistants : []) {
    const normalized = normalizeAssistantRef(item);
    if (!normalized || seenAssistants.has(normalized.id)) continue;
    seenAssistants.add(normalized.id);
    assistants.push(normalized);
    if (assistants.length >= MAX_CONTEXT_ASSISTANTS) break;
  }

  const updatedAt = cleanTimestamp(record.updatedAt) ?? now;
  return {
    version: 1,
    spaces,
    assistants,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function getRuntimeBindingCwd(session: Pick<ChatSession, 'runtimeSessionBinding' | 'externalAgentBinding'>): string | undefined {
  return session.runtimeSessionBinding?.cwd?.trim()
    || session.externalAgentBinding?.cwd?.trim()
    || undefined;
}

export function getEffectiveSessionWorkDir(session: Pick<ChatSession, 'workDir' | 'runtimeSessionBinding' | 'externalAgentBinding'>): SessionWorkDir {
  const bindingCwd = getRuntimeBindingCwd(session);
  if (bindingCwd) {
    return {
      source: 'runtime-binding',
      path: bindingCwd,
      label: bindingCwd.split(/[\\/]/).filter(Boolean).pop() ?? bindingCwd,
      updatedAt: session.workDir?.updatedAt,
    };
  }
  return normalizeSessionWorkDirForClient(session.workDir);
}

export function getEffectiveSessionContextSelection(session: Pick<ChatSession, 'contextSelection'>): SessionContextSelection {
  return normalizeSessionContextSelectionForClient(session.contextSelection);
}

export function canEditSessionWorkDir(
  session: Pick<ChatSession, 'messages' | 'runtimeSessionBinding' | 'externalAgentBinding'>,
  options: { hasLiveRun?: boolean } = {},
): boolean {
  return (
    session.messages.length === 0
    && !session.runtimeSessionBinding?.externalSessionId?.trim()
    && !session.externalAgentBinding?.externalSessionId?.trim()
    && !options.hasLiveRun
  );
}
