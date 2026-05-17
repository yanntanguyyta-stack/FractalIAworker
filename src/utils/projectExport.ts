import JSZip from 'jszip';
import { ProjectDocument } from '../store';

/**
 * Exports a project (collection of documents) to a ZIP archive.
 * Each document becomes one `.md` file. A `project.json` manifest preserves
 * the original document order and IDs so a future import can rebuild the
 * project as-is.
 *
 * Filename collisions on document name are disambiguated with a numeric
 * suffix (`Notes.md`, `Notes (2).md`, …) so the archive always extracts
 * without overwriting.
 */
/** Build the JSZip in-memory (exposed for tests; do not use in production paths). */
export function buildProjectZip(documents: ProjectDocument[]): JSZip {
  const zip = new JSZip();
  const used = new Set<string>();

  const manifest: { id: string; name: string; file: string }[] = [];

  for (const doc of documents) {
    const safe = (doc.name || 'document').replace(/[\\/:*?"<>|]/g, '_').trim() || 'document';
    let filename = `${safe}.md`;
    let counter = 2;
    while (used.has(filename)) {
      filename = `${safe} (${counter}).md`;
      counter += 1;
    }
    used.add(filename);
    zip.file(filename, doc.markdown || '');
    manifest.push({ id: doc.id, name: doc.name, file: filename });
  }

  zip.file(
    'project.json',
    JSON.stringify({ version: 1, documents: manifest }, null, 2)
  );

  return zip;
}

export async function exportProjectToZip(documents: ProjectDocument[]): Promise<Blob> {
  return buildProjectZip(documents).generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
