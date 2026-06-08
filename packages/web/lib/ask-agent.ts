import type { AgentIdentity, AgentRuntimeIdentity, ChatSession, ExternalAgentBinding, Message } from '@/lib/types';

export const MINDOS_AGENT: AgentIdentity = {
  id: 'mindos',
  name: 'MindOS',
};

export function resolveMessageAgent(agent: AgentIdentity | null | undefined): AgentIdentity {
  return agent ?? MINDOS_AGENT;
}

export function annotateMessageWithAgent(message: Message, agent: AgentIdentity | null | undefined): Message {
  const resolved = resolveMessageAgent(agent);
  return {
    ...message,
    agentId: resolved.id,
    agentName: resolved.name,
  };
}

export function annotateMessageWithAgentRuntime(
  message: Message,
  runtime: AgentRuntimeIdentity | null | undefined,
): Message {
  const resolved = runtime ?? { ...MINDOS_AGENT, kind: 'mindos' as const };
  return {
    ...message,
    agentId: resolved.id,
    agentName: resolved.name,
    agentKind: resolved.kind,
  };
}

export function resolveComposerAgent({
  sessionAgent,
  initialAgent,
}: {
  sessionAgent?: AgentIdentity | null;
  initialAgent?: AgentIdentity | null;
}): AgentIdentity | null {
  return sessionAgent ?? initialAgent ?? null;
}

export function getSelectedAcpAgentFromMessage(message: Pick<Message, 'agentId' | 'agentName' | 'agentKind'>): AgentIdentity | null {
  if (!message.agentId || !message.agentName || message.agentId === MINDOS_AGENT.id || message.agentKind) {
    return null;
  }
  return {
    id: message.agentId,
    name: message.agentName,
  };
}

export function getMessageAgentRuntime(
  message: Pick<Message, 'agentId' | 'agentName' | 'agentKind'>,
): AgentRuntimeIdentity | null {
  if (!message.agentId || !message.agentName || message.agentId === MINDOS_AGENT.id) {
    return null;
  }
  return {
    id: message.agentId,
    name: message.agentName,
    kind: message.agentKind ?? 'acp',
  };
}

export function toAgentRuntime(agent: AgentIdentity | null | undefined): AgentRuntimeIdentity | null {
  return agent ? { ...agent, kind: 'acp' } : null;
}

export function getSessionAgentRuntime(
  session: Pick<ChatSession, 'defaultAgentRuntime' | 'defaultAcpAgent'> | null | undefined,
): AgentRuntimeIdentity | null {
  return session?.defaultAgentRuntime ?? toAgentRuntime(session?.defaultAcpAgent);
}

export function bindSessionAgent(session: ChatSession, agent: AgentIdentity | null): ChatSession {
  return {
    ...session,
    defaultAcpAgent: agent,
    defaultAgentRuntime: toAgentRuntime(agent),
  };
}

export function bindSessionAgentRuntime(
  session: ChatSession,
  runtime: AgentRuntimeIdentity | null,
  binding?: {
    externalSessionId?: string;
    cwd?: string;
    status?: ExternalAgentBinding['status'];
    updatedAt?: number;
  },
): ChatSession {
  const externalAgentBinding = runtime && runtime.kind !== 'mindos'
    ? {
        runtime: runtime.kind,
        ...(binding?.externalSessionId ? { externalSessionId: binding.externalSessionId } : {}),
        ...(binding?.cwd ? { cwd: binding.cwd } : {}),
        status: binding?.status ?? 'active',
        updatedAt: binding?.updatedAt ?? Date.now(),
      } satisfies ExternalAgentBinding
    : null;

  return {
    ...session,
    defaultAcpAgent: runtime?.kind === 'acp' ? { id: runtime.id, name: runtime.name } : null,
    defaultAgentRuntime: runtime,
    externalAgentBinding,
  };
}
