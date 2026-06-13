import fs from 'fs';
import path from 'path';
import { runLint, type BrokenLinkEntry, type LintReport, type OrphanEntry, type StaleEntry } from './lint';
import { readFile } from './core/fs-ops';
import { resolveSafe } from './core/security';

export type DreamingStageName = 'light' | 'rem' | 'deep';

export type DreamingProposalType =
  | 'repair_broken_link'
  | 'review_stale_file'
  | 'connect_or_archive_orphan'
  | 'archive_empty_file';

export type DreamingProposalRisk = 'low' | 'medium' | 'high';

export interface DreamingOptions {
  space?: string;
  now?: Date;
  writeArtifacts?: boolean;
  maxItemsPerType?: number;
}

export interface DreamingEvidence {
  path: string;
  line?: number;
  quote?: string;
}

export interface DreamingProposal {
  id: string;
  type: DreamingProposalType;
  title: string;
  reason: string;
  risk: DreamingProposalRisk;
  action: string;
  requiresUserReview: true;
  evidence: DreamingEvidence[];
}

export interface DreamingStage {
  name: DreamingStageName;
  title: string;
  summary: string;
  outputs: string[];
}

export interface DreamingArtifacts {
  runJson: string;
  latestJson: string;
  pendingJson: string;
  reportMarkdown: string;
}

export interface DreamingRun {
  id: string;
  timestamp: string;
  scope: string;
  lint: LintReport;
  stages: DreamingStage[];
  proposals: DreamingProposal[];
  artifacts?: DreamingArtifacts;
}

const DEFAULT_MAX_ITEMS_PER_TYPE = 20;
const DREAMING_DIR = '.mindos/dreaming';

export function runDreaming(mindRoot: string, options: DreamingOptions = {}): DreamingRun {
  const now = options.now ?? new Date();
  const scope = options.space ?? 'all';
  const maxItemsPerType = options.maxItemsPerType ?? DEFAULT_MAX_ITEMS_PER_TYPE;
  const lint = runLint(mindRoot, options.space);
  const proposals = buildDreamingProposals(mindRoot, lint, maxItemsPerType);
  const stages = buildDreamingStages(lint, proposals);
  const run: DreamingRun = {
    id: createRunId(now),
    timestamp: now.toISOString(),
    scope,
    lint,
    stages,
    proposals,
  };

  if (options.writeArtifacts ?? true) {
    run.artifacts = writeDreamingArtifacts(mindRoot, run);
  }

  return run;
}

export function loadLatestDreamingRun(mindRoot: string): DreamingRun | null {
  const latestPath = resolveSafe(mindRoot, `${DREAMING_DIR}/latest.json`);
  if (!fs.existsSync(latestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(latestPath, 'utf-8')) as DreamingRun;
  } catch {
    return null;
  }
}

export function buildDreamingProposals(
  mindRoot: string,
  lint: LintReport,
  maxItemsPerType = DEFAULT_MAX_ITEMS_PER_TYPE,
): DreamingProposal[] {
  const proposals: DreamingProposal[] = [];

  for (const issue of lint.brokenLinks.slice(0, maxItemsPerType)) {
    proposals.push(proposalForBrokenLink(mindRoot, issue));
  }
  for (const issue of lint.stale.slice(0, maxItemsPerType)) {
    proposals.push(proposalForStaleFile(issue));
  }
  for (const issue of lint.orphans.slice(0, maxItemsPerType)) {
    proposals.push(proposalForOrphan(issue));
  }
  for (const filePath of lint.empty.slice(0, maxItemsPerType)) {
    proposals.push(proposalForEmptyFile(filePath));
  }

  return proposals;
}

export function formatDreamingReport(run: DreamingRun): string {
  const lines: string[] = [
    `# Dreaming Report - ${run.timestamp}`,
    '',
    `Scope: ${run.scope}`,
    `Health score: ${run.lint.healthScore}/100`,
    `Files scanned: ${run.lint.stats.totalFiles}`,
    `Pending proposals: ${run.proposals.length}`,
    '',
    '## Stages',
    '',
  ];

  for (const stage of run.stages) {
    lines.push(`### ${stage.title}`, '', stage.summary, '');
    for (const output of stage.outputs) lines.push(`- ${output}`);
    lines.push('');
  }

  lines.push('## Pending Review', '');
  if (run.proposals.length === 0) {
    lines.push('No pending Dreaming proposals.');
  } else {
    for (const proposal of run.proposals) {
      lines.push(`### ${proposal.title}`, '');
      lines.push(`- Type: ${proposal.type}`);
      lines.push(`- Risk: ${proposal.risk}`);
      lines.push(`- Reason: ${proposal.reason}`);
      lines.push(`- Proposed action: ${proposal.action}`);
      for (const evidence of proposal.evidence) {
        const loc = evidence.line ? `${evidence.path}:${evidence.line}` : evidence.path;
        lines.push(`- Evidence: ${loc}${evidence.quote ? ` — ${evidence.quote}` : ''}`);
      }
      lines.push('');
    }
  }

  lines.push(
    '## Safety',
    '',
    'This Dreaming run follows the conservative agent-dream pattern: it writes reports and review proposals, but it does not mutate user notes automatically.',
    '',
  );

  return lines.join('\n');
}

