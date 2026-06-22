import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ViewPageClient markdown TOC parse performance', () => {
  it('reuses one memoized heading parse for TOC layout and rendering', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'app/view/[...path]/ViewPageClient.tsx'),
      'utf8',
    );

    expect(source).toContain('const markdownTocHeadings = useMemo(() => {');
    expect(source).toContain('const hasMarkdownToc = markdownTocHeadings.length >= 2;');
    expect(source).not.toContain('hasTableOfContents(');
    expect(source.match(/<TableOfContents headings={markdownTocHeadings} \/>/g) ?? []).toHaveLength(2);
  });

  it('lets TableOfContents consume precomputed headings without reparsing content', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'components/TableOfContents.tsx'),
      'utf8',
    );

    expect(source).toContain('export interface TableOfContentsHeading');
    expect(source).toContain('export function parseTableOfContentsHeadings(content: string)');
    expect(source).toContain('headings?: TableOfContentsHeading[];');
    expect(source).toContain('const h = providedHeadings ?? parseTableOfContentsHeadings(content);');
  });
});
