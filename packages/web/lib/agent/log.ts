import { getMindRoot } from '@/lib/fs';
import { appendAgentAuditEvent } from '@/lib/core/agent-audit-log';

interface AgentOpEntry {
  ts: string;
  tool: string;
  params: Record<string, unknown>;
  result: 'ok' | 'error';
  message?: string;
  durationMs?: number;
  agentName?: string;
}

/**
 * Append an agent operation entry to the structured agent audit log.
 */
export function logAgentOp(entry: AgentOpEntry): void {
  try {
    const root = getMindRoot();
    appendAgentAuditEvent(root, {
      ts: entry.ts,
      tool: entry.tool,
      params: entry.params,
      result: entry.result,
      message: entry.message,
      durationMs: entry.durationMs,
      agentName: entry.agentName,
    });
  } catch {
    // Logging should never break tool execution
  }
}
