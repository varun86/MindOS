import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/core/hybrid-search', () => ({
  hybridSearch: vi.fn(),
}));

vi.mock('@/lib/fs', () => ({
  getFileContent: vi.fn(),
  getMindRoot: vi.fn(() => '/mock/mind'),
}));

vi.mock('@/lib/agent/context', () => ({
  estimateStringTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

import { performActiveRecall } from '@/lib/agent/active-recall';
import { hybridSearch } from '@/lib/core/hybrid-search';
import { getFileContent } from '@/lib/fs';
import { estimateStringTokens } from '@/lib/agent/context';

const mockSearch = vi.mocked(hybridSearch);
const mockGetFile = vi.mocked(getFileContent);
const mockTokens = vi.mocked(estimateStringTokens);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: estimateStringTokens returns length/4
  mockTokens.mockImplementation((text: string) => Math.ceil(text.length / 4));
});

describe('performActiveRecall', () => {
  it('returns matching results for a valid query', async () => {
    mockSearch.mockResolvedValue([
      { path: 'notes/arch.md', snippet: 'Architecture decisions...', score: 5.0, occurrences: 1 },
      { path: 'notes/todo.md', snippet: 'TODO items...', score: 3.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue('Full content of the architecture document with more details.');

    const results = await performActiveRecall('/mock/mind', 'architecture decisions');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('notes/arch.md');
    expect(results[0].score).toBeGreaterThan(5.0);
    expect(mockSearch).toHaveBeenCalledOnce();
  });

  it('returns empty array when no results match', async () => {
    mockSearch.mockResolvedValue([]);

    const results = await performActiveRecall('/mock/mind', 'something obscure');

    expect(results).toEqual([]);
  });

  it('returns empty array for very short queries', async () => {
    const results = await performActiveRecall('/mock/mind', 'a');

    expect(results).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('returns empty array for empty query', async () => {
    const results = await performActiveRecall('/mock/mind', '');

    expect(results).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('filters results below minScore threshold', async () => {
    mockSearch.mockResolvedValue([
      { path: 'notes/high.md', snippet: 'High score', score: 5.0, occurrences: 1 },
      { path: 'notes/low.md', snippet: 'Low score', score: 0.5, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue('Short content');

    const results = await performActiveRecall('/mock/mind', 'test query', { minScore: 1.0 });

    expect(results.length).toBe(1);
    expect(results[0].path).toBe('notes/high.md');
  });

  it('does not apply BM25 minScore scale to rank-fusion search candidates', async () => {
    mockSearch.mockResolvedValue([
      {
        path: 'notes/rank-fusion.md',
        snippet: 'rank fusion recall',
        score: 0.02,
        scoreKind: 'rank_fusion',
        occurrences: 1,
      },
    ]);
    mockGetFile.mockReturnValue('# Recall\n\nrank fusion recall content');

    const results = await performActiveRecall('/mock/mind', 'rank fusion recall');

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('notes/rank-fusion.md');
  });

  it('excludes meta-files (README.md, INSTRUCTION.md, CONFIG.json)', async () => {
    mockSearch.mockResolvedValue([
      { path: 'README.md', snippet: 'Top-level readme', score: 10.0, occurrences: 1 },
      { path: 'dir/INSTRUCTION.md', snippet: 'Instructions', score: 8.0, occurrences: 1 },
      { path: 'dir/CONFIG.json', snippet: 'Config', score: 7.0, occurrences: 1 },
      { path: 'notes/real.md', snippet: 'Real content', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue('Real content here');

    const results = await performActiveRecall('/mock/mind', 'test query');

    expect(results.length).toBe(1);
    expect(results[0].path).toBe('notes/real.md');
  });

  it('excludes files already in excludePaths (attached files)', async () => {
    mockSearch.mockResolvedValue([
      { path: 'notes/attached.md', snippet: 'Already attached', score: 8.0, occurrences: 1 },
      { path: 'notes/new.md', snippet: 'New content', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue('Content');

    const results = await performActiveRecall('/mock/mind', 'test', {
      excludePaths: ['notes/attached.md'],
    });

    expect(results.length).toBe(1);
    expect(results[0].path).toBe('notes/new.md');
  });

  it('respects maxFiles limit', async () => {
    mockSearch.mockResolvedValue([
      { path: 'a.md', snippet: 'A', score: 5.0, occurrences: 1 },
      { path: 'b.md', snippet: 'B', score: 4.0, occurrences: 1 },
      { path: 'c.md', snippet: 'C', score: 3.0, occurrences: 1 },
      { path: 'd.md', snippet: 'D', score: 2.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue('Short');

    const results = await performActiveRecall('/mock/mind', 'test', { maxFiles: 2 });

    expect(results.length).toBe(2);
  });

  it('keeps default recall limits when optional config fields are undefined', async () => {
    mockSearch.mockResolvedValue([
      { path: 'notes/defaults.md', snippet: 'default fallback', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue('default fallback content');

    const results = await performActiveRecall('/mock/mind', 'default fallback', {
      maxTokens: undefined,
      maxFiles: undefined,
      minScore: undefined,
    });

    expect(results).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('/mock/mind', 'default fallback', { limit: 20 });
  });

  it('respects maxTokens budget', async () => {
    // Each file content is ~200 chars = ~50 tokens
    const content = 'x'.repeat(200);
    mockSearch.mockResolvedValue([
      { path: 'a.md', snippet: 'A', score: 5.0, occurrences: 1 },
      { path: 'b.md', snippet: 'B', score: 4.0, occurrences: 1 },
      { path: 'c.md', snippet: 'C', score: 3.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue(content);
    // 200 chars / 4 = 50 tokens each

    const results = await performActiveRecall('/mock/mind', 'test', { maxTokens: 80 });

    // Should fit 1 full (50t) + possibly truncated 2nd
    expect(results.length).toBeLessThanOrEqual(2);
    // Total tokens should not exceed 80
  });

  it('truncates query longer than 500 chars', async () => {
    const longQuery = 'a'.repeat(600);
    mockSearch.mockResolvedValue([]);

    await performActiveRecall('/mock/mind', longQuery);

    // hybridSearch should be called with truncated query
    expect(mockSearch).toHaveBeenCalledOnce();
    const calledQuery = mockSearch.mock.calls[0][1];
    expect(calledQuery.length).toBe(500);
  });

  it('handles search timeout gracefully', async () => {
    mockSearch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000)));

    const results = await performActiveRecall('/mock/mind', 'test', { timeoutMs: 50 });

    expect(results).toEqual([]);
  });

  it('handles search error gracefully', async () => {
    mockSearch.mockRejectedValue(new Error('search failed'));

    const results = await performActiveRecall('/mock/mind', 'test');

    expect(results).toEqual([]);
  });

  it('falls back to snippet when file read fails', async () => {
    mockSearch.mockResolvedValue([
      { path: 'notes/gone.md', snippet: 'Original snippet text', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockImplementation(() => { throw new Error('file not found'); });

    const results = await performActiveRecall('/mock/mind', 'test');

    expect(results.length).toBe(1);
    expect(results[0].content).toBe('Original snippet text');
  });

  it('returns full file content for short files', async () => {
    const shortContent = 'This is a short file with only 50 chars of text.';
    mockSearch.mockResolvedValue([
      { path: 'notes/short.md', snippet: 'short file', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue(shortContent);

    const results = await performActiveRecall('/mock/mind', 'short file');

    expect(results[0].content).toBe(shortContent);
  });

  it('returns a focused chunk for long files with keyword match', async () => {
    // Build a long file with keyword in the second chunk.
    const before = 'prefix '.repeat(240); // > 1600 chars
    const match = 'KEYWORD_MATCH here is the relevant content ';
    const after = 'suffix '.repeat(240);
    const fullContent = `# Long note\n\n${before}\n\n## Relevant section\n\n${match}${after}`;

    mockSearch.mockResolvedValue([
      { path: 'notes/long.md', snippet: 'KEYWORD_MATCH', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue(fullContent);

    const results = await performActiveRecall('/mock/mind', 'keyword_match');

    expect(results[0].content.length).toBeLessThan(fullContent.length);
    expect(results[0].content).toContain('KEYWORD_MATCH');
    expect(results[0].headingPath).toEqual(['Long note', 'Relevant section']);
    expect(results[0].startLine).toBeGreaterThan(1);
    expect(results[0].endLine).toBeGreaterThanOrEqual(results[0].startLine!);
  });

  it('uses heading-aware chunk scoring instead of the first keyword occurrence', async () => {
    const intro = 'prompt '.repeat(260);
    const fullContent = [
      '# Prompt notes',
      '',
      '## Background',
      intro,
      '',
      '## Recall Strategy',
      'The recall strategy should prefer markdown chunks with exact section context.',
    ].join('\n');

    mockSearch.mockResolvedValue([
      { path: 'notes/prompt.md', snippet: 'recall strategy should prefer markdown chunks', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue(fullContent);

    const results = await performActiveRecall('/mock/mind', 'recall strategy prompt');

    expect(results[0].content).toContain('recall strategy should prefer markdown chunks');
    expect(results[0].headingPath).toEqual(['Prompt notes', 'Recall Strategy']);
    expect(results[0].content).not.toContain(intro.slice(0, 200));
  });

  it('matches Chinese queries without requiring embedding segmentation', async () => {
    const unrelated = '普通记录 '.repeat(400);
    const fullContent = [
      '# 中文知识',
      '',
      '## 背景',
      unrelated,
      '',
      '## 上下文片段 策略',
      '这里记录上下文片段的召回策略，应该优先选择这个语义块。',
    ].join('\n');

    mockSearch.mockResolvedValue([
      { path: 'notes/chinese.md', snippet: '上下文片段的召回策略', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockReturnValue(fullContent);

    const results = await performActiveRecall('/mock/mind', '上下文片段');

    expect(results[0].content).toContain('上下文片段的召回策略');
    expect(results[0].headingPath).toEqual(['中文知识', '上下文片段 策略']);
  });

  it('boosts chunks from selected space prefixes without requiring embeddings', async () => {
    mockSearch.mockResolvedValue([
      { path: 'Archive/old.md', snippet: 'recall policy', score: 5.0, occurrences: 1 },
      { path: 'Project/current.md', snippet: 'recall policy', score: 5.0, occurrences: 1 },
    ]);
    mockGetFile.mockImplementation((filePath: string) => {
      if (filePath === 'Archive/old.md') return '# Old\n\nrecall policy from archive';
      return '# Current\n\nrecall policy from selected project';
    });

    const results = await performActiveRecall('/mock/mind', 'recall policy', {
      preferredPaths: ['Project'],
    });

    expect(results[0].path).toBe('Project/current.md');
    expect(results[0].content).toContain('selected project');
  });
});
