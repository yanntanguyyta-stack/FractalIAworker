import { openDB, IDBPDatabase, DBSchema } from 'idb';
import type { NodeData } from './types';
import type { DocumentIndex } from './documentStore';

const DB_NAME = 'fractalia';
const DB_VERSION = 1;

interface FractaliaDB extends DBSchema {
  documents: {
    key: string;
    value: NodeData[];
  };
  indexes: {
    key: string;
    value: DocumentIndex;
  };
}

let dbPromise: Promise<IDBPDatabase<FractaliaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FractaliaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FractaliaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents');
        }
        if (!db.objectStoreNames.contains('indexes')) {
          db.createObjectStore('indexes');
        }
      },
    });
  }
  return dbPromise;
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

// For tests / cleanup
export async function _resetDBForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
  }
  dbPromise = null;
}

export function docKey(userId: string, docId: string): string {
  return `${userId}:${docId}`;
}
