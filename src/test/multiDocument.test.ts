import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

beforeEach(() => {
  const defaultDocId = 'doc-default';
  useStore.setState({
    documents: [{ id: defaultDocId, name: 'Document', tree: [], markdown: '', history: [], future: [], contextDocIds: [] }],
    activeDocumentId: defaultDocId,
    tree: [],
    markdown: '',
    activeNodeId: null,
    selectedNodeIds: new Set(),
    lastSelectedNodeId: null,
    recentlyMovedNodeId: null,
    history: [],
    future: [],
  } as any);
});

describe('multi-document — store actions', () => {
  it('createDocument appends a new empty document and makes it active', () => {
    useStore.getState().createDocument('Personnages');

    const { documents, activeDocumentId, tree, markdown } = useStore.getState();
    expect(documents).toHaveLength(2);
    expect(documents[1].name).toBe('Personnages');
    expect(activeDocumentId).toBe(documents[1].id);
    expect(tree).toEqual([]);
    expect(markdown).toBe('');
  });

  it('createDocument snapshots the current document before switching', () => {
    useStore.getState().loadMarkdown('# Manuscrit\n\nopening line');
    expect(useStore.getState().tree[0].heading).toBe('Manuscrit');

    useStore.getState().createDocument('Décors');

    // Active doc is now empty
    expect(useStore.getState().tree).toEqual([]);

    // The previous doc is preserved in documents[]
    const docs = useStore.getState().documents;
    const manuscript = docs.find(d => d.name === 'Document');
    expect(manuscript).toBeDefined();
    expect(manuscript!.tree[0].heading).toBe('Manuscrit');
  });

  it('switchDocument restores tree/markdown/history of the target document', () => {
    useStore.getState().loadMarkdown('# A');
    const firstId = useStore.getState().activeDocumentId;

    useStore.getState().createDocument('Second');
    useStore.getState().loadMarkdown('# B');
    const secondId = useStore.getState().activeDocumentId;

    useStore.getState().switchDocument(firstId);
    expect(useStore.getState().activeDocumentId).toBe(firstId);
    expect(useStore.getState().tree[0].heading).toBe('A');

    useStore.getState().switchDocument(secondId);
    expect(useStore.getState().tree[0].heading).toBe('B');
  });

  it('switchDocument resets transient UI state (selection, recently moved)', () => {
    useStore.getState().loadMarkdown('# A\n\n## B');
    const b = useStore.getState().tree[0].children[0];
    useStore.getState().toggleNodeSelection(b.id);
    expect((useStore.getState() as any).selectedNodeIds.has(b.id)).toBe(true);

    useStore.getState().createDocument('Other');
    expect((useStore.getState() as any).selectedNodeIds.size).toBe(0);
  });

  it('switchDocument to the active id is a no-op', () => {
    useStore.getState().loadMarkdown('# A');
    const id = useStore.getState().activeDocumentId;
    const treeBefore = useStore.getState().tree;
    useStore.getState().switchDocument(id);
    expect(useStore.getState().tree).toBe(treeBefore);
  });

  it('renameDocument updates the name', () => {
    const id = useStore.getState().activeDocumentId;
    useStore.getState().renameDocument(id, 'Manuscrit');
    expect(useStore.getState().documents[0].name).toBe('Manuscrit');
  });

  it('deleteDocument is rejected when only one document remains', () => {
    const id = useStore.getState().activeDocumentId;
    useStore.getState().deleteDocument(id);
    expect(useStore.getState().documents).toHaveLength(1);
  });

  it('deleteDocument removes a non-active doc without switching', () => {
    useStore.getState().createDocument('Other');
    const otherId = useStore.getState().activeDocumentId;
    useStore.getState().switchDocument(useStore.getState().documents[0].id);
    const activeBefore = useStore.getState().activeDocumentId;

    useStore.getState().deleteDocument(otherId);
    expect(useStore.getState().documents).toHaveLength(1);
    expect(useStore.getState().activeDocumentId).toBe(activeBefore);
  });

  it('deleteDocument switches to the previous doc when deleting the active one', () => {
    const firstId = useStore.getState().activeDocumentId;
    useStore.getState().loadMarkdown('# First');
    useStore.getState().createDocument('Second');
    useStore.getState().loadMarkdown('# Second');

    const secondId = useStore.getState().activeDocumentId;
    useStore.getState().deleteDocument(secondId);

    expect(useStore.getState().documents).toHaveLength(1);
    expect(useStore.getState().activeDocumentId).toBe(firstId);
    expect(useStore.getState().tree[0].heading).toBe('First');
  });

  it('importAsDocument returns false when given blank markdown', () => {
    const before = useStore.getState().documents.length;
    const ok = useStore.getState().importAsDocument('Vide', '   \n\n  ');
    expect(ok).toBe(false);
    expect(useStore.getState().documents).toHaveLength(before);
  });

  it('importAsDocument returns true for non-empty input', () => {
    const ok = useStore.getState().importAsDocument('Plein', '# Hello');
    expect(ok).toBe(true);
  });

  it('createDocument caps the name length', () => {
    const longName = 'x'.repeat(200);
    useStore.getState().createDocument(longName);
    const created = useStore.getState().documents.at(-1)!;
    expect(created.name.length).toBeLessThanOrEqual(60);
  });

  it('renameDocument ignores empty/whitespace names', () => {
    const id = useStore.getState().activeDocumentId;
    const before = useStore.getState().documents[0].name;
    useStore.getState().renameDocument(id, '   ');
    expect(useStore.getState().documents[0].name).toBe(before);
  });

  it('switchToAdjacentDocument cycles forward and backward', () => {
    useStore.getState().createDocument('B');
    useStore.getState().createDocument('C');
    const ids = useStore.getState().documents.map(d => d.id);
    // Active = C (last created)
    expect(useStore.getState().activeDocumentId).toBe(ids[2]);

    useStore.getState().switchToAdjacentDocument(1); // wrap to 0
    expect(useStore.getState().activeDocumentId).toBe(ids[0]);

    useStore.getState().switchToAdjacentDocument(-1); // wrap to last
    expect(useStore.getState().activeDocumentId).toBe(ids[2]);

    useStore.getState().switchToAdjacentDocument(-1);
    expect(useStore.getState().activeDocumentId).toBe(ids[1]);
  });

  it('setDocumentContextIds stores cross-document AI context per document', () => {
    useStore.getState().createDocument('Personnages');
    const personnagesId = useStore.getState().activeDocumentId;
    const manuscriptId = useStore.getState().documents[0].id;

    useStore.getState().setDocumentContextIds(manuscriptId, [personnagesId]);
    const manuscript = useStore.getState().documents.find(d => d.id === manuscriptId)!;
    expect(manuscript.contextDocIds).toEqual([personnagesId]);
  });

  it('setDocumentContextIds rejects self-reference and unknown ids', () => {
    useStore.getState().createDocument('Other');
    const otherId = useStore.getState().activeDocumentId;
    const firstId = useStore.getState().documents[0].id;

    useStore.getState().setDocumentContextIds(otherId, [otherId, 'ghost-id', firstId]);
    const other = useStore.getState().documents.find(d => d.id === otherId)!;
    expect(other.contextDocIds).toEqual([firstId]);
  });

  it('deleteDocument cleans contextDocIds references on remaining docs', () => {
    useStore.getState().createDocument('Personnages');
    const personnagesId = useStore.getState().activeDocumentId;
    const manuscriptId = useStore.getState().documents[0].id;
    useStore.getState().setDocumentContextIds(manuscriptId, [personnagesId]);

    useStore.getState().deleteDocument(personnagesId);
    const manuscript = useStore.getState().documents.find(d => d.id === manuscriptId)!;
    expect(manuscript.contextDocIds).toEqual([]);
  });

  it('importAsDocument parses markdown into a new active document', () => {
    useStore.getState().importAsDocument('Personnages', `# Alice\n\nbrave\n\n# Bob\n\nclever`);
    const { documents, activeDocumentId, tree } = useStore.getState();
    expect(documents).toHaveLength(2);
    expect(documents[1].name).toBe('Personnages');
    expect(activeDocumentId).toBe(documents[1].id);
    expect(tree.map((n: any) => n.heading)).toEqual(['Alice', 'Bob']);
  });

  it('loadMarkdown updates the active document snapshot in documents[]', () => {
    const id = useStore.getState().activeDocumentId;
    useStore.getState().loadMarkdown('# Hello');

    const stored = useStore.getState().documents.find(d => d.id === id);
    expect(stored!.tree[0].heading).toBe('Hello');
    expect(stored!.markdown).toBe('# Hello');
  });

  it('edits on one doc do not leak into another after switching', () => {
    useStore.getState().loadMarkdown('# Doc A\n\n## Section');
    const firstId = useStore.getState().activeDocumentId;

    useStore.getState().createDocument('Doc B');
    useStore.getState().loadMarkdown('# Doc B only');

    useStore.getState().switchDocument(firstId);
    const trees = useStore.getState().documents.map(d => d.tree[0]?.heading);
    expect(trees).toEqual(['Doc A', 'Doc B only']);
  });
});

