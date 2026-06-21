/**
 * Simple LLM text completion using the agent turn SSE stream.
 *
 * Sends a prompt and collects the full text response.
 * Used by Daily Echo for structured JSON extraction.
 */

import { consumeUIMessageStream } from '@/lib/agent/stream-consumer';
import { buildAgentTurnEndpoint, createTransientAgentSessionId } from '@/lib/agent-turn-endpoint';

/**
 * Send a prompt to the agent turn endpoint and return the full text response.
 * Parses the SSE stream and returns the concatenated text.
 */
export async function askLLMText(
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(buildAgentTurnEndpoint(createTransientAgentSessionId('daily-echo')), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      maxSteps: 5,
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as {
        error?: { message?: string };
        message?: string;
      };
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  if (!res.body) throw new Error('No response body');

  let text = '';
  await consumeUIMessageStream(
    res.body,
    (msg) => {
      text = msg.content ?? '';
    },
    signal,
  );

  return text;
}

/**
 * Send a prompt and parse the response as JSON.
 * Strips markdown code fences if present.
 */
export async function askLLMJSON<T>(
  prompt: string,
  signal?: AbortSignal
): Promise<T> {
  const raw = await askLLMText(prompt, signal);

  // Strip markdown code fences (```json ... ```)
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    cleaned = cleaned.slice(firstNewline + 1);
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3).trim();
    }
  }

  return JSON.parse(cleaned) as T;
}
