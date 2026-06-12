#!/usr/bin/env node
/**
 * Smoke-test Next standalone server: merge static/public, spawn server.js, GET /api/health.
 * Catches missing serverExternalPackages / file-trace gaps (MODULE_NOT_FOUND at startup).
 *
 * Run from repo root after: pnpm --filter @mindos/web run build
 *   node scripts/verify-standalone.mjs
 *
 * @see wiki/specs/spec-desktop-standalone-runtime.md
 */
import { spawn } from 'child_process';
import http from 'http';
import { createServer as createTcpServer } from 'net';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { materializeStandaloneAssets } from '../packages/desktop/scripts/prepare-mindos-bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'packages', 'web');
const serverJs = path.join(appDir, '.next', 'standalone', 'server.js');

if (!existsSync(serverJs)) {
  console.error(
    `[verify-standalone] Missing ${serverJs}\nBuild first: pnpm --filter @mindos/web run build`
  );
  process.exit(1);
}

try {
  materializeStandaloneAssets(appDir);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

async function allocateFreePort() {
  return new Promise((resolve, reject) => {
    const server = createTcpServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const allocatedPort = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (allocatedPort >= 1024) resolve(allocatedPort);
        else reject(new Error(`Invalid allocated test port: ${allocatedPort}`));
      });
    });
  });
}

const port = await allocateFreePort();
const nodeBin = process.execPath;

function waitHttpOk(pathname, timeoutMs, validate = () => true) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    // `/` responds with a server-side 307 to the default echo route; follow
    // same-origin redirects (bounded) so the check validates the real page.
    const tick = (currentPath = pathname, redirectsLeft = 5) => {
      if (Date.now() > deadline) {
        reject(new Error(`Timeout waiting for http://127.0.0.1:${port}${pathname}`));
        return;
      }
      const req = http.get(
        `http://127.0.0.1:${port}${currentPath}`,
        { timeout: 2000 },
        (res) => {
          let body = '';
          res.on('data', (c) => {
            body += c;
          });
          res.on('end', () => {
            if (res.statusCode === 200 && validate(body)) {
              resolve();
              return;
            }
            const location = res.headers.location;
            if (
              res.statusCode >= 300 && res.statusCode < 400 &&
              redirectsLeft > 0 && location && location.startsWith('/')
            ) {
              tick(location, redirectsLeft - 1);
              return;
            }
            setTimeout(() => tick(pathname), 300);
          });
        }
      );
      req.on('error', () => {
        setTimeout(() => tick(pathname), 300);
      });
      req.on('timeout', () => {
        req.destroy();
        setTimeout(() => tick(pathname), 300);
      });
    };
    tick();
  });
}

function waitHealth(timeoutMs) {
  return waitHttpOk('/api/health', timeoutMs, (body) => {
    try {
      const j = JSON.parse(body);
      return j.ok === true && j.service === 'mindos';
    } catch {
      return false;
    }
  });
}

function waitMcpAgents(timeoutMs) {
  return waitHttpOk('/api/mcp/agents', timeoutMs, (body) => {
    try {
      const j = JSON.parse(body);
      return Array.isArray(j.agents) && j.agents.length > 0;
    } catch {
      return false;
    }
  });
}

let stderr = '';
const child = spawn(nodeBin, [serverJs], {
  cwd: appDir,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    /** Next binds to machine hostname by default; Desktop health checks use 127.0.0.1 */
    HOSTNAME: '127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stderr?.on('data', (c) => {
  stderr += c.toString();
});

function killChild() {
  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

async function main() {
  try {
    await waitHealth(90_000);
    await waitMcpAgents(30_000);
    await waitHttpOk('/', 30_000, (body) => body.includes('MindOS') || body.includes('__next'));
    console.log(`[verify-standalone] OK (port ${port})`);
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    if (stderr.trim()) console.error('--- server stderr (tail) ---\n', stderr.slice(-4000));
    return 1;
  } finally {
    killChild();
    await new Promise((r) => setTimeout(r, 500));
  }
}

child.on('error', (err) => {
  console.error('[verify-standalone] spawn failed:', err.message);
  process.exit(1);
});

main().then((code) => process.exit(code));
