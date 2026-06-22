import fs from 'fs';
import path from 'path';
import {
  resolveCanonicalObsidianPluginDir,
  resolveLegacyObsidianPluginDir,
  type ObsidianPluginLocation,
} from './plugin-paths';

export interface LegacyPluginMigrationSkipped {
  path: string;
  reason: string;
}

export interface LegacyPluginMigrationPlan {
  pluginId: string;
  sourcePath: string;
  targetPath: string;
  sourceRelativePath: string;
  targetRelativePath: string;
  canMigrate: boolean;
  conflictReason?: string;
  files: string[];
  directories: string[];
  skipped: LegacyPluginMigrationSkipped[];
}

export interface LegacyPluginMigrationResult extends LegacyPluginMigrationPlan {
  migrated: boolean;
}

interface CopyPlan {
  files: string[];
  directories: string[];
  skipped: LegacyPluginMigrationSkipped[];
}

export function planLegacyObsidianPluginMigration(mindRoot: string, pluginId: string): LegacyPluginMigrationPlan {
  const source = resolveLegacyObsidianPluginDir(mindRoot, pluginId);
  const target = resolveCanonicalObsidianPluginDir(mindRoot, pluginId);
  const base = emptyPlan(pluginId, source, target);

  if (!safeDirectoryExists(source.pluginDir)) {
    return {
      ...base,
      conflictReason: `Legacy plugin package not found: ${source.pluginRelativePath}`,
    };
  }
  if (safeDirectoryExists(target.pluginDir)) {
    return {
      ...base,
      conflictReason: `Canonical plugin package already exists: ${target.pluginRelativePath}`,
    };
  }

  const sourceStats = fs.lstatSync(source.pluginDir);
  if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) {
    return {
      ...base,
      conflictReason: `Legacy plugin package is not a regular directory: ${source.pluginRelativePath}`,
    };
  }

  const copyPlan = inspectCopyPlan(source.pluginDir);
  return {
    ...base,
    canMigrate: true,
    ...copyPlan,
  };
}

export function migrateLegacyObsidianPlugin(mindRoot: string, pluginId: string): LegacyPluginMigrationResult {
  const plan = planLegacyObsidianPluginMigration(mindRoot, pluginId);
  if (!plan.canMigrate) {
    throw new Error(plan.conflictReason ?? `Legacy plugin cannot be migrated: ${pluginId}`);
  }

  const tempDir = `${plan.targetPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(path.dirname(plan.targetPath), { recursive: true });
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    for (const directory of plan.directories) {
      fs.mkdirSync(path.join(tempDir, directory), { recursive: true });
    }
    for (const file of plan.files) {
      const from = path.join(plan.sourcePath, file);
      const to = path.join(tempDir, file);
      const stats = fs.lstatSync(from);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        continue;
      }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
    if (safeDirectoryExists(plan.targetPath)) {
      throw new Error(`Canonical plugin package already exists: ${plan.targetRelativePath}`);
    }
    fs.renameSync(tempDir, plan.targetPath);
    fs.rmSync(plan.sourcePath, { recursive: true, force: true });
    return {
      ...plan,
      migrated: true,
    };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function emptyPlan(pluginId: string, source: ObsidianPluginLocation, target: ObsidianPluginLocation): LegacyPluginMigrationPlan {
  return {
    pluginId,
    sourcePath: source.pluginDir,
    targetPath: target.pluginDir,
    sourceRelativePath: source.pluginRelativePath,
    targetRelativePath: target.pluginRelativePath,
    canMigrate: false,
    files: [],
    directories: [],
    skipped: [],
  };
}

function inspectCopyPlan(sourceDir: string): CopyPlan {
  const files: string[] = [];
  const directories: string[] = [];
  const skipped: LegacyPluginMigrationSkipped[] = [];

  const visit = (absoluteDir: string, relativeDir: string) => {
    for (const entry of fs.readdirSync(absoluteDir)) {
      const absolutePath = path.join(absoluteDir, entry);
      const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
      const stats = fs.lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        skipped.push({ path: relativePath, reason: 'symlink skipped' });
        continue;
      }
      if (stats.isDirectory()) {
        directories.push(relativePath);
        visit(absolutePath, relativePath);
        continue;
      }
      if (stats.isFile()) {
        files.push(relativePath);
        continue;
      }
      skipped.push({ path: relativePath, reason: 'special file skipped' });
    }
  };

  visit(sourceDir, '');
  return {
    files: files.sort((a, b) => a.localeCompare(b, 'en')),
    directories: directories.sort((a, b) => a.localeCompare(b, 'en')),
    skipped: skipped.sort((a, b) => a.path.localeCompare(b.path, 'en')),
  };
}

function safeDirectoryExists(filePath: string): boolean {
  try {
    return fs.lstatSync(filePath).isDirectory();
  } catch (error) {
    if (error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
