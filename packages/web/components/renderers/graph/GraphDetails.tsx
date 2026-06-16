'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import type { GraphData, GraphNode } from '@/app/api/graph/route';

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
    <aside
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        padding: 14,
        minHeight: 180,
        color: 'var(--foreground)',
        overflow: 'hidden',
      }}
    >
      {node ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="font-display" style={{ fontSize: 14, lineHeight: 1.25, marginBottom: 5 }}>
                {node.label}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={node.path}
              >
                {node.path}
              </div>
            </div>
            {!node.isMissing ? (
              <button
                type="button"
                onClick={() => onOpenNode(node)}
                aria-label="Open note"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  flex: '0 0 auto',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="In" value={node.inDegree} />
            <Metric label="Out" value={node.outDegree} />
            <Metric label="Words" value={node.wordCount} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {node.isMissing ? <Badge label="Missing" /> : null}
            {node.isAmbiguous ? <Badge label="Ambiguous" /> : null}
            {node.tags.slice(0, 4).map((tag) => <Badge key={tag} label={`#${tag}`} />)}
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
                    className="font-display"
                    style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: 8,
                      fontSize: 10.5,
                      color: 'var(--muted-foreground)',
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ color: 'var(--foreground)' }} title={peer}>
                      {edge.source === node.id ? 'to' : 'from'} {formatPathLabel(peer)}
                      {edge.count > 1 ? ` (${edge.count})` : ''}
                    </div>
                    {subpath ? <div style={{ marginTop: 3 }}>{subpath}</div> : null}
                    {candidates ? <div style={{ marginTop: 3 }}>candidates: {candidates}</div> : null}
                    {edge.snippets[0] ? <div style={{ marginTop: 4 }}>{edge.snippets[0]}</div> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <span className="font-display" style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
          Select a point to inspect links.
        </span>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="font-display"
      style={{
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--background)',
        padding: '7px 8px',
      }}
    >
      <div style={{ color: 'var(--muted-foreground)', fontSize: 9, marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--foreground)', fontSize: 13 }}>{value}</div>
    </div>
  );
}

function formatPathLabel(path: string): string {
  const fileName = path.split('/').pop() || path;
  return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
}

function Badge({ label }: { label: string }) {
  return (
    <span
      className="font-display"
      style={{
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--background)',
        color: 'var(--muted-foreground)',
        padding: '3px 7px',
        fontSize: 10,
      }}
    >
      {label}
    </span>
  );
}
