'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AcpRegistryEntry } from '@/lib/acp/types';

interface AcpRegistryState {
  agents: AcpRegistryEntry[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const STORAGE_KEY = 'mindos:acp-registry';
const STALE_TTL_MS = 30 * 60 * 1000; // 30 min — show stale data instantly
const REVALIDATE_TTL_MS = 10 * 60 * 1000; // 10 min — background refresh interval
const BUILTIN_REFRESH_RETRY_MS = 1200;
const BUILTIN_REFRESH_MAX_RETRIES = 3;

export interface RegistryCache {
  agents: AcpRegistryEntry[];
  ts: number;
  version?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readAcpRegistryCacheFromStorage(): RegistryCache | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.agents) || typeof parsed.ts !== 'number') return null;
    if (parsed.version !== undefined && typeof parsed.version !== 'string') return null;
    if (Date.now() - parsed.ts > STALE_TTL_MS) return null;
    return {
      agents: parsed.agents as AcpRegistryEntry[],
      ts: parsed.ts,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
    };
  } catch {
    return null;
  }
}

function writeStorage(agents: AcpRegistryEntry[], version?: string) {
  if (version === 'builtin') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ agents, ts: Date.now(), version }));
  } catch { /* quota exceeded — ignore */ }
}

export function useAcpRegistry(): AcpRegistryState {
  const [initialCache] = useState<RegistryCache | null>(() => readAcpRegistryCacheFromStorage());
  const cached = useRef<RegistryCache | null>(initialCache);
  const [agents, setAgents] = useState<AcpRegistryEntry[]>(() => initialCache?.agents ?? []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  const inflight = useRef(false);
  const builtinRefreshRetries = useRef(0);

  const retry = useCallback(() => {
    builtinRefreshRetries.current = 0;
    setTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    const fresh = cached.current
      && cached.current.version !== 'builtin'
      && Date.now() - cached.current.ts < REVALIDATE_TTL_MS;
    if (fresh && trigger === 0) return;

    if (inflight.current) return;
    inflight.current = true;

    const hasCachedData = agents.length > 0;
    if (!hasCachedData) setLoading(true);
    setError(null);

    let cancelled = false;
    let builtinRetryTimer: number | null = null;

    fetch('/api/acp/registry')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const registry = isRecord(data.registry) ? data.registry : null;
        const version = typeof registry?.version === 'string' ? registry.version : undefined;
        const list: AcpRegistryEntry[] = Array.isArray(registry?.agents) ? registry.agents as AcpRegistryEntry[] : [];
        writeStorage(list, version);
        cached.current = { agents: list, ts: Date.now(), version };
        setAgents(list);
        if (version !== 'builtin') {
          builtinRefreshRetries.current = 0;
        } else if (builtinRefreshRetries.current < BUILTIN_REFRESH_MAX_RETRIES) {
          builtinRefreshRetries.current += 1;
          builtinRetryTimer = window.setTimeout(() => {
            if (!cancelled) setTrigger((n) => n + 1);
          }, BUILTIN_REFRESH_RETRY_MS);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (!hasCachedData) setError((err as Error).message);
      })
      .finally(() => {
        inflight.current = false;
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      inflight.current = false;
      if (builtinRetryTimer) window.clearTimeout(builtinRetryTimer);
    };
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return { agents, loading, error, retry };
}
