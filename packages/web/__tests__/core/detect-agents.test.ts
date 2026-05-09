import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { execFileSync, execSync } from 'child_process';
import { detectAgentPresence, MCP_AGENTS } from '@/lib/mcp-agents';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(() => { throw new Error('shell command lookup should not be used'); }),
}));

const mockExecFileSync = vi.mocked(execFileSync);
const mockExecSync = vi.mocked(execSync);

describe('detectAgentPresence', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    mockExecFileSync.mockReset();
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => { throw new Error('shell command lookup should not be used'); });
    existsSyncSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for unknown agent key', () => {
    expect(detectAgentPresence('nonexistent-agent')).toBe(false);
  });

  it('returns true when CLI is found via which', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/bin/claude'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('claude-code')).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith('which', ['claude'], { stdio: 'pipe' });
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns true when data directory exists (no CLI)', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('.cursor');
    });
    expect(detectAgentPresence('cursor')).toBe(true);
  });

  it('returns false when neither CLI nor dirs found', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('claude-code')).toBe(false);
  });

  it('returns true when dir found even if CLI fails (gemini-cli)', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('.gemini');
    });
    expect(detectAgentPresence('gemini-cli')).toBe(true);
  });

  it('detects cline via globalStorage dir', () => {
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('saoudrizwan.claude-dev');
    });
    expect(detectAgentPresence('cline')).toBe(true);
  });

  it('detects codebuddy via codebuddy CLI', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/local/bin/codebuddy'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('codebuddy')).toBe(true);
  });

  it('detects iflow-cli via CLI', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/bin/iflow'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('iflow-cli')).toBe(true);
  });

  it('detects augment via dir', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('.augment');
    });
    expect(detectAgentPresence('augment')).toBe(true);
  });

  it('detects roo via globalStorage dir', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('rooveterinaryinc.roo-cline');
    });
    expect(detectAgentPresence('roo')).toBe(true);
  });

  it('detects kimi-cli via CLI', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/bin/kimi'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('kimi-cli')).toBe(true);
  });

  it('detects qwen-code via dir', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('.qwen');
    });
    expect(detectAgentPresence('qwen-code')).toBe(true);
  });

  it('detects qoder via CLI', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/bin/qoder'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('qoder')).toBe(true);
  });

  it('detects trae-cn via dir', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    existsSyncSpy.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('Trae CN');
    });
    expect(detectAgentPresence('trae-cn')).toBe(true);
  });

  it('detects opencode via CLI', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/bin/opencode'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('opencode')).toBe(true);
  });

  it('detects pi via CLI', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('/usr/bin/pi'));
    existsSyncSpy.mockReturnValue(false);
    expect(detectAgentPresence('pi')).toBe(true);
  });

  it('every agent in MCP_AGENTS has presenceCli or presenceDirs', () => {
    for (const [key, agent] of Object.entries(MCP_AGENTS)) {
      const hasCli = !!agent.presenceCli;
      const hasDirs = Array.isArray(agent.presenceDirs) && agent.presenceDirs.length > 0;
      expect(hasCli || hasDirs, `${key} missing presenceCli and presenceDirs`).toBe(true);
    }
  });
});
