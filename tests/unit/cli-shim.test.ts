import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindos-cli-shim-test-'));
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('CLI shim generation', () => {
  function mockWindowsCliShim(cliPath = 'C:\\MindOS\\bin\\cli.js') {
    vi.doMock('node:os', () => ({
      homedir: () => tempDir,
      platform: () => 'win32',
    }));
    vi.doMock('../../packages/mindos/bin/lib/constants.js', () => ({
      CLI_PATH: cliPath,
    }));
  }

  it('escapes Windows batch metacharacters in generated set values', async () => {
    mockWindowsCliShim('C:\\MindOS%TEMP%^A!B\\bin\\cli.js');

    const shim = await import('../../packages/mindos/bin/lib/cli-shim.js') as {
      escapeCmdSetValue: (value: string) => string;
      ensureCliShim: () => boolean;
    };

    expect(shim.escapeCmdSetValue('C:\\MindOS%TEMP%^A!B\\bin\\cli.js')).toBe(
      'C:\\MindOS%%TEMP%%^^A^^!B\\bin\\cli.js',
    );

    shim.ensureCliShim();

    const cmd = fs.readFileSync(path.join(tempDir, '.mindos', 'bin', 'mindos.cmd'), 'utf-8');
    expect(cmd).toContain('set "CLI=C:\\MindOS%%TEMP%%^^A^^!B\\bin\\cli.js"');
  });

  it('adds the Windows shim directory to the user PATH registry, not only a PowerShell profile', async () => {
    mockWindowsCliShim();

    const mockExecFileSync = vi.fn((command: string, args: string[]) => {
      expect(command).toBe('powershell.exe');
      if (args.some((arg) => arg.includes('GetEnvironmentVariable'))) {
        return 'C:\\Windows\\System32';
      }
      return '';
    });
    vi.doMock('node:child_process', () => ({
      execFileSync: mockExecFileSync,
    }));

    const shim = await import('../../packages/mindos/bin/lib/cli-shim.js') as {
      ensureCliShim: () => boolean;
    };

    expect(shim.ensureCliShim()).toBe(true);

    expect(mockExecFileSync).toHaveBeenCalledWith('powershell.exe', [
      '-NoProfile',
      '-Command',
      '[Environment]::GetEnvironmentVariable("Path", "User")',
    ], expect.any(Object));
    expect(mockExecFileSync).toHaveBeenCalledWith('powershell.exe', [
      '-NoProfile',
      '-Command',
      expect.stringContaining("[Environment]::SetEnvironmentVariable('Path', '"),
    ], expect.any(Object));
  });
});
