import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureUrl, clipUrl, createFallbackWebClip, isSafeHttpUrlForFetch, isValidUrl } from '@/lib/core/web-clip';

describe('isValidUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('https://sub.example.com/path#section')).toBe(true);
  });

  it('rejects non-http schemes', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('file:///etc/passwd')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects empty and garbage strings', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('   ')).toBe(false);
  });

  it('rejects null-like inputs passed as any', () => {
    expect(isValidUrl(null as unknown as string)).toBe(false);
    expect(isValidUrl(undefined as unknown as string)).toBe(false);
  });
});

describe('isSafeHttpUrlForFetch', () => {
  it('blocks local and private network URLs before server-side fetch', () => {
    expect(isSafeHttpUrlForFetch('https://example.com')).toBe(true);
    expect(isSafeHttpUrlForFetch('http://localhost:3000')).toBe(false);
    expect(isSafeHttpUrlForFetch('http://127.0.0.1:3000')).toBe(false);
    expect(isSafeHttpUrlForFetch('http://10.0.0.2/page')).toBe(false);
    expect(isSafeHttpUrlForFetch('http://192.168.1.5/page')).toBe(false);
    expect(isSafeHttpUrlForFetch('http://[::1]/page')).toBe(false);
    expect(isSafeHttpUrlForFetch('http://2130706433/page')).toBe(false);
    expect(isSafeHttpUrlForFetch('http://0x7f000001/page')).toBe(false);
  });
});

