/**
 * Auto-updater — checks GitHub Releases for updates.
 * Uses electron-updater with non-intrusive notifications.
 */
import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow, app, type IpcMainInvokeEvent } from 'electron';

export interface UpdaterOptions {
  /** Called right before quitAndInstall so main can skip its cleanup handler */
  onBeforeQuitAndInstall?: () => void;
  /** Trusted-side IPC guard supplied by main.ts. */
  assertTrustedLocalRenderer?: (event: IpcMainInvokeEvent, capability: string) => void;
}

export function setupUpdater(opts?: UpdaterOptions): () => void {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    autoUpdater.channel = 'latest-arm64';
  } else if (process.platform === 'win32' && process.arch === 'arm64') {
    autoUpdater.channel = 'latest-arm64';
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;

  let isDownloaded = false;

  autoUpdater.on('update-available', (info) => {
    if (info.version === app.getVersion()) return;

    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      win.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      win.webContents.send('update-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    isDownloaded = true;
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      win.webContents.send('update-ready');
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
    // Notify renderer so UI can show error instead of stuck progress
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      win.webContents.send('update-error', { message: err.message });
    }
  });

  // IPC handlers
  ipcMain.handle('check-update', async (event) => {
    opts?.assertTrustedLocalRenderer?.(event, 'check-update');
    try {
      const result = await autoUpdater.checkForUpdates();
      const updateVersion = result?.updateInfo?.version;
      const available = !!updateVersion && updateVersion !== app.getVersion();
      return { available, version: updateVersion };
    } catch {
      return { available: false };
    }
  });

  ipcMain.handle('install-update', async (event) => {
    opts?.assertTrustedLocalRenderer?.(event, 'install-update');
    if (!isDownloaded) {
      await autoUpdater.downloadUpdate();
    }
    // Signal main process to skip cleanup — let the installer relaunch
    opts?.onBeforeQuitAndInstall?.();
    autoUpdater.quitAndInstall(false, true);
  });

  // Silent check on startup (after 10s delay), then every 12 hours
  const startupCheck = setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[MindOS:updater] Startup check failed:', err?.message);
    });
  }, 10_000);
  const periodicCheck = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[MindOS:updater] Periodic check failed:', err?.message);
    });
  }, 12 * 60 * 60 * 1000);

  // Return cleanup function
  return () => {
    clearTimeout(startupCheck);
    clearInterval(periodicCheck);
  };
}
