import { describe, it, expect } from 'vitest';

describe('npm/npx invocation helpers', () => {
  it('resolves npx through npx-cli.js on Windows', async () => {
    const { resolveNpxInvocation } = await import('../../packages/mindos/bin/lib/npm-invocation.js') as {
      resolveNpxInvocation: (
        args: string[],
        options: {
          platform: NodeJS.Platform;
          nodeExecPath: string;
          env: NodeJS.ProcessEnv;
          pathExists: (path: string) => boolean;
        },
      ) => { command: string; args: string[] };
    };
    const npxCliPath = '/node/node_modules/npm/bin/npx-cli.js';

    expect(resolveNpxInvocation(['skills', 'add', 'GeminiLight/MindOS'], {
      platform: 'win32',
      nodeExecPath: '/node/node.exe',
      env: { npm_execpath: '/node/node_modules/npm/bin/npm-cli.js' },
      pathExists: (candidate) => candidate === npxCliPath,
    })).toEqual({
      command: '/node/node.exe',
      args: [npxCliPath, 'skills', 'add', 'GeminiLight/MindOS'],
    });
  });
});
