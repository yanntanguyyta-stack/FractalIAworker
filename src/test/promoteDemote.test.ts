import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

beforeEach(() => {
  useStore.setState({
    tree: [],
    activeNodeId: null,
    selectedNodeIds: new Set(),
    lastSelectedNodeId: null,
    recentlyMovedNodeId: null,
    markdown: '',
    history: [],
    future: [],
  } as any);
});

function findNode(tree: any[], heading: string): any {
  for (const n of tree) {
    if (n.heading === heading) return n;
    const found = findNode(n.children, heading);
    if (found) return found;
  }
  return null;
}

function flatHeadings(tree: any[]): string[] {
  const out: string[] = [];
  function walk(nodes: any[]) {
    for (const n of nodes) {
      out.push(`H${n.headingDepth}:${n.heading}`);
      walk(n.children);
    }
  }
  walk(tree);
  return out;
}

describe('promote/demote — doc-order preserving semantics', () => {
  it('promoting H3 → H2 does NOT change document order', () => {
    useStore.getState().loadMarkdown(`# Projet

## Section 1

### A

### B

## Section 2
`);
    const before = flatHeadings(useStore.getState().tree);
    expect(before).toEqual([
      'H1:Projet', 'H2:Section 1', 'H3:A', 'H3:B', 'H2:Section 2',
    ]);

    const a = findNode(useStore.getState().tree, 'A');
    useStore.getState().promoteNode(a.id, true);

    const after = flatHeadings(useStore.getState().tree);
    // A becomes H2, in the SAME doc position. B is still after A and at H3,
    // so naturally becomes A's child.
    expect(after).toEqual([
      'H1:Projet', 'H2:Section 1', 'H2:A', 'H3:B', 'H2:Section 2',
    ]);
  });

  it('promoting a node never moves it down or up in the document', () => {
    useStore.getState().loadMarkdown(`# A

## B

### C

### D

## E
`);
    const c = findNode(useStore.getState().tree, 'C');
    useStore.getState().promoteNode(c.id, true);

    expect(flatHeadings(useStore.getState().tree)).toEqual([
      'H1:A', 'H2:B', 'H2:C', 'H3:D', 'H2:E',
    ]);
  });

  it('demote turns a node into a child of the preceding sibling naturally', () => {
    useStore.getState().loadMarkdown(`# A

## B

## C
`);
    const c = findNode(useStore.getState().tree, 'C');
    useStore.getState().demoteNode(c.id, true);

    const after = flatHeadings(useStore.getState().tree);
    expect(after).toEqual(['H1:A', 'H2:B', 'H3:C']);
  });

  it('bulk promoteNodes: 2 nodes, single history entry', () => {
    useStore.getState().loadMarkdown(`# A

## B

### C

### D

### E
`);
    const c = findNode(useStore.getState().tree, 'C');
    const e = findNode(useStore.getState().tree, 'E');

    const histLenBefore = (useStore.getState() as any).history.length;
    const res = useStore.getState().promoteNodes([c.id, e.id], true);
    expect(res.ok).toBe(2);

    const after = flatHeadings(useStore.getState().tree);
    expect(after).toEqual(['H1:A', 'H2:B', 'H2:C', 'H3:D', 'H2:E']);

    const histLenAfter = (useStore.getState() as any).history.length;
    expect(histLenAfter).toBe(histLenBefore + 1);

    // Single undo should restore everything
    useStore.getState().undo();
    expect(flatHeadings(useStore.getState().tree)).toEqual(
      ['H1:A', 'H2:B', 'H3:C', 'H3:D', 'H3:E']
    );
  });

  it('bulk promote skips H1 nodes that cannot go higher', () => {
    useStore.getState().loadMarkdown(`# A

## B
`);
    const a = findNode(useStore.getState().tree, 'A');
    const b = findNode(useStore.getState().tree, 'B');

    const res = useStore.getState().promoteNodes([a.id, b.id], true);
    expect(res.ok).toBe(1);
    expect(res.skipped).toBe(1);

    expect(flatHeadings(useStore.getState().tree)).toEqual(['H1:A', 'H1:B']);
  });

  it('recentlyMovedNodeId is set after promote (for highlight/scroll)', () => {
    useStore.getState().loadMarkdown(`# A\n\n## B\n\n### C`);
    const c = findNode(useStore.getState().tree, 'C');
    useStore.getState().promoteNode(c.id, true);
    expect((useStore.getState() as any).recentlyMovedNodeId).toBe(c.id);
  });

  it('selection helpers: toggleNodeSelection adds/removes', () => {
    useStore.getState().loadMarkdown('# A\n\n## B');
    const b = findNode(useStore.getState().tree, 'B');
    useStore.getState().toggleNodeSelection(b.id);
    expect((useStore.getState() as any).selectedNodeIds.has(b.id)).toBe(true);
    useStore.getState().toggleNodeSelection(b.id);
    expect((useStore.getState() as any).selectedNodeIds.has(b.id)).toBe(false);
  });

  it('selection helpers: selectRangeTo selects contiguous doc range', () => {
    useStore.getState().loadMarkdown(`# A

## B

## C

## D
`);
    const t = useStore.getState().tree;
    const b = findNode(t, 'B');
    const d = findNode(t, 'D');
    useStore.getState().toggleNodeSelection(b.id);
    useStore.getState().selectRangeTo(d.id);
    const sel = (useStore.getState() as any).selectedNodeIds as Set<string>;
    expect(sel.size).toBe(3); // B, C, D
  });

  it('deleteNodes removes multiple in one history step', () => {
    useStore.getState().loadMarkdown(`# A

## B

## C

## D
`);
    const t = useStore.getState().tree;
    const b = findNode(t, 'B');
    const d = findNode(t, 'D');
    const removed = useStore.getState().deleteNodes([b.id, d.id]);
    expect(removed).toBe(2);
    expect(flatHeadings(useStore.getState().tree)).toEqual(['H1:A', 'H2:C']);
  });
});
