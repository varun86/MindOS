'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WikiNodeData } from './graph-types';

export const WikiGraphNode = memo(function WikiGraphNode({ data }: NodeProps) {
  const node = data as WikiNodeData;
  const size = getNodeSize(node.degree, node.isCurrent);

  return (
    <div
      title={`${node.path} / ${node.inDegree} in / ${node.outDegree} out`}
      aria-label={node.label}
      className="font-display"
      style={{
        position: 'relative',
        width: size,
        height: size,
        opacity: node.dimmed ? 0.2 : node.isMissing ? 0.62 : 1,
        transition: 'opacity 0.16s ease, transform 0.16s ease',
        transform: node.selected || node.hovered ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 999,
          background: getNodeBackground(node),
          border: getNodeBorder(node),
          boxShadow: getNodeShadow(node),
        }}
      />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});

function getNodeSize(degree: number, isCurrent: boolean): number {
  const base = 10 + Math.min(10, Math.log2(Math.max(degree, 1) + 1) * 3);
  return Math.round(base + (isCurrent ? 4 : 0));
}

const GRAPH_SHADOW = 'color-mix(in srgb, var(--foreground) 14%, transparent)';

function getNodeBackground(node: WikiNodeData): string {
  if (node.isCurrent) return 'var(--amber)';
  if (node.isMissing) return 'var(--background)';
  if (node.isAmbiguous) return 'var(--muted)';
  if (node.matched) return 'var(--accent)';
  return 'var(--foreground)';
}

function getNodeBorder(node: WikiNodeData): string {
  if (node.isCurrent) return '2px solid var(--amber)';
  if (node.isMissing) return '1.5px dashed var(--muted-foreground)';
  if (node.isAmbiguous) return '1.5px solid var(--amber)';
  if (node.selected || node.hovered || node.matched) return '1.5px solid var(--amber)';
  return '1.5px solid var(--background)';
}

function getNodeShadow(node: WikiNodeData): string {
  if (node.isCurrent) return `0 0 0 5px var(--amber-dim), 0 14px 30px ${GRAPH_SHADOW}`;
  if (node.selected) return `0 0 0 4px var(--amber-dim), 0 10px 24px ${GRAPH_SHADOW}`;
  if (node.hovered || node.matched) return `0 0 0 3px var(--accent), 0 8px 18px ${GRAPH_SHADOW}`;
  return `0 2px 8px ${GRAPH_SHADOW}`;
}
