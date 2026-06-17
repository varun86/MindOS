import fs from 'fs';
import path from 'path';
import { getProjectRoot } from './project-root';
import { ensureDefaultMindSystemUpgrade } from './mind-system-upgrade';

export const SPACE_KIT_IDS = ['life', 'social', 'learning', 'content', 'product', 'research'] as const;
export type SpaceKitId = typeof SPACE_KIT_IDS[number];
export type SpaceKitLocale = 'en' | 'zh';

export type SpaceKitInstallResult = {
  id: SpaceKitId;
  version?: number;
  locale: SpaceKitLocale;
  copied: string[];
  skipped: string[];
};

type SpaceKitManifest = {
  schemaVersion: number;
  id: SpaceKitId;
  version: number;
  files: Record<SpaceKitLocale, string[]>;
};

type SpaceKitReceipt = {
  schemaVersion: 1;
  installed: Array<SpaceKitInstallResult & { installedAt: string }>;
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
 * Apply selected Space Kits to a Mind root.
 *
 * Space Kit files are copied one by one from a manifest allowlist, and existing
 * user files are never overwritten.
 */
export function applySpaceKits(
  kitIds: SpaceKitId[],
  destDir: string,
  locale: SpaceKitLocale,
): { installed: SpaceKitInstallResult[] } {
  const projectRoot = getProjectRoot();
  const installed: SpaceKitInstallResult[] = [];

  for (const kitId of kitIds) {
    if (!(SPACE_KIT_IDS as readonly string[]).includes(kitId)) {
      throw new Error(`Invalid space kit: ${kitId}`);
    }
    const kitRoot = resolveTemplateDir(projectRoot, kitId);
    const manifest = readSpaceKitManifest(kitRoot, kitId);
    const localeFiles = manifest.files[locale];
    if (!Array.isArray(localeFiles)) {
      throw new Error(`Space kit "${kitId}" does not define files for locale "${locale}"`);
    }

    const result: SpaceKitInstallResult = {
      id: kitId,
      version: manifest.version,
      locale,
      copied: [],
      skipped: [],
    };

    for (const relFile of localeFiles) {
      validateSpaceKitRelativeFile(relFile);
      const source = path.join(kitRoot, locale, relFile);
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
        throw new Error(`Space kit file not found: ${kitId}/${locale}/${relFile}`);
      }
      const dest = resolveSafeWithin(destDir, relFile);
      if (fs.existsSync(dest)) {
        result.skipped.push(relFile);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);
      result.copied.push(relFile);
    }

    installed.push(result);
  }

  if (installed.length > 0) {
    writeSpaceKitReceipt(destDir, installed);
  }

  return { installed };
}

function resolveTemplateDir(projectRoot: string, kitId: SpaceKitId): string {
  const candidates = [
    path.join(projectRoot, 'templates', 'space-kits', kitId),
    path.resolve(process.cwd(), '..', 'templates', 'space-kits', kitId),
    path.resolve(process.cwd(), 'templates', 'space-kits', kitId),
  ];
  const kitRoot = candidates.find((d) => fs.existsSync(d));
  if (!kitRoot) {
    throw new Error(`Space kit "${kitId}" not found at ${candidates.join(', ')}`);
  }
  return kitRoot;
}

function readSpaceKitManifest(kitRoot: string, expectedId: SpaceKitId): SpaceKitManifest {
  const manifestPath = path.join(kitRoot, 'manifest.json');
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<SpaceKitManifest>;
  if (raw.schemaVersion !== 1 || raw.id !== expectedId || typeof raw.version !== 'number' || !raw.files) {
    throw new Error(`Invalid space kit manifest: ${manifestPath}`);
  }
  return raw as SpaceKitManifest;
}

function validateSpaceKitRelativeFile(relFile: string): void {
  if (!relFile.trim() || path.isAbsolute(relFile)) {
    throw new Error(`Invalid space kit file path: ${relFile}`);
  }
  const parts = relFile.split(/[\\/]+/);
  if (parts.some((part) => !part || part === '.' || part === '..') || parts[0]?.startsWith('.')) {
    throw new Error(`Invalid space kit file path: ${relFile}`);
  }
}

function resolveSafeWithin(root: string, relFile: string): string {
  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, relFile);
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
    throw new Error(`Space kit target escapes Mind root: ${relFile}`);
  }
  return target;
}

function writeSpaceKitReceipt(destDir: string, installed: SpaceKitInstallResult[]): void {
  const setupDir = path.join(destDir, '.mindos', 'setup');
  fs.mkdirSync(setupDir, { recursive: true });
  const receiptPath = path.join(setupDir, 'space-kits.json');
  const previous = readSpaceKitReceipt(receiptPath);
  const installedAt = new Date().toISOString();
  const replacementKeys = new Set(installed.map((item) => `${item.id}:${item.locale}`));
  const next: SpaceKitReceipt = {
    schemaVersion: 1,
    installed: [
      ...previous.installed.filter((item) => !replacementKeys.has(`${item.id}:${item.locale}`)),
      ...installed.map((item) => ({ ...item, installedAt })),
    ],
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
}

function readSpaceKitReceipt(receiptPath: string): SpaceKitReceipt {
  if (!fs.existsSync(receiptPath)) return { schemaVersion: 1, installed: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf-8')) as Partial<SpaceKitReceipt>;
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.installed)) {
      return { schemaVersion: 1, installed: parsed.installed as SpaceKitReceipt['installed'] };
    }
  } catch {
    // Corrupt receipts should not block setup. Keep a fresh receipt for this run.
  }
  return { schemaVersion: 1, installed: [] };
}
