import type { Message as FrontendMessage } from '@/lib/types';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { toMindosAgentMessages } from '@geminilight/mindos/session';

export type { AgentMessage } from '@earendil-works/pi-agent-core';

export function toAgentMessages(messages: FrontendMessage[]): AgentMessage[] {
  return toMindosAgentMessages(messages) as unknown as AgentMessage[];
}
