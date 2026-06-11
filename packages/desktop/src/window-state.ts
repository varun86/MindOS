/**
 * Window state persistence — save/restore window position and size.
 */
import { BrowserWindow, screen } from 'electron';
import Store from 'electron-store';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

const store = new Store<{ windowState: WindowState }>({
  name: 'mindos-window-state',
  defaults: {
    windowState: { width: 1200, height: 800 },
  },
});

// A window counts as visible only if a usable corner of it intersects a
// display work area — a top-left point check passes windows that are 95%
// off-screen after a monitor disconnect.
const MIN_VISIBLE_PX = 100;

export function restoreWindowState(): WindowState {
  const saved = store.get('windowState');

  // Validate that the saved position is on a visible display
  if (saved.x !== undefined && saved.y !== undefined) {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some((d) => {
      const { x, y, width, height } = d.workArea;
      const overlapW = Math.min(saved.x! + saved.width, x + width) - Math.max(saved.x!, x);
      const overlapH = Math.min(saved.y! + saved.height, y + height) - Math.max(saved.y!, y);
      return overlapW >= MIN_VISIBLE_PX && overlapH >= MIN_VISIBLE_PX;
    });
    if (!onScreen) {
      // Reset position if off-screen (e.g. monitor disconnected) — keep size and maximized flag
      return { width: saved.width, height: saved.height, maximized: saved.maximized };
    }
  }

  return saved;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function captureWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const bounds = win.getBounds();
  store.set('windowState', {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: win.isMaximized(),
  });
}

export function saveWindowState(win: BrowserWindow): void {
  // Debounce saves (move/resize fire rapidly)
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => captureWindowState(win), 300);
}

/** Immediate save for quit time — the debounced timer never fires before app.exit. */
export function saveWindowStateNow(win: BrowserWindow): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  captureWindowState(win);
}
