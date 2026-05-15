import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getNodeExecutor } from './node-executor';
import { resolveScript } from './resolve-script';
import { isExtractableDocumentName } from '@/lib/capture-formats';

export interface InboxCaptureInputFile {
  name: string;
  content: string;
  encoding?: 'text' | 'base64' | string;
}

export interface InboxCaptureExpansionResult {
  files: InboxCaptureInputFile[];
}

export interface PdfExtractionResult {
  kind: 'pdf';
  extracted: boolean;
  text: string;
  pages?: number;
  warning?: string;
  error?: string;
}

export interface WordExtractionResult {
  kind: 'word';
  extracted: boolean;
  markdown: string;
  text: string;
  pages?: number;
  chars?: number;
  imageCount?: number;
  warning?: string;
  error?: string;
  message?: string;
}

export interface InboxDocumentExtractors {
  extractPdf: (buffer: Buffer, originalName: string) => Promise<PdfExtractionResult> | PdfExtractionResult;
  extractWord: (buffer: Buffer, originalName: string) => Promise<WordExtractionResult> | WordExtractionResult;
}

export async function expandInboxDocumentCaptures(
  files: InboxCaptureInputFile[],
  extractors: InboxDocumentExtractors = createDefaultInboxDocumentExtractors(),
): Promise<InboxCaptureExpansionResult> {
  const expanded: InboxCaptureInputFile[] = [];

  for (const file of files) {
    expanded.push(file);
    if (file.encoding !== 'base64' || !isExtractableDocumentName(file.name)) continue;

    const buffer = Buffer.from(file.content, 'base64');
    const ext = path.extname(file.name).toLowerCase();
    const companionName = companionMarkdownName(file.name);

    try {
      const extracted = ext === '.pdf'
        ? await extractors.extractPdf(buffer, file.name)
        : await extractors.extractWord(buffer, file.name);

      expanded.push({
        name: companionName,
        content: extractionResultToMarkdown(file.name, extracted),
        encoding: 'text',
      });
    } catch (error) {
      expanded.push({
        name: companionName,
        content: buildExtractionMarkdown({
          originalName: file.name,
          formatLabel: ext === '.pdf' ? 'PDF' : 'Word',
          bodyMarkdown: '',
          status: 'needs review',
          warning: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
        encoding: 'text',
      });
    }
  }

  return { files: expanded };
}

export function buildExtractionMarkdown({
  originalName,
  formatLabel,
  bodyMarkdown,
  status,
  pages,
  chars,
  imageCount,
  warning,
}: {
  originalName: string;
  formatLabel: string;
  bodyMarkdown: string;
  status: 'extracted' | 'needs review';
  pages?: number;
  chars?: number;
  imageCount?: number;
  warning?: string;
}): string {
  const title = titleFromFileName(originalName);
  const metadata = [
    `Source: ${originalName}`,
    `Format: ${formatLabel}`,
    `Extraction status: ${status}`,
    pages != null ? `Pages: ${pages}` : null,
    chars != null ? `Characters: ${chars}` : null,
    imageCount != null ? `Images: ${imageCount}` : null,
    warning ? `Warning: ${warning}` : null,
  ].filter((line): line is string => Boolean(line));

  const body = bodyMarkdown.trim();
  return [
    `# ${title}`,
    '',
    metadata.map(line => `> ${line}`).join('\n'),
    '',
    body || '_No extractable text was found. The original file is preserved in Inbox._',
    '',
  ].join('\n');
}

export function createDefaultInboxDocumentExtractors(): InboxDocumentExtractors {
  return {
    extractPdf(buffer, originalName) {
      const scriptPath = resolveRequiredScript('extract-pdf.cjs');
      const tmpFile = writeTempFile(buffer, originalName, '.pdf', 'pdf-inbox-');
      try {
        const stdout = execFileSync(getNodeExecutor(), [scriptPath, tmpFile], {
          encoding: 'utf-8',
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        const parsed = JSON.parse(stdout) as { text?: string; pages?: number; error?: string };
        const text = (parsed.text ?? '').replace(/\u0000/g, '').trim();
        return {
          kind: 'pdf',
          extracted: Boolean(text) && !parsed.error,
          text,
          pages: parsed.pages ?? 0,
          warning: parsed.error || (!text ? 'No extractable text found. OCR is required.' : undefined),
          error: parsed.error,
        };
      } finally {
        removeTempFile(tmpFile);
      }
    },
    extractWord(buffer, originalName) {
      const scriptPath = resolveRequiredScript('extract-docx.cjs');
      const tmpFile = writeTempFile(buffer, originalName, '.docx', 'word-inbox-');
      try {
        const stdout = execFileSync(getNodeExecutor(), [scriptPath, tmpFile], {
          encoding: 'utf-8',
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        const parsed = JSON.parse(stdout) as Partial<WordExtractionResult>;
        return {
          kind: 'word',
          extracted: Boolean(parsed.extracted),
          markdown: parsed.markdown ?? '',
          text: parsed.text ?? '',
          pages: parsed.pages,
          chars: parsed.chars,
          imageCount: parsed.imageCount,
          warning: parsed.warning,
          error: parsed.error,
          message: parsed.message,
        };
      } finally {
        removeTempFile(tmpFile);
      }
    },
  };
}

function extractionResultToMarkdown(originalName: string, result: PdfExtractionResult | WordExtractionResult): string {
  if (result.kind === 'pdf') {
    return buildExtractionMarkdown({
      originalName,
      formatLabel: 'PDF',
      bodyMarkdown: result.text,
      status: result.extracted ? 'extracted' : 'needs review',
      pages: result.pages,
      chars: result.text.length,
      warning: result.warning || result.error,
    });
  }

  return buildExtractionMarkdown({
    originalName,
    formatLabel: 'Word',
    bodyMarkdown: result.markdown || result.text,
    status: result.extracted ? 'extracted' : 'needs review',
    pages: result.pages,
    chars: result.chars ?? result.text.length,
    imageCount: result.imageCount,
    warning: result.warning || result.message || result.error,
  });
}

function companionMarkdownName(originalName: string): string {
  const ext = path.extname(originalName);
  const stem = path.basename(originalName, ext) || 'document';
  return `${stem}.md`;
}

function titleFromFileName(name: string): string {
  const ext = path.extname(name);
  const stem = (ext ? name.slice(0, -ext.length) : name).replace(/^\.+/, '');
  const words = stem.replace(/[-_]+/g, ' ').trim().split(/\s+/);
  if (words.length === 0 || (words.length === 1 && !words[0])) return 'Untitled';
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function resolveRequiredScript(scriptName: string): string {
  const scriptPath = resolveScript(scriptName);
  if (!scriptPath) {
    throw new Error(`${scriptName} not found`);
  }
  return scriptPath;
}

function writeTempFile(buffer: Buffer, originalName: string, fallbackExt: string, prefix: string): string {
  const ext = path.extname(originalName).toLowerCase() || fallbackExt;
  const tmpFile = path.join(os.tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(tmpFile, buffer);
  return tmpFile;
}

function removeTempFile(filePath: string) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Temp cleanup is best-effort.
  }
}
