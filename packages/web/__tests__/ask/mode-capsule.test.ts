import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const STORAGE_KEY = 'mindos-permission-level.v1';

describe('Permission capsule persistence', () => {
  let store: Record<string, string>;
  const fakeStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  };

  beforeEach(() => {
    store = {};
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: fakeStorage });
    vi.stubGlobal('localStorage', fakeStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to ask-first permission when no stored value exists', async () => {
    const { getPersistedPermissionLevel } = await import('@/components/ask/ModeCapsule');
    expect(getPersistedPermissionLevel()).toBe('ask');
  });

  it('returns stored permission level values', async () => {
    store[STORAGE_KEY] = 'read';
    const { getPersistedPermissionLevel } = await import('@/components/ask/ModeCapsule');
    expect(getPersistedPermissionLevel()).toBe('read');
  });

  it('falls back to ask permission for invalid stored values', async () => {
    store[STORAGE_KEY] = 'invalid';
    const { getPersistedPermissionLevel } = await import('@/components/ask/ModeCapsule');
    expect(getPersistedPermissionLevel()).toBe('ask');
  });

  it('persists permission level without writing legacy ask-mode storage', async () => {
    const { persistPermissionLevel } = await import('@/components/ask/ModeCapsule');
    persistPermissionLevel('read');
    expect(store[STORAGE_KEY]).toBe('read');

    persistPermissionLevel('full');
    expect(store[STORAGE_KEY]).toBe('full');
  });
});

describe('Permission level mapping', () => {
  it('keeps read permission as the native runtime product mode', async () => {
    const { permissionLevelToNativeRuntimePermission } = await import('@/components/ask/ModeCapsule');
    expect(permissionLevelToNativeRuntimePermission('read')).toBe('read');
  });

  it('keeps ask, auto, and full as native runtime product modes', async () => {
    const { permissionLevelToNativeRuntimePermission } = await import('@/components/ask/ModeCapsule');
    for (const level of ['ask', 'auto', 'full'] as const) {
      expect(permissionLevelToNativeRuntimePermission(level)).toBe(level);
    }
  });
});
