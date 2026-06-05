import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import nextConfig from '../next.config';

function collectRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = resolve(dir, entry);
    if (statSync(entryPath).isDirectory()) return collectRouteFiles(entryPath);
    return entry === 'route.ts' ? [entryPath] : [];
  });
}

describe('next config warning hygiene', () => {
  it('keeps tracing and Turbopack roots aligned with the app standalone layout', () => {
    const appRoot = resolve(__dirname, '..');

    expect(nextConfig.outputFileTracingRoot).toBe(appRoot);
    expect(nextConfig.turbopack?.root).toBe(appRoot);
  });

  it('runs local dev with webpack to preserve the app-root standalone tracing layout under pnpm', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };

    const launcher = readFileSync(resolve(__dirname, '../scripts/next-with-port.mjs'), 'utf-8');

    expect(pkg.scripts?.dev).toContain('node scripts/next-with-port.mjs dev');
    expect(launcher).toContain("'--webpack'");
    expect(pkg.scripts?.dev).not.toContain('npx tsx');
    expect(pkg.scripts?.generate).toBe('tsx scripts/generate-explore.ts');
    expect(pkg.scripts?.prebuild).toContain('tsx scripts/generate-explore.ts');
  });

  it('uses a cross-platform launcher for dev and start port selection', async () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const launcherPath = resolve(__dirname, '../scripts/next-with-port.mjs');
    const launcherModule = await import('../scripts/next-with-port.mjs') as {
      buildNextArgs: (command: string, env?: Record<string, string | undefined>) => string[];
    };

    expect(pkg.scripts?.dev).toBe('tsx scripts/generate-explore.ts && node scripts/next-with-port.mjs dev');
    expect(pkg.scripts?.start).toBe('node scripts/next-with-port.mjs start');
    expect(`${pkg.scripts?.dev ?? ''}\n${pkg.scripts?.start ?? ''}`).not.toMatch(/\$\{[^}]+:-/);
    expect(existsSync(launcherPath)).toBe(true);

    const launcher = readFileSync(launcherPath, 'utf-8');
    expect(launcher).toContain('MINDOS_WEB_PORT');
    expect(launcher).toContain('3456');
    expect(launcher).toContain('spawn(');
    expect(launcher).not.toContain('shell: true');
    expect(launcherModule.buildNextArgs('dev', {})).toEqual(['dev', '--webpack', '-p', '3456']);
    expect(launcherModule.buildNextArgs('dev', { MINDOS_WEB_PORT: '4567' })).toEqual(['dev', '--webpack', '-p', '4567']);
    expect(launcherModule.buildNextArgs('start', { MINDOS_WEB_PORT: '70000' })).toEqual(['start', '-p', '3456']);
    expect(() => launcherModule.buildNextArgs('build', {})).toThrow(/Unsupported Next.js command/);
  });

  it('suppresses only the known pi-ai dynamic dependency webpack warning', () => {
    const config: { ignoreWarnings?: unknown[]; resolve?: { alias?: Record<string, string> } } = {};
    const webpack = nextConfig.webpack;
    expect(typeof webpack).toBe('function');
    if (typeof webpack !== 'function') return;

    const result = webpack(config, {
      buildId: 'test',
      dev: false,
      isServer: true,
      defaultLoaders: {},
      nextRuntime: 'nodejs',
      webpack: {},
    } as never);

    const ignoreWarning = result.ignoreWarnings?.find((entry): entry is (warning: unknown) => boolean => {
      return typeof entry === 'function';
    });
    expect(ignoreWarning).toBeTypeOf('function');
    if (!ignoreWarning) return;

    expect(ignoreWarning({
      message: 'Critical dependency: the request of a dependency is an expression',
      module: { resource: '/repo/node_modules/@earendil-works/pi-ai/dist/providers/openai-codex-responses.js' },
    })).toBe(true);
    expect(ignoreWarning({
      message: 'Critical dependency: the request of a dependency is an expression',
      module: { resource: '/repo/node_modules/some-other-package/index.js' },
    })).toBe(false);
  });

  it('keeps Earendil PI packages bundled so Next resolves their package exports', () => {
    expect(nextConfig.serverExternalPackages).not.toContain('@earendil-works/pi-ai');
    expect(nextConfig.serverExternalPackages).not.toContain('@earendil-works/pi-agent-core');
    expect(nextConfig.serverExternalPackages).not.toContain('@earendil-works/pi-coding-agent');
  });

  it('marks API routes that import Node-only modules as nodejs runtime routes', () => {
    const appRoot = resolve(__dirname, '..');
    const apiRoot = resolve(appRoot, 'app/api');
    const nodeOnlyImport = /from ['"](?:node:)?(?:fs|os|path|stream|child_process|crypto)['"]|import\s+[^;]+from ['"](?:node:)?(?:fs|os|path|stream|child_process|crypto)['"]/;
    const missingRuntime = collectRouteFiles(apiRoot).filter((routeFile) => {
      const source = readFileSync(routeFile, 'utf-8');
      return nodeOnlyImport.test(source) && !source.includes("export const runtime = 'nodejs'");
    });

    expect(missingRuntime.map(file => file.replace(`${appRoot}/`, ''))).toEqual([]);
  });
});
