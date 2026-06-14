import { queryValue, type MindosRequestQuery } from '../context.js';
import { json, type MindosServerResponse } from '../response.js';

export type SearchRequestFileType = 'md' | 'csv' | 'all';

export type SearchRequestOptions = {
  limit: number;
  scope?: string;
  file_type?: SearchRequestFileType;
  modified_after?: string;
};

export type SearchHandlerServices<TSearchResult = unknown> = {
  search(query: string, options: SearchRequestOptions): Promise<TSearchResult[]>;
};

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;
const SEARCH_FILE_TYPES = new Set<SearchRequestFileType>(['md', 'csv', 'all']);

function parseSearchLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SEARCH_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SEARCH_LIMIT;
  return Math.max(1, Math.min(parsed, MAX_SEARCH_LIMIT));
}

function parseSearchFileType(raw: string | undefined): SearchRequestFileType | undefined {
  if (!raw) return undefined;
  return SEARCH_FILE_TYPES.has(raw as SearchRequestFileType) ? raw as SearchRequestFileType : undefined;
}

function parseSearchOptions(query: MindosRequestQuery | undefined): SearchRequestOptions {
  const scope = queryValue(query, 'scope')?.trim();
  const modifiedAfter = queryValue(query, 'modified_after')?.trim();
  const fileType = parseSearchFileType(queryValue(query, 'file_type'));
  return {
    limit: parseSearchLimit(queryValue(query, 'limit')),
    ...(scope ? { scope } : {}),
    ...(fileType ? { file_type: fileType } : {}),
    ...(modifiedAfter ? { modified_after: modifiedAfter } : {}),
  };
}

export async function handleSearch<TSearchResult>(
  query: MindosRequestQuery | undefined,
  services: SearchHandlerServices<TSearchResult>,
): Promise<MindosServerResponse<TSearchResult[]>> {
  const q = queryValue(query, 'q') ?? '';
  if (!q.trim()) return json([]);

  const results = await services.search(q, parseSearchOptions(query));
  return json(results, { headers: { 'Cache-Control': 'no-store' } });
}
