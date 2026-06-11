import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';

const httpsGetMock = vi.hoisted(() => vi.fn());

vi.hoisted(() => {
  process.env.MINDOS_DESKTOP_HOME_DIR = '/tmp/mock-home';
});

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => name === 'home' ? '/tmp/mock-home' : `/tmp/mock-${name}`,
    getVersion: () => '0.0.0',
  },
}));

vi.mock('https', () => ({
  default: { get: httpsGetMock },
  get: httpsGetMock,
}));

import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import {
  CoreUpdater,
  CoreUpdateInProgressError,
  _downloadFile_forTest,
  _fetchUrl_forTest,
  _renameWithRetrySync_forTest,
} from './core-updater';
import { getStandaloneAppRequiredEntries } from './runtime-health-contract';

const CONFIG_DIR = '/tmp/mock-home/.mindos';
const RUNTIME_DIR = path.join(CONFIG_DIR, 'runtime');
const DOWNLOAD_DIR = path.join(CONFIG_DIR, 'runtime-downloading');
const LOCK_PATH = path.join(CONFIG_DIR, 'runtime-update.lock');

function writeRuntimeAt(dir: string, version: string, complete: boolean) {
  mkdirSync(path.join(dir, 'packages', 'protocols', 'mcp-server', 'dist'), { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }), 'utf-8');
  writeFileSync(path.join(dir, 'packages', 'protocols', 'mcp-server', 'dist', 'index.cjs'), '// mcp', 'utf-8');
  for (const entry of getStandaloneAppRequiredEntries()) {
    const shouldSkip = !complete && entry.path.includes('pdfjs-dist');
    if (shouldSkip) continue;
    const target = path.join(dir, 'packages', 'web', entry.path);
    if (entry.type === 'directory') {
      mkdirSync(target, { recursive: true });
    } else {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, `// ${entry.path}`, 'utf-8');
    }
  }
}

function writeRuntime(version: string, complete: boolean) {
  writeRuntimeAt(RUNTIME_DIR, version, complete);
}

describe('CoreUpdater.cleanupOnBoot', () => {
  beforeEach(() => {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    delete process.env.MINDOS_DESKTOP_HOME_DIR;
  });

  it('removes cached runtime when critical pdf runtime files are missing even if cached version is newer', () => {
    writeRuntime('9.9.9', false);

    const updater = new CoreUpdater();
    updater.cleanupOnBoot('0.6.78');

    expect(existsSync(RUNTIME_DIR)).toBe(false);
  });

  it('keeps cached runtime when it is complete and newer than bundled', () => {
    writeRuntime('9.9.9', true);

    const updater = new CoreUpdater();
    updater.cleanupOnBoot('0.6.78');

    expect(existsSync(RUNTIME_DIR)).toBe(true);
  });

  it('still removes cached runtime when bundled version is same or newer', () => {
    writeRuntime('0.6.78', true);

    const updater = new CoreUpdater();
    updater.cleanupOnBoot('0.6.78');

    expect(existsSync(RUNTIME_DIR)).toBe(false);
  });
});

describe('CoreUpdater download fallback cleanup', () => {
  it('destroys the active response before retrying after a URL timeout', async () => {
    const request = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      headers: {},
      destroyed: false,
      destroy: vi.fn(function (this: { destroyed: boolean }) {
        this.destroyed = true;
      }),
      pipe: vi.fn(),
      resume: vi.fn(),
    });
    httpsGetMock.mockImplementation((_url, _options, callback) => {
      callback(response);
      return request;
    });

    const controller = new AbortController();
    const download = _downloadFile_forTest(
      ['https://updates.example/runtime.tar.gz'],
      path.join(CONFIG_DIR, 'runtime.tar.gz'),
      0,
      controller.signal,
      () => {},
    );

    request.emit('timeout');

    await expect(download).rejects.toThrow('All download URLs failed: timeout');
    expect(request.destroy).toHaveBeenCalledTimes(1);
    expect(response.destroy).toHaveBeenCalledTimes(1);
  });
});

type MockResponse = EventEmitter & {
  statusCode: number;
  headers: Record<string, string>;
  destroyed: boolean;
  destroy: () => void;
  resume: () => void;
  pipe?: (stream: NodeJS.WritableStream) => NodeJS.WritableStream;
};

function mockResponse(overrides: Partial<MockResponse>): MockResponse {
  return Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: {},
    destroyed: false,
    destroy: vi.fn(),
    resume: vi.fn(),
    ...overrides,
  }) as MockResponse;
}

