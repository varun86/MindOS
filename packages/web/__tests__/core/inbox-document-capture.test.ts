import { describe, expect, it, vi } from 'vitest';

import {
  expandInboxDocumentCaptures,
  buildExtractionMarkdown,
} from '@/lib/core/inbox-document-capture';

describe('inbox document capture expansion', () => {
  it('keeps the original PDF and adds an extracted markdown companion', async () => {
    const result = await expandInboxDocumentCaptures([
      { name: 'research.pdf', content: Buffer.from('%PDF fake').toString('base64'), encoding: 'base64' },
    ], {
      extractPdf: vi.fn(async () => ({
        kind: 'pdf',
        extracted: true,
        text: 'Agent memory benchmark notes',
        pages: 3,
        warning: undefined,
      })),
      extractWord: vi.fn(),
    });

    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toMatchObject({ name: 'research.pdf', encoding: 'base64' });
    expect(result.files[1].name).toBe('research.md');
    expect(result.files[1].encoding).toBe('text');
    expect(result.files[1].content).toContain('Source: research.pdf');
    expect(result.files[1].content).toContain('Format: PDF');
    expect(result.files[1].content).toContain('Pages: 3');
    expect(result.files[1].content).toContain('Agent memory benchmark notes');
  });

  it('keeps the original Word file and adds a markdown companion', async () => {
    const result = await expandInboxDocumentCaptures([
      { name: 'meeting.docx', content: Buffer.from('fake docx').toString('base64'), encoding: 'base64' },
    ], {
      extractPdf: vi.fn(),
      extractWord: vi.fn(async () => ({
        kind: 'word',
        extracted: true,
        markdown: '## Decisions\n\n- Keep Capture simple.',
        text: 'Decisions Keep Capture simple.',
        pages: 1,
        chars: 31,
        imageCount: 0,
      })),
    });

    expect(result.files.map(file => file.name)).toEqual(['meeting.docx', 'meeting.md']);
    expect(result.files[1].content).toContain('Source: meeting.docx');
    expect(result.files[1].content).toContain('Format: Word');
    expect(result.files[1].content).toContain('## Decisions');
  });

  it('adds a readable extraction note for scanned PDFs instead of binary gibberish', async () => {
    const result = await expandInboxDocumentCaptures([
      { name: 'scan.pdf', content: Buffer.from('%PDF scan').toString('base64'), encoding: 'base64' },
    ], {
      extractPdf: vi.fn(async () => ({
        kind: 'pdf',
        extracted: false,
        text: '',
        pages: 5,
        warning: 'No extractable text found. OCR is required.',
      })),
      extractWord: vi.fn(),
    });

    expect(result.files.map(file => file.name)).toEqual(['scan.pdf', 'scan.md']);
    expect(result.files[1].content).toContain('Extraction status: needs review');
    expect(result.files[1].content).toContain('No extractable text found');
    expect(result.files[1].content).not.toContain('%PDF scan');
  });

  it('leaves ordinary text captures unchanged', async () => {
    const result = await expandInboxDocumentCaptures([
      { name: 'note.txt', content: 'hello', encoding: 'text' },
    ], {
      extractPdf: vi.fn(),
      extractWord: vi.fn(),
    });

    expect(result.files).toEqual([{ name: 'note.txt', content: 'hello', encoding: 'text' }]);
  });

  it('does not generate a markdown companion for invalid base64 documents', async () => {
    const extractPdf = vi.fn();
    const result = await expandInboxDocumentCaptures([
      { name: 'broken.pdf', content: 'not base64!!!', encoding: 'base64' },
    ], {
      extractPdf,
      extractWord: vi.fn(),
    });

    expect(result.files).toEqual([
      { name: 'broken.pdf', content: 'not base64!!!', encoding: 'base64' },
    ]);
    expect(extractPdf).not.toHaveBeenCalled();
  });

  it('leaves malformed document captures for the Inbox handler to reject safely', async () => {
    const extractPdf = vi.fn();
    const malformed = { name: 'bad.pdf', content: null, encoding: 'base64' } as unknown as Parameters<typeof expandInboxDocumentCaptures>[0][number];
    const result = await expandInboxDocumentCaptures([malformed], {
      extractPdf,
      extractWord: vi.fn(),
    });

    expect(result.files).toEqual([malformed]);
    expect(extractPdf).not.toHaveBeenCalled();
  });
});

describe('buildExtractionMarkdown', () => {
  it('renders extraction metadata in a stable markdown wrapper', () => {
    expect(buildExtractionMarkdown({
      originalName: 'doc.docx',
      formatLabel: 'Word',
      bodyMarkdown: 'Body',
      status: 'extracted',
      pages: 2,
      chars: 4,
      warning: 'Images omitted',
    })).toContain('Extraction status: extracted');
  });
});
