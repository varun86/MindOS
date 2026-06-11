import { describe, expect, it, vi } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => path.join(process.cwd(), 'tmp-install-cli-shim-home'),
    isPackaged: false,
  },
  BrowserWindow: class {},
  Notification: class {},
  dialog: {},
}));

describe('install-cli-shim', () => {
  it('escapes Windows batch metacharacters in generated set values', async () => {
    const { escapeCmdSetValue } = await import('./install-cli-shim');

    expect(escapeCmdSetValue('C:\\Users\\A%TEMP%^B!C\\cli.js')).toBe(
      'C:\\Users\\A%%TEMP%%^^B^^!C\\cli.js',
    );
  });

  it('generates a Windows cleanup script without touching the knowledge base', async () => {
    const { buildWindowsUninstallScript } = await import('./install-cli-shim');

    const script = buildWindowsUninstallScript();

    expect(script).toContain('taskkill /PID');
    expect(script).toContain('mindos.cmd');
    expect(script).toContain('%MINDOS_DIR%\\runtime');
    expect(script).toContain('%MINDOS_DIR%\\runtime-downloading');
    expect(script).toContain('%MINDOS_DIR%\\runtime-old');
    expect(script).toContain('%MINDOS_DIR%\\runtime-download.tar.gz');
    expect(script).toContain('Normalize-MindOSPath');
    expect(script).toContain('[Environment]::ExpandEnvironmentVariables');
    expect(script).toContain('[Environment]::SetEnvironmentVariable');
    expect(script).toContain('%~f0');
    expect(script).not.toContain('rmdir /s /q "%USERPROFILE%\\MindOS\\mind"');
    expect(script).not.toContain('del /f /q "%USERPROFILE%\\MindOS\\mind"');
    expect(script).not.toContain('TODO: uninstall.bat');
  });

  it('verifies Windows PID command lines before killing uninstall leftovers', async () => {
    const { buildWindowsUninstallScript } = await import('./install-cli-shim');

    const script = buildWindowsUninstallScript();

    expect(script).toContain('Get-CimInstance Win32_Process');
    expect(script).toContain('CommandLine');
    expect(script).toContain('@geminilight\\mindos');
    expect(script).not.toContain('do taskkill /PID %%P /T /F');
  });

  it('verifies Unix PID command lines before killing uninstall leftovers', async () => {
    const { buildUnixUninstallScript } = await import('./install-cli-shim');

    const script = buildUnixUninstallScript();

    expect(script).toContain('ps -p "$pid" -o args=');
    expect(script).toContain('ps -p "$pid" -o comm=');
    expect(script).toContain('is_mindos_cmd()');
    expect(script).toContain('is_ssh_cmd()');
    expect(script).toContain('"$HOME/.mindos/ssh-tunnel.pid"');
    expect(script).toContain('*/.mindos/runtime/*');
    expect(script).toContain('"$HOME/.mindos/runtime"');
    expect(script).toContain('"$HOME/.mindos/runtime-downloading"');
    expect(script).toContain('"$HOME/.mindos/runtime-old"');
    expect(script).toContain('"$HOME/.mindos/runtime-download.tar.gz"');
    expect(script).toContain('/# MindOS CLI/,+1d');
    expect(script).not.toContain('while IFS= read -r pid; do\n      kill "$pid"');
    expect(script).not.toContain('rm -rf "$HOME/MindOS/mind"');
  });

  it('does not tell Windows users to manually add PATH after PATH was appended', async () => {
    const { buildRefreshCliSuccessDialog } = await import('./install-cli-shim');

    const dialog = buildRefreshCliSuccessDialog('win32', false, true);

    expect(dialog.message).toContain('added');
    expect(dialog.message).toContain('user PATH');
    expect(dialog.message).toContain('Open a new terminal');
    expect(dialog.message).not.toContain('add this folder');
  });
});
