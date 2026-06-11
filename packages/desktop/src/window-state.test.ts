import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeData = new Map<string, unknown>();
let displays: Array<{ workArea: { x: number; y: number; width: number; height: number } }> = [];

vi.mock('electron', () => ({
  BrowserWindow: class {},
  screen: { getAllDisplays: () => displays },
}));

vi.mock('electron-store', () => ({
  default: class {
    get(key: string) { return storeData.get(key) ?? { width: 1200, height: 800 }; }
    set(key: string, value: unknown) { storeData.set(key, value); }
  },
}));

import { restoreWindowState, saveWindowStateNow } from './window-state';

const PRIMARY = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };

function fakeWindow(bounds: { x: number; y: number; width: number; height: number }, maximized = false) {
  return {
    isDestroyed: () => false,
    getBounds: () => bounds,
    isMaximized: () => maximized,
  } as never;
}

beforeEach(() => {
  storeData.clear();
  displays = [PRIMARY];
});

describe('restoreWindowState', () => {
  it('returns the saved state when the window is on a visible display', () => {
    storeData.set('windowState', { x: 100, y: 100, width: 800, height: 600 });
    expect(restoreWindowState()).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  });

  it('resets position when the saved bounds are on a disconnected monitor', () => {
    storeData.set('windowState', { x: -2000, y: 100, width: 800, height: 600 });
    const restored = restoreWindowState();
    expect(restored.x).toBeUndefined();
    expect(restored.y).toBeUndefined();
    expect(restored.width).toBe(800);
    expect(restored.height).toBe(600);
  });

  it('keeps the maximized flag when resetting an off-screen position', () => {
    storeData.set('windowState', { x: -2000, y: -2000, width: 800, height: 600, maximized: true });
    expect(restoreWindowState().maximized).toBe(true);
  });

  it('treats a window with under 100px visible overlap as off-screen', () => {
    // Top-left corner is 50px inside the display but 95% of the window hangs off the left edge
    storeData.set('windowState', { x: -750, y: 100, width: 800, height: 600 });
    const restored = restoreWindowState();
    expect(restored.x).toBeUndefined();
  });

  it('accepts a window mostly on a secondary display with negative coordinates', () => {
    displays = [PRIMARY, { workArea: { x: -1920, y: 0, width: 1920, height: 1080 } }];
    storeData.set('windowState', { x: -1800, y: 100, width: 800, height: 600 });
    expect(restoreWindowState().x).toBe(-1800);
  });
});

describe('saveWindowStateNow', () => {
  it('persists bounds and maximized state synchronously', () => {
    saveWindowStateNow(fakeWindow({ x: 10, y: 20, width: 640, height: 480 }, true));
    expect(storeData.get('windowState')).toEqual({ x: 10, y: 20, width: 640, height: 480, maximized: true });
  });
});
