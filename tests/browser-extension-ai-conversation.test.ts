import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AI_CONVERSATION_PLATFORMS,
  buildConversationHtml,
  detectAiConversationPlatform,
  normalizeRole,
  type AiConversationMessage,
} from '../packages/browser-extension/src/content/ai-conversation';
import { toClipDocument } from '../packages/browser-extension/src/lib/markdown';
import type { PageContent } from '../packages/browser-extension/src/lib/types';

const extensionExtractor = readFileSync(
  resolve(__dirname, '../packages/browser-extension/extension/content/extractor.js'),
  'utf-8',
);

describe('browser extension AI conversation capture helpers', () => {
  it('recognizes the requested mainstream AI chat platforms by URL', () => {
    expect(detectAiConversationPlatform('https://chatgpt.com/c/abc')?.id).toBe('chatgpt');
    expect(detectAiConversationPlatform('https://chat.openai.com/c/abc')?.id).toBe('chatgpt');
    expect(detectAiConversationPlatform('https://claude.ai/chat/abc')?.id).toBe('claude');
    expect(detectAiConversationPlatform('https://gemini.google.com/app/abc')?.id).toBe('gemini');
    expect(detectAiConversationPlatform('https://chat.deepseek.com/a/chat/s/abc')?.id).toBe('deepseek');
    expect(detectAiConversationPlatform('https://kimi.moonshot.cn/chat/abc')?.id).toBe('kimi');
    expect(detectAiConversationPlatform('https://chat.qwen.ai/c/abc')?.id).toBe('qwen');
    expect(detectAiConversationPlatform('https://chatglm.cn/main/alltoolsdetail')?.id).toBe('zhipu');
    expect(detectAiConversationPlatform('https://chat.minimax.io/chat/abc')?.id).toBe('minimax');
  });

  it('keeps platform profiles scoped and selector-backed', () => {
    const profileIds = AI_CONVERSATION_PLATFORMS.map(platform => platform.id);
    expect(profileIds).toEqual([
      'chatgpt',
      'claude',
      'gemini',
      'deepseek',
      'kimi',
      'qwen',
      'zhipu',
      'minimax',
    ]);
    for (const platform of AI_CONVERSATION_PLATFORMS) {
      expect(platform.domains.length).toBeGreaterThan(0);
      expect(platform.messageSelectors.length).toBeGreaterThan(0);
      expect(platform.userSelectors.length).toBeGreaterThan(0);
      expect(platform.assistantSelectors.length).toBeGreaterThan(0);
    }
  });

  it('normalizes common role labels and platform markers', () => {
    expect(normalizeRole('data-message-author-role=user')).toBe('user');
    expect(normalizeRole('assistant-message')).toBe('assistant');
    expect(normalizeRole('font-claude-response')).toBe('assistant');
    expect(normalizeRole('system')).toBe('system');
    expect(normalizeRole('neutral')).toBe('unknown');
  });

  it('formats conversation HTML with stable role sections', () => {
    const platform = detectAiConversationPlatform('https://chatgpt.com/c/abc');
    expect(platform).toBeTruthy();
    const messages: AiConversationMessage[] = [
      { role: 'user', html: '<p>Hello</p>', text: 'Hello' },
      { role: 'assistant', html: '<pre><code>world()</code></pre>', text: 'world()' },
    ];

    const html = buildConversationHtml(messages, platform!);

    expect(html).toContain('data-mindos-ai-conversation="true"');
    expect(html).toContain('data-mindos-message-role="user"');
    expect(html).toContain('<h2>ChatGPT</h2>');
    expect(html).toContain('<pre><code>world()</code></pre>');
  });

  it('writes AI conversations as canonical MindOS session frontmatter', () => {
    const page: PageContent = {
      title: 'Debug a sync issue',
      byline: null,
      excerpt: null,
      content: '<section><h2>User</h2><p>Why did sync fail?</p></section><section><h2>DeepSeek</h2><p>Check the token.</p></section>',
      textContent: 'User: Why did sync fail?\nDeepSeek: Check the token.',
      siteName: 'DeepSeek',
      url: 'https://chat.deepseek.com/a/chat/s/123',
      savedAt: '2026-06-17T10:30:00.000Z',
      wordCount: 9,
      captureType: 'ai-conversation',
      sourceType: 'session',
      sourcePlatform: 'deepseek',
      sourcePlatformLabel: 'DeepSeek',
      messageCount: 2,
    };

    const doc = toClipDocument(page, '', html => html.replace(/<[^>]+>/g, '').trim());

    expect(doc.source).toBe('ai-conversation-clipper');
    expect(doc.markdown).toContain('type: log');
    expect(doc.markdown).toContain('source_type: session');
    expect(doc.markdown).toContain('source_url: "https://chat.deepseek.com/a/chat/s/123"');
    expect(doc.markdown).toContain('source_platform: deepseek');
    expect(doc.markdown).toContain('captured_at: "2026-06-17T10:30:00.000Z"');
    expect(doc.markdown).toContain('> Captured from DeepSeek (2 messages).');
  });
});

