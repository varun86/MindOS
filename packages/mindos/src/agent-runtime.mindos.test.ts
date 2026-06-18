import { describe, expect, it } from 'vitest';
import {
  createMindosAgentRuntimeAdapter,
} from './agent-runtime/adapters/mindos.js';

describe('MindOS runtime adapter', () => {
  it('describes the internal MindOS runtime and delegates creation to the injected factory', async () => {
    const createdOptions: unknown[] = [];
    const fakeRuntime = { runtime: true };
    const adapter = createMindosAgentRuntimeAdapter({
      checkedAt: '2026-06-17T00:00:00.000Z',
      createRuntime: async (options) => {
        createdOptions.push(options);
        return fakeRuntime as never;
      },
    });

    expect(adapter).toMatchObject({
      id: 'mindos',
      name: 'MindOS',
      descriptor: {
        id: 'mindos',
        runtimeId: 'mindos',
        kind: 'mindos',
        adapter: 'mindos',
        modelOwner: 'mindos',
        authOwner: 'mindos',
        permissionOwner: 'mindos',
        sessionOwner: 'mindos',
        status: 'available',
        availability: { checkedAt: '2026-06-17T00:00:00.000Z', sources: ['settings'] },
      },
    });

    const options = { mode: 'agent' };
    await expect(adapter.createRuntime(options as never)).resolves.toBe(fakeRuntime);
    expect(createdOptions).toEqual([options]);
  });
});
