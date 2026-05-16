import { describe, it, expect, vi } from 'vitest';
import {
  initUserStore,
  loadDocumentIndex,
  loadDocumentTree,
  saveDocumentTree,
  createDocument,
  deleteDocument,
  renameDocument,
  setActiveDocument,
  duplicateDocument,
  updateDocumentTags,
  _resetCachesForTests,
} from '../documentStore';
import { getDB, docKey } from '../db';
import type { NodeData } from '../types';

const userId = 'test-user';

function makeTree(heading = 'Root'): NodeData[] {
  return [
    {
      id: 'n1',
      heading,
      headingDepth: 1,
      content: 'hello',
      meta: { id: 'm1', type: 'section' },
      children: [],
    },
  ];
}

// Wait for async fire-and-forget writes to flush
async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 10));
}

// _resetCachesForTests is unused — global beforeEach in setup.ts already resets
void _resetCachesForTests;

describe('documentStore (IndexedDB-backed)', () => {
  it('initUserStore returns empty index for new user', async () => {
    await initUserStore(userId);
    const index = loadDocumentIndex(userId);
    expect(index.activeDocId).toBeNull();
    expect(index.documents).toEqual([]);
  });

  it('createDocument adds doc and makes it active', async () => {
    await initUserStore(userId);
    const tree = makeTree('My doc');
    const docId = createDocument(userId, 'My doc', tree);
    const index = loadDocumentIndex(userId);
    expect(index.documents).toHaveLength(1);
    expect(index.activeDocId).toBe(docId);
    expect(index.documents[0].name).toBe('My doc');
    expect(index.documents[0].nodeCount).toBe(1);
  });

  it('saveDocumentTree updates tree and timestamp', async () => {
    await initUserStore(userId);
    const docId = createDocument(userId, 'Doc', makeTree());
    const updatedTree = makeTree('Updated');
    saveDocumentTree(userId, docId, updatedTree);
    const loaded = loadDocumentTree(userId, docId);
    expect(loaded?.[0].heading).toBe('Updated');
  });

  it('deleteDocument removes from index and reassigns activeDocId', async () => {
    await initUserStore(userId);
    const id1 = createDocument(userId, 'A', makeTree('A'));
    const id2 = createDocument(userId, 'B', makeTree('B'));
    deleteDocument(userId, id2);
    const index = loadDocumentIndex(userId);
    expect(index.documents).toHaveLength(1);
    expect(index.documents[0].id).toBe(id1);
    expect(index.activeDocId).toBe(id1);
  });

  it('renameDocument updates name', async () => {
    await initUserStore(userId);
    const docId = createDocument(userId, 'Old name', makeTree());
    renameDocument(userId, docId, 'New name');
    const index = loadDocumentIndex(userId);
    expect(index.documents[0].name).toBe('New name');
  });

  it('setActiveDocument switches active id', async () => {
    await initUserStore(userId);
    const id1 = createDocument(userId, 'A', makeTree());
    const id2 = createDocument(userId, 'B', makeTree());
    setActiveDocument(userId, id1);
    expect(loadDocumentIndex(userId).activeDocId).toBe(id1);
    setActiveDocument(userId, id2);
    expect(loadDocumentIndex(userId).activeDocId).toBe(id2);
  });

  it('duplicateDocument copies tree under new id with "(copie)" suffix', async () => {
    await initUserStore(userId);
    const id = createDocument(userId, 'Original', makeTree('hello'));
    const copyId = duplicateDocument(userId, id);
    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe(id);
    const index = loadDocumentIndex(userId);
    const copy = index.documents.find(d => d.id === copyId);
    expect(copy?.name).toBe('Original (copie)');
    expect(loadDocumentTree(userId, copyId!)?.[0].heading).toBe('hello');
  });

  it('updateDocumentTags trims and filters empty tags', async () => {
    await initUserStore(userId);
    const id = createDocument(userId, 'Doc', makeTree());
    updateDocumentTags(userId, id, ['  alpha  ', 'beta', '   ', '']);
    const tags = loadDocumentIndex(userId).documents[0].tags;
    expect(tags).toEqual(['alpha', 'beta']);
  });

  it('persists data to IndexedDB so it survives cache reset', async () => {
    await initUserStore(userId);
    const docId = createDocument(userId, 'Persisted', makeTree('persisted-content'));
    await flush();

    // Wipe caches; should re-hydrate from IndexedDB
    _resetCachesForTests();
    await initUserStore(userId);

    const index = loadDocumentIndex(userId);
    expect(index.documents).toHaveLength(1);
    expect(index.documents[0].id).toBe(docId);
    expect(loadDocumentTree(userId, docId)?.[0].heading).toBe('persisted-content');
  });

  it('migrates from legacy localStorage to IndexedDB on init', async () => {
    // Seed legacy localStorage data
    const legacyTree = makeTree('legacy');
    const legacyIndex = {
      activeDocId: 'legacy-doc',
      documents: [{ id: 'legacy-doc', name: 'Legacy', createdAt: 1, updatedAt: 1 }],
    };
    const storage: Record<string, string> = {
      [`fractalia-docindex-${userId}`]: JSON.stringify(legacyIndex),
      [`fractalia-doc-${userId}-legacy-doc`]: JSON.stringify(legacyTree),
    };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => storage[key] ?? null
    );

    await initUserStore(userId);

    // Should be hydrated from migrated IDB
    const index = loadDocumentIndex(userId);
    expect(index.documents).toHaveLength(1);
    expect(index.documents[0].id).toBe('legacy-doc');

    // Verify data is now in IDB (not relying on localStorage)
    const db = await getDB();
    const stored = await db.get('documents', docKey(userId, 'legacy-doc'));
    expect(stored?.[0].heading).toBe('legacy');

    // localStorage should have been cleared (removeItem called)
    expect(localStorage.removeItem).toHaveBeenCalledWith(`fractalia-docindex-${userId}`);
    expect(localStorage.removeItem).toHaveBeenCalledWith(`fractalia-doc-${userId}-legacy-doc`);
  });
});
