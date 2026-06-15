'use client';

import { useCallback } from 'react';
import { Cpu, Gauge, ShieldCheck } from 'lucide-react';
import type {
  AgentRuntimeKind,
  NativeRuntimeEffort,
  NativeRuntimeOptions,
  NativeRuntimePermissionMode,
} from '@/lib/types';
import { useLocale } from '@/lib/stores/locale-store';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'mindos-native-runtime-options.v1';
const EFFORT_OPTIONS: NativeRuntimeEffort[] = ['low', 'medium', 'high', 'xhigh'];

function storageKey(runtimeKind: AgentRuntimeKind): string {
  return `${STORAGE_PREFIX}:${runtimeKind}`;
}

function normalizePermissionMode(value: unknown): NativeRuntimePermissionMode | undefined {
  return value === 'readonly' || value === 'agent' ? value : undefined;
}

function normalizeEffort(value: unknown): NativeRuntimeEffort | undefined {
  return EFFORT_OPTIONS.includes(value as NativeRuntimeEffort) ? value as NativeRuntimeEffort : undefined;
}

export function getPersistedNativeRuntimeOptions(runtimeKind: AgentRuntimeKind): NativeRuntimeOptions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(runtimeKind));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const modelOverride = typeof parsed.modelOverride === 'string' ? parsed.modelOverride : undefined;
    const reasoningEffort = normalizeEffort(parsed.reasoningEffort);
    const permissionMode = normalizePermissionMode(parsed.permissionMode);
    return {
      ...(modelOverride ? { modelOverride } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(permissionMode ? { permissionMode } : {}),
    };
  } catch {
    return {};
  }
}

export function persistNativeRuntimeOptions(runtimeKind: AgentRuntimeKind, value: NativeRuntimeOptions): void {
  if (typeof window === 'undefined') return;
  const compact = {
    ...(value.modelOverride?.trim() ? { modelOverride: value.modelOverride.trim() } : {}),
    ...(value.reasoningEffort ? { reasoningEffort: value.reasoningEffort } : {}),
    ...(value.permissionMode ? { permissionMode: value.permissionMode } : {}),
  };
  try {
    if (Object.keys(compact).length === 0) {
      localStorage.removeItem(storageKey(runtimeKind));
    } else {
      localStorage.setItem(storageKey(runtimeKind), JSON.stringify(compact));
    }
  } catch {
    // Private mode / quota: the current turn still uses the in-memory value.
  }
}

interface NativeRuntimeOptionsCapsuleProps {
  runtimeKind: Extract<AgentRuntimeKind, 'codex' | 'claude'>;
  value: NativeRuntimeOptions;
  defaultPermissionMode: NativeRuntimePermissionMode;
  onChange: (value: NativeRuntimeOptions) => void;
  disabled?: boolean;
}

export default function NativeRuntimeOptionsCapsule({
  runtimeKind,
  value,
  defaultPermissionMode,
  onChange,
  disabled = false,
}: NativeRuntimeOptionsCapsuleProps) {
  const { locale } = useLocale();
  const zh = locale === 'zh';
  const permissionMode = value.permissionMode ?? defaultPermissionMode;
  const effort = value.reasoningEffort ?? 'medium';

  const commit = useCallback((next: NativeRuntimeOptions) => {
    onChange(next);
  }, [onChange]);

  const setPermission = useCallback((next: NativeRuntimePermissionMode) => {
    commit({ ...value, permissionMode: next });
  }, [commit, value]);

  const setEffort = useCallback((next: NativeRuntimeEffort) => {
    commit({ ...value, reasoningEffort: next });
  }, [commit, value]);

  const setModel = useCallback((next: string) => {
    commit({ ...value, modelOverride: next });
  }, [commit, value]);

  const label = {
    model: zh ? '模型' : 'Model',
    effort: zh ? '强度' : 'Effort',
    permission: zh ? '权限' : 'Permission',
    placeholder: runtimeKind === 'codex' ? 'gpt-5.4-codex' : 'sonnet',
    readonly: zh ? '只读' : 'Read',
    agent: zh ? 'Agent' : 'Agent',
  };

  return (
    <div
      data-native-runtime-options
      data-runtime-kind={runtimeKind}
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      <label
        className={cn(
          'hit-target-box relative z-10 inline-flex min-h-6 items-center gap-1.5 px-2 py-0.5',
          'border border-transparent text-2xs text-muted-foreground transition-colors',
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
          '[--hit-target-bg:color-mix(in_srgb,var(--muted)_50%,transparent)]',
          '[--hit-target-border:color-mix(in_srgb,var(--border)_50%,transparent)]',
          '[--hit-target-hover-bg:var(--muted)] [--hit-target-radius:9999px]',
        )}
      >
        <Cpu size={11} className="shrink-0" aria-hidden="true" />
        <span className="font-medium">{label.model}</span>
        <input
          value={value.modelOverride ?? ''}
          disabled={disabled}
          onChange={(event) => setModel(event.target.value)}
          onBlur={(event) => {
            const trimmed = event.target.value.trim();
            if (trimmed !== event.target.value) setModel(trimmed);
          }}
          placeholder={label.placeholder}
          aria-label={label.model}
          className="w-[7.5rem] min-w-0 bg-transparent text-2xs text-foreground placeholder:text-muted-foreground/50 outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <label
        className={cn(
          'hit-target-box relative z-10 inline-flex min-h-6 items-center gap-1 px-2 py-0.5',
          'border border-transparent text-2xs text-muted-foreground transition-colors',
          '[--hit-target-bg:color-mix(in_srgb,var(--muted)_50%,transparent)]',
          '[--hit-target-border:color-mix(in_srgb,var(--border)_50%,transparent)]',
          '[--hit-target-hover-bg:var(--muted)] [--hit-target-radius:9999px]',
        )}
      >
        <Gauge size={11} className="shrink-0" aria-hidden="true" />
        <span className="font-medium">{label.effort}</span>
        <select
          value={effort}
          disabled={disabled}
          aria-label={label.effort}
          onChange={(event) => setEffort(event.target.value as NativeRuntimeEffort)}
          className="bg-transparent text-2xs text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {EFFORT_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <div
        className={cn(
          'hit-target-box relative z-10 inline-flex min-h-6 items-center gap-1 px-1 py-0.5',
          'border border-transparent text-2xs transition-colors',
          '[--hit-target-bg:color-mix(in_srgb,var(--muted)_50%,transparent)]',
          '[--hit-target-border:color-mix(in_srgb,var(--border)_50%,transparent)]',
          '[--hit-target-hover-bg:var(--muted)] [--hit-target-radius:9999px]',
        )}
        role="group"
        aria-label={label.permission}
      >
        <ShieldCheck size={11} className="ml-1 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium text-muted-foreground">{label.permission}</span>
        {(['readonly', 'agent'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            data-hit-active={permissionMode === mode ? 'true' : undefined}
            onClick={() => setPermission(mode)}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              permissionMode === mode
                ? 'bg-[var(--amber)]/10 text-[var(--amber)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {mode === 'readonly' ? label.readonly : label.agent}
          </button>
        ))}
      </div>
    </div>
  );
}
