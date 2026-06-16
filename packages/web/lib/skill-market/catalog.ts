export const SKILLS_SH_SEARCH_URL = 'https://skills.sh/api/search';
export const SKILL_MARKET_DEFAULT_QUERY = 'agent';

const GITHUB_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;

export type SkillMarketSource = 'skills.sh';

export interface SkillsShSearchItem {
  id: string;
  skillId: string;
  name: string;
  installs?: number;
  source: string;
}

export interface ParseSkillsShSearchResult {
  query: string;
  searchType?: string;
  skills: SkillsShSearchItem[];
  count: number;
  durationMs?: number;
  skipped: Array<{ index: number; reason: string }>;
}

export interface InstalledSkillMarketState {
  name: string;
  enabled: boolean;
  origin?: string;
  source?: string;
}

export interface SkillMarketItem {
  id: string;
  skillId: string;
  name: string;
  source: SkillMarketSource;
  sourceRepo: string;
  repoUrl?: string;
  installs?: number;
  installed: boolean;
  installedEnabled?: boolean;
  installedOrigin?: string;
  installable: boolean;
  installCommand?: string;
}

export interface SkillMarketCatalogCounts {
  total: number;
  returned: number;
  installed: number;
  available: number;
  installable: number;
}

export interface SkillMarketCatalog {
  source: {
    type: SkillMarketSource;
    url: string;
  };
  query: string;
  defaultedQuery: boolean;
  skills: SkillMarketItem[];
  counts: SkillMarketCatalogCounts;
}

export interface BuildSkillMarketCatalogOptions {
  query: string;
  defaultedQuery?: boolean;
  sourceCount?: number;
  limit?: number;
  installed?: Iterable<InstalledSkillMarketState>;
}

export function normalizeSkillMarketQuery(value: string | null | undefined): { query: string; defaulted: boolean } {
  const trimmed = (value ?? '').trim();
  if (trimmed.length >= 2) return { query: trimmed, defaulted: false };
  return { query: SKILL_MARKET_DEFAULT_QUERY, defaulted: true };
}

export function normalizeSkillMarketLimit(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export function parseSkillsShSearchResponse(raw: unknown): ParseSkillsShSearchResult {
  const record = isPlainObject(raw) ? raw : {};
  const rawSkills = Array.isArray(record.skills) ? record.skills : [];
  const skipped: ParseSkillsShSearchResult['skipped'] = [];
  const seen = new Set<string>();
  const skills: SkillsShSearchItem[] = [];

  rawSkills.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      skipped.push({ index, reason: 'Skill entry is not an object.' });
      return;
    }

    const source = normalizeText(entry.source);
    const skillId = normalizeText(entry.skillId) || normalizeText(entry.name);
    const name = normalizeText(entry.name) || skillId;
    const id = normalizeText(entry.id) || (source && skillId ? `${source}/${skillId}` : '');
    const installs = normalizeNonNegativeInteger(entry.installs);

    if (!source || !skillId || !name || !id) {
      skipped.push({ index, reason: 'Skill entry is missing id, skillId/name, or source.' });
      return;
    }

    const duplicateKey = id.toLowerCase();
    if (seen.has(duplicateKey)) {
      skipped.push({ index, reason: `Duplicate skill id: ${id}` });
      return;
    }

    seen.add(duplicateKey);
    skills.push({
      id,
      skillId,
      name,
      source,
      ...(installs !== undefined ? { installs } : {}),
    });
  });

  const count = normalizeNonNegativeInteger(record.count) ?? skills.length;
  const durationMs = normalizeNonNegativeInteger(record.duration_ms);
  const searchType = normalizeText(record.searchType);

  return {
    query: normalizeText(record.query),
    ...(searchType ? { searchType } : {}),
    skills,
    count,
    ...(durationMs !== undefined ? { durationMs } : {}),
    skipped,
  };
}

export function buildSkillMarketCatalog(
  entries: SkillsShSearchItem[],
  options: BuildSkillMarketCatalogOptions,
): SkillMarketCatalog {
  const limit = normalizeSkillMarketLimit(options.limit);
  const installedByName = new Map<string, InstalledSkillMarketState>();
  for (const skill of options.installed ?? []) {
    if (!skill.name) continue;
    installedByName.set(skill.name.toLowerCase(), skill);
  }

  const skills = entries.slice(0, limit).map((entry) => {
    const installed = installedByName.get(entry.skillId.toLowerCase())
      ?? installedByName.get(entry.name.toLowerCase());
    const repoUrl = githubUrlForRepo(entry.source);
    const installable = Boolean(repoUrl);
    const installCommand = installable ? buildSkillsCliInstallCommand(entry.source, entry.skillId) : undefined;

    return {
      id: entry.id,
      skillId: entry.skillId,
      name: entry.name,
      source: 'skills.sh' as const,
      sourceRepo: entry.source,
      ...(repoUrl ? { repoUrl } : {}),
      ...(entry.installs !== undefined ? { installs: entry.installs } : {}),
      installed: Boolean(installed),
      ...(installed ? { installedEnabled: installed.enabled, installedOrigin: installed.origin } : {}),
      installable,
      ...(installCommand ? { installCommand } : {}),
    };
  });

  const installedCount = skills.filter((skill) => skill.installed).length;
  const installableCount = skills.filter((skill) => skill.installable).length;

  return {
    source: {
      type: 'skills.sh',
      url: SKILLS_SH_SEARCH_URL,
    },
    query: options.query,
    defaultedQuery: Boolean(options.defaultedQuery),
    skills,
    counts: {
      total: options.sourceCount ?? entries.length,
      returned: skills.length,
      installed: installedCount,
      available: skills.length - installedCount,
      installable: installableCount,
    },
  };
}

export function buildSkillsCliInstallCommand(sourceRepo: string, skillId: string): string {
  return `npx skills add ${sourceRepo} --skill ${skillId}`;
}

export function githubUrlForRepo(repo: string): string | undefined {
  const normalized = repo.trim();
  if (!GITHUB_REPO_PATTERN.test(normalized)) return undefined;
  return `https://github.com/${normalized}`;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.trunc(value);
  return rounded >= 0 ? rounded : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
