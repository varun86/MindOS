/**
 * Per-platform uninstall planning — pure decision logic, executed by main.ts.
 *
 * trashItem alone only works where the install is a user-owned bundle:
 * - Windows: the install dir contains the running exe (locked) and NSIS
 *   leaves an Add/Remove Programs registry entry → must run the uninstaller.
 * - Linux deb/rpm: /opt/MindOS is root-owned → only the package manager can
 *   remove it.
 */
import path from 'path';

export type UninstallAction =
  | { kind: 'trash'; target: string }
  | { kind: 'run-uninstaller'; uninstallerPath: string }
  | { kind: 'manual'; reason: 'no-uninstaller' | 'package-manager'; instructions: string };

export interface UninstallContext {
  platform: NodeJS.Platform;
  /** Result of getDesktopInstallPath(): .app bundle, install dir, or AppImage file */
  installPath: string;
  /** process.env.APPIMAGE when running from an AppImage */
  appImagePath?: string;
  fileExists: (p: string) => boolean;
}

/** electron-builder NSIS naming: "Uninstall <productName>.exe" (Uninstall.exe as legacy fallback) */
const NSIS_UNINSTALLER_CANDIDATES = ['Uninstall MindOS.exe', 'Uninstall.exe'];

export function planUninstall(ctx: UninstallContext): UninstallAction {
  if (ctx.platform === 'win32') {
    for (const name of NSIS_UNINSTALLER_CANDIDATES) {
      // path.win32: plans for win32 must join with backslashes even in tests on POSIX
      const candidate = path.win32.join(ctx.installPath, name);
      if (ctx.fileExists(candidate)) {
        return { kind: 'run-uninstaller', uninstallerPath: candidate };
      }
    }
    return {
      kind: 'manual',
      reason: 'no-uninstaller',
      instructions: `Uninstaller not found in ${ctx.installPath}. Please uninstall MindOS from Windows Settings → Apps.`,
    };
  }

  if (ctx.platform === 'linux') {
    if (ctx.appImagePath) {
      return { kind: 'trash', target: ctx.appImagePath };
    }
    return {
      kind: 'manual',
      reason: 'package-manager',
      instructions: 'MindOS was installed via a system package. Remove it with your package manager, e.g. `sudo apt remove mindos-desktop` or `sudo rpm -e mindos-desktop`.',
    };
  }

  // macOS: trash the .app bundle (user-owned, replaceable while running)
  return { kind: 'trash', target: ctx.installPath };
}
