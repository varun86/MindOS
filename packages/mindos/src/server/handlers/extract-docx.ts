import { execFileSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { json, type MindosServerResponse } from '../response.js';
import {
  buildExtractorEnv,
  resolveExtractorScript,
  type ExtractPdfServices,
} from './extract-pdf.js';

const MAX_TEXT_CHARS = 100_000;
const MAX_BYTES = 12 * 1024 * 1024;

export const EXTRACT_DOCX_MAX_BODY_BYTES = 18 * 1024 * 1024;

export type ExtractDocxResult = {
  text: string;
  markdown: string;
  extracted: boolean;
  pages: number;
  chars: number;
  truncated: boolean;
  charsTruncated: number;
  imageCount: number;
  hasCharts: boolean;
  warning?: string;
  error?: string;
  message?: string;
};

export type ExtractDocxPayload =
  | {
    name: string;
    text: string;
    markdown: string;
    extracted: boolean;
    extractionError?: string;
    errorMessage?: string;
    truncated: boolean;
    chars: number;
    charsTruncated: number;
    pages: number;
    imageCount: number;
    hasCharts: boolean;
    warning?: string;
  }
  | { error: string };

export type ExtractDocxServices = ExtractPdfServices & {
  extractDocx?(input: { data: Buffer; name: string }): Promise<ExtractDocxResult> | ExtractDocxResult;
};

export async function handleExtractDocxPost(
  body: unknown,
  services: ExtractDocxServices = {},
): Promise<MindosServerResponse<ExtractDocxPayload>> {
  if (!body || typeof body !== 'object') {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const source = body as Record<string, unknown>;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : 'uploaded.docx';
  const dataBase64 = source.dataBase64;
  if (typeof dataBase64 !== 'string' || !dataBase64) {
    return json({ error: 'dataBase64 is required' }, { status: 400 });
  }

  try {
    const raw = Buffer.from(dataBase64, 'base64');
    if (raw.byteLength > MAX_BYTES) {
      return json({ error: 'Word file is too large (max 12MB)' }, { status: 400 });
    }

    const content = services.extractDocx
      ? await services.extractDocx({ data: raw, name })
      : defaultExtractDocx({ data: raw, name }, services);

    if (!content.extracted) {
      return json({
        name,
        text: '',
        markdown: '',
        extracted: false,
        extractionError: content.error,
        errorMessage: content.message,
        truncated: false,
        chars: 0,
        charsTruncated: 0,
        pages: 0,
        imageCount: 0,
        hasCharts: false,
      });
    }

    const finalContent = truncateContent(content);
    return json({
      name,
      text: finalContent.text,
      markdown: finalContent.markdown,
      extracted: true,
      truncated: finalContent.truncated,
      chars: finalContent.chars,
      charsTruncated: finalContent.charsTruncated,
      pages: finalContent.pages,
      imageCount: finalContent.imageCount,
      hasCharts: finalContent.hasCharts,
      warning: finalContent.warning,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to extract Word document' }, { status: 500 });
  }
}

function truncateContent(content: ExtractDocxResult): ExtractDocxResult {
  if (content.chars <= MAX_TEXT_CHARS) return content;
  return {
    ...content,
    text: content.text.substring(0, MAX_TEXT_CHARS),
    markdown: content.markdown.substring(0, MAX_TEXT_CHARS),
    truncated: true,
    charsTruncated: MAX_TEXT_CHARS,
    warning: content.warning && content.warning.length > 0
      ? `${content.warning}; content truncated to ${Math.round(MAX_TEXT_CHARS / 1000)}K characters`
      : `Content truncated to ${Math.round(MAX_TEXT_CHARS / 1000)}K characters`,
  };
}

function defaultExtractDocx(input: { data: Buffer; name: string }, services: ExtractDocxServices): ExtractDocxResult {
  const scriptPath = resolveExtractorScript('extract-docx.cjs', services);
  if (!scriptPath) {
    throw new Error(
      'extract-docx.cjs not found. Searched runtimeRoot/_standalone/scripts, runtimeRoot/packages/web/scripts, $MINDOS_PROJECT_ROOT/packages/web/scripts, cwd/scripts, and cwd/packages/web/scripts.',
    );
  }

  const ext = extname(input.name).toLowerCase() || '.docx';
  const tmpFile = resolve(tmpdir(), `word-extract-${Date.now()}-${process.pid}${ext}`);
  writeFileSync(tmpFile, input.data);
  try {
    const stdout = execFileSync(services.nodeBin ?? services.env?.MINDOS_NODE_BIN ?? process.env.MINDOS_NODE_BIN ?? process.execPath, [scriptPath, tmpFile], {
      encoding: 'utf-8',
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      env: buildExtractorEnv(services),
    });
    return JSON.parse(stdout) as ExtractDocxResult;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}
