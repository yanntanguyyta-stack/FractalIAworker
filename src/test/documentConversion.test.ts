import { describe, it, expect } from 'vitest';
import {
  markdownToHtml,
  buildHtmlDocument,
  buildPrintHtmlDocument,
  buildWordDocument,
  encodeMarkdownForShare,
  decodeMarkdownFromShare,
} from '../utils/documentConversion';

describe('markdownToHtml', () => {
  it('devrait convertir les titres H1 à H6', () => {
    const result = markdownToHtml('# Titre 1\n## Titre 2\n### Titre 3');
    expect(result).toContain('<h1>');
    expect(result).toContain('Titre 1');
    expect(result).toContain('<h2>');
    expect(result).toContain('Titre 2');
    expect(result).toContain('<h3>');
    expect(result).toContain('Titre 3');
  });

  it('devrait convertir le texte gras et italique', () => {
    const result = markdownToHtml('**gras** et *italique*');
    expect(result).toContain('<strong>gras</strong>');
    expect(result).toContain('<em>italique</em>');
  });

  it('devrait convertir les listes non ordonnées en <ul>', () => {
    const result = markdownToHtml('- item 1\n- item 2\n- item 3');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('item 1');
    expect(result).toContain('</ul>');
  });

  it('devrait convertir les listes ordonnées en <ol>', () => {
    const result = markdownToHtml('1. premier\n2. deuxième');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>');
    expect(result).toContain('premier');
    expect(result).toContain('</ol>');
  });

  it('devrait convertir les blocs de code fencés en <pre><code>', () => {
    const result = markdownToHtml('```javascript\nconsole.log("hello");\n```');
    expect(result).toContain('<pre>');
    expect(result).toContain('<code');
    expect(result).toContain('console.log');
    expect(result).toContain('</pre>');
  });

  it('devrait convertir les tableaux Markdown en <table>', () => {
    const md = '| Col A | Col B |\n|-------|-------|\n| val 1 | val 2 |';
    const result = markdownToHtml(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>');
    expect(result).toContain('Col A');
    expect(result).toContain('<td>');
    expect(result).toContain('val 1');
    expect(result).toContain('</table>');
  });

  it('devrait convertir les blockquotes en <blockquote>', () => {
    const result = markdownToHtml('> Une citation importante');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('Une citation importante');
  });

  it('devrait convertir les liens Markdown', () => {
    const result = markdownToHtml('[Google](https://google.com)');
    expect(result).toContain('<a href="https://google.com"');
    expect(result).toContain('Google');
  });

  it('devrait convertir la règle horizontale ---', () => {
    const result = markdownToHtml('---');
    expect(result).toContain('<hr');
  });

  it('devrait échapper le HTML dans le contenu utilisateur', () => {
    const result = markdownToHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('ne devrait pas contenir de classes Tailwind', () => {
    const result = markdownToHtml('# Titre\n\nParagraphe');
    expect(result).not.toContain('text-lg');
    expect(result).not.toContain('font-bold');
    expect(result).not.toContain('mt-4');
    expect(result).not.toContain('prose');
  });
});

describe('buildHtmlDocument', () => {
  it('devrait inclure le titre dans la balise <title>', () => {
    const result = buildHtmlDocument('# Mon document', 'Mon Titre');
    expect(result).toContain('<title>Mon Titre</title>');
  });

  it('devrait inclure le contenu converti dans le body', () => {
    const result = buildHtmlDocument('# Bonjour', 'Test');
    expect(result).toContain('Bonjour');
    expect(result).toContain('<body>');
  });

  it('devrait inclure le charset UTF-8', () => {
    const result = buildHtmlDocument('# Test', 'Test');
    expect(result).toContain('charset="utf-8"');
  });

  it('devrait être un document HTML valide avec doctype', () => {
    const result = buildHtmlDocument('# Test', 'Test');
    expect(result.trim()).toMatch(/^<!doctype html>/i);
    expect(result).toContain('</html>');
  });

  it('devrait échapper le HTML dans le titre', () => {
    const result = buildHtmlDocument('# Test', '<script>alert("xss")</script>');
    expect(result).not.toContain('<script>alert');
    expect(result).toContain('&lt;script&gt;');
  });
});

describe('buildPrintHtmlDocument', () => {
  it('devrait inclure les règles @page pour les marges d\'impression', () => {
    const result = buildPrintHtmlDocument('# Test', 'Test');
    expect(result).toContain('@page');
    expect(result).toContain('margin:');
  });

  it('devrait inclure les règles @media print', () => {
    const result = buildPrintHtmlDocument('# Test', 'Test');
    expect(result).toContain('@media print');
  });

  it('devrait inclure la règle page-break-before pour h1', () => {
    const result = buildPrintHtmlDocument('# Test', 'Test');
    expect(result).toContain('page-break-before');
  });

  it('devrait inclure les règles orphans et widows', () => {
    const result = buildPrintHtmlDocument('# Test', 'Test');
    expect(result).toContain('orphans');
    expect(result).toContain('widows');
  });
});

describe('buildWordDocument', () => {
  it('devrait inclure les espaces de noms Office XML', () => {
    const result = buildWordDocument('# Test', 'Test');
    expect(result).toContain('urn:schemas-microsoft-com:office:word');
    expect(result).toContain('urn:schemas-microsoft-com:office:office');
  });

  it('devrait inclure le meta ProgId Word.Document', () => {
    const result = buildWordDocument('# Test', 'Test');
    expect(result).toContain('Word.Document');
  });

  it('devrait inclure les styles de page mso pour Word', () => {
    const result = buildWordDocument('# Test', 'Test');
    expect(result).toContain('WordSection1');
  });

  it('devrait inclure le contenu converti', () => {
    const result = buildWordDocument('# Mon titre de document', 'Doc');
    expect(result).toContain('Mon titre de document');
  });
});

describe('encodeMarkdownForShare / decodeMarkdownFromShare', () => {
  it('devrait encoder et décoder un contenu Markdown', () => {
    const original = '# Titre\n\nContenu avec des accents : éàü';
    const encoded = encodeMarkdownForShare(original);
    const decoded = decodeMarkdownFromShare(encoded);
    expect(decoded).toBe(original);
  });

  it('devrait produire un résultat encodé différent du contenu original', () => {
    const original = '# Test';
    const encoded = encodeMarkdownForShare(original);
    expect(encoded).not.toBe(original);
  });
});
