/**
 * Document Management Store
 * 
 * Gère la liste des documents de l'utilisateur via localStorage.
 * Chaque document est identifié par un ID unique et contient un arbre NodeData[].
 */

import { NodeData } from './types';

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

function getIndexKey(userId: string): string {
  return `fractalia-docindex-${userId}`;
}

function getDocKey(userId: string, docId: string): string {
  return `fractalia-doc-${userId}-${docId}`;
}

function generateDocId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/**
 * Charge l'index des documents d'un utilisateur
 */
export function loadDocumentIndex(userId: string): DocumentIndex {
  try {
    const raw = localStorage.getItem(getIndexKey(userId));
    if (raw) {
      return JSON.parse(raw) as DocumentIndex;
    }
  } catch {
    // ignore
  }

  // Migration: si l'utilisateur a l'ancien format fractalia-docs-{userId}
  const legacyKey = `fractalia-docs-${userId}`;
  const legacyData = localStorage.getItem(legacyKey);
  if (legacyData) {
    try {
      const tree = JSON.parse(legacyData) as NodeData[];
      const docId = generateDocId();
      const now = Date.now();
      const docName = extractDocumentName(tree) || 'Mon document';
      const index: DocumentIndex = {
        activeDocId: docId,
        documents: [{ id: docId, name: docName, createdAt: now, updatedAt: now }],
      };
      // Sauvegarder dans le nouveau format
      localStorage.setItem(getDocKey(userId, docId), JSON.stringify(tree));
      localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
      // Supprimer l'ancien format
      localStorage.removeItem(legacyKey);
      return index;
    } catch {
      // ignore
    }
  }

  return { activeDocId: null, documents: [] };
}

/**
 * Sauvegarde l'index des documents
 */
export function saveDocumentIndex(userId: string, index: DocumentIndex): void {
  localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
}

/**
 * Charge l'arbre d'un document
 */
export function loadDocumentTree(userId: string, docId: string): NodeData[] | null {
  try {
    const raw = localStorage.getItem(getDocKey(userId, docId));
    if (raw) {
      return JSON.parse(raw) as NodeData[];
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Counts the total number of nodes in a tree recursively
 */
function countNodes(tree: NodeData[]): number {
  let count = tree.length;
  for (const node of tree) {
    count += countNodes(node.children);
  }
  return count;
}

/**
 * Sauvegarde l'arbre d'un document
 */
export function saveDocumentTree(userId: string, docId: string, tree: NodeData[]): void {
  localStorage.setItem(getDocKey(userId, docId), JSON.stringify(tree));
  // Mettre à jour updatedAt et nodeCount dans l'index
  const index = loadDocumentIndex(userId);
  const doc = index.documents.find(d => d.id === docId);
  if (doc) {
    doc.updatedAt = Date.now();
    doc.nodeCount = countNodes(tree);
    saveDocumentIndex(userId, index);
  }
}

/**
 * Crée un nouveau document et retourne son ID
 */
export function createDocument(userId: string, name: string, tree: NodeData[]): string {
  const docId = generateDocId();
  const now = Date.now();
  const index = loadDocumentIndex(userId);
  index.documents.push({ id: docId, name, createdAt: now, updatedAt: now, nodeCount: countNodes(tree) });
  index.activeDocId = docId;
  saveDocumentIndex(userId, index);
  localStorage.setItem(getDocKey(userId, docId), JSON.stringify(tree));
  return docId;
}

/**
 * Supprime un document
 */
export function deleteDocument(userId: string, docId: string): void {
  const index = loadDocumentIndex(userId);
  index.documents = index.documents.filter(d => d.id !== docId);
  if (index.activeDocId === docId) {
    index.activeDocId = index.documents.length > 0 ? index.documents[0].id : null;
  }
  saveDocumentIndex(userId, index);
  localStorage.removeItem(getDocKey(userId, docId));
}

/**
 * Renomme un document
 */
export function renameDocument(userId: string, docId: string, newName: string): void {
  const index = loadDocumentIndex(userId);
  const doc = index.documents.find(d => d.id === docId);
  if (doc) {
    doc.name = newName;
    saveDocumentIndex(userId, index);
  }
}

/**
 * Définit le document actif
 */
export function setActiveDocument(userId: string, docId: string): void {
  const index = loadDocumentIndex(userId);
  if (index.documents.some(d => d.id === docId)) {
    index.activeDocId = docId;
    saveDocumentIndex(userId, index);
  }
}

/**
 * Extrait le nom du document depuis l'arbre (premier heading H1)
 */
function extractDocumentName(tree: NodeData[]): string | null {
  if (tree.length > 0 && tree[0].heading) {
    return tree[0].heading;
  }
  return null;
}

/**
 * Duplique un document
 */
export function duplicateDocument(userId: string, docId: string): string | null {
  const tree = loadDocumentTree(userId, docId);
  const index = loadDocumentIndex(userId);
  const original = index.documents.find(d => d.id === docId);
  if (!tree || !original) return null;
  return createDocument(userId, `${original.name} (copie)`, tree);
}

/**
 * Met à jour les tags d'un document
 */
export function updateDocumentTags(userId: string, docId: string, tags: string[]): void {
  const index = loadDocumentIndex(userId);
  const doc = index.documents.find(d => d.id === docId);
  if (doc) {
    doc.tags = tags.map(t => t.trim()).filter(t => t.length > 0);
    saveDocumentIndex(userId, index);
  }
}
