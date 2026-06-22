import type { SessionModelSelection } from '@/lib/types';
import {
  type ProviderId,
  isProviderId,
} from '@/lib/agent/providers';
import { isProviderEntryId } from '@/lib/custom-endpoints';

export type ProviderSelection = ProviderId | `p_${string}` | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function cleanTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizeProviderSelection(value: unknown): ProviderSelection {
  const provider = cleanString(value, 120);
  if (!provider) return null;
  return isProviderId(provider) || isProviderEntryId(provider)
    ? provider as ProviderSelection
    : null;
}

export function toSessionModelSelection(
  provider: ProviderSelection,
  model: string | null | undefined,
  now = Date.now(),
): SessionModelSelection | null {
  const modelOverride = cleanString(model, 240);
  if (!provider && !modelOverride) return null;
  return {
    version: 1,
    ...(provider ? { providerOverride: provider } : {}),
    ...(modelOverride ? { modelOverride } : {}),
    updatedAt: now,
  };
}

export function normalizeSessionModelSelectionForClient(input: unknown, now?: number): SessionModelSelection | undefined {
  if (!isRecord(input)) return undefined;
  const provider = normalizeProviderSelection(input.providerOverride ?? input.provider);
  const model = cleanString(input.modelOverride ?? input.model, 240);
  if (!provider && !model) return undefined;
  return {
    version: 1,
    ...(provider ? { providerOverride: provider } : {}),
    ...(model ? { modelOverride: model } : {}),
    ...(cleanTimestamp(input.updatedAt) ?? now ? { updatedAt: cleanTimestamp(input.updatedAt) ?? now } : {}),
  };
}

export function getProviderModelFromSessionSelection(selection: SessionModelSelection | null | undefined): {
  provider: ProviderSelection;
  model: string | null;
} {
  const normalized = normalizeSessionModelSelectionForClient(selection);
  return {
    provider: normalizeProviderSelection(normalized?.providerOverride),
    model: normalized?.modelOverride ?? null,
  };
}
