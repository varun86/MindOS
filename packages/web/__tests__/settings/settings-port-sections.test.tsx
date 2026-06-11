// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { messages } from '@/lib/i18n';

const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('settings port sections', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.useRealTimers();
  });

  it('ignores stale MCP port check responses after the user changes the input', async () => {
    const { default: McpPortSection } = await import('@/components/settings/McpPortSection');
    const firstCheck = deferred<{ available: boolean; suggestion: number }>();
    const secondCheck = deferred<{ available: boolean }>();

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/settings' && !opts?.method) return Promise.resolve({ mcpPort: 8781 });
      if (url === '/api/setup/check-port') {
        const body = JSON.parse(String(opts?.body));
        if (body.port === 9000) return firstCheck.promise;
        if (body.port === 9001) return secondCheck.promise;
      }
      throw new Error(`Unexpected apiFetch call: ${url}`);
    });

    await act(async () => {
      root.render(<McpPortSection m={messages.en.settings.mcp as any} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, '9000');
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await act(async () => {
      setInputValue(input, '9001');
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await act(async () => {
      secondCheck.resolve({ available: true });
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Available');

    await act(async () => {
      firstCheck.resolve({ available: false, suggestion: 9002 });
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Available');
    expect(host.textContent).not.toContain('is in use');
  });

  it('ignores stale Web port check responses after the user changes the input', async () => {
    const { default: WebPortSection } = await import('@/components/settings/WebPortSection');
    const firstCheck = deferred<{ available: boolean; suggestion: number }>();
    const secondCheck = deferred<{ available: boolean }>();

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/settings' && !opts?.method) return Promise.resolve({ port: 4567 });
      if (url === '/api/setup/check-port') {
        const body = JSON.parse(String(opts?.body));
        if (body.port === 9100) return firstCheck.promise;
        if (body.port === 9101) return secondCheck.promise;
      }
      throw new Error(`Unexpected apiFetch call: ${url}`);
    });

    await act(async () => {
      root.render(<WebPortSection m={messages.en.settings.mcp as any} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, '9100');
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await act(async () => {
      setInputValue(input, '9101');
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await act(async () => {
      secondCheck.resolve({ available: true });
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Available');

    await act(async () => {
      firstCheck.resolve({ available: false, suggestion: 9102 });
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Available');
    expect(host.textContent).not.toContain('is in use');
  });
});
