import { describe, expect, it } from 'vitest';
import {
  ECHO_ASSISTANT_DEFAULT_PROMPTS,
  ECHO_ASSISTANT_IDS,
  ECHO_IMPRINT_ASSISTANT_ID,
  ECHO_INSIGHT_ASSISTANT_ID,
  ECHO_PRACTICE_ASSISTANT_ID,
  ECHO_THREADER_ASSISTANT_ID,
  buildEchoAssistantRunPrompt,
  buildEchoRecentSessionSummaries,
  getBuiltinEchoAssistantMarkdownFiles,
  getEchoAssistantIdForSegment,
} from '@/lib/echo-assistants';
import type { ChatSession } from '@/lib/types';

describe('echo assistants', () => {
  it('defines one read-only built-in assistant for each Echo module', () => {
    expect(ECHO_ASSISTANT_IDS).toEqual([
      ECHO_IMPRINT_ASSISTANT_ID,
      ECHO_THREADER_ASSISTANT_ID,
      ECHO_INSIGHT_ASSISTANT_ID,
      ECHO_PRACTICE_ASSISTANT_ID,
    ]);

    expect(getEchoAssistantIdForSegment('overview')).toBeUndefined();
    expect(getEchoAssistantIdForSegment('imprint')).toBe('echo-imprint');
    expect(getEchoAssistantIdForSegment('threads')).toBe('echo-threader');
    expect(getEchoAssistantIdForSegment('growth')).toBe('echo-insight');
    expect(getEchoAssistantIdForSegment('practice')).toBe('echo-practice');

    for (const assistantId of ECHO_ASSISTANT_IDS) {
      const prompt = ECHO_ASSISTANT_DEFAULT_PROMPTS[assistantId];
      expect(prompt).toContain('version: 1');
      expect(prompt).toContain('mode: subagent');
      expect(prompt).toContain('permissionMode: read');
      expect(prompt).toContain('hidden: true');
      expect(prompt).toContain('Return Markdown only');
      expect(prompt).toContain('Do not invent');
      expect(prompt).not.toContain('assistantId:');
    }
  });

  it('exposes built-in Markdown files under the unified assistant path', () => {
    expect(getBuiltinEchoAssistantMarkdownFiles().map((item) => item.path)).toEqual([
      '.mindos/assistants/echo-imprint.md',
      '.mindos/assistants/echo-threader.md',
      '.mindos/assistants/echo-insight.md',
      '.mindos/assistants/echo-practice.md',
    ]);
  });

  it('builds localized Markdown output contracts from visible Echo context', () => {
    const prompt = buildEchoAssistantRunPrompt({
      locale: 'zh',
      segment: 'practice',
      segmentTitle: '实践',
      lead: '把洞察变成下一轮可验证的小行动。',
      snapshotTitle: '把洞察放到下一次',
      snapshotBody: '知道要试什么，也知道怎么看结果。',
      facts: [
        { label: '实验', value: '先写验收标准，再动代码。' },
      ],
      recentSessions: [
        {
          title: '修复 Echo 页面',
          lastUserMessage: '这里为什么会丢失脉络？',
          runtime: 'Codex',
          messageCount: 8,
        },
      ],
    });

    expect(prompt).toContain('Write in Chinese');
    expect(prompt).toContain('# 实践');
    expect(prompt).toContain('## 假设');
    expect(prompt).toContain('实验: 先写验收标准，再动代码。');
    expect(prompt).toContain('修复 Echo 页面');
    expect(prompt).toContain('Do not use tools unless the user explicitly asks');
  });

  it('frames imprint output as a concrete practice event', () => {
    const prompt = buildEchoAssistantRunPrompt({
      locale: 'zh',
      segment: 'imprint',
      segmentTitle: '印迹',
      lead: '保存一次真实 AI 协作现场。',
      snapshotTitle: '从一行开始',
      snapshotBody: '先留下发生了什么。',
      facts: [
        { label: '当前会话', value: '用户指出 sidebar 激活态抖动，最后修复为稳定 Home 状态。' },
      ],
    });

    expect(prompt).toContain('# 印迹');
    expect(prompt).toContain('## 现场');
    expect(prompt).toContain('## 结果');
    expect(prompt).toContain('## 关键片段');
    expect(prompt).toContain('## 待梳理');
    expect(prompt).toContain('## 下一步');
    expect(prompt).toContain('当前会话: 用户指出 sidebar 激活态抖动');
  });

  it('summarizes recent sessions without carrying the full conversation', () => {
    const sessions: ChatSession[] = [
      makeSession({
        id: 'old',
        updatedAt: 1,
        messages: [{ role: 'user', content: 'old session content' }],
      }),
      makeSession({
        id: 'new',
        title: 'Echo polish',
        updatedAt: 3,
        runtime: { id: 'codex', name: 'Codex', kind: 'codex' },
        messages: [
          { role: 'assistant', content: 'ok' },
          { role: 'user', content: 'please explain the why and how'.repeat(20) },
        ],
      }),
      makeSession({
        id: 'empty',
        updatedAt: 4,
        messages: [{ role: 'assistant', content: 'no user input' }],
      }),
    ];

    const summaries = buildEchoRecentSessionSummaries(sessions, 2);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      title: 'Echo polish',
      runtime: 'Codex',
      messageCount: 2,
    });
    expect(summaries[0].lastUserMessage?.length).toBeLessThanOrEqual(220);
    expect(summaries[1]).toMatchObject({
      title: 'old session content',
      messageCount: 1,
    });
  });
});

function makeSession(input: {
  id: string;
  title?: string;
  updatedAt: number;
  runtime?: ChatSession['defaultAgentRuntime'];
  messages: ChatSession['messages'];
}): ChatSession {
  return {
    id: input.id,
    ...(input.title ? { title: input.title } : {}),
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    messages: input.messages,
    ...(input.runtime ? { defaultAgentRuntime: input.runtime } : {}),
  };
}
