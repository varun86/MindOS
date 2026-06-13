import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ViewPageClient header layout', () => {
  it('uses a full-width header row instead of centering actions inside content-width', () => {
    const filePath = path.resolve(process.cwd(), 'app/view/[...path]/ViewPageClient.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('className="view-page-topbar sticky top-[52px] md:top-[var(--app-titlebar-h)] z-20');
    expect(source).toContain('className="view-header-row w-full min-w-0 flex items-center justify-between gap-3 h-full"');
    expect(source).not.toContain('className="content-width flex items-center justify-between gap-2 h-full"');
  });

  it('lets desktop actions occupy the TOC header band without moving document content', () => {
    const viewFile = path.resolve(process.cwd(), 'app/view/[...path]/ViewPageClient.tsx');
    const cssFile = path.resolve(process.cwd(), 'app/globals.css');
    const viewSource = fs.readFileSync(viewFile, 'utf8');
    const cssSource = fs.readFileSync(cssFile, 'utf8');

    expect(viewSource).toContain('view-header-actions-reserve hidden xl:block shrink-0');
    expect(viewSource).toContain('className="view-header-actions flex items-center gap-1.5 md:gap-2 shrink-0"');

    expect(cssSource).toContain('.view-header-actions-reserve');
    expect(cssSource).toContain('.view-header-actions');
    expect(cssSource).toContain('position: fixed;');
    expect(cssSource).toContain('top: calc(var(--app-titlebar-h) + 0.4375rem);');
    expect(cssSource).toContain('right: calc(var(--right-panel-width, 0px) + var(--right-agent-detail-width, 0px) + 1.5rem);');
    expect(cssSource).toContain('z-index: var(--z-app-nav);');
  });
});
