import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('process-manager subprocess cleanup contract', () => {
  it('uses argv-safe subprocess calls for port and process probes', () => {
    const source = readFileSync(path.join(__dirname, 'process-manager.ts'), 'utf-8');

    expect(source).not.toContain("require('child_process')");
    expect(source).not.toContain('execAsync(');
    expect(source).not.toContain('lsof -ti:${port}');
    expect(source).not.toContain('ss -tlnp sport = :${port}');
    expect(source).not.toContain('fuser ${port}/tcp 2>&1');
    expect(source).not.toContain('wmic process where ProcessId=${pid}');
    expect(source).not.toContain('ps -p ${pid} -o comm=');
    expect(source).toContain("execFileAsync('lsof', [`-ti:${port}`]");
    expect(source).toContain("execFileAsync('ss', ['-tlnp', 'sport', '=', `:${port}`]");
    expect(source).toContain("execFileAsync('fuser', [`${port}/tcp`]");
    expect(source).toContain("execFileAsync('wmic', ['process', 'where', `ProcessId=${pid}`");
    expect(source).toContain("execFileAsync('ps', ['-p', String(pid), '-o', 'comm=']");
  });
});
