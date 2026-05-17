import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportProjectToZip, buildProjectZip } from '../utils/projectExport';
import { ProjectDocument } from '../store';

function makeDoc(id: string, name: string, markdown: string): ProjectDocument {
  return { id, name, markdown, tree: [], history: [], future: [], contextDocIds: [] };
}

// jsdom Blob has no arrayBuffer() — we round-trip via uint8array instead.
async function reload(docs: ProjectDocument[]): Promise<JSZip> {
  const u8 = await buildProjectZip(docs).generateAsync({ type: 'uint8array' });
  return JSZip.loadAsync(u8);
}

describe('exportProjectToZip', () => {
  it('produces a zip with one .md per document and a manifest', async () => {
    const docs = [
      makeDoc('a', 'Manuscrit', '# Chapitre 1\n\ntexte'),
      makeDoc('b', 'Personnages', '# Alice'),
    ];
    const zip = await reload(docs);

    expect(await zip.file('Manuscrit.md')!.async('string')).toBe('# Chapitre 1\n\ntexte');
    expect(await zip.file('Personnages.md')!.async('string')).toBe('# Alice');

    const manifest = JSON.parse(await zip.file('project.json')!.async('string'));
    expect(manifest.version).toBe(1);
    expect(manifest.documents.map((d: { id: string }) => d.id)).toEqual(['a', 'b']);
  });

  it('disambiguates duplicate filenames', async () => {
    const docs = [
      makeDoc('a', 'Notes', 'one'),
      makeDoc('b', 'Notes', 'two'),
      makeDoc('c', 'Notes', 'three'),
    ];
    const zip = await reload(docs);
    expect(await zip.file('Notes.md')!.async('string')).toBe('one');
    expect(await zip.file('Notes (2).md')!.async('string')).toBe('two');
    expect(await zip.file('Notes (3).md')!.async('string')).toBe('three');
  });

  it('sanitizes filesystem-hostile characters in document names', async () => {
    const docs = [makeDoc('a', 'foo/bar:baz?', 'x')];
    const zip = await reload(docs);
    expect(zip.file('foo_bar_baz_.md')).not.toBeNull();
  });

  it('handles empty document list', async () => {
    const zip = await reload([]);
    const manifest = JSON.parse(await zip.file('project.json')!.async('string'));
    expect(manifest.documents).toEqual([]);
  });

  it('exportProjectToZip returns a Blob', async () => {
    const blob = await exportProjectToZip([makeDoc('a', 'A', 'x')]);
    expect(blob.type).toContain('zip');
  });
});
