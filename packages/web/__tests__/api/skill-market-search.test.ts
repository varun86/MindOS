import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tempRoot: string;
let projectRoot: string;
let originalHome: string | undefined;
let originalMindRoot: string | undefined;
let originalProjectRoot: string | undefined;

function writeSkill(baseDir: string, name: string) {
  const skillDir = path.join(baseDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} skill\n---\n\nBody`,
    'utf-8',
  );
}

async function importRoute() {
  vi.resetModules();
  return import('../../app/api/skill-market/search/route');
}

describe('/api/skill-market/search', () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mindos-skill-market-api-'));
    projectRoot = path.join(tempRoot, 'project');
    fs.mkdirSync(projectRoot, { recursive: true });
    originalHome = process.env.HOME;
    originalMindRoot = process.env.MIND_ROOT;
    originalProjectRoot = process.env.MINDOS_PROJECT_ROOT;
    process.env.HOME = tempRoot;
    process.env.MIND_ROOT = tempRoot;
    process.env.MINDOS_PROJECT_ROOT = projectRoot;
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalMindRoot === undefined) delete process.env.MIND_ROOT;
    else process.env.MIND_ROOT = originalMindRoot;
    if (originalProjectRoot === undefined) delete process.env.MINDOS_PROJECT_ROOT;
    else process.env.MINDOS_PROJECT_ROOT = originalProjectRoot;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns skills.sh search results with local installed state overlay', async () => {
    writeSkill(path.join(tempRoot, '.agents', 'skills'), 'git-commit');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'github',
      searchType: 'fuzzy',
      count: 2,
      duration_ms: 88,
      skills: [
        {
          id: 'github/awesome-copilot/git-commit',
          skillId: 'git-commit',
          name: 'git-commit',
          installs: 35617,
          source: 'github/awesome-copilot',
        },
        {
          id: 'xixu-me/skills/github-actions-docs',
          skillId: 'github-actions-docs',
          name: 'github-actions-docs',
          installs: 221336,
          source: 'xixu-me/skills',
        },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await importRoute();
    const res = await GET(new NextRequest('http://localhost/api/skill-market/search?q=github&limit=2'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://skills.sh/api/search?q=github&limit=2&offset=0',
      expect.objectContaining({
        cache: 'force-cache',
        headers: { Accept: 'application/json' },
        next: { revalidate: 600 },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(json.ok).toBe(true);
    expect(json.catalog).toMatchObject({
      query: 'github',
      defaultedQuery: false,
      counts: {
        total: 2,
        returned: 2,
        installed: 1,
        available: 1,
        installable: 2,
      },
    });
    expect(json.catalog.skills).toEqual([
      expect.objectContaining({
        skillId: 'git-commit',
        installed: true,
        installedOrigin: 'agents-global',
        installCommand: 'npx skills add github/awesome-copilot --skill git-commit',
      }),
      expect.objectContaining({
        skillId: 'github-actions-docs',
        installed: false,
        repoUrl: 'https://github.com/xixu-me/skills',
      }),
    ]);
    expect(json.upstream).toMatchObject({
      query: 'github',
      searchType: 'fuzzy',
      durationMs: 88,
    });
  });

  it('uses the default query when the user query is too short', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'agent',
      skills: [],
      count: 0,
    }), { status: 200 })));

    const { GET } = await importRoute();
    const res = await GET(new NextRequest('http://localhost/api/skill-market/search?q=g&limit=5'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://skills.sh/api/search?q=agent&limit=5&offset=0',
      expect.anything(),
    );
    expect(json.catalog.query).toBe('agent');
    expect(json.catalog.defaultedQuery).toBe(true);
  });

  it('returns stale cached search data when a forced refresh fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        query: 'browser',
        skills: [
          {
            id: 'vercel-labs/agent-browser/agent-browser',
            skillId: 'agent-browser',
            name: 'agent-browser',
            installs: 453923,
            source: 'vercel-labs/agent-browser',
          },
        ],
        count: 1,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await importRoute();
    const first = await GET(new NextRequest('http://localhost/api/skill-market/search?q=browser&limit=5'));
    expect(first.status).toBe(200);

    const second = await GET(new NextRequest('http://localhost/api/skill-market/search?q=browser&limit=5&refresh=1'));
    const json = await second.json();

    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(json.cache.state).toBe('stale');
    expect(json.catalog.skills).toEqual([
      expect.objectContaining({
        skillId: 'agent-browser',
        installCommand: 'npx skills add vercel-labs/agent-browser --skill agent-browser',
      }),
    ]);
  });
});