describe('insertSectionsAsChildren', () => {
  it('creates N children under the target node in a single history entry', () => {
    useStore.getState().loadMarkdown('# Parent\n');
    const parentId = useStore.getState().tree[0].id;
    const histBefore = (useStore.getState() as any).history.length;

    useStore.getState().insertSectionsAsChildren(parentId, [
      { heading: 'A', content: 'content A' },
      { heading: 'B', content: '' },
      { heading: 'C', content: 'content C' },
    ]);

    const children = useStore.getState().tree[0].children;
    expect(children.map((c: any) => c.heading)).toEqual(['A', 'B', 'C']);
    expect(children[0].content).toBe('content A');
    expect(children.every((c: any) => c.headingDepth === 2)).toBe(true);

    const histAfter = (useStore.getState() as any).history.length;
    expect(histAfter).toBe(histBefore + 1);
  });

  it('inserts at root level when parentId is DOCUMENT_ROOT_ID', async () => {
    const { DOCUMENT_ROOT_ID } = await import('../store');
    useStore.getState().insertSectionsAsChildren(DOCUMENT_ROOT_ID, [
      { heading: 'Chapter 1', content: '' },
      { heading: 'Chapter 2', content: '' },
    ]);

    const tree = useStore.getState().tree;
    expect(tree.map((n: any) => n.heading)).toEqual(['Chapter 1', 'Chapter 2']);
    expect(tree.every((n: any) => n.headingDepth === 1)).toBe(true);
  });

  it('no-op when the sections array is empty', () => {
    useStore.getState().loadMarkdown('# A');
    const histBefore = (useStore.getState() as any).history.length;
    useStore.getState().insertSectionsAsChildren(useStore.getState().tree[0].id, []);
    expect((useStore.getState() as any).history.length).toBe(histBefore);
  });

  it('addChild delegates to insertSectionsAsChildren with a single entry', () => {
    useStore.getState().loadMarkdown('# Root');
    const rootId = useStore.getState().tree[0].id;
    useStore.getState().addChild(rootId, 'Child', 'initial content');

    const child = useStore.getState().tree[0].children[0];
    expect(child.heading).toBe('Child');
    expect(child.content).toBe('initial content');
    expect(child.headingDepth).toBe(2);
  });
});
