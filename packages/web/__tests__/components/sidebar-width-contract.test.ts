import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Sidebar width contract', () => {
  it('keeps sidebar chrome widths behind shared panel-size tokens', () => {
    const activityBar = readSource('components/ActivityBar.tsx');
    const leftPanel = readSource('hooks/useLeftPanel.ts');
    const sidebarLayout = readSource('components/SidebarLayout.tsx');
    const settingsContent = readSource('components/settings/SettingsContent.tsx');

    expect(activityBar).toContain("from '@/lib/config/panel-sizes'");
    expect(leftPanel).toContain("from '@/lib/config/panel-sizes'");
    expect(leftPanel).not.toContain("from '@/components/ActivityBar'");

    expect(sidebarLayout).toContain('MOBILE_SIDEBAR');
    expect(sidebarLayout).not.toContain('w-[85vw]');
    expect(sidebarLayout).not.toContain('max-w-[320px]');

    expect(settingsContent).toContain('SETTINGS_SIDEBAR');
    expect(settingsContent).not.toContain('w-[232px]');
  });
});
