import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Sidebar width contract', () => {
  it('keeps sidebar chrome widths behind shared constants instead of inline widths', () => {
    const activityBar = readSource('components/ActivityBar.tsx');
    const leftPanel = readSource('hooks/useLeftPanel.ts');
    const sidebarLayout = readSource('components/SidebarLayout.tsx');

    expect(activityBar).toContain("from '@/lib/config/panel-sizes'");
    expect(leftPanel).toContain("import { MIN_PANEL_WIDTH, MAX_PANEL_WIDTH_ABS } from '@/components/Panel'");
    expect(leftPanel).toContain("import { RAIL_WIDTH_COLLAPSED, RAIL_WIDTH_EXPANDED } from '@/components/ActivityBar'");
    expect(leftPanel).not.toContain('280');
    expect(leftPanel).not.toContain('56');

    expect(sidebarLayout).toContain('MOBILE_SIDEBAR');
    expect(sidebarLayout).not.toContain('w-[85vw]');
    expect(sidebarLayout).not.toContain('max-w-[320px]');
  });

  it('routes MindOS logo entries to the product Home instead of Wiki or Echo', () => {
    const activityBar = readSource('components/ActivityBar.tsx');
    const sidebarLayout = readSource('components/SidebarLayout.tsx');

    expect(activityBar).toContain("router.push('/')");
    expect(activityBar).not.toContain('router.push(ROUTE_PANEL_HREF.files)');
    expect(sidebarLayout).toContain('<Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">');
    expect(sidebarLayout).not.toContain('href={ROUTE_PANEL_HREF.files}');
  });

  it('keeps titlebar actions positioned from the live rail width', () => {
    const titlebarRow = readSource('components/TitlebarRow.tsx');
    const sidebarLayout = readSource('components/SidebarLayout.tsx');
    const globals = readSource('app/globals.css');

    expect(titlebarRow).toContain("left: 'var(--rail-width, 48px)'");
    expect(titlebarRow).toContain("paddingLeft: 'max(0px, calc(var(--window-controls-left, 0px) - var(--rail-width, 48px)))'");
    expect(titlebarRow).toContain('z-app-rail-affordance');
    expect(sidebarLayout).toContain('--rail-width: ${lp.railWidth}px;');
    expect(titlebarRow).not.toContain('--titlebar-row-left');
    expect(sidebarLayout).not.toContain('--titlebar-row-left');
    expect(globals).not.toContain('--titlebar-row-left');
  });
});
