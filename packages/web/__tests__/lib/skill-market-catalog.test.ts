import { describe, expect, it } from 'vitest';
import {
  buildSkillMarketCatalog,
  buildSkillsCliInstallCommand,
  githubUrlForRepo,
  normalizeSkillMarketQuery,
  parseSkillsShSearchResponse,
} from '@/lib/skill-market/catalog';

describe('skill market catalog', () => {
  it('parses skills.sh search results and skips malformed records', () => {
    const parsed = parseSkillsShSearchResponse({
      query: 'github',
      searchType: 'fuzzy',
      count: 4,
      duration_ms: 123,
      skills: [
        {
          id: 'github/awesome-copilot/git-commit',
          skillId: 'git-commit',
          name: 'git-commit',
          installs: 35617,
          source: 'github/awesome-copilot',
        },
        { id: 'bad/missing-source', skillId: 'bad', name: 'bad' },
        {
          id: 'github/awesome-copilot/git-commit',
          skillId: 'duplicate',
          name: 'duplicate',
          source: 'github/awesome-copilot',
        },
        {
          skillId: 'derived-id',
          name: 'derived-id',
          source: 'owner/repo',
        },
      ],
    });

    expect(parsed).toMatchObject({
      query: 'github',
      searchType: 'fuzzy',
      count: 4,
      durationMs: 123,
    });
    expect(parsed.skills).toEqual([
      {
        id: 'github/awesome-copilot/git-commit',
        skillId: 'git-commit',
        name: 'git-commit',
        installs: 35617,
        source: 'github/awesome-copilot',
      },
      {
        id: 'owner/repo/derived-id',
        skillId: 'derived-id',
        name: 'derived-id',
        source: 'owner/repo',
      },
    ]);
    expect(parsed.skipped).toEqual([
      { index: 1, reason: 'Skill entry is missing id, skillId/name, or source.' },
      { index: 2, reason: 'Duplicate skill id: github/awesome-copilot/git-commit' },
    ]);
  });

  it('builds local installed state overlay and safe CLI commands', () => {
    const catalog = buildSkillMarketCatalog([
      {
        id: 'github/awesome-copilot/git-commit',
        skillId: 'git-commit',
        name: 'git-commit',
        installs: 35617,
        source: 'github/awesome-copilot',
      },
      {
        id: 'unsafe/source/skill',
        skillId: 'unsafe-skill',
        name: 'unsafe-skill',
        source: 'unsafe/source/extra',
      },
    ], {
      query: 'git',
      sourceCount: 10,
      installed: [
        { name: 'git-commit', enabled: true, origin: 'agents-global' },
      ],
    });

    expect(catalog.counts).toEqual({
      total: 10,
      returned: 2,
      installed: 1,
      available: 1,
      installable: 1,
    });
    expect(catalog.skills[0]).toMatchObject({
      installed: true,
      installedEnabled: true,
      installedOrigin: 'agents-global',
      repoUrl: 'https://github.com/github/awesome-copilot',
      installCommand: 'npx skills add github/awesome-copilot --skill git-commit',
    });
    expect(catalog.skills[1]).toMatchObject({
      installed: false,
      installable: false,
    });
    expect(catalog.skills[1].installCommand).toBeUndefined();
  });

  it('normalizes short queries to a default query', () => {
    expect(normalizeSkillMarketQuery('g')).toEqual({ query: 'agent', defaulted: true });
    expect(normalizeSkillMarketQuery(' github ')).toEqual({ query: 'github', defaulted: false });
  });

  it('builds GitHub source links and install commands only for owner/repo sources', () => {
    expect(githubUrlForRepo('vercel-labs/agent-skills')).toBe('https://github.com/vercel-labs/agent-skills');
    expect(githubUrlForRepo('not/a/repo')).toBeUndefined();
    expect(buildSkillsCliInstallCommand('vercel-labs/agent-skills', 'web-design-guidelines')).toBe(
      'npx skills add vercel-labs/agent-skills --skill web-design-guidelines',
    );
  });
});
