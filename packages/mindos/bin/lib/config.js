import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_PATH } from './constants.js';
import { stripBom } from './jsonc.js';
import { ensureWebSessionSecret } from './auth-session-secret.js';
import { providerEnvKeys, resolveAiConfig } from './ai-config.js';

let loaded = false;

export function loadConfig() {
  if (loaded) return;
  loaded = true;
  if (!existsSync(CONFIG_PATH)) return;
  let config;
  try {
    config = JSON.parse(stripBom(readFileSync(CONFIG_PATH, 'utf-8')));
  } catch {
    console.error(`Warning: failed to parse ${CONFIG_PATH}`);
    return;
  }

  if (typeof config.webPassword === 'string' && config.webPassword) {
    const prevSecret = config.webSessionSecret;
    ensureWebSessionSecret(config, config.webPassword);
    if (config.webSessionSecret !== prevSecret) {
      try {
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      } catch {
        // If persistence fails, still expose the in-memory secret for this process.
      }
    }
  }

  const set = (key, val) => {
    if (val && !process.env[key]) process.env[key] = String(val);
  };

  set('MIND_ROOT',          config.mindRoot);
  set('MINDOS_WEB_PORT',    config.port);
  set('MINDOS_MCP_PORT',    config.mcpPort);
  set('AUTH_TOKEN',         config.authToken);
  set('MINDOS_AUTH_TOKEN',  config.authToken);
  set('WEB_PASSWORD',       config.webPassword);
  set('WEB_SESSION_SECRET', config.webSessionSecret);
  const ai = resolveAiConfig(config.ai);
  set('AI_PROVIDER',        ai.activeEntry?.protocol || config.ai?.provider);
  // Remote URL: allows CLI to operate against a remote MindOS instance
  if (config.url && !process.env.MINDOS_URL) {
    process.env.MINDOS_URL = String(config.url);
  }

  const orderedProviders = [
    ai.activeEntry,
    ...ai.providers.filter((provider) => provider.id !== ai.activeEntry?.id),
  ].filter(Boolean);
  for (const provider of orderedProviders) {
    for (const envKey of providerEnvKeys(provider)) {
      set(envKey, provider.apiKey);
    }
    const prefix = provider.protocol.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    set(`${prefix}_MODEL`, provider.model);
    set(`${prefix}_BASE_URL`, provider.baseUrl);
  }

  set('ANTHROPIC_API_KEY', config.ai?.anthropicApiKey);
  set('ANTHROPIC_MODEL',   config.ai?.anthropicModel);
  set('OPENAI_API_KEY',    config.ai?.openaiApiKey);
  set('OPENAI_MODEL',      config.ai?.openaiModel);
  set('OPENAI_BASE_URL',   config.ai?.openaiBaseUrl);
}

export function getStartMode() {
  try {
    const mode = JSON.parse(stripBom(readFileSync(CONFIG_PATH, 'utf-8'))).startMode || 'start';
    return mode === 'daemon' ? 'start' : mode;
  } catch {
    return 'start';
  }
}

export function isDaemonMode() {
  try {
    return JSON.parse(stripBom(readFileSync(CONFIG_PATH, 'utf-8'))).startMode === 'daemon';
  } catch {
    return false;
  }
}
