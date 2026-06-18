'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';
import { FolderOpen } from 'lucide-react';
import { getDesktopBridge } from '@/lib/desktop-bridge';
import { cn } from '@/lib/utils';

function getParentDir(value: string): string {
  if (!value.trim()) return '';
  const trimmed = value.trim();
  if (trimmed.endsWith('/') || trimmed.endsWith('\\')) return trimmed;
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSlash >= 0 ? trimmed.slice(0, lastSlash + 1) : '';
}

function subscribeDesktopBridge() {
  return () => {};
}

function getCanBrowseDirectorySnapshot() {
  return Boolean(getDesktopBridge()?.selectDirectory);
}

function getServerCanBrowseDirectorySnapshot() {
  return false;
}

export interface PathAutocompleteFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  homeDir?: string;
  browseLabel?: string;
  browseUnavailableLabel?: string;
  commitOnSelect?: boolean;
  onCommit?: (value: string) => void;
  wrapperClassName?: string;
  inputClassName?: string;
  browseButtonClassName?: string;
  suggestionsClassName?: string;
  suggestionClassName?: string;
}

export default function PathAutocompleteField({
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  homeDir = '~',
  browseLabel = 'Browse...',
  browseUnavailableLabel = 'Folder picker is available in the desktop app',
  commitOnSelect = false,
  onCommit,
  wrapperClassName,
  inputClassName,
  browseButtonClassName,
  suggestionsClassName,
  suggestionClassName,
}: PathAutocompleteFieldProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);
  const trimmedValue = value.trim();
  const canBrowseDirectory = useSyncExternalStore(
    subscribeDesktopBridge,
    getCanBrowseDirectorySnapshot,
    getServerCanBrowseDirectorySnapshot,
  );

  const hideSuggestions = useCallback(() => {
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  }, []);

  const commit = (nextValue = value) => {
    onCommit?.(nextValue);
  };

  const selectSuggestion = (nextValue: string) => {
    justSelectedRef.current = true;
    onChange(nextValue);
    hideSuggestions();
    inputRef.current?.focus();
    if (commitOnSelect) commit(nextValue);
  };

  useEffect(() => {
    if (disabled) {
      return;
    }
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const typed = value.trim();
    if (!typed) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      const parent = getParentDir(typed) || homeDir;
      fetch('/api/setup/ls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: parent }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.dirs?.length) {
            setSuggestions([]);
            return;
          }
          const endsWithSep = parent.endsWith('/') || parent.endsWith('\\');
          const localSep = parent.includes('\\') ? '\\' : '/';
          const parentNorm = endsWithSep ? parent : parent + localSep;
          const full = (data.dirs as string[]).map((dir) => parentNorm + dir);
          const endsWithAnySep = typed.endsWith('/') || typed.endsWith('\\');
          const filtered = endsWithAnySep ? full : full.filter((candidate) => candidate.startsWith(typed));
          setSuggestions(filtered.slice(0, 20));
          setShowSuggestions(filtered.length > 0);
          setActiveSuggestion(-1);
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn('[PathAutocompleteField] autocomplete fetch failed:', error);
          setSuggestions([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [disabled, homeDir, value]);

  const browseDirectory = async () => {
    try {
      const selectedDir = await getDesktopBridge()?.selectDirectory?.();
      if (!selectedDir) return;
      justSelectedRef.current = true;
      onChange(selectedDir);
      hideSuggestions();
      inputRef.current?.focus();
      if (commitOnSelect) commit(selectedDir);
    } catch (error) {
      console.warn('[PathAutocompleteField] directory picker failed:', error);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestion((index) => Math.min(index + 1, suggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSuggestion((index) => Math.max(index - 1, -1));
        return;
      }
      if (event.key === 'Enter' && activeSuggestion >= 0) {
        event.preventDefault();
        selectSuggestion(suggestions[activeSuggestion]);
        return;
      }
      if (event.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commit(value);
    }
  };

  return (
    <div className={cn('relative', wrapperClassName)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!justSelectedRef.current) commit(value);
          setTimeout(() => hideSuggestions(), 150);
        }}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          'w-full rounded-lg border border-border bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
          inputClassName,
        )}
      />
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={browseDirectory}
        disabled={disabled || !canBrowseDirectory}
        className={cn(
          'absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
          browseButtonClassName,
        )}
        title={canBrowseDirectory ? browseLabel : browseUnavailableLabel}
        aria-label={browseLabel}
      >
        <FolderOpen size={16} />
      </button>

      {showSuggestions && !disabled && Boolean(trimmedValue) && suggestions.length > 0 && (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-[220px] overflow-auto rounded-lg border border-border bg-card shadow-lg',
            suggestionsClassName,
          )}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
              className={cn(
                'w-full px-3 py-2 text-left font-mono text-sm text-foreground transition-colors',
                index === activeSuggestion ? 'bg-muted' : 'bg-transparent',
                index > 0 && 'border-t border-border',
                suggestionClassName,
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
