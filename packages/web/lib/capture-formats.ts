export type CaptureFormatKind = 'documents' | 'web' | 'tables' | 'screenshots';

export interface CaptureFormatChip {
  kind: CaptureFormatKind;
  label: string;
  examples: string;
}

export const CAPTURE_FORMAT_CHIPS: CaptureFormatChip[] = [
  { kind: 'documents', label: 'Documents', examples: 'PDF, Word, MD, TXT' },
  { kind: 'web', label: 'Web', examples: 'URL, HTML' },
  { kind: 'tables', label: 'Tables', examples: 'CSV, JSON, YAML, XML' },
  { kind: 'screenshots', label: 'Screenshots', examples: 'PNG, JPG, WebP' },
];

export const CAPTURE_ACCEPT = [
  '.md',
  '.markdown',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.htm',
  '.pdf',
  '.doc',
  '.docx',
  '.docm',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
].join(',');

const EXTRACTABLE_DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'docm']);

const BINARY_CAPTURE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'docm',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
]);

const AI_READABLE_CAPTURE_EXTENSIONS = new Set([
  'md',
  'markdown',
  'txt',
  'csv',
  'tsv',
  'json',
  'yaml',
  'yml',
  'xml',
  'html',
  'htm',
]);

export function getCaptureExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isExtractableDocumentName(name: string): boolean {
  return EXTRACTABLE_DOCUMENT_EXTENSIONS.has(getCaptureExtension(name));
}

export function isBinaryCaptureName(name: string): boolean {
  return BINARY_CAPTURE_EXTENSIONS.has(getCaptureExtension(name));
}

export function isAiReadableCaptureName(name: string): boolean {
  return AI_READABLE_CAPTURE_EXTENSIONS.has(getCaptureExtension(name));
}
