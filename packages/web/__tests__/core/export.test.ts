import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectExportFiles } from '@/lib/core/export';
import { mkTempMindRoot, cleanupMindRoot, seedFile } from './helpers';

describe('export helpers', () => {
  let mindRoot: string;

  beforeEach(() => { mindRoot = mkTempMindRoot(); });
  afterEach(() => { cleanupMindRoot(mindRoot); });

  describe('collectExportFiles', () => {
    it('collects markdown and csv files under the selected directory', () => {
      seedFile(mindRoot, 'Space/README.md', '# Space');
      seedFile(mindRoot, 'Space/data.csv', 'name,value');
      seedFile(mindRoot, 'Space/private.json', '{"skip":true}');
      seedFile(mindRoot, 'Space/Nested/note.md', 'hello');

      const files = collectExportFiles(mindRoot, 'Space')
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

      expect(files).toEqual([
        { relativePath: 'data.csv', content: 'name,value' },
        { relativePath: 'Nested/note.md', content: 'hello' },
        { relativePath: 'README.md', content: '# Space' },
      ]);
    });

    it('rejects traversal before checking directories outside mindRoot', () => {
      const outsideDir = path.join(path.dirname(mindRoot), `mindos-export-outside-${Date.now()}`);
      fs.mkdirSync(outsideDir, { recursive: true });
      fs.writeFileSync(path.join(outsideDir, 'leak.md'), 'outside', 'utf-8');

      try {
        expect(() => collectExportFiles(mindRoot, path.relative(mindRoot, outsideDir))).toThrow('Access denied');
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });
  });
});
