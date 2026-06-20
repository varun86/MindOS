'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import type { GraphData, GraphNode } from '@/app/api/graph/route';
import {
  RendererBadge,
  RendererIconButton,
  RendererMetric,
  RendererPanel,
} from '../renderer-primitives';

interface GraphDetailsProps {
  node: GraphNode | null;
  data: GraphData;
  onOpenNode: (node: GraphNode) => void;
}

export function GraphDetails({ node, data, onOpenNode }: GraphDetailsProps) {
  const relatedEdges = useMemo(() => {
    if (!node) return [];
    return data.edges.filter((edge) => edge.source === node.id || edge.target === node.id).slice(0, 6);
  }, [data.edges, node]);

  return (
    <RendererPanel className="min-h-[180px] p-3.5" as="aside">
      {node ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display mb-1 text-sm leading-tight">
                {node.label}
              </div>
              <div
                className="truncate font-mono text-[10px] text-muted-foreground"
                title={node.path}
              >
                {node.path}
              </div>
            </div>
            {!node.isMissing ? (
              <RendererIconButton
                onClick={() => onOpenNode(node)}
                label="Open note"
              >
                <ExternalLink size={14} aria-hidden="true" />
              </RendererIconButton>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <RendererMetric label="In" value={node.inDegree} />
            <RendererMetric label="Out" value={node.outDegree} />
            <RendererMetric label="Words" value={node.wordCount} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {node.isMissing ? <RendererBadge>Missing</RendererBadge> : null}
            {node.isAmbiguous ? <RendererBadge tone="amber">Ambiguous</RendererBadge> : null}
            {node.tags.slice(0, 4).map((tag) => <RendererBadge key={tag}>#{tag}</RendererBadge>)}
          </div>

          {relatedEdges.length ? (
            <div className="mt-4 grid gap-2">
              {relatedEdges.map((edge) => {
                const peer = edge.source === node.id ? edge.target : edge.source;
                const candidates = edge.ambiguous && edge.candidates.length
                  ? edge.candidates.join(', ')
                  : null;
                const subpath = edge.subpaths[0]
                  ? `${edge.subpaths[0].type}: ${edge.subpaths[0].value}`
                  : null;
                return (
                  <div
                    key={edge.id}
                    className="font-display border-t border-border pt-2 text-[10.5px] leading-snug text-muted-foreground"
                  >
                    <div className="text-foreground" title={peer}>
                      {edge.source === node.id ? 'to' : 'from'} {formatPathLabel(peer)}
                      {edge.count > 1 ? ` (${edge.count})` : ''}
                    </div>
                    {subpath ? <div className="mt-1">{subpath}</div> : null}
                    {candidates ? <div className="mt-1">candidates: {candidates}</div> : null}
                    {edge.snippets[0] ? <div className="mt-1">{edge.snippets[0]}</div> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <span className="font-display text-xs text-muted-foreground">
          Select a point to inspect links.
        </span>
      )}
    </RendererPanel>
  );
}

function formatPathLabel(path: string): string {
  const fileName = path.split('/').pop() || path;
  return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
}
