'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Cpu, Gauge, RotateCcw } from 'lucide-react';
import AskOptionCapsule, { type AskOptionCapsuleOption } from '@/components/ask/AskOptionCapsule';
import type {
  AgentRuntimeKind,
  NativeRuntimeEffort,
  NativeRuntimeOptions,
} from '@/lib/types';

const STORAGE_PREFIX = 'mindos-native-runtime-options.v1';
const EFFORT_OPTIONS: NativeRuntimeEffort[] = ['low', 'medium', 'high', 'xhigh'];

function storageKey(runtimeKind: AgentRuntimeKind): string {
  return `${STORAGE_PREFIX}:${runtimeKind}`;
}

function normalizeEffort(value: unknown): NativeRuntimeEffort | undefined {
  return EFFORT_OPTIONS.includes(value as NativeRuntimeEffort) ? value as NativeRuntimeEffort : undefined;
}

function compactRuntimeOptions(value: NativeRuntimeOptions): NativeRuntimeOptions {
  return {
    ...(value.modelOverride?.trim() ? { modelOverride: value.modelOverride.trim() } : {}),
    ...(value.reasoningEffort ? { reasoningEffort: value.reasoningEffort } : {}),
  };
}

export function getPersistedNativeRuntimeOptions(runtimeKind: AgentRuntimeKind): NativeRuntimeOptions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(runtimeKind));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const modelOverride = typeof parsed.modelOverride === 'string' ? parsed.modelOverride : undefined;
    const reasoningEffort = normalizeEffort(parsed.reasoningEffort);
    return compactRuntimeOptions({
      ...(modelOverride ? { modelOverride } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
    });
  } catch {
    return {};
  }
}

export function persistNativeRuntimeOptions(runtimeKind: AgentRuntimeKind, value: NativeRuntimeOptions): void {
  if (typeof window === 'undefined') return;
  const compact = compactRuntimeOptions(value);
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
  onChange: (value: NativeRuntimeOptions) => void;
  disabled?: boolean;
}

function effortIcon(size = 11) {
  return <Gauge size={size} className="shrink-0" />;
}

function modelIcon(size = 11) {
  return <Cpu size={size} className="shrink-0" />;
}

export default function NativeRuntimeOptionsCapsule({
  runtimeKind,
  value,
  onChange,
  disabled = false,
}: NativeRuntimeOptionsCapsuleProps) {
  const effort = value.reasoningEffort ?? 'medium';
  const modelOverride = value.modelOverride ?? '';
  const [draftModel, setDraftModel] = useState(modelOverride);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultModelLabel = 'Default';
  const placeholder = runtimeKind === 'codex' ? 'gpt-5.4-codex' : 'sonnet';

  useEffect(() => {
    setDraftModel(modelOverride);
  }, [modelOverride]);

  const commit = useCallback((next: NativeRuntimeOptions) => {
    onChange(compactRuntimeOptions(next));
  }, [onChange]);

  const setEffort = useCallback((next: NativeRuntimeEffort) => {
    commit({ ...value, reasoningEffort: next });
  }, [commit, value]);

  const commitModel = useCallback((next: string) => {
    commit({ ...value, modelOverride: next });
  }, [commit, value]);

  const effortOptions: Array<AskOptionCapsuleOption<NativeRuntimeEffort>> = [
    { value: 'low', label: 'Low', description: 'Fastest responses for simple asks.', icon: effortIcon(13) },
    { value: 'medium', label: 'Medium', description: 'Balanced reasoning and speed.', icon: effortIcon(13) },
    { value: 'high', label: 'High', description: 'More reasoning for complex work.', icon: effortIcon(13) },
    { value: 'xhigh', label: 'X High', description: 'Maximum reasoning budget for hard tasks.', icon: effortIcon(13) },
  ];
  const selectedEffort = effortOptions.find((option) => option.value === effort) ?? effortOptions[1]!;
  const displayModel = modelOverride.trim() || defaultModelLabel;
  const shortModel = displayModel.length > 20 ? `${displayModel.slice(0, 18)}...` : displayModel;

  return (
    <div
      data-native-runtime-options
      data-runtime-kind={runtimeKind}
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      <AskOptionCapsule
        title="Model"
        ariaLabel="Model"
        icon={modelIcon()}
        label={shortModel}
        tooltip={modelOverride.trim() ? `Model: ${modelOverride.trim()}` : `Model: ${defaultModelLabel}`}
        active={Boolean(modelOverride.trim())}
        disabled={disabled}
        dropdownWidthClassName="min-w-[270px] max-w-[320px]"
      >
        {({ close }) => (
          <div className="px-3 py-2">
            <label className="block text-2xs font-medium text-muted-foreground" htmlFor={`native-model-${runtimeKind}`}>
              Override
            </label>
            <div className="mt-1 flex items-center gap-1.5 rounded-md border border-border/50 bg-background/65 px-2 py-1.5">
              <Cpu size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id={`native-model-${runtimeKind}`}
                ref={inputRef}
                value={draftModel}
                disabled={disabled}
                onChange={(event) => setDraftModel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitModel(draftModel);
                    close();
                  }
                }}
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/45 disabled:cursor-not-allowed disabled:opacity-50"
                autoComplete="off"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setDraftModel('');
                  commitModel('');
                  close();
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/45 bg-background px-2 text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={11} />
                {defaultModelLabel}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  commitModel(draftModel);
                  close();
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--amber)] bg-[var(--amber)] px-2 text-2xs font-medium text-[var(--amber-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={11} />
                Apply
              </button>
            </div>
          </div>
        )}
      </AskOptionCapsule>

      <AskOptionCapsule
        title="Effort"
        ariaLabel="Effort"
        icon={effortIcon()}
        label={selectedEffort.label}
        tooltip={selectedEffort.description}
        value={effort}
        options={effortOptions}
        onChange={setEffort}
        disabled={disabled}
        active={effort !== 'medium'}
        dropdownWidthClassName="min-w-[230px] max-w-[290px]"
      />
    </div>
  );
}
