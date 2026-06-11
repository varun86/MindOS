import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTestMindRoot } from '../setup';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

function clipRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/inbox/clip', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/inbox/clip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores an HTTP PDF URL as a PDF file in Inbox', async () => {
    const pdfBytes = Buffer.from('%PDF-1.7\nremote paper');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://papers.example.com/paper?id=42',
      headers: new Headers({
        'content-type': 'application/pdf; charset=binary',
        'content-length': String(pdfBytes.length),
        'content-disposition': 'attachment; filename="Remote Paper.pdf"',
      }),
      arrayBuffer: () => Promise.resolve(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)),
    }));

    const { POST } = await import('@/app/api/inbox/clip/route');
    const res = await POST(clipRequest({ url: 'https://papers.example.com/paper?id=42' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      title: 'Remote Paper.pdf',
      fileName: 'Inbox/Remote Paper.pdf',
      mode: 'file',
      url: 'https://papers.example.com/paper?id=42',
      contentType: 'application/pdf; charset=binary',
      byteLength: pdfBytes.length,
    });
    expect(fs.readFileSync(path.join(getTestMindRoot(), 'Inbox', 'Remote Paper.pdf'))).toEqual(pdfBytes);
  });

  it('stores an HTTP image URL as an image file in Inbox', async () => {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://assets.example.com/diagram.png',
      headers: new Headers({
        'content-type': 'image/png',
        'content-length': String(imageBytes.length),
      }),
      arrayBuffer: () => Promise.resolve(imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength)),
    }));

    const { POST } = await import('@/app/api/inbox/clip/route');
    const res = await POST(clipRequest({ url: 'https://assets.example.com/diagram.png' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      title: 'diagram.png',
      fileName: 'Inbox/diagram.png',
      mode: 'file',
      url: 'https://assets.example.com/diagram.png',
      contentType: 'image/png',
      byteLength: imageBytes.length,
    });
    expect(fs.readFileSync(path.join(getTestMindRoot(), 'Inbox', 'diagram.png'))).toEqual(imageBytes);
  });
});
