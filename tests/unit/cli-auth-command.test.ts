import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(ROOT, 'packages', 'mindos', 'bin', 'cli.js');
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeHome(config: Record<string, unknown> = {}): { home: string; configPath: string } {
  const home = mkdtempSync(path.join(tmpdir(), 'mindos-cli-auth-command-'));
  tempRoots.push(home);
  const configDir = path.join(home, '.mindos');
  mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, 'config.json');
  writeFileSync(configPath, JSON.stringify({
    mindRoot: path.join(home, 'mind'),
    ...config,
  }, null, 2), 'utf-8');
  return { home, configPath };
}

function runCli(home: string, args: string[], input = ''): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: home, NODE_ENV: 'test' },
      input,
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      exitCode: e.status ?? 1,
    };
  }
}

describe('mindos auth reset-web-password', () => {
  it('resets the local Web UI password without rotating the Web session secret', () => {
    const { home, configPath } = makeHome({
      webPassword: 'old-password',
      webSessionSecret: 'stable-session-secret',
      customValue: 'keep-me',
    });

    const result = runCli(home, ['auth', 'reset-web-password'], 'new-password\nnew-password\n');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    expect(result.exitCode).toBe(0);
    expect(config.webPassword).toBe('new-password');
    expect(config.webSessionSecret).toBe('stable-session-secret');
    expect(config.customValue).toBe('keep-me');
    expect(result.stdout).toContain('Existing browser sessions are kept');
  });

  it('migrates the previous Web UI password into the session secret when none exists yet', () => {
    const { home, configPath } = makeHome({ webPassword: 'old-password' });

    const result = runCli(home, ['auth', 'reset-web-password'], 'new-password\nnew-password\n');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    expect(result.exitCode).toBe(0);
    expect(config.webPassword).toBe('new-password');
    expect(config.webSessionSecret).toBe('old-password');
  });

  it('rejects a mismatched confirmation and leaves the config unchanged', () => {
    const { home, configPath } = makeHome({
      webPassword: 'old-password',
      webSessionSecret: 'stable-session-secret',
    });

    const result = runCli(home, ['auth', 'reset-web-password'], 'new-password\nother-password\n');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Passwords do not match');
    expect(config.webPassword).toBe('old-password');
    expect(config.webSessionSecret).toBe('stable-session-secret');
  });

  it('masks the Web session secret in config output', () => {
    const { home } = makeHome({
      webPassword: 'web-password',
      webSessionSecret: 'stable-session-secret',
    });

    const result = runCli(home, ['config', 'show', '--json']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('stable-session-secret');
    expect(result.stdout).toContain('stable****');
  });
});