function buildDreamingStages(lint: LintReport, proposals: DreamingProposal[]): DreamingStage[] {
  const stats = lint.stats;
  return [
    {
      name: 'light',
      title: 'Light - Local Signal Capture',
      summary: 'Collected deterministic knowledge-health signals without calling an LLM or modifying notes.',
      outputs: [
        `${stats.totalFiles} file(s) scanned`,
        `${stats.brokenLinks} broken link(s)`,
        `${stats.staleFiles} stale file(s)`,
        `${stats.orphanFiles} orphan file(s)`,
        `${stats.emptyFiles} empty/stub file(s)`,
      ],
    },
    {
      name: 'rem',
      title: 'REM - Pattern Grouping',
      summary: 'Grouped raw signals into reviewable maintenance themes that a background agent can reason about safely.',
      outputs: buildThemeOutputs(lint),
    },
    {
      name: 'deep',
      title: 'Deep - Review Proposals',
      summary: 'Promoted only reversible, review-first suggestions. User-authored notes are left untouched.',
      outputs: [
        `${proposals.length} pending proposal(s) generated`,
        '0 automatic note mutations',
        'Artifacts written under .mindos/dreaming',
      ],
    },
  ];
}

function buildThemeOutputs(lint: LintReport): string[] {
  const outputs: string[] = [];
  if (lint.brokenLinks.length > 0) outputs.push('Repair candidates: broken links with source line evidence');
  if (lint.stale.length > 0) outputs.push('Refresh candidates: files older than the staleness threshold');
  if (lint.orphans.length > 0) outputs.push('Organization candidates: files with no inbound links');
  if (lint.empty.length > 0) outputs.push('Archive candidates: empty or stub files');
  if (outputs.length === 0) outputs.push('No actionable maintenance themes detected');
  return outputs;
}

function proposalForBrokenLink(mindRoot: string, issue: BrokenLinkEntry): DreamingProposal {
  return {
    id: stableProposalId('broken', issue.source, String(issue.line), issue.target),
    type: 'repair_broken_link',
    title: `Review broken link in ${issue.source}`,
    reason: `The link target "${issue.target}" does not resolve to an existing note.`,
    risk: 'medium',
    action: 'Find the intended target, recreate the missing note, or remove the stale link after user review.',
    requiresUserReview: true,
    evidence: [{
      path: issue.source,
      line: issue.line,
      quote: readLine(mindRoot, issue.source, issue.line),
    }],
  };
}

function proposalForStaleFile(issue: StaleEntry): DreamingProposal {
  return {
    id: stableProposalId('stale', issue.path, String(issue.daysSinceUpdate)),
    type: 'review_stale_file',
    title: `Review stale note ${issue.path}`,
    reason: `This file has not changed for ${issue.daysSinceUpdate} day(s).`,
    risk: 'low',
    action: 'Verify whether the note is still current, then refresh, archive, or mark it as historical.',
    requiresUserReview: true,
    evidence: [{ path: issue.path }],
  };
}

function proposalForOrphan(issue: OrphanEntry): DreamingProposal {
  return {
    id: stableProposalId('orphan', issue.path),
    type: 'connect_or_archive_orphan',
    title: `Organize orphan note ${issue.path}`,
    reason: 'No other Markdown note links to this file.',
    risk: 'medium',
    action: 'Add an inbound link from an index/README, merge into an authoritative note, or archive after review.',
    requiresUserReview: true,
    evidence: [{ path: issue.path }],
  };
}

function proposalForEmptyFile(filePath: string): DreamingProposal {
  return {
    id: stableProposalId('empty', filePath),
    type: 'archive_empty_file',
    title: `Review empty or stub file ${filePath}`,
    reason: 'The file has too little content to be useful as durable knowledge.',
    risk: 'high',
    action: 'Archive or delete only after confirming it is not a placeholder the user still needs.',
    requiresUserReview: true,
    evidence: [{ path: filePath }],
  };
}

function writeDreamingArtifacts(mindRoot: string, run: DreamingRun): DreamingArtifacts {
  const runJsonPath = `${DREAMING_DIR}/runs/${run.id}.json`;
  const latestJsonPath = `${DREAMING_DIR}/latest.json`;
  const pendingJsonPath = `${DREAMING_DIR}/pending.json`;
  const reportPath = `${DREAMING_DIR}/dreaming-report.md`;

  writeJson(mindRoot, runJsonPath, run);
  writeJson(mindRoot, latestJsonPath, { ...run, artifacts: undefined });
  writeJson(mindRoot, pendingJsonPath, {
    runId: run.id,
    timestamp: run.timestamp,
    scope: run.scope,
    proposals: run.proposals,
  });
  writeText(mindRoot, reportPath, formatDreamingReport(run));

  return {
    runJson: runJsonPath,
    latestJson: latestJsonPath,
    pendingJson: pendingJsonPath,
    reportMarkdown: reportPath,
  };
}

function writeJson(mindRoot: string, relativePath: string, value: unknown): void {
  writeText(mindRoot, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(mindRoot: string, relativePath: string, content: string): void {
  const absolutePath = resolveSafe(mindRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf-8');
}

function readLine(mindRoot: string, filePath: string, line: number): string | undefined {
  try {
    return readFile(mindRoot, filePath).split('\n')[line - 1]?.trim();
  } catch {
    return undefined;
  }
}

function createRunId(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

function stableProposalId(...parts: string[]): string {
  return parts
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
