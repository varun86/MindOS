import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('fix-postcss-deps subprocess contract', () => {
  it('runs npm install with argv-safe subprocess APIs', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', 'fix-postcss-deps.cjs'), 'utf-8');

    expect(source).not.toContain('execSync(');
    expect(source).toContain("const { execFileSync } = require('child_process');");
    expect(source).toContain("execFileSync(invocation.command, invocation.args");
    expect(source).toContain("resolveNpmInvocation(['install', '--no-save', '--install-strategy=nested'])");
  });
});
