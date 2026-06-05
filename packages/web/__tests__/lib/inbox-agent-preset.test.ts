import { describe, expect, it } from 'vitest';

import {
  buildInboxAgentPrompt,
  INBOX_AGENT_PRESET_ID,
  INBOX_AGENT_PRESET_NAME,
} from '@/lib/inbox-agent-preset';

describe('Inbox Agent preset', () => {
  it('builds a stable preset contract for Inbox review runs', () => {
    const prompt = buildInboxAgentPrompt(['source.md', 'decision.md']);

    expect(INBOX_AGENT_PRESET_ID).toBe('mindos-inbox-agent');
    expect(INBOX_AGENT_PRESET_NAME).toBe('MindOS Inbox Agent');
    expect(prompt).toContain('You are the MindOS Inbox Agent');
    expect(prompt).toContain('preset agent');
    expect(prompt).toContain('source note, structured note, decision/rule, reference, or reflection material');
    expect(prompt).toContain('Do not delete, rename, or overwrite Inbox source files directly');
    expect(prompt).toContain('Inbox/source.md');
    expect(prompt).toContain('Inbox/decision.md');
  });
});