describe('CoreUpdater download redirects', () => {
  beforeEach(() => {
    httpsGetMock.mockReset();
    process.env.MINDOS_DESKTOP_HOME_DIR = '/tmp/mock-home';
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    delete process.env.MINDOS_DESKTOP_HOME_DIR;
  });

  it('resolves relative redirect locations during runtime download', async () => {
    const calls: string[] = [];
    httpsGetMock.mockImplementation((reqUrl, _options, callback) => {
      calls.push(String(reqUrl));
      const request = Object.assign(new EventEmitter(), { destroy: vi.fn(), destroyed: false });
      process.nextTick(() => {
        if (calls.length === 1) {
          callback(mockResponse({ statusCode: 302, headers: { location: '/runtime2.tar.gz' } }));
          return;
        }
        callback(mockResponse({
          headers: { 'content-length': '2' },
          pipe: (stream: NodeJS.WritableStream) => { stream.end('ok'); return stream; },
        }));
      });
      return request;
    });

    const controller = new AbortController();
    await _downloadFile_forTest(
      ['https://updates.example/dist/runtime.tar.gz'],
      path.join(CONFIG_DIR, 'runtime.tar.gz'),
      0,
      controller.signal,
      () => {},
    );

    expect(calls).toEqual([
      'https://updates.example/dist/runtime.tar.gz',
      'https://updates.example/runtime2.tar.gz',
    ]);
  });

  it('fails over after exceeding the redirect cap', async () => {
    httpsGetMock.mockImplementation((_reqUrl, _options, callback) => {
      const request = Object.assign(new EventEmitter(), { destroy: vi.fn(), destroyed: false });
      process.nextTick(() => {
        callback(mockResponse({ statusCode: 302, headers: { location: '/loop' } }));
      });
      return request;
    });

    const controller = new AbortController();
    await expect(_downloadFile_forTest(
      ['https://updates.example/runtime.tar.gz'],
      path.join(CONFIG_DIR, 'runtime.tar.gz'),
      0,
      controller.signal,
      () => {},
    )).rejects.toThrow(/All download URLs failed.*Too many redirects/i);
    // Initial request + MAX_REDIRECTS follows, then the URL is abandoned.
    expect(httpsGetMock).toHaveBeenCalledTimes(6);
  });

  it('refuses redirects that downgrade to plain http', async () => {
    httpsGetMock.mockImplementation((_reqUrl, _options, callback) => {
      const request = Object.assign(new EventEmitter(), { destroy: vi.fn(), destroyed: false });
      process.nextTick(() => {
        callback(mockResponse({ statusCode: 302, headers: { location: 'http://evil.example/x' } }));
      });
      return request;
    });

    const controller = new AbortController();
    await expect(_downloadFile_forTest(
      ['https://updates.example/runtime.tar.gz'],
      path.join(CONFIG_DIR, 'runtime.tar.gz'),
      0,
      controller.signal,
      () => {},
    )).rejects.toThrow(/insecure/);
    expect(httpsGetMock).toHaveBeenCalledTimes(1);
  });

  it('resolves relative redirects when fetching the manifest', async () => {
    const calls: string[] = [];
    httpsGetMock.mockImplementation((reqUrl, _options, callback) => {
      calls.push(String(reqUrl));
      const request = Object.assign(new EventEmitter(), { destroy: vi.fn(), destroyed: false });
      process.nextTick(() => {
        if (calls.length === 1) {
          callback(mockResponse({ statusCode: 302, headers: { location: '/v2/latest.json' } }));
          return;
        }
        const res = mockResponse({ statusCode: 200 });
        callback(res);
        res.emit('data', Buffer.from('{"ok":true}'));
        res.emit('end');
      });
      return request;
    });

    await expect(_fetchUrl_forTest('https://updates.example/api/latest.json', 1000)).resolves.toBe('{"ok":true}');
    expect(calls).toEqual([
      'https://updates.example/api/latest.json',
      'https://updates.example/v2/latest.json',
    ]);
  });
});

describe('CoreUpdater update lock', () => {
  beforeEach(() => {
    httpsGetMock.mockReset();
    process.env.MINDOS_DESKTOP_HOME_DIR = '/tmp/mock-home';
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    delete process.env.MINDOS_DESKTOP_HOME_DIR;
  });

  it('refuses to apply while another process holds the update lock', () => {
    writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, createdAt: Date.now() }), 'utf-8');

    const updater = new CoreUpdater();
    expect(() => updater.apply()).toThrow(CoreUpdateInProgressError);
    expect(() => updater.apply()).toThrow(/Another update is in progress/);
  });

  it('reclaims a stale lock left by a dead process', () => {
    writeFileSync(
      LOCK_PATH,
      JSON.stringify({ pid: 999999999, createdAt: Date.now() - 11 * 60 * 1000 }),
      'utf-8',
    );
    const oldDir = path.join(CONFIG_DIR, 'runtime-old');
    mkdirSync(oldDir, { recursive: true });

    const updater = new CoreUpdater();
    updater.cleanupOnBoot(null);

    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(LOCK_PATH)).toBe(false);
  });

  it('releases the lock after a failed apply', () => {
    const updater = new CoreUpdater();
    expect(() => updater.apply()).toThrow(/No downloaded runtime/);
    expect(existsSync(LOCK_PATH)).toBe(false);
  });

  it('skips boot cleanup while another instance is updating', () => {
    writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, createdAt: Date.now() }), 'utf-8');
    const oldDir = path.join(CONFIG_DIR, 'runtime-old');
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(path.join(oldDir, 'keep.txt'), 'x', 'utf-8');

    const updater = new CoreUpdater();
    updater.cleanupOnBoot(null);

    expect(existsSync(path.join(oldDir, 'keep.txt'))).toBe(true);
    expect(existsSync(LOCK_PATH)).toBe(true);
  });
});

