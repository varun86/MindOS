import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MINDOS_AGENT_PROMPT_ASSET_URL = new URL('./agent-prompt.txt', import.meta.url);
export const MINDOS_AGENT_PROMPT_ASSET_PATH = normalizePromptAssetPath(MINDOS_AGENT_PROMPT_ASSET_URL);

export type LoadMindosAgentPromptOptions = {
  asset?: URL | string;
};

function resolveNextStaticMediaAsset(assetPath: string): string | null {
  const filename = path.basename(assetPath);
  const candidates: string[] = [];

  if (assetPath.startsWith('/_next/static/media/')) {
    candidates.push(
      ...(typeof __dirname === 'string' ? [path.join(__dirname, 'static', 'media', filename)] : []),
      path.join(process.cwd(), '.next', 'dev', 'server', 'static', 'media', filename),
      path.join(process.cwd(), '.next', 'server', 'static', 'media', filename),
      path.join(process.cwd(), '.next', 'server', 'chunks', 'static', 'media', filename),
      path.join(process.cwd(), 'server', 'chunks', 'static', 'media', filename),
    );
  }

  const normalized = assetPath.replace(/\\/g, '/');
  const serverAppMarker = '/server/app/';
  const serverAppIndex = normalized.indexOf(serverAppMarker);
  if (serverAppIndex >= 0 && normalized.includes('/static/media/')) {
    const serverRoot = assetPath.slice(0, serverAppIndex + '/server'.length);
    candidates.push(path.join(serverRoot, 'static', 'media', filename));
  }

  if (candidates.length === 0) return null;
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function fallbackPromptAssetPath(assetPath: string): string | null {
  const sourceCandidate = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-prompt.txt');
  if (existsSync(sourceCandidate)) return sourceCandidate;

  const candidates = [
    path.join(process.cwd(), 'packages', 'mindos', 'src', 'agent', 'prompt', 'agent-prompt.txt'),
    path.join(process.cwd(), 'src', 'agent', 'prompt', 'agent-prompt.txt'),
    path.join(process.cwd(), 'agent', 'prompt', 'agent-prompt.txt'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? (existsSync(assetPath) ? assetPath : null);
}

function normalizePromptAssetPath(asset: URL | string): string {
  const assetPath = typeof asset === 'string' ? asset : asset.toString();
  return resolveNextStaticMediaAsset(assetPath)
    ?? fallbackPromptAssetPath(assetPath)
    ?? (assetPath.startsWith('file:') ? fileURLToPath(assetPath) : assetPath);
}

export function loadMindosAgentPrompt(options: LoadMindosAgentPromptOptions = {}): string {
  const assetPath = options.asset === undefined
    ? MINDOS_AGENT_PROMPT_ASSET_PATH
    : normalizePromptAssetPath(options.asset);
  const content = readFileSync(assetPath, 'utf-8').trim();
  if (!content) {
    throw new Error('MindOS agent prompt asset is empty.');
  }
  return content;
}

export const MINDOS_SYSTEM_PROMPT = loadMindosAgentPrompt();
