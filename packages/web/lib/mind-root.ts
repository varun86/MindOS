import fs from 'fs';
import os from 'os';
import path from 'path';

const SETTINGS_PATH = path.join(os.homedir(), '.mindos', 'config.json');

export function effectiveMindRoot(): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as Record<string, unknown>;
    if (typeof parsed.mindRoot === 'string' && parsed.mindRoot.trim()) {
      return parsed.mindRoot;
    }
  } catch {
    // Missing or invalid config falls through to env/default.
  }
  return process.env.MIND_ROOT || path.join(os.homedir(), 'MindOS', 'mind');
}
