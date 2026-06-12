import type { AskModeApi } from '@/lib/types';

export function resolveAskCompatMode(input: {
  askMode: AskModeApi;
  provider: string;
  baseUrl?: string;
  cachedMode?: string;
}): 'non-streaming' | undefined {
  if (input.cachedMode === 'non-streaming') return 'non-streaming';
  // Chat/agent modes should try streaming first. Providers that genuinely
  // reject stream+tools are caught by the after-stream fallback and cached.
  return undefined;
}
