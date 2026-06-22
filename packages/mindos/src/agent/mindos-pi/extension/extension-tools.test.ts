import { describe, expect, it } from 'vitest';
import {
  collectMindosPiRegisteredToolSummaries,
  collectMindosPiRuntimeToolsForFallback,
  createMindosHeadlessExtensionContext,
} from './extension-tools.js';
import type { MindosPiResourceLoaderAdapter } from '../resource-types.js';

describe('MindOS pi extension tools', () => {
  it('adapts pi extension tool wrappers for the non-streaming fallback', async () => {
    const captured: {
      params?: unknown;
      ctx?: Record<string, unknown>;
      toolCallId?: string;
    } = {};
    const resourceLoader: MindosPiResourceLoaderAdapter = {
      reload: async () => {},
      getExtensions: () => ({
        extensions: [{
          path: '/extensions/pi-web-access.ts',
          tools: new Map<string, unknown>([
            ['read_file', {
              definition: {
                name: 'read_file',
                execute: async () => ({ content: [{ type: 'text', text: 'extension result' }] }),
              },
            }],
            ['web_search', {
              definition: {
                name: 'web_search',
                description: 'Search the web',
                parameters: { type: 'object', properties: { query: { type: 'string' } } },
                prepareArguments: (args: unknown) => ({
                  query: String((args as { query?: unknown }).query ?? '').trim(),
                }),
                execute: async (
                  toolCallId: string,
                  params: unknown,
                  _signal: AbortSignal | undefined,
                  onUpdate: ((update: unknown) => void) | undefined,
                  ctx: Record<string, unknown>,
                ) => {
                  captured.toolCallId = toolCallId;
                  captured.params = params;
                  captured.ctx = ctx;
                  onUpdate?.({ content: [{ type: 'text', text: 'Searching...' }] });
                  return { ok: true };
                },
              },
              sourceInfo: { packageName: 'pi-web-access' },
            }],
          ]),
        }],
        errors: [],
      }),
    };
    const extensionContext = createMindosHeadlessExtensionContext({
      cwd: '/repo',
      model: { id: 'model' },
      modelRegistry: { registry: true },
      sessionManager: { session: true },
      settingsManager: { settings: true },
      resourceLoader,
      permissionMode: 'read',
    });

    const tools = collectMindosPiRuntimeToolsForFallback({
      resourceLoader,
      extensionContext,
    });

    expect(tools.map((tool) => tool.name)).toEqual(['read_file', 'web_search']);
    await expect(tools.find((tool) => tool.name === 'read_file')?.execute(
      'call-read',
      {},
      undefined,
      undefined,
    )).resolves.toEqual({ content: [{ type: 'text', text: 'extension result' }] });

    const updates: unknown[] = [];
    const webSearch = tools.find((tool) => tool.name === 'web_search');
    await expect(webSearch?.execute('call-search', { query: ' pi.dev ' }, new AbortController().signal, (update) => {
      updates.push(update);
    })).resolves.toEqual({ content: [{ type: 'text', text: '{"ok":true}' }] });

    expect(webSearch).toMatchObject({
      name: 'web_search',
      description: 'Search the web',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    });
    expect(captured).toMatchObject({
      toolCallId: 'call-search',
      params: { query: 'pi.dev' },
      ctx: expect.objectContaining({
        cwd: '/repo',
        hasUI: false,
        permissionMode: 'read',
        model: { id: 'model' },
        resourceLoader,
      }),
    });
    expect(updates).toEqual([{ content: [{ type: 'text', text: 'Searching...' }] }]);
  });

  it('summarizes extension tools so the runtime prompt can answer capability questions', () => {
    const resourceLoader: MindosPiResourceLoaderAdapter = {
      reload: async () => {},
      getExtensions: () => ({
        extensions: [{
          path: '/extensions/pi-web-access/index.ts',
          tools: new Map<string, unknown>([
            ['web_search', {
              definition: {
                name: 'web_search',
                description: 'Search the web',
              },
              sourceInfo: { packageName: 'pi-web-access' },
            }],
            ['fetch_content', {
              definition: {
                name: 'fetch_content',
                description: 'Fetch a URL',
              },
              sourceInfo: { packageName: 'pi-web-access' },
            }],
          ]),
        }],
        errors: [],
      }),
    };

    const summaries = collectMindosPiRegisteredToolSummaries({
      resourceLoader,
      customTools: [{ name: 'bash', description: 'Run a shell command' }],
    });

    expect(summaries).toEqual([
      { name: 'bash', description: 'Run a shell command', source: 'custom', sourceName: 'mindos-runtime' },
      { name: 'fetch_content', description: 'Fetch a URL', source: 'extension', sourceName: 'pi-web-access' },
      { name: 'web_search', description: 'Search the web', source: 'extension', sourceName: 'pi-web-access' },
    ]);
  });
});
