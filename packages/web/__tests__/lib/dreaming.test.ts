import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanupMindRoot, mkTempMindRoot, seedFile } from '../core/helpers';
import { formatDreamingReport, loadLatestDreamingRun, runDreaming } from '@/lib/dreaming';

describe('dreaming', () => {
  let mindRoot: string;

  beforeEach(() => { mindRoot = mkTempMindRoot(); });
  afterEach(() => { cleanupMindRoot(mindRoot); });

  it('writes review-first artifacts without modifying user notes', () => {
    seedFile(mindRoot, 'source.md', 'See [[missing-page]]');
    seedFile(mindRoot, 'stub.md', '# TODO');
    const before = fs.readFileSync(path.join(mindRoot, 'source.md'), 'utf-8');

    const run = runDreaming(mindRoot, {
      now: new Date('2026-06-13T00:00:00.000Z'),
    });

    expect(run.id).toBe('2026-06-13T00-00-00-000Z');
    expect(run.stages.map(stage => stage.name)).toEqual(['light', 'rem', 'deep']);
    expect(run.proposals.some(proposal => proposal.type === 'repair_broken_link')).toBe(true);
    expect(run.proposals.some(proposal => proposal.type === 'archive_empty_file')).toBe(true);
    expect(run.proposals.every(proposal => proposal.requiresUserReview)).toBe(true);
    expect(fs.readFileSync(path.join(mindRoot, 'source.md'), 'utf-8')).toBe(before);

    expect(fs.existsSync(path.join(mindRoot, '.mindos/dreaming/latest.json'))).toBe(true);
    expect(fs.existsSync(path.join(mindRoot, '.mindos/dreaming/pending.json'))).toBe(true);
    expect(fs.existsSync(path.join(mindRoot, '.mindos/dreaming/dreaming-report.md'))).toBe(true);
    expect(loadLatestDreamingRun(mindRoot)?.id).toBe(run.id);
  });

  it('supports dry runs that do not write artifacts', () => {
    seedFile(mindRoot, 'source.md', 'See [[missing-page]] in a note with enough body text to avoid the empty-file detector.');

    const run = runDreaming(mindRoot, { writeArtifacts: false });

    expect(run.artifacts).toBeUndefined();
    expect(fs.existsSync(path.join(mindRoot, '.mindos/dreaming/latest.json'))).toBe(false);
    expect(run.proposals).toHaveLength(2); // broken source + orphan source
  });

  it('scopes a Dreaming run to one space', () => {
    seedFile(mindRoot, 'Projects/source.md', 'See [[missing-page]] in a note with enough body text to avoid the empty-file detector.');
    seedFile(mindRoot, 'Notes/standalone.md', '# Standalone');

    const run = runDreaming(mindRoot, { space: 'Projects', writeArtifacts: false });

    expect(run.scope).toBe('Projects');
    expect(run.lint.stats.totalFiles).toBe(1);
    expect(run.proposals.map(proposal => proposal.evidence[0]?.path)).toContain('Projects/source.md');
    expect(run.proposals.map(proposal => proposal.evidence[0]?.path)).not.toContain('Notes/standalone.md');
  });

  it('formats a report with Light REM Deep safety framing', () => {
    seedFile(mindRoot, 'source.md', 'See [[missing-page]]');

    const report = formatDreamingReport(runDreaming(mindRoot, { writeArtifacts: false }));

    expect(report).toContain('Light - Local Signal Capture');
    expect(report).toContain('REM - Pattern Grouping');
    expect(report).toContain('Deep - Review Proposals');
    expect(report).toContain('does not mutate user notes automatically');
  });
});
