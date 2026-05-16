/**
 * Document Management Store
 *
 * Primary storage: IndexedDB (via idb wrapper).
 * Reads served synchronously from an in-memory cache populated by initUserStore.
 * Writes update the cache synchronously and persist to IndexedDB asynchronously
 * (with localStorage fallback on IDB error).
 *
 * Migration: on first init for a user, legacy localStorage data is moved to
 * IndexedDB and the legacy keys cleared.
 */

import { NodeData } from './types';
import { getDB, isIndexedDBAvailable, docKey } from './db';

export interface DocumentMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount?: number;
  tags?: string[];
}

export interface DocumentIndex {
  activeDocId: string | null;
  documents: DocumentMeta[];
}

const indexCache = new Map<string, DocumentIndex>();
const treeCache = new Map<string, NodeData[]>();
const initializedUsers = new Set<string>();

function getIndexKey(userId: string): string {
  return `fractalia-docindex-${userId}`;
}

function getDocKeyLS(userId: string, docId: string): string {
  return `fractalia-doc-${userId}-${docId}`;
}

function generateDocId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function countNodes(tree: NodeData[]): number {
  let count = tree.length;
  for (const node of tree) {
    count += countNodes(node.children);
  }
  return count;
}

function extractDocumentName(tree: NodeData[]): string | null {
  if (tree.length > 0 && tree[0].heading) return tree[0].heading;
  return null;
}

function readIndexFromLocalStorage(userId: string): DocumentIndex | null {
  try {
    const raw = localStorage.getItem(getIndexKey(userId));
    if (raw) return JSON.parse(raw) as DocumentIndex;
  } catch {
    // ignore
  }

  // Legacy v1 format: fractalia-docs-{userId}
  const legacyKey = `fractalia-docs-${userId}`;
  try {
    const legacyData = localStorage.getItem(legacyKey);
    if (legacyData) {
      const tree = JSON.parse(legacyData) as NodeData[];
      const docId = generateDocId();
      const now = Date.now();
      const docName = extractDocumentName(tree) || 'Mon document';
      const index: DocumentIndex = {
        activeDocId: docId,
        documents: [{ id: docId, name: docName, createdAt: now, updatedAt: now }],
      };
      localStorage.setItem(getDocKeyLS(userId, docId), JSON.stringify(tree));
      localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
      localStorage.removeItem(legacyKey);
      return index;
    }
  } catch {
    // ignore
  }
  return null;
}

function readTreeFromLocalStorage(userId: string, docId: string): NodeData[] | null {
  try {
    const raw = localStorage.getItem(getDocKeyLS(userId, docId));
    if (raw) return JSON.parse(raw) as NodeData[];
  } catch {
    // ignore
  }
  return null;
}

function persistIndexToLocalStorage(userId: string, index: DocumentIndex): void {
  try {
    localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
  } catch {
    // ignore quota errors
  }
}

function persistTreeToLocalStorage(userId: string, docId: string, tree: NodeData[]): void {
  try {
    localStorage.setItem(getDocKeyLS(userId, docId), JSON.stringify(tree));
  } catch {
    // ignore quota errors
  }
}

async function migrateFromLocalStorage(userId: string): Promise<void> {
  const index = readIndexFromLocalStorage(userId);
  if (!index) return;

  const db = await getDB();
  await db.put('indexes', index, userId);

  for (const doc of index.documents) {
    const tree = readTreeFromLocalStorage(userId, doc.id);
    if (tree) {
      await db.put('documents', tree, docKey(userId, doc.id));
    }
  }

  // Clear legacy localStorage entries after successful migration
  try {
    localStorage.removeItem(getIndexKey(userId));
    for (const doc of index.documents) {
      localStorage.removeItem(getDocKeyLS(userId, doc.id));
    }
  } catch {
    // ignore
  }
}

/**
 * Hydrates the in-memory cache for the given user from IndexedDB, performing
 * a one-time migration from localStorage if needed. Must be awaited before
 * any synchronous read for this user.
 */
export async function initUserStore(userId: string): Promise<void> {
  if (initializedUsers.has(userId)) return;

  if (!isIndexedDBAvailable()) {
    // Fallback: load from localStorage into the cache
    const index = readIndexFromLocalStorage(userId);
    if (index) {
      indexCache.set(userId, index);
      for (const doc of index.documents) {
        const tree = readTreeFromLocalStorage(userId, doc.id);
        if (tree) treeCache.set(docKey(userId, doc.id), tree);
      }
    }
    initializedUsers.add(userId);
    return;
  }

  try {
    const db = await getDB();
    let index = await db.get('indexes', userId);

    if (!index) {
      // Try migration from localStorage
      await migrateFromLocalStorage(userId);
      index = await db.get('indexes', userId);
    }

    if (index) {
      indexCache.set(userId, index);
      for (const doc of index.documents) {
        const tree = await db.get('documents', docKey(userId, doc.id));
        if (tree) treeCache.set(docKey(userId, doc.id), tree);
      }
    }
  } catch (e) {
    console.warn('IndexedDB init failed, falling back to localStorage:', e);
    const index = readIndexFromLocalStorage(userId);
    if (index) {
      indexCache.set(userId, index);
      for (const doc of index.documents) {
        const tree = readTreeFromLocalStorage(userId, doc.id);
        if (tree) treeCache.set(docKey(userId, doc.id), tree);
      }
    }
  } finally {
    initializedUsers.add(userId);
  }
}

