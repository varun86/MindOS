import yaml from 'js-yaml';

export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterValue =
  | FrontmatterScalar
  | Date
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export interface FrontmatterEntry {
  key: string;
  value: FrontmatterValue;
}

export interface MarkdownFrontmatter {
  raw: string;
  entries: FrontmatterEntry[];
}

export interface SplitMarkdownFrontmatterResult {
  body: string;
  frontmatter: MarkdownFrontmatter | null;
}

const OPENING_FENCE_RE = /^\uFEFF?---[ \t]*(?:\r?\n)/;
const CLOSING_FENCE_RE = /^---[ \t]*(?:\r?\n|$)/gm;

interface FrontmatterFenceBounds {
  openingEnd: number;
  closingStart: number;
  closingEnd: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function normalizeValue(value: unknown, seen = new WeakSet<object>()): FrontmatterValue {
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((item) => normalizeValue(item, seen));
  }
  if (isRecord(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeValue(nested, seen)]),
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  return String(value);
}

function findFrontmatterFenceBounds(content: string): FrontmatterFenceBounds | null {
  const opening = content.match(OPENING_FENCE_RE);
  if (!opening?.[0]) return null;

  // Use a fresh stateful regexp so callers never share lastIndex across renders.
  const closingFenceRe = new RegExp(CLOSING_FENCE_RE.source, CLOSING_FENCE_RE.flags);
  closingFenceRe.lastIndex = opening[0].length;
  const closing = closingFenceRe.exec(content);
  if (!closing) return null;

  return {
    openingEnd: opening[0].length,
    closingStart: closing.index,
    closingEnd: closing.index + closing[0].length,
  };
}

/**
 * Cheap guard for editor routing. It intentionally does not parse YAML: any
 * leading frontmatter-like fence should stay in source mode so WYSIWYG
 * normalization cannot rewrite user properties or malformed metadata.
 */
export function hasMarkdownFrontmatterFence(content: string): boolean {
  return findFrontmatterFenceBounds(content) !== null;
}

export function splitMarkdownFrontmatter(content: string): SplitMarkdownFrontmatterResult {
  const bounds = findFrontmatterFenceBounds(content);
  if (!bounds) return { body: content, frontmatter: null };

  const raw = content.slice(bounds.openingEnd, bounds.closingStart).replace(/\r?\n$/, '');
  const body = content.slice(bounds.closingEnd).replace(/^\r?\n/, '');

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch {
    return { body: content, frontmatter: null };
  }

  if (parsed == null) {
    return { body, frontmatter: { raw, entries: [] } };
  }

  if (!isRecord(parsed)) {
    return { body: content, frontmatter: null };
  }

  return {
    body,
    frontmatter: {
      raw,
      entries: Object.entries(parsed).map(([key, value]) => ({
        key,
        value: normalizeValue(value),
      })),
    },
  };
}
