/**
 * mindos open — Open Web UI in browser
 */

import { execFileSync } from 'node:child_process';
import { loadConfig } from '../lib/config.js';
import { cyan, green, dim } from '../lib/colors.js';

export const meta = {
  name: 'open',
  group: 'Service',
  summary: 'Open Web UI in browser',
  usage: 'mindos open',
};

function normalizeWebPort(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? String(parsed) : '3456';
}

export function buildOpenUrl(env = process.env) {
  return `http://localhost:${normalizeWebPort(env.MINDOS_WEB_PORT || '3456')}`;
}

function detectLinuxOpenCommand() {
  try {
    const uname = execFileSync('uname', ['-r'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    return uname.toLowerCase().includes('microsoft') ? 'wslview' : 'xdg-open';
  } catch {
    return 'xdg-open';
  }
}

function openUrl(url) {
  if (process.platform === 'darwin') {
    execFileSync('open', [url], { stdio: 'ignore' });
    return;
  }
  if (process.platform === 'linux') {
    execFileSync(detectLinuxOpenCommand(), [url], { stdio: 'ignore' });
    return;
  }
  if (process.platform === 'win32') {
    // Windows `start` treats the first quoted arg as a window title.
    execFileSync('cmd.exe', ['/c', 'start', '', url], { stdio: 'ignore', windowsHide: true });
    return;
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

export const run = () => {
  loadConfig();
  const url = buildOpenUrl();

  try {
    openUrl(url);
    console.log(`${green('✔')} Opening ${cyan(url)}`);
  } catch {
    console.log(dim(`Could not open browser automatically. Visit: ${cyan(url)}`));
  }
};