function schedulePersistIndex(userId: string, index: DocumentIndex): void {
  if (!isIndexedDBAvailable()) {
    persistIndexToLocalStorage(userId, index);
    return;
  }
  getDB()
    .then(db => db.put('indexes', index, userId))
    .catch(() => persistIndexToLocalStorage(userId, index));
}

function schedulePersistTree(userId: string, docId: string, tree: NodeData[]): void {
  if (!isIndexedDBAvailable()) {
    persistTreeToLocalStorage(userId, docId, tree);
    return;
  }
  getDB()
    .then(db => db.put('documents', tree, docKey(userId, docId)))
    .catch(() => persistTreeToLocalStorage(userId, docId, tree));
}

function scheduleDeleteTree(userId: string, docId: string): void {
  if (!isIndexedDBAvailable()) {
    try { localStorage.removeItem(getDocKeyLS(userId, docId)); } catch { /* ignore */ }
    return;
  }
  getDB()
    .then(db => db.delete('documents', docKey(userId, docId)))
    .catch(() => {
      try { localStorage.removeItem(getDocKeyLS(userId, docId)); } catch { /* ignore */ }
    });
}

export function loadDocumentIndex(userId: string): DocumentIndex {
  const cached = indexCache.get(userId);
  if (cached) return cached;
  // Fallback for callers that did not init (e.g., legacy code paths)
  const fromLS = readIndexFromLocalStorage(userId);
  if (fromLS) {
    indexCache.set(userId, fromLS);
    return fromLS;
  }
  return { activeDocId: null, documents: [] };
}

export function saveDocumentIndex(userId: string, index: DocumentIndex): void {
  indexCache.set(userId, index);
  schedulePersistIndex(userId, index);
}

export function loadDocumentTree(userId: string, docId: string): NodeData[] | null {
  const cached = treeCache.get(docKey(userId, docId));
  if (cached) return cached;
  // Fallback if not preloaded
  const fromLS = readTreeFromLocalStorage(userId, docId);
  if (fromLS) {
    treeCache.set(docKey(userId, docId), fromLS);
    return fromLS;
  }
  return null;
}

export function saveDocumentTree(userId: string, docId: string, tree: NodeData[]): void {
  treeCache.set(docKey(userId, docId), tree);
  schedulePersistTree(userId, docId, tree);

  const index = loadDocumentIndex(userId);
  const doc = index.documents.find(d => d.id === docId);
  if (doc) {
    doc.updatedAt = Date.now();
    doc.nodeCount = countNodes(tree);
    saveDocumentIndex(userId, index);
  }
}

export function createDocument(userId: string, name: string, tree: NodeData[]): string {
  const docId = generateDocId();
  const now = Date.now();
  const index = loadDocumentIndex(userId);
  index.documents.push({ id: docId, name, createdAt: now, updatedAt: now, nodeCount: countNodes(tree) });
  index.activeDocId = docId;
  saveDocumentIndex(userId, index);
  treeCache.set(docKey(userId, docId), tree);
  schedulePersistTree(userId, docId, tree);
  return docId;
}

export function deleteDocument(userId: string, docId: string): void {
  const index = loadDocumentIndex(userId);
  index.documents = index.documents.filter(d => d.id !== docId);
  if (index.activeDocId === docId) {
    index.activeDocId = index.documents.length > 0 ? index.documents[0].id : null;
  }
  saveDocumentIndex(userId, index);
  treeCache.delete(docKey(userId, docId));
  scheduleDeleteTree(userId, docId);
}

export function renameDocument(userId: string, docId: string, newName: string): void {
  const index = loadDocumentIndex(userId);
  const doc = index.documents.find(d => d.id === docId);
  if (doc) {
    doc.name = newName;
    saveDocumentIndex(userId, index);
  }
}

export function setActiveDocument(userId: string, docId: string): void {
  const index = loadDocumentIndex(userId);
  if (index.documents.some(d => d.id === docId)) {
    index.activeDocId = docId;
    saveDocumentIndex(userId, index);
  }
}

export function duplicateDocument(userId: string, docId: string): string | null {
  const tree = loadDocumentTree(userId, docId);
  const index = loadDocumentIndex(userId);
  const original = index.documents.find(d => d.id === docId);
  if (!tree || !original) return null;
  return createDocument(userId, `${original.name} (copie)`, tree);
}

export function updateDocumentTags(userId: string, docId: string, tags: string[]): void {
  const index = loadDocumentIndex(userId);
  const doc = index.documents.find(d => d.id === docId);
  if (doc) {
    doc.tags = tags.map(t => t.trim()).filter(t => t.length > 0);
    saveDocumentIndex(userId, index);
  }
}

// Test helpers
export function _resetCachesForTests(): void {
  indexCache.clear();
  treeCache.clear();
  initializedUsers.clear();
}
