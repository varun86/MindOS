import { readFileSync } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { _downloadFile_forTest, removeMacQuarantineAttribute } from './node-bootstrap';

const httpsGetMock = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getPath: () => path.join(process.cwd(), 'tmp-node-bootstrap-home'),
  },
}));

vi.mock('https', () => ({
  default: { get: httpsGetMock },
  get: httpsGetMock,
}));

describe('node-bootstrap', () => {
  it('removes macOS quarantine with argv so quoted paths are safe', () => {
    const calls: Array<{ command: string; args: string[]; options: unknown }> = [];
    const nodeDir = '/Users/test/.mindos/node "quoted" $HOME';

    removeMacQuarantineAttribute(nodeDir, (command, args, options) => {
      calls.push({ command, args, options });
      return '';
    });

    expect(calls).toEqual([{
      command: 'xattr',
      args: ['-dr', 'com.apple.quarantine', nodeDir],
      options: { stdio: 'ignore' },
    }]);

    const source = readFileSync(path.join(__dirname, 'node-bootstrap.ts'), 'utf-8');
    expect(source).not.toContain('execSync(`xattr');
    expect(source).not.toContain('com.apple.quarantine "${NODE_DIR}"');
  });

  it('does not route every Windows bootstrap spawn through the shell', () => {
    const source = readFileSync(path.join(__dirname, 'node-bootstrap.ts'), 'utf-8');

    expect(source).not.toContain('shell: IS_WIN');
    expect(source).toContain('shell: needsWindowsShell(cmd)');
    expect(source).toContain('shell: needsWindowsShell(npmBin)');
  });

  it('destroys the active download request when the overall timeout fires', async () => {
    vi.useFakeTimers();
    try {
      const request = Object.assign(new EventEmitter(), { destroy: vi.fn() });
      httpsGetMock.mockImplementation(() => request);

      const download = _downloadFile_forTest('https://node.example/node.tar.gz', '/tmp/node.tar.gz', undefined, 1000);
      const rejected = expect(download).rejects.toThrow('Download timed out after 1s');

      await vi.advanceTimersByTimeAsync(1000);

      await rejected;
      expect(request.destroy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
