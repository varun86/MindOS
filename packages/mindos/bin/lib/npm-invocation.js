import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Resolve npm without running Windows .cmd shims through a shell.
 * Unix-like platforms intentionally keep PATH lookup so user-managed npm
 * shims and tests can provide their own executable.
 *
 * @param {string[]} args
 * @param {{ platform?: NodeJS.Platform, nodeExecPath?: string, env?: NodeJS.ProcessEnv, pathExists?: (path: string) => boolean }} [options]
 */
export function resolveNpmInvocation(args, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== 'win32') {
    return { command: 'npm', args };
  }

  const env = options.env ?? process.env;
  const nodeExecPath = options.nodeExecPath ?? process.execPath;
  const pathExists = options.pathExists ?? existsSync;
  const npmCliPath = findNpmCliPath(nodeExecPath, env, pathExists);
  if (!npmCliPath) {
    throw new Error('Unable to locate npm-cli.js for shell-free npm execution on Windows');
  }
  return { command: nodeExecPath, args: [npmCliPath, ...args] };
}

/**
 * Resolve npx without launching Windows .cmd shims through a shell.
 *
 * @param {string[]} args
 * @param {{ platform?: NodeJS.Platform, nodeExecPath?: string, env?: NodeJS.ProcessEnv, pathExists?: (path: string) => boolean }} [options]
 */
export function resolveNpxInvocation(args, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== 'win32') {
    return { command: 'npx', args };
  }

  const env = options.env ?? process.env;
  const nodeExecPath = options.nodeExecPath ?? process.execPath;
  const pathExists = options.pathExists ?? existsSync;
  const npxCliPath = findNpmPackageCliPath('npx-cli.js', nodeExecPath, env, pathExists);
  if (!npxCliPath) {
    throw new Error('Unable to locate npx-cli.js for shell-free npx execution on Windows');
  }
  return { command: nodeExecPath, args: [npxCliPath, ...args] };
}

function findNpmCliPath(nodeExecPath, env, pathExists) {
  return findNpmPackageCliPath('npm-cli.js', nodeExecPath, env, pathExists);
}

function findNpmPackageCliPath(cliFileName, nodeExecPath, env, pathExists) {
  const candidates = new Set();
  if (env.npm_execpath) {
    if (env.npm_execpath.endsWith(cliFileName)) {
      candidates.add(env.npm_execpath);
    } else {
      candidates.add(join(dirname(env.npm_execpath), cliFileName));
    }
  }

  const nodeDir = dirname(nodeExecPath);
  candidates.add(join(nodeDir, 'node_modules', 'npm', 'bin', cliFileName));
  candidates.add(resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', cliFileName));

  for (const candidate of candidates) {
    if (pathExists(candidate)) return candidate;
  }
  return null;
}
