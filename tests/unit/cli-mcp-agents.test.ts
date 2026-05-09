import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { detectAgentPresence } from '../../packages/mindos/bin/lib/mcp-agents.js';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFileSync: vi.fn(),
  execSync: vi.fn(() => {
    throw new Error('shell command lookup should not be used');
  }),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockExecFileSync = vi.mocked(execFileSync);
const mockExecSync = vi.mocked(execSync);
const originalPlatform = process.platform;

describe('CLI MCP agent detection', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockExecFileSync.mockReset();
    mockExecSync.mockReset();
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockImplementation(() => {
      throw new Error('shell command lookup should not be used');
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('checks CLI presence with execFileSync argv on Unix', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/local/bin/claude\n'));

    expect(detectAgentPresence('claude-code')).toBe(true);

    expect(mockExecFileSync).toHaveBeenCalledWith('which', ['claude'], { stdio: 'pipe' });
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('checks CLI presence with execFileSync argv on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockExecFileSync.mockReturnValue(Buffer.from('C:\\Tools\\claude.cmd\r\n'));

    expect(detectAgentPresence('claude-code')).toBe(true);

    expect(mockExecFileSync).toHaveBeenCalledWith('where', ['claude'], { stdio: 'pipe' });
    expect(mockExecSync).not.toHaveBeenCalled();
  });
});
