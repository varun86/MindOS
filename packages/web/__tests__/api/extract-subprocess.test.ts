import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('document extraction subprocesses', () => {
  it('do not rely on a bare node command being present in PATH', () => {
    const webAdapterFiles = [
      'app/api/extract-pdf/route.ts',
      'app/api/extract-docx/route.ts',
    ];

    for (const rel of webAdapterFiles) {
      const source = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      expect(source, rel).not.toContain('execFileSync');
    }

    const webCoreFiles = [
      'lib/core/pdf-text.ts',
      'lib/core/inbox-document-capture.ts',
    ];

    for (const rel of webCoreFiles) {
      const source = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      expect(source, rel).not.toContain("execFileSync('node'");
      expect(source, rel).toContain('getNodeExecutor');
    }

    const productServerRoot = path.resolve(ROOT, '..', 'mindos', 'src', 'server', 'handlers');
    const productServerFiles = [
      'extract-pdf.ts',
      'extract-docx.ts',
    ];

    for (const rel of productServerFiles) {
      const source = fs.readFileSync(path.join(productServerRoot, rel), 'utf-8');
      expect(source, rel).not.toContain("execFileSync('node'");
      expect(source, rel).toContain('process.execPath');
      expect(source, rel).toContain('MINDOS_NODE_BIN');
    }
  });
});
