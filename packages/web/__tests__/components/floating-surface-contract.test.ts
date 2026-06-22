import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('floating surface contract', () => {
  it('provides one shared surface class and dismiss hook for product popovers', () => {
    const source = readSource('components/shared/FloatingSurface.tsx');

    expect(source).toContain('export const FLOATING_SURFACE_CLASS');
    expect(source).toContain('export const FLOATING_CARD_SURFACE_CLASS');
    expect(source).toContain('export function useDismissableFloatingLayer');
    expect(source).toContain('Escape');
    expect(source).toContain('mousedown');
  });

  it('uses the shared surface primitive on high-frequency menus', () => {
    const files = [
      'components/panels/SyncPopover.tsx',
      'components/file-tree/FileTreeContextMenus.tsx',
      'components/TitlebarTabStrip.tsx',
      'components/ask/RuntimeIconSwitcher.tsx',
    ];

    for (const file of files) {
      const source = readSource(file);
      expect(source, file).toContain('@/components/shared/FloatingSurface');
      expect(source, file).not.toContain('className="fixed z-50');
    }
  });
});
