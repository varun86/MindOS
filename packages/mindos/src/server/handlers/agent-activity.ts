import type { AgentAuditEvent, AgentAuditInput } from '../../knowledge/audit/index.js';
import { queryValue, type MindosRequestQuery } from '../context.js';
import { json, privateCacheHeaders, type MindosServerResponse } from '../response.js';
import { appendAgentAuditEvents, listAgentAuditEventsFromLog } from './audit-log.js';

export type AgentActivityHandlerServices = {
  mindRoot: string;
};

export type AgentActivityPayload = {
  events: AgentAuditEvent[];
};

export type AgentActivityAppendPayload = {
  ok: true;
  count: number;
  events: AgentAuditEvent[];
};

export async function handleAgentActivity(
  query: MindosRequestQuery | undefined,
  services: AgentActivityHandlerServices,
): Promise<MindosServerResponse<AgentActivityPayload | { error: string }>> {
  const limit = parseLimit(queryValue(query, 'limit'));
  try {
    const events = listAgentAuditEventsFromLog(services.mindRoot, limit);
    return json({ events }, { headers: privateCacheHeaders(30) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export function handleAgentActivityPost(
  body: unknown,
  services: AgentActivityHandlerServices,
): MindosServerResponse<AgentActivityAppendPayload | { error: string }> {
  const parsed = parseAuditInputs(body);
  if ('error' in parsed) return json({ error: parsed.error }, { status: 400 });

  try {
    const events = appendAgentAuditEvents(services.mindRoot, parsed.inputs);
    return json({ ok: true, count: events.length, events }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: /access denied/i.test(message) ? 403 : 500 });
  }
}

function parseLimit(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 10;
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 500));
}

type AuditInputParseResult = { inputs: AgentAuditInput[] } | { error: string };

function parseAuditInputs(body: unknown): AuditInputParseResult {
  if (!isRecord(body)) return { error: 'Expected an object payload' };

  const rawEvents = Array.isArray(body.events)
    ? body.events
    : isRecord(body.event)
      ? [body.event]
      : [body];

  if (rawEvents.length === 0) return { error: 'Expected at least one audit event' };

  const inputs: AgentAuditInput[] = [];
  for (const [index, value] of rawEvents.entries()) {
    if (!isRecord(value)) return { error: `Event ${index} must be an object` };
    const parsed = parseAuditInput(value, index);
    if ('error' in parsed) return parsed;
    inputs.push(parsed.input);
  }

  return { inputs };
}

function parseAuditInput(value: Record<string, unknown>, index: number): { input: AgentAuditInput } | { error: string } {
  const tool = typeof value.tool === 'string' ? value.tool.trim() : '';
  if (!tool) return { error: `Event ${index} is missing tool` };

  if (value.result !== undefined && value.result !== 'ok' && value.result !== 'error') {
    return { error: `Event ${index} has invalid result` };
  }

  return {
    input: {
      ts: typeof value.ts === 'string' ? value.ts : new Date().toISOString(),
      tool,
      params: isRecord(value.params) ? value.params : {},
      result: value.result === 'error' ? 'error' : 'ok',
      actionSummary: typeof value.actionSummary === 'string' ? value.actionSummary : undefined,
      message: typeof value.message === 'string' ? value.message : undefined,
      durationMs: typeof value.durationMs === 'number' && Number.isFinite(value.durationMs) ? value.durationMs : undefined,
      agentName: typeof value.agentName === 'string' ? value.agentName : undefined,
      debugCapture: value.debugCapture === 'redacted_raw' ? 'redacted_raw' : undefined,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
