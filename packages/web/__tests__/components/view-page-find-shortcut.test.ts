import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ViewPageClient find shortcut', () => {
  it('handles browser key events that report modified F as uppercase', () => {
    const filePath = path.resolve(process.cwd(), 'app/view/[...path]/ViewPageClient.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('const key = e.key.toLowerCase();');
    expect(source).toContain("key === 'f' && !editing");
    expect(source).toContain("key === 's'");
    expect(source).not.toContain("e.key === 'f' && !editing");
    expect(source).not.toContain("e.key === 's'");
  });
});
