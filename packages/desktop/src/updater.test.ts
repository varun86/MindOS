import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron-updater', () => ({
  autoUpdater: Object.assign(new EventEmitter(), {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  }),
}));

vi.mock('electron', () => ({
  app: { getVersion: () => '1.2.3' },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: vi.fn() },
}));

import { isUpdateAvailable } from './updater';

describe('isUpdateAvailable', () => {
  it('reports an update when the feed version is newer', () => {
    expect(isUpdateAvailable('1.2.4', '1.2.3')).toBe(true);
  });

  it('reports no update when versions are equal', () => {
    expect(isUpdateAvailable('1.2.3', '1.2.3')).toBe(false);
  });

  it('reports no update when running version is newer than the feed (rollback)', () => {
    expect(isUpdateAvailable('1.2.2', '1.2.3')).toBe(false);
    expect(isUpdateAvailable('1.2.2', '1.2.3', true)).toBe(false);
  });

  it('reports no update when the feed version is missing', () => {
    expect(isUpdateAvailable(undefined, '1.2.3')).toBe(false);
    expect(isUpdateAvailable('', '1.2.3')).toBe(false);
  });

  it('trusts an explicit electron-updater "not available" flag over version strings', () => {
    expect(isUpdateAvailable('9.9.9', '1.2.3', false)).toBe(false);
  });

  it('falls back to the electron-updater flag when versions are not valid semver', () => {
    expect(isUpdateAvailable('nightly-2', 'nightly-1', true)).toBe(true);
    expect(isUpdateAvailable('nightly-2', 'nightly-1')).toBe(false);
    expect(isUpdateAvailable('nightly-2', 'nightly-1', false)).toBe(false);
  });
});
