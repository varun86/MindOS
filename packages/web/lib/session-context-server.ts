import fs from 'node:fs';
import path from 'node:path';
import type {
  ChatSession,
  ContextAssistantRef,
  ContextSpaceRef,
  RuntimeSessionBinding,
  SessionContextSelection,
  SessionWorkDir,
} from '@/lib/types';
import {
  defaultSessionContextSelection,
  defaultSessionWorkDir,
  getEffectiveSessionContextSelection,
  getEffectiveSessionWorkDir,
  getRuntimeBindingCwd,
  normalizeSessionContextSelectionForClient,
  normalizeSessionWorkDirForClient,
} from '@/lib/session-context';
import {
  handleAskSessionsGet,
  isMindosBuiltinAssistantId,
  listLocalAssistants,
  type MindosChatSession,
} from '@geminilight/mindos/server';

export type ResolvedSessionWorkDir = {
  path: string;
  label: string;
  source: SessionWorkDir['source'];
};

export type ResolvedContextSpace = {
  path: string;
  label: string;
};

export type ResolvedContextAssistant = {
  id: string;
  name: string;
  kind: NonNullable<ContextAssistantRef['kind']>;
};

export type SessionContextIssue = {
  code:
    | 'workdir_missing'
    | 'workdir_not_directory'
    | 'workdir_outside_allowed_roots'
    | 'workdir_changed_after_history'
    | 'runtime_cwd_locked'
    | 'runtime_resume_untrusted'
    | 'space_missing'
    | 'space_outside_mind_root'
    | 'assistant_missing'
    | 'assistant_unavailable';
  severity: 'info' | 'warning' | 'error';
  message: string;
  target?: string;
};

export type SessionContextResolution = {
  requestedWorkDir: SessionWorkDir;
  requestedSelection: SessionContextSelection;
  resolvedWorkDir: ResolvedSessionWorkDir;
  resolvedSelection: {
    version: 1;
    spaces: ResolvedContextSpace[];
    assistants: ResolvedContextAssistant[];
  };
  issues: SessionContextIssue[];
};

export class SessionContextResolutionError extends Error {
  readonly code: SessionContextIssue['code'];
  readonly issues: SessionContextIssue[];

  constructor(issue: SessionContextIssue) {
    super(issue.message);
    this.name = 'SessionContextResolutionError';
    this.code = issue.code;
    this.issues = [issue];
  }
}

type PriorRunSummary = {
  cwd?: string;
  externalSessionId?: string;
  archiveSessionId?: string;
};

type ResolveSessionContextInput = {
  requestedWorkDir: unknown;
  requestedSelection: unknown;
  mindRoot: string;
  projectRoot: string;
  priorSession?: ChatSession | null;
  requestRuntimeBinding?: RuntimeSessionBinding | null;
  requestExternalSessionId?: string | null;
  priorRuns?: PriorRunSummary[];
  allowedWorkDirRoots?: string[];
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

const SAFE_ASSISTANT_ID = /^[a-z0-9][a-z0-9-]*$/;

function basenameLabel(value: string): string {
  return path.basename(value) || value;
}

function titleizeId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ') || id;
}

function realpathExistingDirectory(inputPath: string, issueCode: SessionContextIssue['code']): string {
  let real: string;
  try {
    real = fs.realpathSync(inputPath);
  } catch {
    throw new SessionContextResolutionError({
      code: issueCode,
      severity: 'error',
      message: `WorkDir does not exist: ${inputPath}`,
      target: inputPath,
    });
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(real);
  } catch {
    throw new SessionContextResolutionError({
      code: issueCode,
      severity: 'error',
      message: `WorkDir cannot be inspected: ${inputPath}`,
      target: inputPath,
    });
  }
  if (!stat.isDirectory()) {
    throw new SessionContextResolutionError({
      code: 'workdir_not_directory',
      severity: 'error',
      message: `WorkDir is not a directory: ${inputPath}`,
      target: inputPath,
    });
  }
  return real;
}