describe('browser extension generated AI conversation extractor', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('captures ChatGPT-like DOM without mistaking the message list container for one message', async () => {
    const result = await extractGeneratedClipResult(browser, 'https://chatgpt.com/c/sync-debugging', `
      <!doctype html>
      <title>Sync debugging - ChatGPT</title>
      <main id="thread" class="message-list">
        <h1>Sync debugging</h1>
        <article data-testid="conversation-turn-1">
          <div data-message-author-role="user">
            <p>Why did sync fail?</p>
          </div>
        </article>
        <article data-testid="conversation-turn-2">
          <div data-message-author-role="assistant">
            <div class="markdown prose">
              <p>Check the local token and retry.</p>
              <button data-testid="copy-turn">Copy</button>
              <span aria-hidden="true">hidden decoration</span>
            </div>
          </div>
        </article>
      </main>
    `);

    expect(result.captureType).toBe('ai-conversation');
    expect(result.sourcePlatform).toBe('chatgpt');
    expect(result.messageCount).toBe(2);
    expect(result.title).toBe('Sync debugging');
    expect(result.textContent).toContain('User:\nWhy did sync fail?');
    expect(result.textContent).toContain('ChatGPT:\nCheck the local token and retry.');
    expect(result.textContent).not.toContain('Copy');
    expect(result.textContent).not.toContain('hidden decoration');
  });

  it('captures Gemini custom elements and preserves assistant code language classes', async () => {
    const result = await extractGeneratedClipResult(browser, 'https://gemini.google.com/app/test-session', `
      <!doctype html>
      <title>Code review - Gemini</title>
      <main id="chat-history">
        <h1>Code review</h1>
        <user-query>
          <user-query-content>Review this parser.</user-query-content>
        </user-query>
        <model-response>
          <message-content>
            <p>Keep the parser structured.</p>
            <pre><code class="language-ts">const role = "assistant";</code></pre>
          </message-content>
        </model-response>
      </main>
    `);

    expect(result.captureType).toBe('ai-conversation');
    expect(result.sourcePlatform).toBe('gemini');
    expect(result.messageCount).toBe(2);
    expect(result.textContent).toContain('User:\nReview this parser.');
    expect(result.textContent).toContain('Gemini:\nKeep the parser structured.');
    expect(result.content).toContain('class="language-ts"');
  });

  it('falls back to ordinary web extraction when a known AI domain has no loaded session', async () => {
    const result = await extractGeneratedClipResult(browser, 'https://chat.deepseek.com/', `
      <!doctype html>
      <title>DeepSeek</title>
      <main>
        <h1>Start a new chat</h1>
        <p>This landing page has no user and assistant message pair yet.</p>
      </main>
    `);

    expect(result.captureType).toBe('web-page');
    expect(result.sourcePlatform).toBeUndefined();
    expect(result.messageCount).toBeUndefined();
  });
});

async function extractGeneratedClipResult(browser: Browser, url: string, body: string): Promise<any> {
  const page = await browser.newPage();
  try {
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body }));
    await page.goto(url);
    await page.addScriptTag({ content: extensionExtractor });
    return await page.evaluate(() => (globalThis as any).__mindosClipResult);
  } finally {
    await page.close();
  }
}
