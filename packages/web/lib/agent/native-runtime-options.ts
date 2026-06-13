import type {
  AgentRuntimeIdentity,
  RuntimePermissionMode,
  RuntimeReasoningEffort,
} from '@/lib/types';

export type NativeRuntimeRequestOptions = {
  permissionMode?: RuntimePermissionMode;
  modelOverride?: string;
  reasoningEffort?: RuntimeReasoningEffort;
};

const RUNTIME_PERMISSION_MODES = new Set<RuntimePermissionMode>([
  'readonly',
  'agent',
  'workspace-write',
  'danger-full-access',
]);

export function normalizeRuntimePermissionForKind(
  kind: 'codex' | 'claude',
  mode: RuntimePermissionMode,
): RuntimePermissionMode {
  if (kind === 'codex') return mode === 'agent' ? 'workspace-write' : mode;
  return mode === 'readonly' ? 'readonly' : 'agent';
}

export function normalizeNativeRuntimeOptions(
  value: unknown,
  runtime: Pick<AgentRuntimeIdentity, 'kind'> | null,
): NativeRuntimeRequestOptions {
  if (!runtime || !value || typeof value !== 'object' || Array.isArray(value)) return {};
  if (runtime.kind !== 'codex' && runtime.kind !== 'claude') return {};
  const record = value as Record<string, unknown>;
  const permissionMode = isRuntimePermissionMode(record.permissionMode)
    ? normalizeRuntimePermissionForKind(runtime.kind, record.permissionMode)
    : undefined;
  const modelOverride = typeof record.modelOverride === 'string' && record.modelOverride.trim()
    ? record.modelOverride.trim().slice(0, 160)
    : undefined;
  const reasoningEffort = runtime.kind === 'codex' && typeof record.reasoningEffort === 'string' && record.reasoningEffort.trim()
    ? (record.reasoningEffort.trim().slice(0, 64) as RuntimeReasoningEffort)
    : undefined;
  return {
    ...(permissionMode ? { permissionMode } : {}),
    ...(modelOverride ? { modelOverride } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };
}

function isRuntimePermissionMode(value: unknown): value is RuntimePermissionMode {
  return typeof value === 'string' && RUNTIME_PERMISSION_MODES.has(value as RuntimePermissionMode);
}
