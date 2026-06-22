import type { MindosExecutableTool } from '../../tool/executable-tool.js';
import type { MindosPermissionMode } from '../../permission/index.js';
import type {
  MindosExtensionEntry,
  MindosPiResourceLoaderAdapter,
} from '../resource-types.js';

type MindosExtensionToolDefinition = {
  name?: unknown;
  description?: unknown;
  parameters?: unknown;
  prepareArguments?: unknown;
  execute?: unknown;
};

type MindosExtensionToolExecute = (
  this: unknown,
  toolCallId: string,
  params: unknown,
  signal: AbortSignal | undefined,
  onUpdate: ((update: unknown) => void) | undefined,
  ctx: Record<string, unknown>,
) => Promise<unknown> | unknown;

export type MindosRuntimeToolSummary = {
  name: string;
  description?: string;
  source: 'extension' | 'custom';
  sourceName?: string;
};

export function createMindosHeadlessExtensionContext(input: {
  cwd: string;
  model: unknown;
  modelRegistry: unknown;
  sessionManager: unknown;
  settingsManager: unknown;
  resourceLoader: unknown;
  permissionMode?: MindosPermissionMode;
}): Record<string, unknown> {
  return {
    cwd: input.cwd,
    hasUI: false,
    model: input.model,
    modelRegistry: input.modelRegistry,
    sessionManager: input.sessionManager,
    settingsManager: input.settingsManager,
    resourceLoader: input.resourceLoader,
    ...(input.permissionMode ? { permissionMode: input.permissionMode } : {}),
    ui: {
      notify: () => {},
      setWidget: () => {},
      custom: async () => undefined,
    },
  };
}

export function collectMindosPiRegisteredToolSummaries(input: {
  resourceLoader: MindosPiResourceLoaderAdapter;
  customTools?: unknown[];
}): MindosRuntimeToolSummary[] {
  const byName = new Map<string, MindosRuntimeToolSummary>();

  let extensions: MindosExtensionEntry[] = [];
  try {
    extensions = input.resourceLoader.getExtensions?.().extensions ?? [];
  } catch {
    extensions = [];
  }

  for (const extension of extensions) {
    for (const [entryName, rawTool] of mindosExtensionToolEntries(extension.tools)) {
      const tool = mindosExtensionToolDefinition(rawTool);
      if (!tool) continue;
      const name = typeof tool.name === 'string' ? tool.name : entryName;
      if (!name || byName.has(name)) continue;
      byName.set(name, {
        name,
        ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
        source: 'extension',
        sourceName: extensionToolSourceName(rawTool, extension),
      });
    }
  }

  for (const customTool of input.customTools ?? []) {
    if (!isRecord(customTool) || typeof customTool.name !== 'string' || !customTool.name) continue;
    if (byName.has(customTool.name)) continue;
    byName.set(customTool.name, {
      name: customTool.name,
      ...(typeof customTool.description === 'string' ? { description: customTool.description } : {}),
      source: 'custom',
      sourceName: 'mindos-runtime',
    });
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function collectMindosPiRuntimeToolsForFallback(input: {
  resourceLoader: MindosPiResourceLoaderAdapter;
  extensionContext: Record<string, unknown>;
}): MindosExecutableTool[] {
  const byName = new Map<string, MindosExecutableTool>();

  let extensions: MindosExtensionEntry[] = [];
  try {
    extensions = input.resourceLoader.getExtensions?.().extensions ?? [];
  } catch {
    return [];
  }

  for (const extension of extensions) {
    for (const [entryName, rawTool] of mindosExtensionToolEntries(extension.tools)) {
      const tool = mindosExtensionToolDefinition(rawTool);
      if (!tool) continue;
      const name = typeof tool.name === 'string' ? tool.name : entryName;
      if (!name || byName.has(name) || typeof tool.execute !== 'function') continue;
      byName.set(name, createMindosExecutableToolFromExtension(name, tool, input.extensionContext));
    }
  }

  return [...byName.values()];
}

function mindosExtensionToolEntries(tools: unknown): Array<[string | undefined, unknown]> {
  if (!tools) return [];
  if (tools instanceof Map) {
    return [...tools.entries()].map(([name, tool]) => [
      typeof name === 'string' ? name : undefined,
      tool,
    ]);
  }
  if (Array.isArray(tools)) {
    return tools.map((tool) => [
      isRecord(tool) && typeof tool.name === 'string' ? tool.name : undefined,
      tool,
    ]);
  }
  if (isRecord(tools)) {
    return Object.entries(tools).map(([name, tool]) => [name, tool]);
  }
  return [];
}

function extensionToolSourceName(rawTool: unknown, extension: MindosExtensionEntry): string | undefined {
  if (isRecord(rawTool) && isRecord(rawTool.sourceInfo)) {
    const packageName = rawTool.sourceInfo.packageName;
    if (typeof packageName === 'string' && packageName.trim()) return packageName.trim();
  }
  if (typeof extension.path === 'string' && extension.path.trim()) {
    const normalized = extension.path.replace(/\\/g, '/').replace(/\/+$/g, '');
    const parts = normalized.split('/').filter(Boolean);
    const fileName = parts.at(-1);
    const parent = parts.at(-2);
    if (parent === 'pi-web-access') return 'pi-web-access';
    if (fileName) return fileName.replace(/\.(?:mjs|cjs|js|jsx|ts|tsx)$/i, '');
  }
  return undefined;
}

function mindosExtensionToolDefinition(rawTool: unknown): MindosExtensionToolDefinition | null {
  if (!isRecord(rawTool)) return null;
  const wrappedDefinition = rawTool.definition;
  if (isRecord(wrappedDefinition)) return wrappedDefinition as MindosExtensionToolDefinition;
  return rawTool as MindosExtensionToolDefinition;
}

function createMindosExecutableToolFromExtension(
  name: string,
  tool: MindosExtensionToolDefinition,
  extensionContext: Record<string, unknown>,
): MindosExecutableTool {
  const execute = tool.execute as MindosExtensionToolExecute;
  const prepareArguments = typeof tool.prepareArguments === 'function'
    ? tool.prepareArguments as (args: unknown) => unknown
    : undefined;

  return {
    name,
    description: typeof tool.description === 'string' ? tool.description : undefined,
    parameters: tool.parameters,
    execute: async (toolCallId, args, signal, onUpdate) => {
      const preparedArgs = prepareArguments ? prepareArguments(args) : args;
      const result = await execute.call(tool, toolCallId, preparedArgs, signal, onUpdate, extensionContext);
      return normalizeMindosExecutableToolResult(result);
    },
  };
}

function normalizeMindosExecutableToolResult(result: unknown): {
  content: Array<{ type: string; text?: string }>;
} {
  if (isRecord(result) && Array.isArray(result.content)) {
    return {
      content: result.content
        .filter(isRecord)
        .map((part) => ({
          type: typeof part.type === 'string' ? part.type : 'text',
          ...(typeof part.text === 'string' ? { text: part.text } : {}),
        })),
    };
  }
  if (typeof result === 'string') return { content: [{ type: 'text', text: result }] };
  if (result == null) return { content: [] };
  return { content: [{ type: 'text', text: stringifyMindosToolResult(result) }] };
}

function stringifyMindosToolResult(result: unknown): string {
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
