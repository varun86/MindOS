import { AsyncLocalStorage } from 'node:async_hooks';
import { AGENT_RUN_CONTEXT_BY_RESOURCE_KEY, getProcessGlobal } from './global-state.js';

export interface AgentRunContext {
  chatSessionId?: string;
  rootRunId?: string;
  parentRunId?: string;
}

const agentRunContext = new AsyncLocalStorage<AgentRunContext>();

function contextByResource(): WeakMap<object, AgentRunContext> {
  return getProcessGlobal(AGENT_RUN_CONTEXT_BY_RESOURCE_KEY, () => new WeakMap<object, AgentRunContext>());
}

export function runWithAgentRunContext<T>(
  context: AgentRunContext,
  fn: () => T,
): T {
  return agentRunContext.run(context, fn);
}

export function getCurrentAgentRunContext(): AgentRunContext | undefined {
  return agentRunContext.getStore();
}

export function getAgentRunContextForResource(resource: unknown): AgentRunContext | undefined {
  if ((!resource || typeof resource !== 'object') && typeof resource !== 'function') return undefined;
  return contextByResource().get(resource as object);
}

export function setAgentRunContextForResource(
  resource: object,
  context: AgentRunContext,
): () => void {
  const contexts = contextByResource();
  const previous = contexts.get(resource);
  contexts.set(resource, context);
  return () => {
    if (previous) contexts.set(resource, previous);
    else contexts.delete(resource);
  };
}
