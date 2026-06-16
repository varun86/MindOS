import { describe, expect, it } from 'vitest';
import { extractInboxSourceMetadata } from './inbox-source.js';

describe('extractInboxSourceMetadata', () => {
  it('extracts web source metadata from canonical frontmatter', () => {
    const result = extractInboxSourceMetadata([
      '---',
      'title: Video Notes',
      'type: material',
      'source_type: web',
      'source_url: "https://www.youtube.com/watch?v=abc"',
      'source_platform: youtube',
      'captured_at: 2026-06-16T10:30:00.000Z',
      '---',
      '',
      '# Video Notes',
    ].join('\n'));

    expect(result).toEqual({
      kind: 'web',
      url: 'https://www.youtube.com/watch?v=abc',
      domain: 'youtube.com',
      platform: 'youtube',
      platformLabel: 'YouTube',
      title: 'Video Notes',
    });
  });

  it('does not treat legacy non-url source values as web URLs', () => {
    const result = extractInboxSourceMetadata([
      '---',
      'title: Readwise Item',
      'source: readwise',
      'category: book',
      '---',
      '',
      '# Readwise Item',
    ].join('\n'));

    expect(result).toBeUndefined();
  });
});