describe('clipUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid URLs', async () => {
    await expect(clipUrl('not-a-url')).rejects.toThrow('Invalid URL');
    await expect(clipUrl('ftp://evil.com')).rejects.toThrow('Invalid URL');
  });

  it('rejects local URLs before fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(clipUrl('http://127.0.0.1:4567/private')).rejects.toThrow('Unsafe URL');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects unsafe redirects before following them', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      statusText: 'Found',
      url: 'https://example.com/redirect',
      headers: new Headers({
        location: 'http://127.0.0.1:4567/private',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(clipUrl('https://example.com/redirect')).rejects.toThrow('Unsafe redirect URL');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('clips a simple HTML page', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>Test Article</title></head>
<body>
  <article>
    <h1>Test Article</h1>
    <p>This is a test article with enough content to pass the Readability threshold.
       It needs to be longer than 100 characters to be parsed as an article by the
       Readability library. So we add more text here to make sure it works properly
       in our test environment.</p>
    <p>Second paragraph with additional content to ensure the article extraction
       algorithm has enough material to work with. We want at least a few hundred
       characters of meaningful content.</p>
  </article>
</body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/article',
      headers: new Headers({
        'content-type': 'text/html; charset=utf-8',
      }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await clipUrl('https://example.com/article');

    expect(result.title).toBe('Test Article');
    expect(result.fileName).toBe('Test Article.md');
    expect(result.url).toBe('https://example.com/article');
    expect(result.markdown).toContain('# Test Article');
    expect(result.markdown).toContain('---');
    expect(result.markdown).toContain('type: material');
    expect(result.markdown).toContain('source_type: web');
    expect(result.markdown).toMatch(/source_url:.*example\.com\/article/);
    expect(result.markdown).toContain('captured_at:');
    expect(result.markdown).not.toContain('source_domain:');
    expect(result.markdown).not.toContain('clipped:');
    expect(result.mode).toBe('article');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('preserves embedded image URLs in clipped web pages without downloading them', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>Article With Image</title></head>
<body>
  <article>
    <h1>Article With Image</h1>
    <p>This article includes a meaningful image but the web clip should keep the
       original remote image URL in Markdown instead of saving the image as a
       separate Inbox file. We add enough article text so Readability extracts
       the article body consistently in this test environment.</p>
    <img src="https://cdn.example.com/figures/chart.png" alt="Research chart">
    <p>Additional body text keeps the article extraction stable and verifies that
       normal web-page clipping remains an article capture, not a binary capture.</p>
  </article>
</body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/article-with-image',
      headers: new Headers({
        'content-type': 'text/html; charset=utf-8',
      }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await captureUrl('https://example.com/article-with-image');

    expect(result.mode).toBe('article');
    if (result.mode !== 'article') throw new Error('Expected article capture');
    expect(result.fileName).toBe('Article With Image.md');
    expect(result.markdown).toContain('![Research chart](https://cdn.example.com/figures/chart.png)');
    expect(result.markdown).not.toContain('contentBase64');
  });

  it('handles non-HTML content type', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/image.png',
      headers: new Headers({
        'content-type': 'image/png',
      }),
      text: () => Promise.resolve('binary data'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(clipUrl('https://example.com/image.png'))
      .rejects.toThrow('URL does not point to an HTML page');
  });

  it('captures a PDF URL as the original binary file', async () => {
    const pdfBytes = Buffer.from('%PDF-1.7\nbinary body');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://papers.example.com/download?id=123',
      headers: new Headers({
        'content-type': 'application/pdf',
        'content-length': String(pdfBytes.length),
        'content-disposition': 'attachment; filename="MindOS Paper.pdf"',
      }),
      arrayBuffer: () => Promise.resolve(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await captureUrl('https://papers.example.com/download?id=123');

    expect(result.mode).toBe('file');
    if (result.mode !== 'file') throw new Error('Expected PDF file capture');
    expect(result.fileName).toBe('MindOS Paper.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.contentBase64).toBe(pdfBytes.toString('base64'));
    expect(result.byteLength).toBe(pdfBytes.length);
    expect(result.url).toBe('https://papers.example.com/download?id=123');
  });

  it('captures an image URL as the original binary file', async () => {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://assets.example.com/images/diagram',
      headers: new Headers({
        'content-type': 'image/png',
        'content-length': String(imageBytes.length),
        'content-disposition': "inline; filename*=UTF-8''MindOS%20Diagram.png",
      }),
      arrayBuffer: () => Promise.resolve(imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength)),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await captureUrl('https://assets.example.com/images/diagram');

    expect(result.mode).toBe('file');
    if (result.mode !== 'file') throw new Error('Expected image file capture');
    expect(result.fileName).toBe('MindOS Diagram.png');
    expect(result.contentType).toBe('image/png');
    expect(result.contentBase64).toBe(imageBytes.toString('base64'));
    expect(result.byteLength).toBe(imageBytes.length);
    expect(result.url).toBe('https://assets.example.com/images/diagram');
  });

  it('handles HTTP error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      url: 'https://example.com/missing',
      headers: new Headers({ 'content-type': 'text/html' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(clipUrl('https://example.com/missing'))
      .rejects.toThrow('HTTP 404');
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(clipUrl('https://example.com'))
      .rejects.toThrow('fetch failed');
  });

  it('handles pages with minimal content', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>Minimal Page</title></head>
<body><p>Short.</p></body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await clipUrl('https://example.com/');

    expect(result.title).toBe('Minimal Page');
    expect(result.markdown).toContain('# Minimal Page');
    expect(result.fileName).toBe('Minimal Page.md');
  });

  it('sanitizes titles with special characters', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>My "Article" — with: special/chars</title></head>
<body>
  <article>
    <h1>My "Article" — with: special/chars</h1>
    <p>Long enough content to be picked up by Readability as a proper article.
       We need several sentences of meaningful text content to ensure the extraction
       works correctly. This is the third sentence adding more words.</p>
  </article>
</body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/special',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await clipUrl('https://example.com/special');

    expect(result.fileName).not.toContain('/');
    expect(result.fileName).not.toContain('"');
    expect(result.fileName).not.toContain(':');
    expect(result.fileName.endsWith('.md')).toBe(true);
  });

  it('includes frontmatter with source metadata', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>Frontmatter Test</title></head>
<body>
  <article>
    <h1>Frontmatter Test</h1>
    <p>Content paragraph one with enough text to be extracted properly by
       the Readability library. We need meaningful content here.</p>
    <p>Content paragraph two adding more substance to the article.</p>
  </article>
</body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://blog.example.com/post/123',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await clipUrl('https://blog.example.com/post/123');

    expect(result.markdown).toMatch(/^---\n/);
    expect(result.markdown).toContain('title: Frontmatter Test');
    expect(result.markdown).toContain('type: material');
    expect(result.markdown).toContain('status: active');
    expect(result.markdown).toMatch(/created: \d{4}-\d{2}-\d{2}/);
    expect(result.markdown).toMatch(/source_url:.*blog\.example\.com\/post\/123/);
    expect(result.markdown).toContain('captured_at:');
    expect(result.markdown).not.toContain('source_domain:');
    expect(result.markdown).not.toContain('author:');
    expect(result.markdown).not.toContain('clipped:');
    expect(result.siteName).toBe('blog.example.com');
  });

  it('adds platform frontmatter for known social sources', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>Video Notes</title></head>
<body><article><h1>Video Notes</h1><p>Enough content for extraction from a YouTube page. This paragraph has enough words for the readability fallback in tests and keeps the behavior deterministic.</p></article></body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://www.youtube.com/watch?v=abc',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await clipUrl('https://www.youtube.com/watch?v=abc');

    expect(result.markdown).toContain('source_platform: youtube');
    expect(result.markdown).not.toContain('source_domain:');
    expect(result.siteName).toBe('YouTube');
  });

  it('creates link-only fallback markdown with source metadata', () => {
    const result = createFallbackWebClip('https://www.bilibili.com/video/BV123');

    expect(result.mode).toBe('link');
    expect(result.fileName).toBe('Bilibili link.md');
    expect(result.markdown).toContain('type: material');
    expect(result.markdown).toContain('source_type: web');
    expect(result.markdown).toMatch(/source_url:.*bilibili\.com\/video\/BV123/);
    expect(result.markdown).toContain('source_platform: bilibili');
    expect(result.markdown).toContain('captured_at:');
    expect(result.markdown).not.toContain('source_domain:');
    expect(result.markdown).not.toContain('clip_status:');
  });

  it('handles CJK content word count', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>中文文章</title></head>
<body>
  <article>
    <h1>中文文章标题</h1>
    <p>这是一篇中文文章的内容，包含足够多的中文字符来测试字数统计功能。
       我们需要确保中日韩字符的计数逻辑正确工作，每个汉字算作一个词。
       这段话应该有足够的内容让 Readability 提取器正常工作。</p>
  </article>
</body></html>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.cn/article',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await clipUrl('https://example.cn/article');
    expect(result.wordCount).toBeGreaterThan(20);
  });
});