function isSameOrInside(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function envAllowedWorkDirRoots(env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined): string[] {
  const raw = env?.MINDOS_ALLOWED_WORKDIRS;
  if (!raw) return [];
  return raw
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAllowedRoots(input: {
  mindRoot: string;
  projectRoot: string;
  priorSession?: ChatSession | null;
  priorRuns?: PriorRunSummary[];
  allowedWorkDirRoots?: string[];
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): string[] {
  const roots = [
    input.mindRoot,
    input.projectRoot,
    getRuntimeBindingCwd(input.priorSession ?? {}),
    ...(input.priorRuns ?? []).map((run) => run.cwd).filter((cwd): cwd is string => Boolean(cwd?.trim())),
    ...(input.allowedWorkDirRoots ?? []),
    ...envAllowedWorkDirRoots(input.env),
  ];
  const normalized: string[] = [];
  for (const root of roots) {
    if (!root?.trim()) continue;
    try {
      const real = fs.realpathSync(path.resolve(root));
      if (!normalized.some((existing) => existing === real)) normalized.push(real);
    } catch {
      // Ignore stale configured roots. The requested WorkDir still has to resolve.
    }
  }
  return normalized;
}

function resolveRequestedPath(requested: SessionWorkDir, defaults: { mindRoot: string; projectRoot: string }): string {
  if (requested.source === 'mind-root') return defaults.mindRoot;
  if (!requested.path?.trim()) {
    throw new SessionContextResolutionError({
      code: 'workdir_missing',
      severity: 'error',
      message: `WorkDir path is required for ${requested.source} sessions.`,
    });
  }
  return path.isAbsolute(requested.path)
    ? requested.path
    : path.resolve(defaults.projectRoot, requested.path);
}

function resolveWorkDir(input: ResolveSessionContextInput, requested: SessionWorkDir): ResolvedSessionWorkDir {
  const requestedPath = resolveRequestedPath(requested, input);
  const resolvedPath = realpathExistingDirectory(requestedPath, 'workdir_missing');
  const allowedRoots = normalizeAllowedRoots(input);
  if (!allowedRoots.some((root) => isSameOrInside(resolvedPath, root))) {
    throw new SessionContextResolutionError({
      code: 'workdir_outside_allowed_roots',
      severity: 'error',
      message: `WorkDir is outside allowed roots: ${requestedPath}`,
      target: requestedPath,
    });
  }
  return {
    path: resolvedPath,
    label: basenameLabel(resolvedPath),
    source: requested.source,
  };
}

function sessionHasConversation(session: ChatSession | null | undefined): boolean {
  return Boolean(session?.messages?.length);
}

function sessionHasRuntimeBinding(session: ChatSession | null | undefined): boolean {
  return Boolean(
    session?.runtimeSessionBinding?.externalSessionId?.trim()
    || session?.externalAgentBinding?.externalSessionId?.trim(),
  );
}

function priorSessionHasExternalSessionId(session: ChatSession | null | undefined, externalSessionId: string): boolean {
  return Boolean(
    session?.runtimeSessionBinding?.externalSessionId?.trim() === externalSessionId
    || session?.externalAgentBinding?.externalSessionId?.trim() === externalSessionId,
  );
}

function priorRunHasExternalSessionId(runs: PriorRunSummary[] | undefined, externalSessionId: string): boolean {
  return Boolean(runs?.some((run) => (
    run.externalSessionId?.trim() === externalSessionId
    || run.archiveSessionId?.trim() === externalSessionId
  )));
}

function trustedLockedWorkDir(input: ResolveSessionContextInput): string | undefined {
  const priorBindingCwd = getRuntimeBindingCwd(input.priorSession ?? {});
  if (priorBindingCwd) return priorBindingCwd;
  const priorRunCwd = input.priorRuns?.find((run) => run.cwd?.trim())?.cwd;
  if (priorRunCwd) return priorRunCwd;
  const priorWorkDir = input.priorSession ? getEffectiveSessionWorkDir(input.priorSession).path : undefined;
  if (priorWorkDir) return priorWorkDir;
  return undefined;
}

function assertTrustedRuntimeResume(input: ResolveSessionContextInput): void {
  const externalSessionId = input.requestExternalSessionId?.trim();
  if (!externalSessionId) return;
  if (
    priorSessionHasExternalSessionId(input.priorSession, externalSessionId)
    || priorRunHasExternalSessionId(input.priorRuns, externalSessionId)
  ) {
    return;
  }

  throw new SessionContextResolutionError({
    code: 'runtime_resume_untrusted',
    severity: 'error',
    message: 'WorkDir cannot resume an untrusted runtime session. Attach the runtime session first, or start a new session.',
    target: externalSessionId,
  });
}

function assertWorkDirNotMutatedAfterLock(input: ResolveSessionContextInput, resolvedWorkDir: ResolvedSessionWorkDir): void {
  const requestBindingCwd = input.requestRuntimeBinding?.externalSessionId?.trim()
    ? input.requestRuntimeBinding.cwd?.trim()
    : undefined;
  const hasPriorRuns = (input.priorRuns ?? []).length > 0;
  const locked = sessionHasConversation(input.priorSession)
    || sessionHasRuntimeBinding(input.priorSession)
    || hasPriorRuns
    || Boolean(requestBindingCwd);
  if (!locked) return;

  const expectedRaw = trustedLockedWorkDir(input) ?? requestBindingCwd ?? input.mindRoot;
  const expected = realpathExistingDirectory(expectedRaw, 'runtime_cwd_locked');
  if (expected !== resolvedWorkDir.path) {
    throw new SessionContextResolutionError({
      code: requestBindingCwd ? 'runtime_cwd_locked' : 'workdir_changed_after_history',
      severity: 'error',
      message: `WorkDir is locked for this session. Expected ${expected}, got ${resolvedWorkDir.path}.`,
      target: resolvedWorkDir.path,
    });
  }
}

function validateSpacePath(space: ContextSpaceRef, mindRootReal: string): { real?: string; rel?: string; issue?: SessionContextIssue } {
  const raw = space.path.trim();
  const normalized = raw.replace(/\\/g, '/').trim();
  if (
    !normalized
    || path.posix.isAbsolute(normalized)
    || path.win32.isAbsolute(raw)
    || path.win32.isAbsolute(normalized)
    || normalized.split('/').some((part) => part === '..' || part === '.')
  ) {
    return {
      issue: {
        code: 'space_outside_mind_root',
        severity: 'warning',
        message: `Space path is not allowed: ${space.path}`,
        target: space.path,
      },
    };
  }
  const rel = normalized.replace(/\/+$/g, '');
  if (!rel) {
    return {
      issue: {
        code: 'space_outside_mind_root',
        severity: 'warning',
        message: `Space path is not allowed: ${space.path}`,
        target: space.path,
      },
    };
  }
  if (rel === '.mindos' || rel.startsWith('.mindos/')) {
    return {
      issue: {
        code: 'space_outside_mind_root',
        severity: 'warning',
        message: `System paths cannot be selected as Spaces: ${space.path}`,
        target: space.path,
      },
    };
  }
  const abs = path.join(mindRootReal, rel);
  let real: string;
  try {
    real = fs.realpathSync(abs);
  } catch {
    return {
      issue: {
        code: 'space_missing',
        severity: 'warning',
        message: `Selected Space is missing: ${rel}`,
        target: rel,
      },
    };
  }
  if (!isSameOrInside(real, mindRootReal)) {
    return {
      issue: {
        code: 'space_outside_mind_root',
        severity: 'warning',
        message: `Space path resolves outside the Mind root: ${rel}`,
        target: rel,
      },
    };
  }
  try {
    if (!fs.statSync(real).isDirectory()) {
      return {
        issue: {
          code: 'space_missing',
          severity: 'warning',
          message: `Selected Space is not a directory: ${rel}`,
          target: rel,
        },
      };
    }
  } catch {
    return {
      issue: {
        code: 'space_missing',
        severity: 'warning',
        message: `Selected Space cannot be inspected: ${rel}`,
        target: rel,
      },
    };
  }
  return { real, rel };
}

function resolveSpaces(selection: SessionContextSelection, mindRoot: string): {
  spaces: ResolvedContextSpace[];
  issues: SessionContextIssue[];
} {
  const mindRootReal = fs.realpathSync(mindRoot);
  const spaces: ResolvedContextSpace[] = [];
  const issues: SessionContextIssue[] = [];
  const seen = new Set<string>();
  for (const space of selection.spaces) {
    const validation = validateSpacePath(space, mindRootReal);
    if (validation.issue) {
      issues.push(validation.issue);
      continue;
    }
    const rel = validation.rel ?? space.path;
    if (seen.has(rel)) continue;
    seen.add(rel);
    spaces.push({
      path: rel,
      label: path.posix.basename(rel),
    });
  }
  return { spaces, issues };
}

function resolveAssistants(selection: SessionContextSelection, mindRoot: string): {
  assistants: ResolvedContextAssistant[];
  issues: SessionContextIssue[];
} {
  const issues: SessionContextIssue[] = [];
  let assistantMap = new Map<string, { id: string; name: string; health?: { state: string } }>();
  try {
    assistantMap = new Map(listLocalAssistants(mindRoot).map((assistant) => [assistant.id, assistant]));
  } catch {
    assistantMap = new Map();
  }

  const assistants: ResolvedContextAssistant[] = [];
  for (const assistant of selection.assistants) {
    if (!SAFE_ASSISTANT_ID.test(assistant.id)) {
      issues.push({
        code: 'assistant_unavailable',
        severity: 'warning',
        message: `Assistant id is invalid: ${assistant.id}`,
        target: assistant.id,
      });
      continue;
    }
    const local = assistantMap.get(assistant.id);
    if (!local && !isMindosBuiltinAssistantId(assistant.id)) {
      issues.push({
        code: 'assistant_missing',
        severity: 'warning',
        message: `Selected Assistant is missing: ${assistant.id}`,
        target: assistant.id,
      });
      continue;
    }
    assistants.push({
      id: assistant.id,
      name: local?.name || titleizeId(assistant.id),
      kind: assistant.kind ?? 'assistant',
    });
  }
  return { assistants, issues };
}

export function resolveSessionContext(input: ResolveSessionContextInput): SessionContextResolution {
  const requestedWorkDir = normalizeSessionWorkDirForClient(input.requestedWorkDir);
  const requestedSelection = normalizeSessionContextSelectionForClient(input.requestedSelection);
  const resolvedWorkDir = resolveWorkDir(input, requestedWorkDir);
  assertTrustedRuntimeResume(input);
  assertWorkDirNotMutatedAfterLock(input, resolvedWorkDir);
  const spaceResolution = resolveSpaces(requestedSelection, input.mindRoot);
  const assistantResolution = resolveAssistants(requestedSelection, input.mindRoot);
  return {
    requestedWorkDir,
    requestedSelection,
    resolvedWorkDir,
    resolvedSelection: {
      version: 1,
      spaces: spaceResolution.spaces,
      assistants: assistantResolution.assistants,
    },
    issues: [...spaceResolution.issues, ...assistantResolution.issues],
  };
}

function isChatSession(value: MindosChatSession | unknown): value is ChatSession {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as { id?: unknown }).id === 'string'
    && Array.isArray((value as { messages?: unknown }).messages)
  );
}

export function readPersistedAskSession(sessionId: string | undefined): ChatSession | null {
  if (!sessionId) return null;
  const response = handleAskSessionsGet();
  const sessions = Array.isArray(response.body) ? response.body : [];
  const session = sessions.find((item) => item.id === sessionId);
  if (!isChatSession(session)) return null;
  return {
    ...session,
    workDir: getEffectiveSessionWorkDir(session),
    contextSelection: getEffectiveSessionContextSelection(session),
  };
}

export function fallbackSessionContextResolution(input: {
  mindRoot: string;
  projectRoot: string;
}): SessionContextResolution {
  const workDir = defaultSessionWorkDir();
  return {
    requestedWorkDir: workDir,
    requestedSelection: defaultSessionContextSelection(),
    resolvedWorkDir: {
      path: fs.realpathSync(input.mindRoot),
      label: basenameLabel(input.mindRoot),
      source: 'mind-root',
    },
    resolvedSelection: {
      version: 1,
      spaces: [],
      assistants: [],
    },
    issues: [],
  };
}
