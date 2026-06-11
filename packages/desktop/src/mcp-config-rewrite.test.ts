import { describe, expect, it } from 'vitest';
import { rewriteMcpClientConfig } from './mcp-config-rewrite';

describe('rewriteMcpClientConfig', () => {
  it('rewrites localhost-form URLs to the 127.0.0.1 form on the new port', () => {
    const raw = '{"mcpServers":{"mindos":{"url":"http://localhost:8781/mcp"}}}';
    expect(rewriteMcpClientConfig(raw, 8781, 8790)).toBe(
      '{"mcpServers":{"mindos":{"url":"http://127.0.0.1:8790/mcp"}}}',
    );
  });

  it('rewrites 127.0.0.1-form URLs (hand-written configs)', () => {
    const raw = '{"url":"http://127.0.0.1:8781/mcp"}';
    expect(rewriteMcpClientConfig(raw, 8781, 8790)).toBe('{"url":"http://127.0.0.1:8790/mcp"}');
  });

  it('rewrites every occurrence across mixed host forms', () => {
    const raw = 'a http://localhost:8781/mcp b http://127.0.0.1:8781/mcp c';
    expect(rewriteMcpClientConfig(raw, 8781, 8790)).toBe(
      'a http://127.0.0.1:8790/mcp b http://127.0.0.1:8790/mcp c',
    );
  });

  it('returns null when the old port is not referenced', () => {
    expect(rewriteMcpClientConfig('{"url":"http://localhost:9999/mcp"}', 8781, 8790)).toBeNull();
    expect(rewriteMcpClientConfig('', 8781, 8790)).toBeNull();
  });

  it('does not touch non-mcp URLs on the same port', () => {
    const raw = '{"web":"http://localhost:8781/api"}';
    expect(rewriteMcpClientConfig(raw, 8781, 8790)).toBeNull();
  });
});
