declare module '@earendil-works/pi-coding-agent' {
  import type { AgentToolResult } from '@earendil-works/pi-agent-core';
  import type { TSchema } from '@sinclair/typebox';

  export interface SkillSummary {
    name: string;
  }

  export function loadSkills(options: {
    cwd: string;
    agentDir: string;
    skillPaths: string[];
    includeDefaults?: boolean;
  }): { skills: SkillSummary[] };

  export interface ToolDefinition<TParameters extends TSchema = TSchema, TDetails = unknown> {
    name: string;
    label?: string;
    description?: string;
    promptSnippet?: string;
    parameters: TParameters;
    execute: (
      toolCallId: string,
      params: unknown,
      signal?: AbortSignal,
      onUpdate?: unknown,
    ) => Promise<AgentToolResult<TDetails>> | AgentToolResult<TDetails>;
  }

  export interface ExtensionAPI {
    registerTool(tool: ToolDefinition): void;
    registerCommand(command: string, definition: {
      description?: string;
      handler: (args: string, ctx: { ui: { notify(message: string, level?: string): void } }) => void | Promise<void>;
    }): void;
  }

  export class SettingsManager {
    static inMemory(settings?: unknown): SettingsManager;
  }

  export interface LoadedExtension {
    path: string;
    resolvedPath?: string;
    tools: Map<string, unknown>;
    commands: Map<string, unknown>;
  }

  export class DefaultResourceLoader {
    constructor(options: {
      cwd: string;
      agentDir: string;
      settingsManager: SettingsManager;
      systemPrompt: string;
      appendSystemPrompt: string[];
      additionalSkillPaths: string[];
      additionalExtensionPaths: string[];
    });
    reload(): Promise<void>;
    getExtensions(): { extensions: LoadedExtension[] };
  }

  export class SessionManager {
    static inMemory(cwd: string): SessionManager;
    static continueRecent(cwd: string, sessionDir: string): SessionManager;
    static create(cwd: string, sessionDir: string): SessionManager;
  }
}
