import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Desktop layout: fixed titlebar row (var(--app-titlebar-h) = 42px) on top, then the
// 46px view header (sticky md:top-[var(--app-titlebar-h)]). Anything pinned "below the
// view header" must therefore sit at calc(var(--app-titlebar-h) + 46px), and JS scroll
// math must read the CSS variable at runtime. See wiki/41-dev-pitfall-patterns.md 规则 10.
describe('Page header and TOC vertical alignment', () => {
  it('TOC toggle and panel sit below titlebar row + view header', () => {
    const filePath = path.resolve(process.cwd(), 'components/TableOfContents.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    // Toggle button: just below the view header (titlebar + 46px view header on desktop)
    expect(source).toContain('top-[calc(var(--app-titlebar-h)+46px)]');
    expect(source).not.toContain('top-[46px]');
    expect(source).not.toContain('top-[52px]');

    // Aside panel: starts below the titlebar row, full remaining height
    expect(source).toContain('top: `calc(var(--app-titlebar-h) + ${TOPBAR_H}px)`');
    expect(source).toContain('height: `calc(100vh - var(--app-titlebar-h) - ${TOPBAR_H}px)`');

    // Scroll math (IntersectionObserver rootMargin + scrollTo) must include the
    // titlebar offset at runtime, not a hardcoded constant
    expect(source).toContain('getPropertyValue(\'--app-titlebar-h\')');
    expect(source).toContain('titlebarOffset() + TOPBAR_H + 12');
    expect(source).not.toContain('const SCROLL_OFFSET');
  });

  it('FindInPage sticky top sits below titlebar row + view header on desktop', () => {
    const filePath = path.resolve(process.cwd(), 'components/FindInPage.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('md:top-[calc(var(--app-titlebar-h)+46px)]');
    expect(source).not.toContain('md:top-[46px]');
    expect(source).not.toContain('md:top-[44px]');
  });
});
