import { describe, expect, it } from 'vitest';
import { normalizeShellPathname, shouldLoadShellData, shouldRenderShell } from '@/lib/shell-route';

describe('shell route data boundaries', () => {
  it('normalizes pathnames from proxy headers', () => {
    expect(normalizeShellPathname(null)).toBe('/');
    expect(normalizeShellPathname('settings?tab=ai')).toBe('/settings');
    expect(normalizeShellPathname('/setup#ai')).toBe('/setup');
  });

  it('keeps auth and setup routes free of vault shell data', () => {
    expect(shouldLoadShellData('/login')).toBe(false);
    expect(shouldLoadShellData('/login?redirect=%2F')).toBe(false);
    expect(shouldLoadShellData('/setup')).toBe(false);
    expect(shouldLoadShellData('/setup/ai')).toBe(false);
    expect(shouldRenderShell('/setup')).toBe(false);
  });

  it('continues loading shell data for normal app routes', () => {
    expect(shouldLoadShellData('/')).toBe(true);
    expect(shouldLoadShellData('/settings')).toBe(true);
    expect(shouldLoadShellData('/agents')).toBe(true);
    expect(shouldLoadShellData('/view/Notes/A.md')).toBe(true);
  });
});
