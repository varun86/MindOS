import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('mindos start host binding', () => {
  it('binds to localhost by default', async () => {
    const { resolveWebHost } = await import('../../packages/mindos/bin/commands/start.js');

    expect(resolveWebHost({}, {})).toBe('127.0.0.1');
  });

  it('binds to all interfaces only when LAN access is enabled in settings', async () => {
    const { resolveWebHost } = await import('../../packages/mindos/bin/commands/start.js');

    expect(resolveWebHost({ allowNetworkAccess: true }, {})).toBe('0.0.0.0');
    expect(resolveWebHost({ allowNetworkAccess: false }, {})).toBe('127.0.0.1');
  });

  it('keeps an explicit MINDOS_WEB_HOST override for advanced deployments', async () => {
    const { resolveWebHost } = await import('../../packages/mindos/bin/commands/start.js');

    expect(resolveWebHost({ allowNetworkAccess: false }, { MINDOS_WEB_HOST: '::' })).toBe('::');
  });

  it('uses argv-safe subprocess calls for daemon ready notifications', () => {
    const source = fs.readFileSync(path.join(ROOT, 'packages', 'mindos', 'bin', 'commands', 'start.js'), 'utf-8');

    expect(source).not.toContain('execSync(');
    expect(source).toContain("execFileSync('osascript', [");
    expect(source).toContain("'-e'");
    expect(source).toContain("execFileSync('notify-send', ['MindOS Ready', `http://localhost:${webPort}`]");
  });
});
