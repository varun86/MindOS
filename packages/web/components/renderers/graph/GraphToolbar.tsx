'use client';

import { Search } from 'lucide-react';
import type { GraphDirection, GraphScope, GraphData, Depth } from './graph-types';

interface GraphToolbarProps {
  scope: GraphScope;
  depth: Depth;
  direction: GraphDirection;
  includeUnresolved: boolean;
  searchTerm: string;
  stats: GraphData['stats'];
  onScopeChange: (value: GraphScope) => void;
  onDepthChange: (value: Depth) => void;
  onDirectionChange: (value: GraphDirection) => void;
  onIncludeUnresolvedChange: (value: boolean) => void;
  onSearchTermChange: (value: string) => void;
}

export function GraphToolbar({
  scope,
  depth,
  direction,
  includeUnresolved,
  searchTerm,
  stats,
  onScopeChange,
  onDepthChange,
  onDirectionChange,
  onIncludeUnresolvedChange,
  onSearchTermChange,
}: GraphToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={scope}
          options={[
            { id: 'local', label: 'Local' },
            { id: 'global', label: 'Global' },
          ]}
          onChange={(value) => onScopeChange(value as GraphScope)}
        />

        {scope === 'local' ? (
          <>
            <SegmentedControl
              value={String(depth)}
              options={[
                { id: '1', label: '1 hop' },
                { id: '2', label: '2 hops' },
              ]}
              onChange={(value) => onDepthChange(value === '2' ? 2 : 1)}
            />
            <SegmentedControl
              value={direction}
              options={[
                { id: 'both', label: 'Both' },
                { id: 'incoming', label: 'In' },
                { id: 'outgoing', label: 'Out' },
              ]}
              onChange={(value) => onDirectionChange(value as GraphDirection)}
            />
          </>
        ) : null}

        <button
          type="button"
          onClick={() => onIncludeUnresolvedChange(!includeUnresolved)}
          className="font-display"
          style={{
            height: 28,
            padding: '0 10px',
            borderRadius: 999,
            border: `1px solid ${includeUnresolved ? 'var(--amber)' : 'var(--border)'}`,
            background: includeUnresolved ? 'var(--amber-dim)' : 'var(--card)',
            color: includeUnresolved ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Missing
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className="font-display"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 30,
            padding: '0 10px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--muted-foreground)',
            fontSize: 11,
          }}
        >
          <Search size={13} aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search"
            style={{
              width: 130,
              border: 'none',
              background: 'transparent',
              color: 'var(--foreground)',
              outline: 'none',
              fontSize: 11,
            }}
          />
        </label>
        <span className="font-display" style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>
          {stats.nodeCount} nodes / {stats.edgeCount} edges
          {stats.unresolvedCount ? ` / ${stats.unresolvedCount} missing` : ''}
        </span>
      </div>
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: 'var(--muted)',
      }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className="font-display"
          style={{
            height: 22,
            padding: '0 9px',
            borderRadius: 999,
            fontSize: 11,
            cursor: 'pointer',
            border: 'none',
            outline: 'none',
            background: value === option.id ? 'var(--card)' : 'transparent',
            color: value === option.id ? 'var(--foreground)' : 'var(--muted-foreground)',
            boxShadow: value === option.id
              ? '0 1px 4px color-mix(in srgb, var(--foreground) 10%, transparent)'
              : 'none',
            transition: 'background 0.12s ease, color 0.12s ease',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
