/**
 * Fix nested postcss dependencies inside next/node_modules.
 *
 * Next.js 16 bundles postcss@8.4.31 which depends on nanoid@^3,
 * picocolors, and source-map-js. When the app's top-level nanoid
 * is v5 (major mismatch), npm's hoisting fails to place nanoid@3
 * where postcss can find it.
 *
 * Runs as postinstall — skips silently if postcss is already OK
 * or if next/node_modules/postcss doesn't exist.
 *
 * Optimization: symlink/copy picocolors and source-map-js directly
 * from app's node_modules (compatible versions), then only use npm
 * install for nanoid (which needs v3, incompatible with app's v5).
 */

const { existsSync, mkdirSync, cpSync, symlinkSync } = require('fs');
const { dirname, join, resolve } = require('path');
const { execFileSync } = require('child_process');

const postcssDir = join('node_modules', 'next', 'node_modules', 'postcss');
const postcssNm = join(postcssDir, 'node_modules');
const marker = join(postcssNm, 'source-map-js');

if (!existsSync(postcssDir)) {
  process.exit(0); // postcss not installed — skip
}

if (existsSync(marker)) {
  process.exit(0); // Already fixed — skip
}

// picocolors and source-map-js: app's versions are semver-compatible with
// postcss's requirements (^1.0.0 and ^1.0.2). Safe to symlink/copy.
// nanoid: postcss needs ^3.3.6 but app has v5 (ESM-only, CJS-incompatible).
// Must use npm install for nanoid only.

const compatibleDeps = ['picocolors', 'source-map-js'];
const appNm = 'node_modules';

function resolveNpmInvocation(args) {
  if (process.platform !== 'win32') {
    return { command: 'npm', args };
  }

  const npmCliPath = findNpmCliPath();
  if (!npmCliPath) {
    throw new Error('Unable to locate npm-cli.js for shell-free npm execution on Windows');
  }
  return { command: process.execPath, args: [npmCliPath, ...args] };
}

function findNpmCliPath() {
  const candidates = new Set();
  if (process.env.npm_execpath) {
    if (process.env.npm_execpath.endsWith('npm-cli.js')) {
      candidates.add(process.env.npm_execpath);
    } else {
      candidates.add(join(dirname(process.env.npm_execpath), 'npm-cli.js'));
    }
  }

  const nodeDir = dirname(process.execPath);
  candidates.add(join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  candidates.add(resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function runNpmInstall(cwd) {
  const invocation = resolveNpmInvocation(['install', '--no-save', '--install-strategy=nested']);
  execFileSync(invocation.command, invocation.args, {
    cwd,
    stdio: 'ignore',
  });
}

try {
  mkdirSync(postcssNm, { recursive: true });

  // Fast path: link compatible deps from app's node_modules
  for (const dep of compatibleDeps) {
    const srcPath = resolve(appNm, dep);
    const dstPath = resolve(postcssNm, dep);
    if (existsSync(srcPath) && !existsSync(dstPath)) {
      try {
        // junction works on Windows without admin privileges
        symlinkSync(srcPath, dstPath, 'junction');
      } catch {
        cpSync(srcPath, dstPath, { recursive: true, force: true });
      }
    }
  }

  // nanoid needs ^3 (app has v5) — must install separately
  if (!existsSync(join(postcssNm, 'nanoid'))) {
    runNpmInstall(postcssDir);
  }
} catch {
  // If anything fails, fall back to full nested npm install
  try {
    runNpmInstall(postcssDir);
  } catch {
    // Best-effort — build will report the real error if deps are still missing
  }
}
