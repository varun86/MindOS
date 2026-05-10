import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killAgent, resolveTerminalSpawn, spawnAcpAgent } from './subprocess';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);
const mockExecFileSync = vi.mocked(execFileSync);

function makeChildProcess() {
  return {
    pid: 4321,
    stdin: {},
    stdout: {},
    stderr: { on: vi.fn() },
    on: vi.fn(),
  } as any;
}

describe('spawnAcpAgent', () => {
  const originalPlatform = process.platform;
  const originalShell = process.env.SHELL;

  beforeEach(() => {
    mockExecFileSync.mockReset();
    mockSpawn.mockReset();
    mockSpawn.mockReturnValue(makeChildProcess());
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env.SHELL = originalShell;
  });

  it('spawns with the absolute executable resolved from the login shell on macOS', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.SHELL = '/bin/zsh';

    mockExecFileSync.mockImplementation((command, args) => {
      if (command === 'which') throw new Error('not found');
      if (command === '/bin/zsh' && Array.isArray(args) && String(args[1]).includes("command -v -- 'gemini'")) {
        return '/Users/test/bin/gemini\n' as any;
      }
      throw new Error(`unexpected command: ${String(command)}`);
    });

    spawnAcpAgent({ id: 'gemini' } as any);

    expect(mockSpawn).toHaveBeenCalledWith(
      '/Users/test/bin/gemini',
      ['--experimental-acp'],
      expect.objectContaining({ shell: false }),
    );
  });

  it('spawns Claude via the resolved npx executable instead of a bare command', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.SHELL = '/bin/zsh';

    mockExecFileSync.mockImplementation((command, args) => {
      if (command === 'which') throw new Error('not found');
      if (command === '/bin/zsh' && Array.isArray(args) && String(args[1]).includes("command -v -- 'npx'")) {
        return '/Users/test/bin/npx\n' as any;
      }
      throw new Error(`unexpected command: ${String(command)}`);
    });

    spawnAcpAgent({ id: 'claude' } as any);

    expect(mockSpawn).toHaveBeenCalledWith(
      '/Users/test/bin/npx',
      ['--yes', '@agentclientprotocol/claude-agent-acp'],
      expect.objectContaining({ shell: false }),
    );
  });
});

describe('killAgent', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('uses argv-safe taskkill for Windows process trees', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const acpProc = {
      id: 'acp-test-1',
      agentId: 'test',
      proc: makeChildProcess(),
      alive: true,
    };

    killAgent(acpProc);

    expect(mockExecFileSync).toHaveBeenCalledWith('taskkill', ['/PID', '4321', '/T', '/F'], { stdio: 'ignore' });
    expect(acpProc.alive).toBe(false);
  });

  it('keeps process cleanup subprocess calls argv-safe', () => {
    const source = fs.readFileSync(path.join(__dirname, 'subprocess.ts'), 'utf-8');

    expect(source).not.toContain('execSync(');
    expect(source).not.toContain('taskkill /PID ${pid}');
    expect(source).toContain("execFileSync('taskkill', ['/PID', String(pid), '/T', '/F']");
  });

  it('keeps ACP terminal commands out of unconditional shell execution', () => {
    const source = fs.readFileSync(path.join(__dirname, 'subprocess.ts'), 'utf-8');

    expect(source).not.toContain('shell: true,');
    expect(source).toContain('const terminalSpawn = resolveTerminalSpawn(params.command);');
    expect(source).toContain('shell: terminalSpawn.shell');
  });
});

describe('resolveTerminalSpawn', () => {
  const originalPlatform = process.platform;
  const originalShell = process.env.SHELL;

  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env.SHELL = originalShell;
  });

  it('resolves terminal commands without enabling a shell on Unix', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.SHELL = '/bin/zsh';

    mockExecFileSync.mockImplementation((command, args) => {
      if (command === 'which') throw new Error('not found');
      if (command === '/bin/zsh' && Array.isArray(args) && String(args[1]).includes("command -v -- 'node'")) {
        return '/usr/local/bin/node\n' as any;
      }
      throw new Error(`unexpected command: ${String(command)}`);
    });

    expect(resolveTerminalSpawn('node')).toEqual({
      command: '/usr/local/bin/node',
      shell: false,
    });
  });

  it('does not shell-evaluate unresolved command names with metacharacters', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.SHELL = '/bin/bash';
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not found');
    });

    expect(resolveTerminalSpawn('node && rm -rf /')).toEqual({
      command: 'node && rm -rf /',
      shell: false,
    });
  });

  it('uses a shell only for Windows cmd and bat launchers', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockExecFileSync.mockImplementation((command, args) => {
      if (command === 'where' && Array.isArray(args) && args[0] === 'npm') {
        return 'C:\\Users\\test\\AppData\\Roaming\\npm\\npm.cmd\r\n' as any;
      }
      throw new Error(`unexpected command: ${String(command)}`);
    });

    expect(resolveTerminalSpawn('npm')).toEqual({
      command: 'C:\\Users\\test\\AppData\\Roaming\\npm\\npm.cmd',
      shell: true,
    });
  });
});
