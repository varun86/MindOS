import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('TableOfContents header layout', () => {
  it('renders as an inline sticky rail owned by the Markdown page layout', () => {
    const filePath = path.resolve(process.cwd(), 'components/TableOfContents.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain("const VIEW_HEADER_CSS_VAR = 'var(--workspace-header-h)';");
    expect(source).toContain('const VIEW_HEADER_FALLBACK_H = 40;');
    expect(source).toContain('data-markdown-toc-panel');
    expect(source).toContain('sticky z-app-sticky relative overflow-visible');
    expect(source).toContain('data-markdown-toc-toggle');
    expect(source).toContain('className="absolute -left-5 top-0 z-10 flex h-8 w-5 items-center justify-center rounded-l-md border border-r-0 border-border bg-background');
    expect(source).not.toContain('className="flex items-center h-[46px] px-4 border-l border-b border-border"');
    expect(source).not.toContain('className="flex h-9 shrink-0 items-center justify-end border-l border-border bg-background/95 pl-2 pr-2"');
    expect(source).not.toContain('className="hidden xl:flex fixed');
    expect(source).not.toContain('font-semibold uppercase tracking-wider');
  });

  it('keeps collapse state global without publishing layout width to the app shell', () => {
    const filePath = path.resolve(process.cwd(), 'components/TableOfContents.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('export function hasTableOfContents(content: string): boolean');
    expect(source).toContain("const TOC_COLLAPSED_KEY = 'mindos.toc.collapsed';");
    expect(source).toContain("const TOC_COLLAPSED_EVENT = 'mindos:toc-collapsed-change';");
    expect(source).toContain('parseHeadings(content)');
    expect(source).toContain('const handleCollapsedToggle = useCallback(() => {');
    expect(source).toContain('onClick={handleCollapsedToggle}');
    expect(source).not.toContain('useLayoutEffect');
    expect(source).not.toContain("setProperty('--toc-width'");
    expect(source).not.toContain("setProperty('--toc-margin'");
    expect(source).not.toContain('removeProperty(\'--toc-width\')');
    expect(source).not.toContain('setCollapsed(value => {');
    expect(source).not.toContain('useDeferredValue');
  });

  it('keeps the TOC handle inside the rail instead of floating as a viewport button', () => {
    const filePath = path.resolve(process.cwd(), 'components/TableOfContents.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('data-markdown-toc-toggle');
    expect(source).toContain('className="absolute -left-5 top-0');
    expect(source).toContain('aria-expanded={!collapsed}');
    expect(source).not.toContain('className="hidden xl:flex fixed');
    expect(source).not.toContain('right: `calc(var(--right-panel-width, 0px) + ${NAV_W}px)`');
    expect(source).not.toContain('right: `calc(var(--right-panel-width, 0px) + ${collapsed ? 0 : NAV_W}px)`');
  });

  it('does not swallow anchor navigation when rendered headings are not yet available', () => {
    const filePath = path.resolve(process.cwd(), 'components/TableOfContents.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('findHeadingElementById(headings[idx])');
    expect(source).toContain('if (!el) {\n      setActiveIdx(idx);\n      return;\n    }\n    e.preventDefault();');
    expect(source).not.toContain('const handleClick = (e: React.MouseEvent, idx: number) => {\n    e.preventDefault();');
  });
});
