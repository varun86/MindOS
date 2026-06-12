import { describe, expect, it } from 'vitest';
import {
  createMindosAgentPermissionPolicy,
  createMindosAgentPermissionPolicyFromContext,
  hasMindosExtensionScope,
} from '@/lib/agent/permission-policy';

describe('MindOS agent permission policy', () => {
  it('maps chat mode to chat product scope and readonly harness permissions', () => {
    const policy = createMindosAgentPermissionPolicy('chat');

    expect(policy).toMatchObject({
      mode: 'chat',
      permissionMode: 'chat',
      runtimePermissionMode: 'readonly',
      acpPermissionMode: 'readonly',
      toolScope: {
        kbRead: true,
        kbWrite: 'none',
        web: true,
        askUserQuestion: true,
        terminal: false,
        mcp: false,
        subagents: false,
        acpDelegation: false,
        a2aDelegation: false,
        im: false,
        schedule: false,
        userExtensions: false,
      },
    });
    expect(policy.kbToolNames).toEqual([
      'list_files',
      'read_file',
      'read_file_chunk',
      'search',
      'load_skill',
      'get_recent',
      'get_backlinks',
    ]);
    expect(hasMindosExtensionScope(policy, 'subagents')).toBe(false);
  });

  it('maps agent mode to full local agent scope', () => {
    const policy = createMindosAgentPermissionPolicy('agent');

    expect(policy).toMatchObject({
      mode: 'agent',
      permissionMode: 'agent',
      runtimePermissionMode: 'agent',
      acpPermissionMode: 'agent',
      toolScope: {
        kbRead: true,
        kbWrite: 'all',
        web: true,
        askUserQuestion: true,
        terminal: true,
        mcp: true,
        subagents: true,
        acpDelegation: true,
        a2aDelegation: true,
        im: true,
        schedule: true,
        userExtensions: true,
      },
    });
    expect(hasMindosExtensionScope(policy, 'pi-mcp-adapter')).toBe(true);
    expect(hasMindosExtensionScope(policy, 'subagents')).toBe(true);
    expect(hasMindosExtensionScope(policy, 'schedule-prompt')).toBe(true);
  });

  it('derives external harness permission from policy instead of non-chat branches', () => {
    expect(createMindosAgentPermissionPolicy('chat').runtimePermissionMode).toBe('readonly');
    expect(createMindosAgentPermissionPolicy('agent').runtimePermissionMode).toBe('agent');

    expect(createMindosAgentPermissionPolicy('chat').acpPermissionMode).toBe('readonly');
    expect(createMindosAgentPermissionPolicy('agent').acpPermissionMode).toBe('agent');
  });

  it('maps runtime contexts into the same policy contract', () => {
    expect(createMindosAgentPermissionPolicyFromContext({ permissionMode: 'readonly' }).mode).toBe('chat');
    expect(createMindosAgentPermissionPolicyFromContext({ mode: 'agent' }).toolScope.subagents).toBe(true);
    expect(createMindosAgentPermissionPolicyFromContext(undefined).mode).toBe('agent');
  });
});
