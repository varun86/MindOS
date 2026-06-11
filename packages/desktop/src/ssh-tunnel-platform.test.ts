import { describe, expect, it, vi } from 'vitest';
import os from 'os';
import path from 'path';
import { readFileSync } from 'fs';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'home') return os.homedir();
      return '/tmp';
    },
  },
}));

import { expandSshTilde, resolveSshAddPath, verifyPidIsSshProcess } from './ssh-tunnel';

describe('verifyPidIsSshProcess', () => {
  it('refuses to confirm a reused PID owned by a non-ssh process on win32', () => {
    const result = verifyPidIsSshProcess(4321, 'win32', () => 'chrome.exe');
    expect(result).toBe(false);
  });

  it('confirms an ssh.exe process on win32 via Win32_Process name', () => {
    const calls: Array<{ command: string }> = [];
    const result = verifyPidIsSshProcess(4321, 'win32', (command) => {
      calls.push({ command });
      return 'ssh.exe';
    });
    expect(result).toBe(true);
    expect(calls[0].command).toBe('powershell.exe');
  });

  it('confirms ssh on unix via ps comm', () => {
    expect(verifyPidIsSshProcess(4321, 'darwin', () => 'ssh\n')).toBe(true);
    expect(verifyPidIsSshProcess(4321, 'darwin', () => 'node\n')).toBe(false);
  });

  it('treats verification failure as not-ssh (conservative: never kill unverified)', () => {
    const result = verifyPidIsSshProcess(4321, 'win32', () => { throw new Error('powershell missing'); });
    expect(result).toBe(false);
  });
});

describe('resolveSshAddPath', () => {
  it('derives ssh-add next to an absolutely-resolved ssh binary', () => {
    const sshPath = 'C:\\Program Files\\Git\\usr\\bin\\ssh.exe';
    const expected = path.win32.join('C:\\Program Files\\Git\\usr\\bin', 'ssh-add.exe');
    expect(resolveSshAddPath(sshPath, 'win32', (p) => p === expected)).toBe(expected);
  });

  it('falls back to bare ssh-add when the sibling does not exist', () => {
    expect(resolveSshAddPath('/usr/bin/ssh', 'darwin', () => false)).toBe('ssh-add');
  });

  it('falls back to bare ssh-add for bare/unresolved ssh commands', () => {
    expect(resolveSshAddPath('ssh.exe', 'win32', () => true)).toBe('ssh-add');
    expect(resolveSshAddPath(null, 'darwin', () => true)).toBe('ssh-add');
  });
});

describe('expandSshTilde', () => {
  const home = '/home/u';

  it('expands ~/ and bare ~ to the home directory', () => {
    expect(expandSshTilde('~', home)).toBe(home);
    expect(expandSshTilde('~/.ssh/id_ed25519', home)).toBe(path.join(home, '.ssh', 'id_ed25519'));
  });

  it('passes ~user/... forms through unchanged (ssh resolves them natively)', () => {
    expect(expandSshTilde('~deploy/.ssh/key', home)).toBe('~deploy/.ssh/key');
  });

  it('leaves absolute and relative paths untouched', () => {
    expect(expandSshTilde('/etc/ssh/key', home)).toBe('/etc/ssh/key');
    expect(expandSshTilde('keys/id_rsa', home)).toBe('keys/id_rsa');
  });
});

describe('ssh-tunnel windows console hygiene contract', () => {
  it('passes windowsHide to every child-process call site', () => {
    const source = readFileSync(path.join(__dirname, 'ssh-tunnel.ts'), 'utf-8');
    const tokens = ['spawn(', 'execFileAsync(', 'execFileSync('];
    for (const token of tokens) {
      let idx = source.indexOf(token);
      while (idx !== -1) {
        const window = source.slice(idx, idx + 700);
        expect(window, `call site at index ${idx} (${token}) missing windowsHide`).toContain('windowsHide');
        idx = source.indexOf(token, idx + 1);
      }
    }
  });

  it('hardens askpass temp files: random name + exclusive create', () => {
    const source = readFileSync(path.join(__dirname, 'ssh-tunnel.ts'), 'utf-8');
    expect(source).toContain("randomBytes(16).toString('hex')");
    expect(source).not.toContain('mindos-askpass-${Date.now()}');
    expect(source).toContain("flag: 'wx'");
  });
});
