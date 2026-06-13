import type { ClaudeCodeCliPermissionMode } from './claude-code-cli.js';
import type {
  MindosRuntimePermissionMode,
  MindosRuntimeReasoningEffort,
} from './codex-runtime-options.js';

export type ClaudeRuntimeRequestOptions = {
  permissionMode?: MindosRuntimePermissionMode;
  reasoningEffort?: MindosRuntimeReasoningEffort;
};

export type ClaudeCodeRuntimeOverrides = {
  permissionMode: ClaudeCodeCliPermissionMode;
  effort?: MindosRuntimeReasoningEffort;
  allowDangerouslySkipPermissions?: boolean;
};

export function buildClaudeCodeRuntimeOverrides(
  options: ClaudeRuntimeRequestOptions,
): ClaudeCodeRuntimeOverrides {
  const permissionMode = claudeCliPermissionModeForMindosMode(options.permissionMode);
  const effort = normalizeClaudeReasoningEffort(options.reasoningEffort);
  return {
    permissionMode,
    ...(effort ? { effort } : {}),
    ...(permissionMode === 'bypassPermissions' ? { allowDangerouslySkipPermissions: true } : {}),
  };
}

export function claudeCliPermissionModeForMindosMode(
  mode: MindosRuntimePermissionMode | undefined,
): ClaudeCodeCliPermissionMode {
  if (mode === 'readonly') return 'dontAsk';
  if (mode === 'workspace-write') return 'acceptEdits';
  if (mode === 'danger-full-access') return 'bypassPermissions';
  return 'default';
}

function normalizeClaudeReasoningEffort(
  effort: MindosRuntimeReasoningEffort | undefined,
): MindosRuntimeReasoningEffort | undefined {
  if (!effort) return undefined;
  // Claude Code exposes low/medium/high/xhigh/max. If an older shared preset
  // uses OpenAI-style "minimal", keep the run valid by using Claude's floor.
  return effort === 'minimal' ? 'low' : effort;
}
