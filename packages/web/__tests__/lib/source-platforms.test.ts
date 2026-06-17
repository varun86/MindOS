import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectSourcePlatform,
  getSourcePlatformDefinition,
  normalizeSourceHostname,
} from '@/lib/link-preview/source-platforms';

describe('source platform detection', () => {
  it('detects mainstream social and reference domains', () => {
    expect(detectSourcePlatform('https://www.youtube.com/watch?v=abc')?.id).toBe('youtube');
    expect(detectSourcePlatform('https://b23.tv/abc')?.id).toBe('bilibili');
    expect(detectSourcePlatform('https://www.xiaohongshu.com/explore/abc')?.id).toBe('xiaohongshu');
    expect(detectSourcePlatform('https://zhuanlan.zhihu.com/p/123')?.id).toBe('zhihu');
    expect(detectSourcePlatform('https://gist.github.com/user/id')?.id).toBe('github');
    expect(detectSourcePlatform('https://old.reddit.com/r/localfirst')?.id).toBe('reddit');
    expect(detectSourcePlatform('https://twitter.com/user/status/1')?.id).toBe('x');
    expect(detectSourcePlatform('https://mp.weixin.qq.com/s/example')?.id).toBe('wechat');
    expect(detectSourcePlatform('https://arxiv.org/abs/2401.00001')?.id).toBe('arxiv');
  });

  it('detects mainstream AI chat domains and reuses bundled agent icons where available', () => {
    expect(detectSourcePlatform('https://chatgpt.com/c/abc')?.id).toBe('chatgpt');
    expect(detectSourcePlatform('https://chat.openai.com/c/abc')?.id).toBe('chatgpt');
    expect(detectSourcePlatform('https://claude.ai/chat/abc')?.id).toBe('claude');
    expect(detectSourcePlatform('https://gemini.google.com/app/abc')?.id).toBe('gemini');
    expect(detectSourcePlatform('https://chat.deepseek.com/a/chat/s/abc')?.id).toBe('deepseek');
    expect(detectSourcePlatform('https://kimi.moonshot.cn/chat/abc')?.id).toBe('kimi');
    expect(detectSourcePlatform('https://chat.qwen.ai/c/abc')?.id).toBe('qwen');
    expect(detectSourcePlatform('https://chatglm.cn/main/alltoolsdetail')?.id).toBe('zhipu');
    expect(detectSourcePlatform('https://chat.minimax.io/chat/abc')?.id).toBe('minimax');

    for (const id of ['chatgpt', 'claude', 'gemini', 'kimi', 'qwen']) {
      const iconPath = getSourcePlatformDefinition(id)?.iconPath;
      expect(iconPath, id).toBeTruthy();
      expect(existsSync(join(process.cwd(), 'public', iconPath!))).toBe(true);
    }
  });

  it('normalizes hosts without treating arbitrary text as a source', () => {
    expect(normalizeSourceHostname('www.youtube.com/watch?v=abc')).toBe('youtube.com');
    expect(normalizeSourceHostname('not a url')).toBeNull();
    expect(detectSourcePlatform('https://example.com')).toBeNull();
  });
});
