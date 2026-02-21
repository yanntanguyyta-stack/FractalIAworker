import JSZip from 'jszip';
import { DocumentIndex, DocumentMeta } from '../documentStore';
import { NodeData } from '../types';

export interface ZipExportBundle {
  index: DocumentIndex;
  documents: Record<string, NodeData[]>;
}

/**
 * Exports all documents to a ZIP archive containing:
 * - `index.json` — the document index (list, active doc, tags, etc.)
 * - `docs/<id>.json` — each document's node tree
 */
export async function exportDocumentsToZip(
  userId: string,
  docIndex: DocumentIndex,
  loadTree: (userId: string, docId: string) => NodeData[] | null
): Promise<Blob> {
  const zip = new JSZip();

  zip.file('index.json', JSON.stringify(docIndex, null, 2));

  const docsFolder = zip.folder('docs');
  if (docsFolder) {
    for (const doc of docIndex.documents) {
      const tree = loadTree(userId, doc.id);
      if (tree) {
        docsFolder.file(`${doc.id}.json`, JSON.stringify(tree, null, 2));
      }
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Imports documents from a ZIP archive.
 * Returns the parsed bundle or throws on invalid archive.
 */
export async function importDocumentsFromZip(file: File): Promise<ZipExportBundle> {
  // Use FileReader for broad compatibility (including jsdom test environments)
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsArrayBuffer(file);
  });

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new Error('Fichier ZIP invalide ou corrompu.');
  }

  const indexFile = zip.file('index.json');
  if (!indexFile) {
    throw new Error('Archive invalide : index.json introuvable.');
  }

  let index: DocumentIndex;
  try {
    index = JSON.parse(await indexFile.async('string')) as DocumentIndex;
  } catch {
    throw new Error('Archive invalide : index.json est malformé.');
  }

  if (!Array.isArray(index.documents)) {
    throw new Error('Archive invalide : le champ "documents" est manquant.');
  }

  const documents: Record<string, NodeData[]> = {};

  for (const doc of index.documents) {
    const treeFile = zip.file(`docs/${doc.id}.json`);
    if (treeFile) {
      try {
        documents[doc.id] = JSON.parse(await treeFile.async('string')) as NodeData[];
      } catch {
        // Skip documents with invalid JSON, continue with others
        documents[doc.id] = [];
      }
    } else {
      documents[doc.id] = [];
    }
  }

  return { index, documents };
}

/**
 * Merges imported documents into the existing index, resolving id collisions
 * by generating new ids for conflicting entries.
 */
export function mergeImportedDocuments(
  existingIndex: DocumentIndex,
  bundle: ZipExportBundle
): { mergedIndex: DocumentIndex; mergedDocs: Record<string, NodeData[]> } {
  const existingIds = new Set(existingIndex.documents.map(d => d.id));
  const idMapping: Record<string, string> = {};

  const newDocs: DocumentMeta[] = [];
  const mergedDocs: Record<string, NodeData[]> = {};

  for (const doc of bundle.index.documents) {
    let finalId = doc.id;
    if (existingIds.has(doc.id)) {
      // Generate a collision-safe id
      finalId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    idMapping[doc.id] = finalId;
    existingIds.add(finalId);
    newDocs.push({ ...doc, id: finalId });
    mergedDocs[finalId] = bundle.documents[doc.id] ?? [];
  }

  const mergedIndex: DocumentIndex = {
    activeDocId: existingIndex.activeDocId,
    documents: [...existingIndex.documents, ...newDocs],
  };

  return { mergedIndex, mergedDocs };
}
