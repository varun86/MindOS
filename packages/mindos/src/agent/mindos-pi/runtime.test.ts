import { describe, expect, it, vi } from 'vitest';

const piState = vi.hoisted(() => ({
  bashRoot: '',
}));

vi.mock('../../foundation/native-import.js', () => ({
  nativeImport: async () => ({
    createBashToolDefinition: (root: string) => {
      piState.bashRoot = root;
      return { name: 'bash' };
    },
    AuthStorage: {
      create: () => ({ setRuntimeApiKey: () => {} }),
    },
    ModelRegistry: {
      create: () => ({ registry: true }),
    },
    SettingsManager: {
      inMemory: (settings: unknown) => ({ settings }),
    },
    SessionManager: {
      inMemory: () => ({ appendMessage: () => {} }),
    },
    DefaultResourceLoader: class {
      async reload() {}
      getSkills() { return { skills: [] }; }
      getExtensions() { return { extensions: [], errors: [] }; }
    },
    createAgentSession: async () => ({
      session: {
        subscribe: () => {},
        prompt: async () => {},
        steer: async () => {},
        abort: async () => {},
      },
    }),
    convertToLlm: (messages: unknown[]) => messages,
  }),
}));

import { createMindosPiCodingAgentRuntime } from './runtime.js';

describe('MindOS Pi coding agent runtime', () => {
  it('creates the bash tool against the session workDir', async () => {
    await createMindosPiCodingAgentRuntime({
      messages: [{ role: 'user', content: 'hello', timestamp: 1 }],
      systemPrompt: 'prompt',
      projectRoot: '/repo',
      agentDir: '/home/test/.pi',
      mindRoot: '/mind',
      workDir: '/repo/app',
      agentConfig: {},
      serverSettings: {},
      allowProjectBash: true,
      hostServices: {
        resolveModelConfig: () => ({
          model: { id: 'model-object' },
          modelName: 'gpt-test',
          apiKey: 'key',
          provider: 'openai',
        }),
        toRuntimeProvider: (provider) => provider,
      },
    });

    expect(piState.bashRoot).toBe('/repo/app');
  });
});
