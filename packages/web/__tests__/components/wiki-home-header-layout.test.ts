import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('WikiHomeContent header layout', () => {
  it('uses the shared content page shell and avoids a decorative title rail', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'components/WikiHomeContent.tsx'), 'utf8');

    expect(source).toContain('ContentPageShell');
    expect(source).toContain('data-content-page-shell="wiki"');
    expect(source).toContain('<header className="mb-10">');
    expect(source).toContain('<h1 className="text-2xl font-semibold tracking-tight text-foreground">');
    expect(source).toContain('<p className="mt-1 text-sm text-muted-foreground">');
    expect(source).not.toContain('bg-gradient-to-b from-[var(--amber)]');
    expect(source).not.toContain('w-1 h-7 rounded-full');
    expect(source).not.toContain('pl-4 -mt-3');
  });
});
