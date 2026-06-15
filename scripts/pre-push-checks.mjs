#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ZERO_SHA = /^0{40}$/;

function run(command, args, options = {}) {
  const label = [command, ...args].join(' ');
  console.log(`\n$ ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function read(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function parseUpdates(stdin) {
  return stdin
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    })
    .filter((update) => update.localSha && !ZERO_SHA.test(update.localSha));
}

function baseFor(update) {
  if (update.remoteSha && !ZERO_SHA.test(update.remoteSha)) {
    return update.remoteSha;
  }

  const originMain = read('git', ['rev-parse', '--verify', 'origin/main']);
  if (originMain) {
    const mergeBase = read('git', ['merge-base', originMain, update.localSha]);
    if (mergeBase) return mergeBase;
  }

  const parent = read('git', ['rev-parse', '--verify', `${update.localSha}^`]);
  return parent || update.localSha;
}

function changedFilesForRange(base, head) {
  const output = read('git', ['diff', '--name-only', `${base}..${head}`]);
  return output ? output.split('\n').filter(Boolean) : [];
}

function fallbackChangedFiles() {
  const staged = read('git', ['diff', '--cached', '--name-only']);
  const unstaged = read('git', ['diff', '--name-only']);
  const untracked = read('git', ['ls-files', '--others', '--exclude-standard']);
  return unique([
    ...(staged ? staged.split('\n') : []),
    ...(unstaged ? unstaged.split('\n') : []),
    ...(untracked ? untracked.split('\n') : []),
  ]);
}

function isDocLike(file) {
  if (/\.(md|mdx|txt)$/i.test(file)) return true;
  if (/^README(_zh)?\.md$/i.test(file)) return true;
  if (file === 'AGENTS.md' || file === 'CLAUDE.md') return true;
  return file.startsWith('wiki/') || file.startsWith('SOP/') || file.startsWith('docs/');
}

function isWebTestFile(file) {
  return /^packages\/web\/__tests__\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file);
}

function isWebRelatedInput(file) {
  if (!file.startsWith('packages/web/')) return false;
  if (isWebTestFile(file)) return false;
  if (/\.d\.ts$/.test(file)) return false;
  return /\.(ts|tsx|js|jsx)$/.test(file);
}

function needsFullWebTest(file) {
  return [
    'packages/web/package.json',
    'packages/web/vitest.config.ts',
    'packages/web/__tests__/setup.ts',
    'packages/web/next.config.ts',
    'packages/web/tsconfig.json',
  ].includes(file);
}

function addCommand(commands, key, command, args) {
  if (commands.some((entry) => entry.key === key)) return;
  commands.push({ key, command, args });
}

const stdin = readFileSync(0, 'utf8');
const updates = parseUpdates(stdin);
const ranges = updates.map((update) => ({ base: baseFor(update), head: update.localSha }));
const changedFiles = ranges.length > 0
  ? unique(ranges.flatMap((range) => changedFilesForRange(range.base, range.head)))
  : fallbackChangedFiles();

console.log('MindOS pre-push checks');
if (updates.length > 0) {
  for (const update of updates) {
    console.log(`- ${update.localRef} -> ${update.remoteRef}`);
  }
}
console.log(`- changed files: ${changedFiles.length}`);

if (changedFiles.length === 0) {
  console.log('No changed files detected; skipping checks.');
  process.exit(0);
}

if (ranges.length > 0) {
  for (const range of ranges) {
    run('git', ['diff', '--check', `${range.base}..${range.head}`]);
  }
} else {
  run('git', ['diff', '--check']);
}

if (changedFiles.every(isDocLike)) {
  console.log('\nDocumentation-only push: whitespace check passed; skipping code tests.');
  process.exit(0);
}

const commands = [];
const rootSensitive = changedFiles.some((file) => (
  file === 'package.json'
  || file === 'pnpm-lock.yaml'
  || file === 'pnpm-workspace.yaml'
  || file === 'turbo.json'
  || file === 'vitest.config.ts'
  || file.startsWith('tests/')
  || file.startsWith('scripts/')
));
if (rootSensitive) {
  addCommand(commands, 'root:quick', 'pnpm', ['run', 'test:quick']);
}

const changedMjs = changedFiles.filter((file) => file.startsWith('scripts/') && file.endsWith('.mjs'));
for (const file of changedMjs) {
  addCommand(commands, `node-check:${file}`, 'node', ['--check', file]);
}

const changedShell = changedFiles.filter((file) => (
  file.endsWith('.sh') || file.startsWith('scripts/hooks/')
));
for (const file of changedShell) {
  addCommand(commands, `bash-check:${file}`, 'bash', ['-n', file]);
}

const webFiles = changedFiles.filter((file) => file.startsWith('packages/web/'));
if (webFiles.length > 0) {
  if (webFiles.some(needsFullWebTest)) {
    addCommand(commands, 'web:test', 'pnpm', ['--filter', '@mindos/web', 'test']);
  } else {
    const webTestFiles = unique(webFiles.filter(isWebTestFile).map((file) => file.replace(/^packages\/web\//, '')));
    const webRelatedInputs = unique(webFiles.filter(isWebRelatedInput).map((file) => file.replace(/^packages\/web\//, '')));
    if (webTestFiles.length > 0) {
      addCommand(commands, 'web:test-files', 'pnpm', [
        '--filter',
        '@mindos/web',
        'exec',
        'vitest',
        'run',
        ...webTestFiles,
        '--passWithNoTests',
      ]);
    }
    if (webRelatedInputs.length > 0) {
      addCommand(commands, 'web:related', 'pnpm', [
        '--filter',
        '@mindos/web',
        'exec',
        'vitest',
        'related',
        ...webRelatedInputs,
        '--run',
        '--passWithNoTests',
      ]);
    }
  }

  if (webFiles.some((file) => /\.(ts|tsx|js|jsx|json)$/.test(file))) {
    addCommand(commands, 'web:typecheck', 'pnpm', ['--filter', '@mindos/web', 'typecheck']);
  }
}

const packageChecks = [
  { prefix: 'packages/mindos/', filter: '@geminilight/mindos', test: true, typecheck: 'type-check' },
  { prefix: 'packages/mobile/', filter: '@mindos/mobile', test: true, typecheck: 'type-check' },
  { prefix: 'packages/desktop/', filter: '@mindos/desktop', test: true, typecheck: 'type-check' },
  { prefix: 'packages/desktop-tauri/', filter: '@mindos/desktop-tauri', test: false, typecheck: 'type-check' },
  { prefix: 'packages/browser-extension/', filter: '@mindos/browser-extension', test: false, typecheck: 'type-check' },
  { prefix: 'packages/retrieval/api/', filter: '@mindos/api', test: true, typecheck: 'type-check' },
  { prefix: 'packages/retrieval/indexer/', filter: '@mindos/indexer', test: true, typecheck: 'type-check' },
  { prefix: 'packages/retrieval/search/', filter: '@mindos/search', test: true, typecheck: 'type-check' },
  { prefix: 'packages/retrieval/vector/', filter: '@mindos/vector', test: true, typecheck: 'type-check' },
];

for (const check of packageChecks) {
  if (!changedFiles.some((file) => file.startsWith(check.prefix))) continue;
  if (check.test) {
    addCommand(commands, `${check.filter}:test`, 'pnpm', ['--filter', check.filter, 'test']);
  }
  addCommand(commands, `${check.filter}:typecheck`, 'pnpm', ['--filter', check.filter, check.typecheck]);
}

if (commands.length === 0) {
  console.log('\nNo automatic code test selected for this path set.');
  console.log('Run focused tests manually if the change affects runtime behavior.');
  process.exit(0);
}

for (const { command, args } of commands) {
  run(command, args, {
    env: {
      ...process.env,
      MINDOS_WEB_PORT: process.env.MINDOS_WEB_PORT || '19456',
      MINDOS_MCP_PORT: process.env.MINDOS_MCP_PORT || '19781',
    },
  });
}

console.log('\nPre-push checks passed.');