describe('CoreUpdater.download input validation', () => {
  beforeEach(() => {
    httpsGetMock.mockReset();
    process.env.MINDOS_DESKTOP_HOME_DIR = '/tmp/mock-home';
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    delete process.env.MINDOS_DESKTOP_HOME_DIR;
  });

  it('rejects download without a sha256', async () => {
    const updater = new CoreUpdater();
    await expect(updater.download(['https://x/y.tgz'], '1.0.0', 0, '')).rejects.toThrow(/64-char hex/);
    expect(httpsGetMock).not.toHaveBeenCalled();
  });

  it('rejects malformed sha256', async () => {
    const updater = new CoreUpdater();
    await expect(updater.download(['https://x/y.tgz'], '1.0.0', 0, 'nothex')).rejects.toThrow(/64-char hex/);
    expect(httpsGetMock).not.toHaveBeenCalled();
  });

  it('rejects downloads whose size does not match the manifest', async () => {
    httpsGetMock.mockImplementation((_reqUrl, _options, callback) => {
      const request = Object.assign(new EventEmitter(), { destroy: vi.fn(), destroyed: false });
      process.nextTick(() => {
        callback(mockResponse({
          headers: { 'content-length': '4' },
          pipe: (stream: NodeJS.WritableStream) => { stream.end('data'); return stream; },
        }));
      });
      return request;
    });

    const sha = createHash('sha256').update('data').digest('hex');
    const updater = new CoreUpdater();
    await expect(
      updater.download(['https://updates.example/runtime.tar.gz'], '1.0.0', 999, sha),
    ).rejects.toThrow(/Size mismatch/);
  });
});

describe('renameWithRetrySync', () => {
  it('retries transient EPERM rename failures and succeeds', () => {
    let attempts = 0;
    const rename = vi.fn(() => {
      attempts++;
      if (attempts <= 2) {
        const err = new Error('operation not permitted') as NodeJS.ErrnoException;
        err.code = 'EPERM';
        throw err;
      }
    });
    const sleep = vi.fn();

    _renameWithRetrySync_forTest('/from', '/to', {
      rename: rename as unknown as typeof renameSync,
      sleep,
    });

    expect(rename).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient rename errors', () => {
    const rename = vi.fn(() => {
      const err = new Error('no such file or directory') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });
    const sleep = vi.fn();

    expect(() => _renameWithRetrySync_forTest('/from', '/to', {
      rename: rename as unknown as typeof renameSync,
      sleep,
    })).toThrow(/no such file/);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('CoreUpdater stale pending downloads', () => {
  beforeEach(() => {
    process.env.MINDOS_DESKTOP_HOME_DIR = '/tmp/mock-home';
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    delete process.env.MINDOS_DESKTOP_HOME_DIR;
  });

  it('getPendingVersion returns null when the pending download is not newer than the cached runtime', () => {
    writeRuntimeAt(RUNTIME_DIR, '1.2.0', true);
    writeRuntimeAt(DOWNLOAD_DIR, '1.1.0', true);

    expect(new CoreUpdater().getPendingVersion()).toBeNull();
  });

  it('getPendingVersion returns the version when pending is an upgrade', () => {
    writeRuntimeAt(RUNTIME_DIR, '1.0.0', true);
    writeRuntimeAt(DOWNLOAD_DIR, '1.1.0', true);

    expect(new CoreUpdater().getPendingVersion()).toBe('1.1.0');
  });

  it('apply discards a stale pending download instead of downgrading', () => {
    writeRuntimeAt(RUNTIME_DIR, '1.2.0', true);
    writeRuntimeAt(DOWNLOAD_DIR, '1.1.0', true);

    const updater = new CoreUpdater();
    expect(() => updater.apply()).toThrow(/not newer/);

    expect(existsSync(DOWNLOAD_DIR)).toBe(false);
    expect(existsSync(RUNTIME_DIR)).toBe(true);
    expect(updater.getCachedVersion()).toBe('1.2.0');
  });

  it('cleanupOnBoot removes runnable pending downloads that are not upgrades', () => {
    writeRuntimeAt(DOWNLOAD_DIR, '1.0.0', true);

    new CoreUpdater().cleanupOnBoot('1.2.0');

    expect(existsSync(DOWNLOAD_DIR)).toBe(false);
  });

  it('cleanupOnBoot keeps runnable pending downloads that are upgrades', () => {
    writeRuntimeAt(DOWNLOAD_DIR, '9.9.9', true);

    new CoreUpdater().cleanupOnBoot('1.2.0');

    expect(existsSync(DOWNLOAD_DIR)).toBe(true);
  });
});
