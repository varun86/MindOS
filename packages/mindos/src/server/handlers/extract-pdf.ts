import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import { json, type MindosServerResponse } from '../response.js';

const MAX_TEXT_CHARS = 100_000;
const MAX_BYTES = 12 * 1024 * 1024;

export const EXTRACT_PDF_MAX_BODY_BYTES = 18 * 1024 * 1024;

export type ExtractPdfResult = {
  text: string;
  pages: number;
  error?: string;
};

export type ExtractPdfPayload =
  | {
    name: string;
    text: string;
    extracted: 'success' | 'empty' | 'error';
    extractionError?: string;
    truncated: boolean;
    totalChars: number;
    pagesParsed: number;
  }
  | { error: string };

export type ExtractPdfServices = {
  runtimeRoot?: string;
  nodeBin?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  extractPdf?(input: { data: Buffer; name: string }): Promise<ExtractPdfResult> | ExtractPdfResult;
};

export async function handleExtractPdfPost(
  body: unknown,
  services: ExtractPdfServices = {},
): Promise<MindosServerResponse<ExtractPdfPayload>> {
  if (!body || typeof body !== 'object') {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const source = body as Record<string, unknown>;
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : 'uploaded.pdf';
  const dataBase64 = source.dataBase64;
  if (typeof dataBase64 !== 'string' || !dataBase64) {
    return json({ error: 'dataBase64 is required' }, { status: 400 });
  }

  try {
    const raw = Buffer.from(dataBase64, 'base64');
    if (raw.byteLength > MAX_BYTES) {
      return json({ error: 'PDF is too large (max 12MB)' }, { status: 400 });
    }

    const extracted = services.extractPdf
      ? await services.extractPdf({ data: raw, name })
      : defaultExtractPdf({ data: raw }, services);
    if (extracted.error) {
      return json({
        name,
        text: '',
        extracted: 'error',
        extractionError: extracted.error,
        truncated: false,
        totalChars: 0,
        pagesParsed: extracted.pages ?? 0,
      });
    }

    const text = extracted.text.replace(/\u0000/g, '').trim();
    const { result, truncated } = truncateText(text);
    return json({
      name,
      text: result,
      extracted: text.length > 0 ? 'success' : 'empty',
      truncated,
      totalChars: text.length,
      pagesParsed: extracted.pages,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to extract PDF' }, { status: 500 });
  }
}

function truncateText(text: string): { result: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_CHARS) return { result: text, truncated: false };
  return {
    result: `${text.slice(0, MAX_TEXT_CHARS)}\n\n[...content truncated - only first ~${Math.round(MAX_TEXT_CHARS / 1000)}K characters included]`,
    truncated: true,
  };
}

function defaultExtractPdf(input: { data: Buffer }, services: ExtractPdfServices = {}): ExtractPdfResult {
  const scriptPath = resolveExtractorScript('extract-pdf.cjs', services);
  if (!scriptPath) {
    throw new Error(
      'extract-pdf.cjs not found. Searched runtimeRoot/_standalone/scripts, runtimeRoot/packages/web/scripts, $MINDOS_PROJECT_ROOT/packages/web/scripts, cwd/scripts, and cwd/packages/web/scripts.',
    );
  }

  const tmpPdf = resolve(tmpdir(), `pdf-extract-${Date.now()}-${process.pid}.pdf`);
  writeFileSync(tmpPdf, input.data);
  try {
    const stdout = execFileSync(services.nodeBin ?? services.env?.MINDOS_NODE_BIN ?? process.env.MINDOS_NODE_BIN ?? process.execPath, [scriptPath, tmpPdf], {
      encoding: 'utf-8',
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      env: buildExtractorEnv(services),
    });
    return JSON.parse(stdout) as ExtractPdfResult;
  } finally {
    try { unlinkSync(tmpPdf); } catch {}
  }
}

export function resolveExtractorScript(name: string, services: ExtractPdfServices): string | null {
  const cwd = services.cwd ?? process.cwd();
  const runtimeRoot = services.runtimeRoot;
  const projectRoot = services.env?.MINDOS_PROJECT_ROOT ?? process.env.MINDOS_PROJECT_ROOT;
  const candidates = [
    runtimeRoot ? resolve(runtimeRoot, '_standalone', 'scripts', name) : undefined,
    runtimeRoot ? resolve(runtimeRoot, 'packages', 'web', 'scripts', name) : undefined,
    projectRoot ? resolve(projectRoot, 'packages', 'web', 'scripts', name) : undefined,
    resolve(cwd, 'scripts', name),
    resolve(cwd, 'packages', 'web', 'scripts', name),
    resolve(cwd, '.next', 'standalone', 'scripts', name),
    resolve(cwd, '..', '..', 'scripts', name),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function buildExtractorEnv(services: ExtractPdfServices): NodeJS.ProcessEnv {
  const baseEnv = services.env ?? process.env;
  const runtimeRoot = services.runtimeRoot;
  const cwd = services.cwd ?? process.cwd();
  const nodePathEntries = [
    runtimeRoot ? resolve(runtimeRoot, '_standalone', 'node_modules') : undefined,
    runtimeRoot ? resolve(runtimeRoot, '_standalone', '__node_modules') : undefined,
    runtimeRoot ? resolve(runtimeRoot, 'packages', 'web', 'node_modules') : undefined,
    resolve(cwd, 'node_modules'),
    resolve(cwd, 'packages', 'web', 'node_modules'),
    baseEnv.NODE_PATH,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    ...baseEnv,
    NODE_PATH: nodePathEntries.join(delimiter),
  };
}
