import { describe, expect, it } from 'vitest';
import type { GraphData, GraphNode } from '@/app/api/graph/route';
import { buildStableLayout, CENTER } from '@/components/renderers/graph/graph-layout';

function node(id: string, degree = 1): GraphNode {
  return {
    id,
    path: id,
    label: id.replace(/\.md$/, ''),
    folder: '.',
    type: 'note',
    tags: [],
    wordCount: 10,
    inDegree: 0,
    outDegree: 0,
    degree,
    isMissing: false,
    isAmbiguous: false,
  };
}

function edge(source: string, target: string): GraphData['edges'][number] {
  return {
    id: `${source}\0${target}`,
    source,
    target,
    kind: 'wiki',
    count: 1,
    snippets: [],
    unresolved: false,
    ambiguous: false,
    candidates: [],
    subpaths: [],
  };
}

describe('graph layout', () => {
  it('places the current local note between incoming and outgoing neighbors', () => {
    const layout = buildStableLayout(
      [node('A.md'), node('B.md'), node('C.md')],
      [edge('B.md', 'A.md'), edge('A.md', 'C.md')],
      'A.md',
      'local',
      'both',
    );

    expect(layout['A.md']).toEqual(CENTER);
    expect(layout['B.md']?.x).toBeLessThan(CENTER.x);
    expect(layout['C.md']?.x).toBeGreaterThan(CENTER.x);
  });

  it('keeps global layout deterministic for the same node set', () => {
    const nodes = [node('A.md', 2), node('B.md', 1), node('C.md', 3)];
    expect(buildStableLayout(nodes, [], 'A.md', 'global', 'both')).toEqual(
      buildStableLayout([...nodes].reverse(), [], 'A.md', 'global', 'both'),
    );
  });
});
