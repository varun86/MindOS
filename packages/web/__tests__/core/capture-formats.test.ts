import { describe, expect, it } from 'vitest';

import {
  CAPTURE_ACCEPT,
  CAPTURE_FORMAT_CHIPS,
  isAiReadableCaptureName,
  isBinaryCaptureName,
  isExtractableDocumentName,
} from '@/lib/capture-formats';

describe('capture format capability table', () => {
  it('keeps common document formats in the shared accept string', () => {
    expect(CAPTURE_ACCEPT).toContain('.pdf');
    expect(CAPTURE_ACCEPT).toContain('.docx');
    expect(CAPTURE_ACCEPT).toContain('.doc');
    expect(CAPTURE_ACCEPT).toContain('.docm');
  });

  it('drives UI chips from product-level format groups', () => {
    expect(CAPTURE_FORMAT_CHIPS.map(chip => chip.label)).toEqual([
      'Documents',
      'Web',
      'Tables',
      'Screenshots',
    ]);
  });

  it('separates extractable documents from save-only binaries and AI-readable text', () => {
    expect(isExtractableDocumentName('report.pdf')).toBe(true);
    expect(isExtractableDocumentName('brief.docx')).toBe(true);
    expect(isBinaryCaptureName('brief.docx')).toBe(true);
    expect(isBinaryCaptureName('sheet.xlsx')).toBe(true);
    expect(isAiReadableCaptureName('brief.docx')).toBe(false);
    expect(isAiReadableCaptureName('brief.md')).toBe(true);
    expect(isAiReadableCaptureName('data.csv')).toBe(true);
  });
});
