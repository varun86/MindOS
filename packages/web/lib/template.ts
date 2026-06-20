import fs from 'fs';
import path from 'path';
import { getProjectRoot } from './project-root';
import { ensureDefaultMindSystemUpgrade } from './mind-system-upgrade';

export const INITIAL_SPACE_IDS = ['life', 'social', 'learning', 'content', 'product', 'research'] as const;
export type InitialSpaceId = typeof INITIAL_SPACE_IDS[number];
export type InitialSpaceLocale = 'en' | 'zh';

export type InitialSpaceInstallResult = {
  id: InitialSpaceId;
  locale: InitialSpaceLocale;
  copied: string[];
  skipped: string[];
};

/**
 * Recursively copy `src` to `dest`, skipping files that already exist in dest.
 */
export function copyRecursive(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // Skip if file already exists
    if (fs.existsSync(dest)) return;
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

/**
 * Apply a built-in template (en / zh / empty) to the given directory.
 * Returns true on success, throws on error.
 */
export function applyTemplate(template: string, destDir: string): void {
  if (!['en', 'zh', 'empty'].includes(template)) {
    throw new Error(`Invalid template: ${template}`);
  }

  // templates/ lives at the repo/project root (sibling of app/).
  // In standalone mode process.cwd() is .next/standalone/ — unreliable for relative paths.
  // MINDOS_PROJECT_ROOT is set by Desktop ProcessManager and CLI startup.
  const projectRoot = getProjectRoot();
  const candidates = [
    path.join(projectRoot, 'templates', template),
    path.resolve(process.cwd(), '..', 'templates', template),
    path.resolve(process.cwd(), 'templates', template),
  ];
  const templateDir = candidates.find((d) => fs.existsSync(d));
  if (!templateDir) {
    throw new Error(`Template "${template}" not found at ${candidates.join(', ')}`);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  copyRecursive(templateDir, destDir);
  ensureDefaultMindSystemUpgrade(destDir);
}

/**
 * Apply selected built-in Mind Spaces to a Mind root.
 * Template directories are copied once and existing user files are never overwritten.
 */
export function applyInitialSpaces(
  spaceIds: InitialSpaceId[],
  destDir: string,
  locale: InitialSpaceLocale,
): { installed: InitialSpaceInstallResult[] } {
  const projectRoot = getProjectRoot();
  const installed: InitialSpaceInstallResult[] = [];

  for (const spaceId of spaceIds) {
    if (!(INITIAL_SPACE_IDS as readonly string[]).includes(spaceId)) {
      throw new Error(`Invalid initial space: ${spaceId}`);
    }
  }

  for (const spaceId of spaceIds) {
    const spaceRoot = resolveInitialSpaceTemplateDir(projectRoot, spaceId);
    const localeRoot = path.join(spaceRoot, locale);
    assertInitialSpaceLocaleTemplate(spaceId, locale, localeRoot);

    const result: InitialSpaceInstallResult = {
      id: spaceId,
      locale,
      copied: [],
      skipped: [],
    };

    copyInitialSpaceTemplate(localeRoot, destDir, result);
    installed.push(result);
  }

  ensureDefaultMindSystemUpgrade(destDir);
  return { installed };
}

function resolveInitialSpaceTemplateDir(projectRoot: string, spaceId: InitialSpaceId): string {
  const candidates = [
    path.join(projectRoot, 'templates', 'mind-spaces', spaceId),
    path.resolve(process.cwd(), '..', 'templates', 'mind-spaces', spaceId),
    path.resolve(process.cwd(), 'templates', 'mind-spaces', spaceId),
  ];
  const spaceRoot = candidates.find((d) => fs.existsSync(d));
  if (!spaceRoot) {
    throw new Error(`Initial space "${spaceId}" not found at ${candidates.join(', ')}`);
  }
  return spaceRoot;
}

function assertInitialSpaceLocaleTemplate(
  spaceId: InitialSpaceId,
  locale: InitialSpaceLocale,
  localeRoot: string,
): void {
  if (!fs.existsSync(localeRoot) || !fs.statSync(localeRoot).isDirectory()) {
    throw new Error(`Initial space "${spaceId}" does not define locale "${locale}"`);
  }

  const topLevelSpaces = fs.readdirSync(localeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
  if (topLevelSpaces.length === 0) {
    throw new Error(`Initial space "${spaceId}" locale "${locale}" has no Space directory`);
  }

  for (const entry of topLevelSpaces) {
    const instructionPath = path.join(localeRoot, entry.name, 'INSTRUCTION.md');
    if (!fs.existsSync(instructionPath) || !fs.statSync(instructionPath).isFile()) {
      throw new Error(`Initial space "${spaceId}" locale "${locale}" is missing ${entry.name}/INSTRUCTION.md`);
    }
  }
}

function copyInitialSpaceTemplate(
  localeRoot: string,
  destDir: string,
  result: InitialSpaceInstallResult,
): void {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  for (const entry of fs.readdirSync(localeRoot)) {
    if (entry === '.DS_Store') continue;
    copyInitialSpaceEntry(localeRoot, path.join(localeRoot, entry), destDir, result);
  }
}

function copyInitialSpaceEntry(
  localeRoot: string,
  source: string,
  destRoot: string,
  result: InitialSpaceInstallResult,
): void {
  const stat = fs.lstatSync(source);
  const relFile = path.relative(localeRoot, source).split(path.sep).join('/');
  validateInitialSpaceRelativePath(relFile);
  if (stat.isSymbolicLink()) {
    throw new Error(`Initial space template contains unsupported symlink: ${relFile}`);
  }

  const dest = resolveSafeWithin(destRoot, relFile);
  if (stat.isDirectory()) {
    if (fs.existsSync(dest) && !fs.statSync(dest).isDirectory()) {
      throw new Error(`Initial space target path is not a directory: ${relFile}`);
    }
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      if (entry === '.DS_Store') continue;
      copyInitialSpaceEntry(localeRoot, path.join(source, entry), destRoot, result);
    }
    return;
  }

  if (!stat.isFile()) {
    throw new Error(`Initial space template contains unsupported file type: ${relFile}`);
  }
  if (fs.existsSync(dest)) {
    if (!fs.statSync(dest).isFile()) {
      throw new Error(`Initial space target path is not a file: ${relFile}`);
    }
    result.skipped.push(relFile);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  result.copied.push(relFile);
}

function validateInitialSpaceRelativePath(relFile: string): void {
  if (!relFile.trim() || path.isAbsolute(relFile)) {
    throw new Error(`Invalid initial space file path: ${relFile}`);
  }
  const parts = relFile.split(/[\\/]+/);
  if (parts.some((part) => !part || part === '.' || part === '..') || parts[0]?.startsWith('.')) {
    throw new Error(`Invalid initial space file path: ${relFile}`);
  }
}

function resolveSafeWithin(root: string, relFile: string): string {
  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, relFile);
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
    throw new Error(`Initial space target escapes Mind root: ${relFile}`);
  }
  return target;
}
