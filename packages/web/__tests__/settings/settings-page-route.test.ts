import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('settings page route', () => {
  it('backs /settings navigation with a real route', () => {
    const routePath = path.join(ROOT, 'app', 'settings', 'page.tsx');

    expect(fs.existsSync(routePath)).toBe(true);

    const source = fs.readFileSync(routePath, 'utf-8');
    expect(source).toContain("from '@/components/settings/SettingsContent'");
    expect(source).toContain('variant="panel"');
    expect(source).toContain('visible');
  });
});
