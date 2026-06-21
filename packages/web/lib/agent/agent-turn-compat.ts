export function resolveAgentTurnCompatMode(input: {
  provider: string;
  baseUrl?: string;
  cachedMode?: string;
}): 'non-streaming' | undefined {
  if (input.cachedMode === 'non-streaming') return 'non-streaming';
  return undefined;
}
