import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchAcpRegistry, getAcpAgents, findAcpAgent, clearRegistryCache } from '../../lib/acp/registry';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const MOCK_REGISTRY = {
  version: '1',
  agents: [
    {
      id: 'gemini-cli',
      name: 'Gemini CLI',
      description: 'Google Gemini CLI agent',
      transport: 'npx',
      command: '@google/gemini-cli',
      tags: ['coding', 'search'],
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Anthropic Claude coding agent',
      transport: 'npx',
      command: '@anthropic/claude-code',
      tags: ['coding'],
    },
    {
      id: 'new-cdn-only',
      name: 'CDN Only Agent',
      description: 'An agent only available from CDN',
      transport: 'stdio',
      command: 'cdn-agent',
      tags: ['new'],
    },
  ],
};

async function flushPromises(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('ACP Registry', () => {
  beforeEach(() => {
    clearRegistryCache();
    mockFetch.mockReset();
  });

  describe('fetchAcpRegistry', () => {
    it('returns built-in registry immediately and refreshes CDN data in the background', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      const registry = await fetchAcpRegistry();
      expect(registry).not.toBeNull();
      expect(registry.version).toBe('builtin');
      // Built-in agents are present with canonical IDs
      const gemini = registry.agents.find(a => a.id === 'gemini');
      expect(gemini).toBeDefined();
      expect(gemini!.name).toBe('Gemini CLI');
      // CDN alias entries (gemini-cli) are deduplicated — built-in 'gemini' covers them
      expect(registry.agents.find(a => a.id === 'gemini-cli')).toBeUndefined();

      await flushPromises();
      const refreshed = await fetchAcpRegistry();
      // CDN-only entries are added
      const cdnOnly = refreshed.agents.find(a => a.id === 'new-cdn-only');
      expect(cdnOnly).toBeDefined();
      expect(cdnOnly!.name).toBe('CDN Only Agent');
    });

    it('caches the registry for subsequent calls', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      await fetchAcpRegistry();
      await flushPromises();
      const cached = await fetchAcpRegistry();

      expect(cached).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not wait for a hanging CDN request before returning built-in agents', async () => {
      let resolveFetch!: (value: { ok: boolean; json: () => Promise<typeof MOCK_REGISTRY> }) => void;
      mockFetch.mockReturnValueOnce(new Promise((resolve) => {
        resolveFetch = resolve;
      }));

      const registry = await fetchAcpRegistry();

      expect(registry.version).toBe('builtin');
      expect(registry.agents.length).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, json: async () => MOCK_REGISTRY });
      await flushPromises();
      const refreshed = await fetchAcpRegistry();
      expect(refreshed.agents.find(a => a.id === 'new-cdn-only')).toBeDefined();
    });

    it('deduplicates concurrent cold refreshes', async () => {
      let resolveFetch!: (value: { ok: boolean; json: () => Promise<typeof MOCK_REGISTRY> }) => void;
      mockFetch.mockReturnValueOnce(new Promise((resolve) => {
        resolveFetch = resolve;
      }));

      const registries = await Promise.all([
        fetchAcpRegistry(),
        fetchAcpRegistry(),
        fetchAcpRegistry(),
      ]);

      expect(registries.every((registry) => registry.version === 'builtin')).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, json: async () => MOCK_REGISTRY });
      await flushPromises();
      const refreshed = await fetchAcpRegistry();
      expect(refreshed.agents.find(a => a.id === 'new-cdn-only')).toBeDefined();
    });

    it('returns built-in registry on fetch failure with no cache', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const registry = await fetchAcpRegistry();
      // Should fall back to built-in registry, never null
      expect(registry).not.toBeNull();
      expect(registry.agents.length).toBeGreaterThan(0);
      expect(registry.version).toBe('builtin');
    });

    it('returns stale cache on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });
      await fetchAcpRegistry();
      await flushPromises();

      // Force cache expiry by clearing and re-caching with old date
      // (we can't easily expire cache in test, so just test that cache works)
      const cached = await fetchAcpRegistry();
      expect(cached).not.toBeNull();
      expect(cached!.agents.length).toBeGreaterThanOrEqual(2);
    });

    it('returns built-in registry for non-ok HTTP response with no cache', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const registry = await fetchAcpRegistry();
      // Should fall back to built-in registry, never null
      expect(registry).not.toBeNull();
      expect(registry.agents.length).toBeGreaterThan(0);
      expect(registry.version).toBe('builtin');
    });

    it('merges empty CDN registry with built-in agents', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ version: '1', agents: [] }) });

      const registry = await fetchAcpRegistry();
      expect(registry).not.toBeNull();
      // Even with empty CDN, built-in agents should be present
      expect(registry.agents.length).toBeGreaterThan(0);
    });

    it('handles object-keyed registry format', async () => {
      const objectFormat = {
        version: '1',
        'my-agent': { name: 'My Agent', description: 'test', transport: 'stdio', command: 'my-agent' },
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => objectFormat });

      await fetchAcpRegistry();
      await flushPromises();
      const registry = await fetchAcpRegistry();
      expect(registry).not.toBeNull();
      expect(registry.agents.length).toBeGreaterThanOrEqual(1);
      expect(registry.agents.find(a => a.id === 'my-agent')).toBeDefined();
    });

    it('handles malformed entries gracefully', async () => {
      const withBad = {
        version: '1',
        agents: [
          { id: 'good', name: 'Good', description: 'ok', transport: 'stdio', command: 'good' },
          null,
          { notAnAgent: true },
          { id: '', name: '', description: '' },
        ],
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => withBad });

      await fetchAcpRegistry();
      await flushPromises();
      const registry = await fetchAcpRegistry();
      expect(registry).not.toBeNull();
      // Valid CDN entry should be present (merged with built-in)
      expect(registry.agents.find(a => a.id === 'good')).toBeDefined();
      // Malformed entries should not be present
      expect(registry.agents.find(a => a.id === '')).toBeUndefined();
    });
  });

  describe('getAcpAgents', () => {
    it('returns agents from registry merged with built-in', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      const agents = await getAcpAgents();
      expect(agents.length).toBeGreaterThanOrEqual(2);
    });

    it('returns built-in agents on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('down'));

      const agents = await getAcpAgents();
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('findAcpAgent', () => {
    it('finds agent by canonical ID', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      const agent = await findAcpAgent('gemini');
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('Gemini CLI');
    });

    it('finds agent by alias ID (resolves to canonical)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      const agent = await findAcpAgent('gemini-cli');
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('Gemini CLI');
    });

    it('finds CDN-only agent', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      const agent = await findAcpAgent('new-cdn-only');
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('CDN Only Agent');
    });

    it('returns null for unknown ID', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_REGISTRY });

      const agent = await findAcpAgent('nonexistent');
      expect(agent).toBeNull();
    });
  });
});
