export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import path from 'path';
import {
  collectSkillInfos,
  getSkillRootsFromRuntime,
  type MindosRuntimeSettings,
} from '@geminilight/mindos/server';
import { ErrorCodes, handleRouteErrorSimple, MindOSError } from '@/lib/errors';
import { getProjectRoot } from '@/lib/project-root';
import { readSettings } from '@/lib/settings';
import {
  buildSkillMarketCatalog,
  normalizeSkillMarketLimit,
  normalizeSkillMarketQuery,
  parseSkillsShSearchResponse,
  SKILLS_SH_SEARCH_URL,
  type ParseSkillsShSearchResult,
} from '@/lib/skill-market/catalog';

const SKILLS_SH_TIMEOUT_MS = 8000;
const SKILL_MARKET_CACHE_TTL_MS = 10 * 60 * 1000;

type SkillMarketCacheState = 'fresh' | 'refreshed' | 'stale';

interface SkillMarketCacheEntry {
  parsed: ParseSkillsShSearchResult;
  fetchedAt: number;
}

const skillMarketCache = new Map<string, SkillMarketCacheEntry>();
const skillMarketRequests = new Map<string, Promise<SkillMarketCacheEntry>>();

function getMindRoot(): string {
  const settings = readSettings();
  return settings.mindRoot || process.env.MIND_ROOT || path.join(os.homedir(), 'MindOS', 'mind');
}

async function fetchSkillsShSearch(query: string, limit: number, forceRefresh: boolean): Promise<SkillMarketCacheEntry> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SKILLS_SH_TIMEOUT_MS);
  const url = new URL(SKILLS_SH_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', '0');

  const fetchOptions: RequestInit & { next?: { revalidate: number } } = forceRefresh
    ? {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    : {
        cache: 'force-cache',
        headers: { Accept: 'application/json' },
        next: { revalidate: SKILL_MARKET_CACHE_TTL_MS / 1000 },
        signal: controller.signal,
      };

  try {
    const response = await fetch(url.toString(), fetchOptions);
    if (!response.ok) {
      throw new MindOSError(
        ErrorCodes.INTERNAL_ERROR,
        `Failed to fetch skills.sh search index: ${response.status}`,
      );
    }

    const raw = await response.json();
    return {
      parsed: parseSkillsShSearchResponse(raw),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MindOSError(ErrorCodes.INTERNAL_ERROR, 'Timed out fetching skills.sh search index.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function getSkillsShSearch(
  query: string,
  limit: number,
  forceRefresh: boolean,
): Promise<SkillMarketCacheEntry & { cacheState: SkillMarketCacheState }> {
  const cacheKey = `${query}:${limit}`;
  const cached = skillMarketCache.get(cacheKey);
  const now = Date.now();

  if (!forceRefresh && cached && now - cached.fetchedAt < SKILL_MARKET_CACHE_TTL_MS) {
    return { ...cached, cacheState: 'fresh' };
  }

  if (!skillMarketRequests.has(cacheKey)) {
    const request = fetchSkillsShSearch(query, limit, forceRefresh)
      .then((entry) => {
        skillMarketCache.set(cacheKey, entry);
        return entry;
      })
      .finally(() => {
        skillMarketRequests.delete(cacheKey);
      });
    skillMarketRequests.set(cacheKey, request);
  }

  try {
    const entry = await skillMarketRequests.get(cacheKey)!;
    return { ...entry, cacheState: 'refreshed' };
  } catch (err) {
    if (cached) return { ...cached, cacheState: 'stale' };
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const normalized = normalizeSkillMarketQuery(req.nextUrl.searchParams.get('q') ?? req.nextUrl.searchParams.get('query'));
    const limit = normalizeSkillMarketLimit(req.nextUrl.searchParams.get('limit'));
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
    const index = await getSkillsShSearch(normalized.query, limit, forceRefresh);
    const settings = readSettings();
    const homeDir = process.env.HOME || os.homedir();
    const mindRoot = getMindRoot();
    const installed = collectSkillInfos(
      getSkillRootsFromRuntime({
        mindRoot,
        runtimeRoot: getProjectRoot(),
        homeDir,
        settings: settings as unknown as MindosRuntimeSettings,
      }),
      new Set(settings.disabledSkills ?? []),
    );

    const catalog = buildSkillMarketCatalog(index.parsed.skills, {
      query: normalized.query,
      defaultedQuery: normalized.defaulted,
      sourceCount: index.parsed.count,
      limit,
      installed,
    });

    return NextResponse.json({
      ok: true,
      catalog,
      skipped: index.parsed.skipped,
      cache: {
        state: index.cacheState,
        fetchedAt: new Date(index.fetchedAt).toISOString(),
        ttlMs: SKILL_MARKET_CACHE_TTL_MS,
      },
      upstream: {
        query: index.parsed.query,
        searchType: index.parsed.searchType,
        durationMs: index.parsed.durationMs,
      },
    });
  } catch (err) {
    return handleRouteErrorSimple(err);
  }
}
