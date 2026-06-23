import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('mobile drawer accessibility contract', () => {
  it('exposes the mobile sidebar as a dialog with focus and background guards', () => {
    const source = readSource('components/SidebarLayout.tsx');

    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain('aria-expanded={mobileOpen}');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('mobileDrawerCloseRef.current?.focus()');
    expect(source).toContain("if (e.key === 'Escape') setMobileOpen(false)");
    expect(source).toContain('aria-hidden={mobileOpen || undefined}');
    expect(source).toContain('inert={mobileOpen ? true : undefined}');
  });
});
