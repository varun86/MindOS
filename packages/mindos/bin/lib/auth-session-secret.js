import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { CONFIG_PATH } from './constants.js';
import { stripBom } from './jsonc.js';

export function createWebSessionSecret() {
  return randomBytes(32).toString('base64url');
}

export function ensureWebSessionSecret(config, legacySessionSecret) {
  if (typeof config.webSessionSecret === 'string' && config.webSessionSecret.trim()) {
    return config.webSessionSecret;
  }
  const secret = typeof legacySessionSecret === 'string' && legacySessionSecret
    ? legacySessionSecret
    : createWebSessionSecret();
  config.webSessionSecret = secret;
  return secret;
}

export function ensureWebSessionSecretInConfig(configPath = CONFIG_PATH) {
  if (!existsSync(configPath)) return null;

  let config;
  try {
    config = JSON.parse(stripBom(readFileSync(configPath, 'utf-8')));
  } catch {
    return null;
  }

  if (!config || typeof config !== 'object') return null;
  if (typeof config.webSessionSecret === 'string' && config.webSessionSecret.trim()) {
    return config.webSessionSecret;
  }
  if (typeof config.webPassword !== 'string' || !config.webPassword) {
    return null;
  }

  const secret = ensureWebSessionSecret(config, config.webPassword);
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  } catch {
    return null;
  }
  return secret;
}
