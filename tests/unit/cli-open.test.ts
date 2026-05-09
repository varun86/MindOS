import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildOpenUrl } from '../../packages/mindos/bin/commands/open.js';

const ROOT = path.resolve(__dirname, '..', '..');

describe('mindos open', () => {
  it('builds a localhost URL only from valid TCP ports', () => {
    expect(buildOpenUrl({ MINDOS_WEB_PORT: '4567' })).toBe('http://localhost:4567');
    expect(buildOpenUrl({ MINDOS_WEB_PORT: '0' })).toBe('http://localhost:3456');
    expect(buildOpenUrl({ MINDOS_WEB_PORT: '70000' })).toBe('http://localhost:3456');
    expect(buildOpenUrl({ MINDOS_WEB_PORT: '3456\" & calc' })).toBe('http://localhost:3456');
  });

  it('launches browsers through argv instead of interpolated shell commands', () => {
    const source = fs.readFileSync(path.join(ROOT, 'packages', 'mindos', 'bin', 'commands', 'open.js'), 'utf-8');

    expect(source).toContain('execFileSync(');
    expect(source).not.toContain('execSync(`start');
    expect(source).not.toContain('execSync(`${cmd}');
    expect(source).not.toContain('execSync(`open');
    expect(source).not.toContain('execSync(`xdg-open');
  });
});
