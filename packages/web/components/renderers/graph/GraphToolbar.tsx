'use client';

import type { GraphDirection, GraphScope, GraphData, Depth } from './graph-types';
import {
  RendererSearchField,
  RendererSegmentedControl,
  RendererTogglePill,
} from '../renderer-primitives';

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
        <RendererSegmentedControl
          value={scope}
          options={[
            { id: 'local', label: 'Local' },
            { id: 'global', label: 'Global' },
          ]}
          onChange={(value) => onScopeChange(value as GraphScope)}
        />

        {scope === 'local' ? (
          <>
            <RendererSegmentedControl
              value={String(depth)}
              options={[
                { id: '1', label: '1 hop' },
                { id: '2', label: '2 hops' },
              ]}
              onChange={(value) => onDepthChange(value === '2' ? 2 : 1)}
            />
            <RendererSegmentedControl
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

        <RendererTogglePill
          active={includeUnresolved}
          onClick={() => onIncludeUnresolvedChange(!includeUnresolved)}
        >
          Missing
        </RendererTogglePill>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <RendererSearchField value={searchTerm} onChange={onSearchTermChange} />
        <span className="font-display text-[11px] text-muted-foreground">
          {stats.nodeCount} nodes / {stats.edgeCount} edges
          {stats.unresolvedCount ? ` / ${stats.unresolvedCount} missing` : ''}
        </span>
      </div>
    </div>
  );
}
