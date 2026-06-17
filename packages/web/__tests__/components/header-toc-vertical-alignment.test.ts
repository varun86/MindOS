import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Desktop layout: fixed titlebar row (var(--app-titlebar-h) = 42px) on top, then the
// shared workspace header. Anything pinned "below the view header" must use
// calc(var(--app-titlebar-h) + var(--workspace-header-h)), and JS scroll math must
// measure the rendered view header at runtime. See wiki/41-dev-pitfall-patterns.md 规则 10.
describe('Page header and TOC vertical alignment', () => {
  it('TOC toggle and panel sit below titlebar row + view header', () => {
    const filePath = path.resolve(process.cwd(), 'components/TableOfContents.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    // Toggle button: just below the view header (titlebar + shared workspace header)
    expect(source).toContain('top-[calc(var(--app-titlebar-h)+var(--workspace-header-h))]');
    expect(source).not.toContain('top-[46px]');
    expect(source).not.toContain('top-[52px]');

    // Aside panel: starts below the titlebar row, full remaining height
    expect(source).toContain('top: `calc(var(--app-titlebar-h) + ${VIEW_HEADER_CSS_VAR})`');
    expect(source).toContain('height: `calc(100vh - var(--app-titlebar-h) - ${VIEW_HEADER_CSS_VAR})`');

    // Scroll math (IntersectionObserver rootMargin + scrollTo) must include the
    // titlebar offset and the measured view header at runtime, not a hardcoded constant.
    expect(source).toContain('getPropertyValue(\'--app-titlebar-h\')');
    expect(source).toContain('titlebarOffset() + viewHeaderHeight() + 12');
    expect(source).toContain("document.querySelector<HTMLElement>('.view-page-topbar')");
    expect(source).not.toContain('const SCROLL_OFFSET');
    expect(source).not.toContain('const TOPBAR_H = 46');
  });

  it('FindInPage sticky top sits below titlebar row + view header on desktop', () => {
    const filePath = path.resolve(process.cwd(), 'components/FindInPage.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('md:top-[calc(var(--app-titlebar-h)+var(--workspace-header-h))]');
    expect(source).not.toContain('md:top-[46px]');
    expect(source).not.toContain('md:top-[44px]');
  });
});
