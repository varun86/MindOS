import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { assessDeletionRisk, isWindowsDeviceNamespacePath, safeRmSync } from './safe-rm';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('safe-rm deletion risk assessment', () => {
  it('does not treat in-config child paths with consecutive dots as system paths', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'mindos-safe-rm-'));
    tempRoots.push(home);
    const configDir = path.join(home, '.mindos');

    const risks = assessDeletionRisk(path.join(configDir, '..cache', 'runtime'), configDir);

    expect(risks.isSystemPath).toBe(false);
  });

  it('treats sibling paths outside config as system paths', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'mindos-safe-rm-'));
    tempRoots.push(home);
    const configDir = path.join(home, '.mindos');

    const risks = assessDeletionRisk(path.join(home, '.mindos-other', 'runtime'), configDir);

    expect(risks.isSystemPath).toBe(true);
  });

  it('detects symlink parents through case-variant config paths', () => {
    // macOS filesystems are case-insensitive by default, so an attacker (or a
    // confused caller) can reach the same symlink through '.MINDOS'.
    if (process.platform !== 'darwin') return;
    const home = mkdtempSync(path.join(tmpdir(), 'mindos-safe-rm-'));
    tempRoots.push(home);
    const configDir = path.join(home, '.mindos');
    mkdirSync(path.join(configDir, 'real-target'), { recursive: true });
    symlinkSync(path.join(configDir, 'real-target'), path.join(configDir, 'sub'));

    const risks = assessDeletionRisk(
      path.join(home, '.MINDOS', 'sub', 'child', 'file'),
      configDir,
    );

    expect(risks.hasSymlinkParent).toBe(true);
  });

  it('detects symlink parents inside the boundary', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'mindos-safe-rm-'));
    tempRoots.push(home);
    const configDir = path.join(home, '.mindos');
    mkdirSync(path.join(configDir, 'real-target'), { recursive: true });
    symlinkSync(path.join(configDir, 'real-target'), path.join(configDir, 'sub'));

    const risks = assessDeletionRisk(
      path.join(configDir, 'sub', 'child', 'file'),
      configDir,
    );

    expect(risks.hasSymlinkParent).toBe(true);
  });
});

describe('isWindowsDeviceNamespacePath', () => {
  it('rejects \\\\?\\ device-namespace paths on Windows', () => {
    expect(isWindowsDeviceNamespacePath('\\\\?\\C:\\Users\\x\\.mindos\\runtime')).toBe(true);
  });

  it('rejects \\\\.\\ device-namespace paths', () => {
    expect(isWindowsDeviceNamespacePath('\\\\.\\PhysicalDrive0\\x')).toBe(true);
  });

  it('rejects forward-slash device-namespace variants', () => {
    expect(isWindowsDeviceNamespacePath('//?/C:/x')).toBe(true);
  });

  it('allows normal UNC share paths', () => {
    expect(isWindowsDeviceNamespacePath('\\\\server\\share\\users\\x\\.mindos\\runtime')).toBe(false);
  });
});

describe('safeRmSync boundary symlink checks', () => {
  it('refuses deletion when a parent between target and boundary is a symlink', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mindos-safe-rm-'));
    tempRoots.push(root);
    const boundary = path.join(root, 'boundary');
    const realDir = path.join(root, 'real');
    mkdirSync(path.join(realDir, 'child'), { recursive: true });
    mkdirSync(boundary, { recursive: true });
    symlinkSync(realDir, path.join(boundary, 'link'));

    expect(() =>
      safeRmSync(path.join(boundary, 'link', 'child'), { recursive: true, force: true, boundary }),
    ).toThrow(/symlink/i);
    expect(existsSync(path.join(realDir, 'child'))).toBe(true);
  });

  it('deletes normally when boundary provided and chain is clean', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mindos-safe-rm-'));
    tempRoots.push(root);
    const boundary = path.join(root, 'boundary');
    const target = path.join(boundary, 'a', 'b');
    mkdirSync(target, { recursive: true });

    safeRmSync(target, { recursive: true, force: true, boundary });

    expect(existsSync(target)).toBe(false);
    expect(existsSync(path.join(boundary, 'a'))).toBe(true);
  });
});
