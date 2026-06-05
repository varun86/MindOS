import fs from 'fs';
import os from 'os';
import path from 'path';

const SETTINGS_PATH = path.join(os.homedir(), '.mindos', 'config.json');

export function readSetupPending(): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as Record<string, unknown>;
    return parsed.setupPending === true;
  } catch {
    return true;
  }
}
