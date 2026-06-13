export type MindosRuntimePermissionMode =
  | 'readonly'
  | 'agent'
  | 'workspace-write'
  | 'danger-full-access';

export type MindosRuntimeReasoningEffort =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | (string & {});

export type CodexApprovalPolicy =
  | 'untrusted'
  | 'on-failure'
  | 'on-request'
  | 'never'
  | {
      granular: {
        sandbox_approval: boolean;
        rules: boolean;
        skill_approval: boolean;
        request_permissions: boolean;
        mcp_elicitations: boolean;
      };
    };

export type CodexSandboxMode =
  | 'read-only'
  | 'workspace-write'
  | 'danger-full-access';

export type CodexSandboxPolicy =
  | { type: 'readOnly'; networkAccess: boolean }
  | {
      type: 'workspaceWrite';
      writableRoots: string[];
      networkAccess: boolean;
      excludeTmpdirEnvVar: boolean;
      excludeSlashTmp: boolean;
    }
  | { type: 'externalSandbox'; networkAccess: 'restricted' | 'enabled' }
  | { type: 'dangerFullAccess' };

export type CodexRuntimeRequestOptions = {
  cwd?: string;
  permissionMode?: MindosRuntimePermissionMode;
  modelOverride?: string;
  reasoningEffort?: MindosRuntimeReasoningEffort;
};

export type CodexAppServerRuntimeOverrides = {
  thread: {
    model?: string;
    approvalPolicy?: CodexApprovalPolicy;
    sandbox?: CodexSandboxMode;
    config?: Record<string, unknown>;
  };
  turn: {
    model?: string;
    approvalPolicy?: CodexApprovalPolicy;
    sandboxPolicy?: CodexSandboxPolicy;
    effort?: MindosRuntimeReasoningEffort;
  };
};

export function isReadonlyRuntimePermissionMode(
  mode: MindosRuntimePermissionMode | undefined,
): boolean {
  return mode === 'readonly';
}

export function buildCodexAppServerRuntimeOverrides(
  options: CodexRuntimeRequestOptions,
): CodexAppServerRuntimeOverrides {
  const config: Record<string, unknown> = {};
  const thread: CodexAppServerRuntimeOverrides['thread'] = {};
  const turn: CodexAppServerRuntimeOverrides['turn'] = {};

  if (options.modelOverride) {
    thread.model = options.modelOverride;
    turn.model = options.modelOverride;
  }

  if (options.reasoningEffort) {
    config.model_reasoning_effort = options.reasoningEffort;
    turn.effort = options.reasoningEffort;
  }

  const permission = options.permissionMode
    ? codexPermissionConfig(options.permissionMode, options.cwd)
    : null;
  if (permission) {
    config.approval_policy = permission.approvalPolicy;
    config.sandbox_mode = permission.sandboxMode;
    if (permission.sandboxWorkspaceWriteConfig) {
      config.sandbox_workspace_write = permission.sandboxWorkspaceWriteConfig;
    }
    thread.approvalPolicy = permission.approvalPolicy;
    thread.sandbox = permission.sandboxMode;
    turn.approvalPolicy = permission.approvalPolicy;
    turn.sandboxPolicy = permission.sandboxPolicy;
  }

  if (Object.keys(config).length > 0) thread.config = config;

  return { thread, turn };
}

function codexPermissionConfig(mode: MindosRuntimePermissionMode, cwd?: string): {
  approvalPolicy: CodexApprovalPolicy;
  sandboxMode: CodexSandboxMode;
  sandboxPolicy: CodexSandboxPolicy;
  sandboxWorkspaceWriteConfig?: {
    writable_roots: string[];
    network_access: boolean;
    exclude_tmpdir_env_var: boolean;
    exclude_slash_tmp: boolean;
  };
} {
  if (mode === 'readonly') {
    return {
      approvalPolicy: 'never',
      sandboxMode: 'read-only',
      sandboxPolicy: { type: 'readOnly', networkAccess: true },
    };
  }

  if (mode === 'danger-full-access') {
    return {
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      sandboxPolicy: { type: 'dangerFullAccess' },
    };
  }

  const writableRoots = cwd?.trim() ? [cwd.trim()] : [];
  const workspaceWrite = {
    writable_roots: writableRoots,
    network_access: true,
    exclude_tmpdir_env_var: false,
    exclude_slash_tmp: false,
  };

  return {
    approvalPolicy: 'on-request',
    sandboxMode: 'workspace-write',
    sandboxPolicy: {
      type: 'workspaceWrite',
      writableRoots,
      networkAccess: workspaceWrite.network_access,
      excludeTmpdirEnvVar: workspaceWrite.exclude_tmpdir_env_var,
      excludeSlashTmp: workspaceWrite.exclude_slash_tmp,
    },
    sandboxWorkspaceWriteConfig: workspaceWrite,
  };
}
