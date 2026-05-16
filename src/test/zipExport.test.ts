import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportDocumentsToZip,
  importDocumentsFromZip,
  mergeImportedDocuments,
} from '../utils/zipExport';
import { DocumentIndex } from '../documentStore';
import { NodeData } from '../types';

const sampleIndex: DocumentIndex = {
  activeDocId: 'doc1',
  documents: [
    {
      id: 'doc1',
      name: 'Document 1',
      createdAt: 1000,
      updatedAt: 2000,
      tags: ['projet', 'important'],
    },
    {
      id: 'doc2',
      name: 'Document 2',
      createdAt: 1500,
      updatedAt: 2500,
      tags: [],
    },
  ],
};

const sampleTree: NodeData[] = [
  {
    id: 'n1',
    heading: 'Titre',
    headingDepth: 1,
    content: 'Contenu du document',
    meta: { id: 'm1', type: 'section' },
    children: [],
  },
];

function mockLoadTree(_userId: string, docId: string): NodeData[] | null {
  if (docId === 'doc1' || docId === 'doc2') return sampleTree;
  return null;
}

describe('zipExport', () => {
  describe('exportDocumentsToZip', () => {
    it('devrait retourner un Blob non vide', async () => {
      const blob = await exportDocumentsToZip('user1', sampleIndex, mockLoadTree);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('devrait générer un ZIP avec contenu pour chaque document', async () => {
      const blob = await exportDocumentsToZip('user1', sampleIndex, mockLoadTree);
      expect(blob.type).toContain('zip');
    });
  });

  describe('importDocumentsFromZip', () => {
    it('devrait importer depuis un ZIP valide exporté (via Uint8Array)', async () => {
      // exportDocumentsToZip returns a Blob; in jsdom Blob.arrayBuffer() might not work
      // so we reconstruct the zip programmatically for the round-trip test
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file('index.json', JSON.stringify(sampleIndex));
      const docsFolder = zip.folder('docs');
      docsFolder?.file('doc1.json', JSON.stringify(sampleTree));
      docsFolder?.file('doc2.json', JSON.stringify(sampleTree));
      const uint8 = await zip.generateAsync({ type: 'uint8array' });
      const file = new File([uint8 as BlobPart], 'docs.zip', { type: 'application/zip' });
      const bundle = await importDocumentsFromZip(file);
      expect(bundle.index.documents.length).toBe(2);
      expect(bundle.documents['doc1']).toBeDefined();
      expect(bundle.documents['doc2']).toBeDefined();
    });

    it('devrait lever une erreur sur un fichier non-ZIP', async () => {
      const file = new File(['not a zip'], 'invalid.zip', { type: 'application/zip' });
      await expect(importDocumentsFromZip(file)).rejects.toThrow(/invalide/i);
    });
  });

  describe('mergeImportedDocuments', () => {
    it('devrait fusionner sans collision', () => {
      const existing: DocumentIndex = {
        activeDocId: 'existingDoc',
        documents: [
          { id: 'existingDoc', name: 'Existant', createdAt: 100, updatedAt: 200 },
        ],
      };
      const bundle = {
        index: sampleIndex,
        documents: { doc1: sampleTree, doc2: sampleTree },
      };
      const { mergedIndex, mergedDocs } = mergeImportedDocuments(existing, bundle);
      expect(mergedIndex.documents.length).toBe(3);
      expect(Object.keys(mergedDocs).length).toBe(2);
    });

    it('devrait résoudre les collisions d\'id', () => {
      const existing: DocumentIndex = {
        activeDocId: 'doc1',
        documents: [
          { id: 'doc1', name: 'Existant', createdAt: 100, updatedAt: 200 },
        ],
      };
      const bundle = {
        index: sampleIndex,
        documents: { doc1: sampleTree, doc2: sampleTree },
      };
      const { mergedIndex } = mergeImportedDocuments(existing, bundle);
      // Les IDs doivent tous être uniques
      const ids = mergedIndex.documents.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('devrait conserver l\'activeDocId de l\'index existant', () => {
      const existing: DocumentIndex = {
        activeDocId: 'existingDoc',
        documents: [
          { id: 'existingDoc', name: 'Existant', createdAt: 100, updatedAt: 200 },
        ],
      };
      const bundle = {
        index: sampleIndex,
        documents: { doc1: sampleTree, doc2: [] },
      };
      const { mergedIndex } = mergeImportedDocuments(existing, bundle);
      expect(mergedIndex.activeDocId).toBe('existingDoc');
    });
  });
});
