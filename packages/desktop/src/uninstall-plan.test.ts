import { describe, expect, it } from 'vitest';
import { planUninstall } from './uninstall-plan';

const never = () => false;

describe('planUninstall', () => {
  it('trashes the .app bundle on macOS', () => {
    const plan = planUninstall({ platform: 'darwin', installPath: '/Applications/MindOS.app', fileExists: never });
    expect(plan).toEqual({ kind: 'trash', target: '/Applications/MindOS.app' });
  });

  it('runs the NSIS uninstaller on Windows when present', () => {
    const plan = planUninstall({
      platform: 'win32',
      installPath: 'C:\\Users\\u\\AppData\\Local\\Programs\\MindOS',
      fileExists: (p) => p.endsWith('Uninstall MindOS.exe'),
    });
    expect(plan.kind).toBe('run-uninstaller');
    if (plan.kind === 'run-uninstaller') {
      expect(plan.uninstallerPath.endsWith('Uninstall MindOS.exe')).toBe(true);
    }
  });

  it('falls back to legacy Uninstall.exe name on Windows', () => {
    const plan = planUninstall({
      platform: 'win32',
      installPath: 'C:\\Program Files\\MindOS',
      fileExists: (p) => p.endsWith('\\Uninstall.exe'),
    });
    expect(plan.kind).toBe('run-uninstaller');
  });

  it('returns Settings → Apps instructions on Windows without an uninstaller', () => {
    const plan = planUninstall({ platform: 'win32', installPath: 'C:\\Program Files\\MindOS', fileExists: never });
    expect(plan.kind).toBe('manual');
    if (plan.kind === 'manual') expect(plan.reason).toBe('no-uninstaller');
  });

  it('trashes the AppImage file on Linux when APPIMAGE is set', () => {
    const plan = planUninstall({
      platform: 'linux',
      installPath: '/home/u/Apps/MindOS.AppImage',
      appImagePath: '/home/u/Apps/MindOS.AppImage',
      fileExists: never,
    });
    expect(plan).toEqual({ kind: 'trash', target: '/home/u/Apps/MindOS.AppImage' });
  });

  it('returns package-manager instructions on Linux deb/rpm installs', () => {
    const plan = planUninstall({ platform: 'linux', installPath: '/opt/MindOS', fileExists: never });
    expect(plan.kind).toBe('manual');
    if (plan.kind === 'manual') expect(plan.reason).toBe('package-manager');
  });
});
