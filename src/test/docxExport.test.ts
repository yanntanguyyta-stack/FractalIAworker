import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markdownToDocxChildren, buildDocxBlob } from '../utils/docxExport';
import { Paragraph, Table } from 'docx';

describe('docxExport', () => {
  describe('markdownToDocxChildren', () => {
    it('devrait retourner un résultat vide ou minimal pour un Markdown vide', () => {
      const result = markdownToDocxChildren('');
      // An empty string splits to one empty line → one spacing paragraph
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('devrait convertir les titres en Paragraphs', () => {
      const result = markdownToDocxChildren('# Titre 1\n## Titre 2\n### Titre 3');
      const paragraphs = result.filter(c => c instanceof Paragraph);
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    });

    it('devrait convertir les paragraphes normaux', () => {
      const result = markdownToDocxChildren('Voici un paragraphe simple.');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toBeInstanceOf(Paragraph);
    });

    it('devrait convertir les listes non ordonnées', () => {
      const result = markdownToDocxChildren('- Item 1\n- Item 2\n- Item 3');
      expect(result.filter(c => c instanceof Paragraph).length).toBe(3);
    });

    it('devrait convertir les listes ordonnées', () => {
      const result = markdownToDocxChildren('1. Premier\n2. Deuxième\n3. Troisième');
      expect(result.filter(c => c instanceof Paragraph).length).toBe(3);
    });

    it('devrait convertir les tables Markdown en Table DOCX', () => {
      const md = '| Colonne A | Colonne B |\n|---|---|\n| Val 1 | Val 2 |';
      const result = markdownToDocxChildren(md);
      const tables = result.filter(c => c instanceof Table);
      expect(tables.length).toBe(1);
    });

    it('devrait convertir les blocs de code', () => {
      const md = '```js\nconsole.log("hello");\n```';
      const result = markdownToDocxChildren(md);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toBeInstanceOf(Paragraph);
    });

    it('devrait convertir les blockquotes', () => {
      const md = '> Une citation importante';
      const result = markdownToDocxChildren(md);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toBeInstanceOf(Paragraph);
    });

    it('devrait traiter correctement un document complet', () => {
      const md = `# Mon Document

## Introduction

Voici le contenu introductif.

## Section avec liste

- Point A
- Point B

## Section avec tableau

| Nom | Valeur |
|---|---|
| Foo | 42 |

### Sous-section

Texte de la sous-section.
`;
      const result = markdownToDocxChildren(md);
      expect(result.length).toBeGreaterThan(5);
      const tables = result.filter(c => c instanceof Table);
      expect(tables.length).toBe(1);
    });
  });

  describe('buildDocxBlob', () => {
    it('devrait retourner un Blob', async () => {
      const blob = await buildDocxBlob('# Titre\n\nContenu du document.', 'Test');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('devrait ajouter un H1 si le markdown n\'en commence pas par un', async () => {
      const blob = await buildDocxBlob('Contenu sans titre', 'Mon Document');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('devrait ne pas dupliquer le H1 si le markdown commence déjà par # ', async () => {
      const blob = await buildDocxBlob('# Titre existant\n\nContenu', 'Titre existant');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('devrait fonctionner avec un Markdown complexe incluant tableau', async () => {
      const md = `# Rapport

## Résumé

Voici un **rapport** important.

| Indicateur | Valeur |
|---|---|
| Score | 95 |

## Conclusion

C'est tout.
`;
      const blob = await buildDocxBlob(md, 'Rapport');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});
