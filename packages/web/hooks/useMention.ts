'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchAllFilePaths } from '@/lib/client-cache';
import { subscribeFilesChanged } from '@/lib/files-changed';

const MENTION_RESULT_LIMIT = 30;
const MENTION_INDEX_IDLE_TIMEOUT_MS = 750;

export interface MentionSearchEntry {
  path: string;
  lowerPath: string;
  lowerName: string;
}

interface MentionSearchHit {
  path: string;
  score: number;
}

export interface MentionSearchIndex {
  entries: MentionSearchEntry[];
  candidateBuckets: Map<string, MentionSearchEntry[]>;
}

const EMPTY_MENTION_INDEX: MentionSearchIndex = { entries: [], candidateBuckets: new Map() };
let sharedMentionIndex: { signature: string; index: MentionSearchIndex } | null = null;

function safeFetchFiles(): Promise<string[]> {
  // Shared cache + single-flight: simultaneous consumers of /api/files
  // (mention picker, plugin panels, ...) issue one request.
  return fetchAllFilePaths().catch(() => [] as string[]);
}

export function parseMentionQueryFromInput(val: string, cursorPos?: number): string | null {
  const pos = cursorPos ?? val.length;
  const before = val.slice(0, pos);
  const atIdx = before.lastIndexOf('@');
  if (atIdx === -1) return null;
  if (atIdx > 0 && before[atIdx - 1] !== ' ' && before[atIdx - 1] !== '\n') return null;

  const query = before.slice(atIdx + 1);
  if (query.includes(' ') || query.includes('\n')) return null;
  return query;
}

function mentionCandidateKey(query: string): string {
  return query.length <= 1 ? query : query.slice(0, 2);
}

function collectMentionPathKeys(lowerPath: string, keys: Set<string>): void {
  keys.clear();
  for (let i = 0; i < lowerPath.length; i += 1) {
    keys.add(lowerPath[i]);
    if (i + 1 < lowerPath.length) keys.add(lowerPath.slice(i, i + 2));
  }
}

export function createMentionSearchIndex(allFiles: string[]): MentionSearchIndex {
  const entries = allFiles.map((path) => ({
    path,
    lowerPath: path.toLowerCase(),
    lowerName: (path.split('/').pop() ?? path).toLowerCase(),
  }));
  const candidateBuckets = new Map<string, MentionSearchEntry[]>();
  const pathKeys = new Set<string>();
  for (const entry of entries) {
    collectMentionPathKeys(entry.lowerPath, pathKeys);
    for (const key of pathKeys) {
      const bucket = candidateBuckets.get(key);
      if (bucket) bucket.push(entry);
      else candidateBuckets.set(key, [entry]);
    }
  }
  return { entries, candidateBuckets };
}

function mentionFilesSignature(allFiles: string[]): string {
  return allFiles.join('\0');
}

function getOrCreateSharedMentionIndex(allFiles: string[]): MentionSearchIndex {
  if (allFiles.length === 0) return EMPTY_MENTION_INDEX;
  const signature = mentionFilesSignature(allFiles);
  if (sharedMentionIndex?.signature === signature) return sharedMentionIndex.index;
  const index = createMentionSearchIndex(allFiles);
  sharedMentionIndex = { signature, index };
  return index;
}

function scheduleMentionIndexBuild(callback: () => void): () => void {
  const idleWindow = typeof window !== 'undefined'
    ? window as Window & typeof globalThis & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    }
    : null;

  if (idleWindow?.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: MENTION_INDEX_IDLE_TIMEOUT_MS });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = setTimeout(callback, 0);
  return () => clearTimeout(handle);
}

function mentionScore(entry: MentionSearchEntry, query: string): number {
  if (entry.lowerName.startsWith(query)) return 100;
  if (entry.lowerName.includes(query)) return 50;
  if (entry.lowerPath.includes(query)) return 10;
  return 0;
}

function insertTopMentionHit(hits: MentionSearchHit[], hit: MentionSearchHit, limit: number): void {
  if (hits.length === limit && hit.score <= hits[hits.length - 1].score) return;

  let insertAt = hits.length;
  while (insertAt > 0 && hits[insertAt - 1].score < hit.score) {
    insertAt -= 1;
  }
  hits.splice(insertAt, 0, hit);
  if (hits.length > limit) hits.length = limit;
}

export function searchMentionFiles(
  index: MentionSearchIndex,
  rawQuery: string,
  limit = MENTION_RESULT_LIMIT,
): string[] {
  const query = rawQuery.toLowerCase();
  if (!query) return index.entries.slice(0, limit).map((entry) => entry.path);

  const hits: MentionSearchHit[] = [];
  const candidates = index.candidateBuckets.get(mentionCandidateKey(query)) ?? [];
  for (const entry of candidates) {
    const score = mentionScore(entry, query);
    if (score > 0) insertTopMentionHit(hits, { path: entry.path, score }, limit);
  }
  return hits.map((hit) => hit.path);
}

export function useMention() {
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState<MentionSearchIndex>(EMPTY_MENTION_INDEX);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<string[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  const loadFiles = useCallback(() => {
    safeFetchFiles().then(setAllFiles);
  }, []);

  useEffect(() => {
    loadFiles();
    // Any path change can affect mention candidates; coalesce bursts only.
    return subscribeFilesChanged(() => loadFiles());
  }, [loadFiles]);

  useEffect(() => {
    if (allFiles.length === 0) {
      const handle = setTimeout(() => setSearchIndex(EMPTY_MENTION_INDEX), 0);
      return () => clearTimeout(handle);
    }

    let cancelled = false;
    const cancelBuild = scheduleMentionIndexBuild(() => {
      const nextIndex = getOrCreateSharedMentionIndex(allFiles);
      if (!cancelled) setSearchIndex(nextIndex);
    });

    return () => {
      cancelled = true;
      cancelBuild();
    };
  }, [allFiles]);

  const updateMentionFromInput = useCallback(
    (val: string, cursorPos?: number) => {
      const query = parseMentionQueryFromInput(val, cursorPos);
      if (query === null) {
        setMentionQuery(null);
        setMentionResults([]);
        setMentionIndex(0);
        return;
      }
      const activeIndex = searchIndex.entries.length > 0
        ? searchIndex
        : getOrCreateSharedMentionIndex(allFiles);
      if (activeIndex !== searchIndex) setSearchIndex(activeIndex);
      const results = searchMentionFiles(activeIndex, query);
      if (results.length === 0) {
        setMentionQuery(null);
        setMentionResults([]);
        setMentionIndex(0);
        return;
      }
      setMentionQuery(query);
      setMentionResults(results);
      setMentionIndex(0);
    },
    [allFiles, searchIndex],
  );

  const navigateMention = useCallback(
    (direction: 'up' | 'down') => {
      if (mentionResults.length === 0) return;
      if (direction === 'down') {
        setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
      } else {
        setMentionIndex((i) => Math.max(i - 1, 0));
      }
    },
    [mentionResults.length],
  );

  const resetMention = useCallback(() => {
    setMentionQuery(null);
    setMentionResults([]);
    setMentionIndex(0);
  }, []);

  return {
    mentionQuery,
    mentionResults,
    mentionIndex,
    updateMentionFromInput,
    navigateMention,
    resetMention,
  };
}
