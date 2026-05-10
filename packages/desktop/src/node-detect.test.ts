import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('node-detect command execution', () => {
  it('does not interpolate discovered executable paths into shell command strings', () => {
    const source = fs.readFileSync(path.join(__dirname, 'node-detect.ts'), 'utf-8');

    expect(source).not.toContain("import { exec,");
    expect(source).not.toContain('promisify(exec)');
    expect(source).not.toContain('`"${npmBin}" root -g`');
    expect(source).not.toContain("'npm root -g'");
    expect(source).not.toContain('`${sh} -il -c "which node"');
  });
});
