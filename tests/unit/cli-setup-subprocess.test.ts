import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('setup.js subprocess contract', () => {
  it('uses argv-safe subprocess calls for setup helpers', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', 'setup.js'), 'utf-8');

    expect(source).not.toContain('execSync(');
    expect(source).not.toContain('exec(`node');
    expect(source).toContain("execFileSync('tar', ['-xzf', tarPath, '-C', extractDir]");
    expect(source).toContain("execFileSync('open', [url]");
    expect(source).toContain("execFileSync('cmd.exe', ['/c', 'start', '', url]");
    expect(source).toContain("execFileSync(process.execPath, [cliPath, 'restart']");
    expect(source).toContain("resolveNpxInvocation(args)");
    expect(source).toContain("resolveNpmInvocation(['link'])");
  });
});
