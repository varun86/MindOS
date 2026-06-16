import type { GraphData, GraphDirection, GraphScope } from '@/app/api/graph/route';

export type Depth = 1 | 2;

export interface Pos {
  x: number;
  y: number;
}

export interface WikiNodeData {
  id: string;
  label: string;
  path: string;
  isCurrent: boolean;
  isMissing: boolean;
  isAmbiguous: boolean;
  dimmed: boolean;
  matched: boolean;
  selected: boolean;
  hovered: boolean;
  degree: number;
  inDegree: number;
  outDegree: number;
  [key: string]: unknown;
}

export type {
  GraphData,
  GraphDirection,
  GraphScope,
};
