import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('mindos gateway service root resolution', () => {
  it('uses argv command lookup instead of shell strings when finding mindos binaries', () => {
    const source = fs.readFileSync(path.join(ROOT, 'packages', 'mindos', 'bin', 'lib', 'gateway.js'), 'utf-8');

    expect(source).toContain("execFileSync(process.platform === 'win32' ? 'where' : 'which', ['mindos']");
    expect(source).not.toContain("'where mindos'");
    expect(source).not.toContain("'which mindos'");
  });
});
