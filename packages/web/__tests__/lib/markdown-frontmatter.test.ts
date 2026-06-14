import { describe, expect, it } from 'vitest';
import { hasMarkdownFrontmatterFence, splitMarkdownFrontmatter } from '@/lib/parsing/frontmatter';

describe('splitMarkdownFrontmatter', () => {
  it('extracts leading YAML frontmatter and returns the markdown body', () => {
    const result = splitMarkdownFrontmatter(`---
title: Frontmatter Test
tags: [clip, reading]
source: "https://example.com/a:b"
published: 2026-06-09
draft: false
---

# Note

Body`);

    expect(result.body).toBe('# Note\n\nBody');
    expect(result.frontmatter?.entries).toEqual([
      { key: 'title', value: 'Frontmatter Test' },
      { key: 'tags', value: ['clip', 'reading'] },
      { key: 'source', value: 'https://example.com/a:b' },
      { key: 'published', value: new Date('2026-06-09T00:00:00.000Z') },
      { key: 'draft', value: false },
    ]);
  });

  it('supports CRLF frontmatter fences', () => {
    const result = splitMarkdownFrontmatter('---\r\ntitle: Windows\r\n---\r\n\r\n# Body');

    expect(result.body).toBe('# Body');
    expect(result.frontmatter?.entries).toEqual([{ key: 'title', value: 'Windows' }]);
  });

  it('returns empty entries for an empty frontmatter block', () => {
    const result = splitMarkdownFrontmatter('---\n---\n\n# Body');

    expect(result.body).toBe('# Body');
    expect(result.frontmatter?.entries).toEqual([]);
  });

  it('leaves content without leading frontmatter unchanged', () => {
    const content = '# Note\n\n---\n\nA divider in the body.';
    const result = splitMarkdownFrontmatter(content);

    expect(result).toEqual({ body: content, frontmatter: null });
  });

  it('leaves malformed YAML unchanged so user content is not hidden', () => {
    const content = `---
title: [broken
---

# Body`;
    const result = splitMarkdownFrontmatter(content);

    expect(result).toEqual({ body: content, frontmatter: null });
    expect(hasMarkdownFrontmatterFence(content)).toBe(true);
  });

  it('leaves non-object YAML roots unchanged', () => {
    const content = `---
- one
- two
---

# Body`;
    const result = splitMarkdownFrontmatter(content);

    expect(result).toEqual({ body: content, frontmatter: null });
  });

  it('normalizes nested objects and circular aliases without recursing forever', () => {
    const result = splitMarkdownFrontmatter(`---
meta: &meta
  author: moonshot
  self: *meta
---

# Body`);

    expect(result.body).toBe('# Body');
    expect(result.frontmatter?.entries).toEqual([
      {
        key: 'meta',
        value: {
          author: 'moonshot',
          self: '[Circular]',
        },
      },
    ]);
  });

  it('detects leading frontmatter fences without requiring valid YAML', () => {
    expect(hasMarkdownFrontmatterFence('---\ntitle: Fast\n---\n\n# Body')).toBe(true);
    expect(hasMarkdownFrontmatterFence('---\r\ntitle: Windows\r\n---\r\n\r\n# Body')).toBe(true);
    expect(hasMarkdownFrontmatterFence('# Body\n\n---\nnot frontmatter\n---')).toBe(false);
    expect(hasMarkdownFrontmatterFence('---\ntitle: missing close\n\n# Body')).toBe(false);
  });
});
