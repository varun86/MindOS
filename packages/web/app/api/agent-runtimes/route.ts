export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import {
  handleAgentRuntimesGet,
  type AgentRuntimeDescriptor,
  type AgentRuntimePayload,
  type AgentRuntimesPayload,
  type AgentRuntimesServices,
} from '@geminilight/mindos/server';
import { checkNativeRuntimeHealth, detectLocalAcpAgents, resolveCommandPath } from '@/lib/acp/detect-local';
import { readSettings } from '@/lib/settings';
import { toNextResponse } from '../_mindos-adapter';
import { rememberAvailableNativeRuntimeDescriptorsFromPayload } from '@/lib/agent/native-runtime-descriptor-cache';
import { compactRuntimeDisplayHints, compactRuntimeDisplayReason } from '@/lib/agent/runtime-error-display';

const services: AgentRuntimesServices = {
  readSettings: readSettings as AgentRuntimesServices['readSettings'],
  detectLocalAcpAgents: detectLocalAcpAgents as AgentRuntimesServices['detectLocalAcpAgents'],
  resolveRuntimeCommand: resolveCommandPath as AgentRuntimesServices['resolveRuntimeCommand'],
  checkNativeRuntimeHealth: checkNativeRuntimeHealth as AgentRuntimesServices['checkNativeRuntimeHealth'],
};

export async function GET(req: Request) {
  const response = await handleAgentRuntimesGet(new URL(req.url).searchParams, services);
  if (response.status === 200 && response.body) {
    const body = compactNativeRuntimePayload(response.body);
    rememberAvailableNativeRuntimeDescriptorsFromPayload(body);
    return toNextResponse({ ...response, body });
  }
  return toNextResponse(response);
}

function isNativeRuntimeKind(kind: AgentRuntimeDescriptor['kind']): kind is 'codex' | 'claude' {
  return kind === 'codex' || kind === 'claude';
}

function compactNativeRuntimeDescriptor(runtime: AgentRuntimeDescriptor): AgentRuntimeDescriptor {
  if (!isNativeRuntimeKind(runtime.kind) || !runtime.availability) return runtime;
  const reason = runtime.availability.reason
    ? compactRuntimeDisplayReason(runtime.availability.reason, { runtime: runtime.kind })
    : undefined;
  const diagnosticHints = compactRuntimeDisplayHints(runtime.availability.diagnosticHints, { runtime: runtime.kind })
    .filter((hint) => hint !== reason);
  return {
    ...runtime,
    availability: {
      ...runtime.availability,
      ...(reason ? { reason } : {}),
      diagnosticHints: diagnosticHints.length > 0 ? diagnosticHints : undefined,
    },
  };
}

function compactNativeRuntimePayload<T extends AgentRuntimesPayload | AgentRuntimePayload | { error: string }>(body: T): T {
  if ('runtime' in body) {
    return {
      ...body,
      runtime: compactNativeRuntimeDescriptor(body.runtime),
    };
  }
  if ('runtimes' in body) {
    return {
      ...body,
      runtimes: body.runtimes.map(compactNativeRuntimeDescriptor),
    };
  }
  return body;
}
