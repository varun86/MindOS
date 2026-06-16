import type { GraphData, GraphDirection, GraphNode, GraphScope } from '@/app/api/graph/route';
import type { Pos } from './graph-types';

export const GRAPH_WIDTH = 1040;
export const GRAPH_HEIGHT = 680;
export const CENTER: Pos = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };

export function buildStableLayout(
  nodes: GraphNode[],
  edges: GraphData['edges'],
  currentPath: string,
  scope: GraphScope,
  direction: GraphDirection,
): Record<string, Pos> {
  if (scope === 'global') return buildGlobalLayout(nodes);

  const directIncoming = new Set(edges.filter((edge) => edge.target === currentPath).map((edge) => edge.source));
  const directOutgoing = new Set(edges.filter((edge) => edge.source === currentPath).map((edge) => edge.target));
  const layout: Record<string, Pos> = { [currentPath]: CENTER };
  const current = nodes.find((node) => node.id === currentPath);
  if (current && !layout[current.id]) layout[current.id] = CENTER;

  const incoming = nodes.filter((node) => directIncoming.has(node.id)).sort(compareGraphNodes);
  const outgoing = nodes.filter((node) => directOutgoing.has(node.id)).sort(compareGraphNodes);
  const placed = new Set<string>([currentPath, ...incoming.map((node) => node.id), ...outgoing.map((node) => node.id)]);

  if (direction !== 'outgoing') placeColumn(layout, incoming, CENTER.x - 310, CENTER.y);
  if (direction !== 'incoming') placeColumn(layout, outgoing, CENTER.x + 310, CENTER.y);
  if (direction === 'incoming') placeColumn(layout, incoming, CENTER.x - 260, CENTER.y);
  if (direction === 'outgoing') placeColumn(layout, outgoing, CENTER.x + 260, CENTER.y);

  const secondary = nodes.filter((node) => !placed.has(node.id)).sort(compareGraphNodes);
  placeRing(layout, secondary, CENTER, 300);
  return layout;
}
function buildGlobalLayout(nodes: GraphNode[]): Record<string, Pos> {
  const sorted = [...nodes].sort(compareGraphNodes);
  const layout: Record<string, Pos> = {};
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  sorted.forEach((node, index) => {
    const radius = 78 + Math.sqrt(index + 1) * 44;
    const angle = index * goldenAngle + (stableHash(node.id) % 360) * (Math.PI / 180) * 0.03;
    layout[node.id] = {
      x: CENTER.x + Math.cos(angle) * radius,
      y: CENTER.y + Math.sin(angle) * radius,
    };
  });
  return layout;
}

function placeColumn(layout: Record<string, Pos>, nodes: GraphNode[], x: number, centerY: number): void {
  if (!nodes.length) return;
  const gap = Math.max(58, Math.min(88, 420 / Math.max(nodes.length - 1, 1)));
  const startY = centerY - ((nodes.length - 1) * gap) / 2;
  nodes.forEach((node, index) => {
    layout[node.id] = { x, y: startY + index * gap };
  });
}

function placeRing(layout: Record<string, Pos>, nodes: GraphNode[], center: Pos, radius: number): void {
  if (!nodes.length) return;
  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    layout[node.id] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
}

function compareGraphNodes(a: GraphNode, b: GraphNode): number {
  return b.degree - a.degree || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
