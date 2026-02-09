import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseMarkdownToTree,
  treeToMarkdown,
  updateNodeInTree,
  findNodeById,
  flattenTree,
} from '../markdownEngine';
import { NodeData } from '../types';

describe('markdownEngine', () => {
  describe('parseMarkdownToTree', () => {
    it('devrait parser un document vide', () => {
      const result = parseMarkdownToTree('');
      expect(result).toEqual([]);
    });

    it('devrait parser un seul titre H1', () => {
      const markdown = '# Titre Principal\n\nContenu du document.';
      const result = parseMarkdownToTree(markdown);
      
      expect(result).toHaveLength(1);
      expect(result[0].heading).toBe('Titre Principal');
      expect(result[0].headingDepth).toBe(1);
      expect(result[0].content).toBe('Contenu du document.');
      expect(result[0].children).toEqual([]);
    });

    it('devrait parser plusieurs titres H1 comme nœuds racines', () => {
      const markdown = `# Premier

Contenu 1

# Deuxième

Contenu 2`;
      const result = parseMarkdownToTree(markdown);
      
      expect(result).toHaveLength(2);
      expect(result[0].heading).toBe('Premier');
      expect(result[1].heading).toBe('Deuxième');
    });

    it('devrait créer une hiérarchie avec H1 et H2', () => {
      const markdown = `# Parent

Contenu parent

## Enfant

Contenu enfant`;
      const result = parseMarkdownToTree(markdown);
      
      expect(result).toHaveLength(1);
      expect(result[0].heading).toBe('Parent');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].heading).toBe('Enfant');
      expect(result[0].children[0].headingDepth).toBe(2);
    });

    it('devrait créer une hiérarchie à 3 niveaux', () => {
      const markdown = `# Niveau 1

## Niveau 2

### Niveau 3

Contenu profond`;
      const result = parseMarkdownToTree(markdown);
      
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].heading).toBe('Niveau 3');
    });

    it('devrait parser les métadonnées depuis les commentaires HTML', () => {
      const markdown = `# Test

Contenu

<!-- {"meta":{"id":"custom-id","type":"section"}} -->`;
      const result = parseMarkdownToTree(markdown);
      
      expect(result[0].meta.id).toBe('custom-id');
      expect(result[0].meta.type).toBe('section');
    });

    it('devrait gérer plusieurs enfants au même niveau', () => {
      const markdown = `# Parent

## Enfant 1

## Enfant 2

## Enfant 3`;
      const result = parseMarkdownToTree(markdown);
      
      expect(result[0].children).toHaveLength(3);
      expect(result[0].children[0].heading).toBe('Enfant 1');
      expect(result[0].children[1].heading).toBe('Enfant 2');
      expect(result[0].children[2].heading).toBe('Enfant 3');
    });

    it('devrait conserver le contenu multiligne', () => {
      const markdown = `# Titre

Ligne 1
Ligne 2
Ligne 3`;
      const result = parseMarkdownToTree(markdown);
      
      expect(result[0].content).toContain('Ligne 1');
      expect(result[0].content).toContain('Ligne 2');
      expect(result[0].content).toContain('Ligne 3');
    });
  });

  describe('treeToMarkdown', () => {
    it('devrait convertir un arbre vide', () => {
      const result = treeToMarkdown([]);
      expect(result.trim()).toBe('');
    });

    it('devrait convertir un nœud simple', () => {
      const tree: NodeData[] = [{
        id: 'test-1',
        heading: 'Titre',
        headingDepth: 1,
        content: 'Contenu',
        meta: { id: 'test-1', type: 'project-root' },
        children: [],
      }];
      
      const result = treeToMarkdown(tree);
      expect(result).toContain('# Titre');
      expect(result).toContain('Contenu');
    });

    it('devrait préserver la hiérarchie', () => {
      const tree: NodeData[] = [{
        id: 'parent',
        heading: 'Parent',
        headingDepth: 1,
        content: '',
        meta: { id: 'parent', type: 'project-root' },
        children: [{
          id: 'child',
          heading: 'Enfant',
          headingDepth: 2,
          content: 'Contenu enfant',
          meta: { id: 'child', type: 'section' },
          children: [],
        }],
      }];
      
      const result = treeToMarkdown(tree);
      expect(result).toContain('# Parent');
      expect(result).toContain('## Enfant');
    });

    it('devrait inclure les métadonnées en commentaire HTML', () => {
      const tree: NodeData[] = [{
        id: 'test-1',
        heading: 'Test',
        headingDepth: 1,
        content: '',
        meta: { id: 'meta-id', type: 'section' },
        children: [],
      }];
      
      const result = treeToMarkdown(tree);
      expect(result).toContain('<!-- {');
      expect(result).toContain('"meta"');
    });
  });

  describe('findNodeById', () => {
    const sampleTree: NodeData[] = [{
      id: 'root',
      heading: 'Root',
      headingDepth: 1,
      content: '',
      meta: { id: 'root', type: 'project-root' },
      children: [{
        id: 'child-1',
        heading: 'Child 1',
        headingDepth: 2,
        content: '',
        meta: { id: 'child-1', type: 'section' },
        children: [{
          id: 'grandchild',
          heading: 'Grandchild',
          headingDepth: 3,
          content: '',
          meta: { id: 'grandchild', type: 'section' },
          children: [],
        }],
      }, {
        id: 'child-2',
        heading: 'Child 2',
        headingDepth: 2,
        content: '',
        meta: { id: 'child-2', type: 'section' },
        children: [],
      }],
    }];

    it('devrait trouver un nœud racine', () => {
      const result = findNodeById(sampleTree, 'root');
      expect(result).not.toBeNull();
      expect(result?.heading).toBe('Root');
    });

    it('devrait trouver un enfant direct', () => {
      const result = findNodeById(sampleTree, 'child-1');
      expect(result).not.toBeNull();
      expect(result?.heading).toBe('Child 1');
    });

    it('devrait trouver un petit-enfant', () => {
      const result = findNodeById(sampleTree, 'grandchild');
      expect(result).not.toBeNull();
      expect(result?.heading).toBe('Grandchild');
    });

    it('devrait retourner null pour un ID inexistant', () => {
      const result = findNodeById(sampleTree, 'nonexistent');
      expect(result).toBeNull();
    });

    it('devrait retourner null pour un arbre vide', () => {
      const result = findNodeById([], 'any-id');
      expect(result).toBeNull();
    });
  });

  describe('updateNodeInTree', () => {
    const createSampleTree = (): NodeData[] => [{
      id: 'root',
      heading: 'Root',
      headingDepth: 1,
      content: 'Original content',
      meta: { id: 'root', type: 'project-root' },
      children: [{
        id: 'child',
        heading: 'Child',
        headingDepth: 2,
        content: 'Child content',
        meta: { id: 'child', type: 'section' },
        children: [],
      }],
    }];

    it('devrait mettre à jour le contenu d\'un nœud racine', () => {
      const tree = createSampleTree();
      const result = updateNodeInTree(tree, 'root', { content: 'Nouveau contenu' });
      
      expect(result[0].content).toBe('Nouveau contenu');
    });

    it('devrait mettre à jour le contenu d\'un enfant', () => {
      const tree = createSampleTree();
      const result = updateNodeInTree(tree, 'child', { content: 'Nouveau contenu enfant' });
      
      expect(result[0].children[0].content).toBe('Nouveau contenu enfant');
    });

    it('devrait mettre à jour le titre d\'un nœud', () => {
      const tree = createSampleTree();
      const result = updateNodeInTree(tree, 'root', { heading: 'Nouveau titre' });
      
      expect(result[0].heading).toBe('Nouveau titre');
    });

    it('ne devrait pas modifier l\'arbre original (immutabilité)', () => {
      const tree = createSampleTree();
      const original = tree[0].content;
      updateNodeInTree(tree, 'root', { content: 'Modified' });
      
      expect(tree[0].content).toBe(original);
    });

    it('devrait retourner un arbre identique si l\'ID n\'existe pas', () => {
      const tree = createSampleTree();
      const result = updateNodeInTree(tree, 'nonexistent', { content: 'Test' });
      
      expect(result[0].content).toBe('Original content');
    });
  });

  describe('flattenTree', () => {
    const sampleTree: NodeData[] = [{
      id: 'root',
      heading: 'Root',
      headingDepth: 1,
      content: '',
      meta: { id: 'root', type: 'project-root' },
      children: [{
        id: 'child-1',
        heading: 'Child 1',
        headingDepth: 2,
        content: '',
        meta: { id: 'child-1', type: 'section' },
        children: [{
          id: 'grandchild',
          heading: 'Grandchild',
          headingDepth: 3,
          content: '',
          meta: { id: 'grandchild', type: 'section' },
          children: [],
        }],
      }, {
        id: 'child-2',
        heading: 'Child 2',
        headingDepth: 2,
        content: '',
        meta: { id: 'child-2', type: 'section' },
        children: [],
      }],
    }];

    it('devrait aplatir un arbre vide', () => {
      const result = flattenTree([]);
      expect(result).toEqual([]);
    });

    it('devrait retourner tous les nœuds dans l\'ordre de profondeur', () => {
      const result = flattenTree(sampleTree);
      
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('root');
      expect(result[1].id).toBe('child-1');
      expect(result[2].id).toBe('grandchild');
      expect(result[3].id).toBe('child-2');
    });

    it('devrait conserver les propriétés des nœuds', () => {
      const result = flattenTree(sampleTree);
      
      expect(result[0].heading).toBe('Root');
      expect(result[0].headingDepth).toBe(1);
    });
  });

  describe('parseMarkdownToTree - cas edge', () => {
    it('devrait gérer les commentaires HTML invalides sans crash', () => {
      const markdown = `# Test

<!-- invalid json not meta -->

Contenu`;
      const result = parseMarkdownToTree(markdown);

      expect(result).toHaveLength(1);
      // Le nœud devrait avoir un ID généré automatiquement
      expect(result[0].meta.id).toBeDefined();
    });

    it('devrait gérer les métadonnées JSON invalides avec syntaxe cassée', () => {
      const markdown = `# Test

<!-- {"meta":{"broken: -->

Contenu`;
      // Ce test vérifie que le parsing ne plante pas avec du JSON invalide
      const result = parseMarkdownToTree(markdown);

      expect(result).toHaveLength(1);
      // Le nœud devrait avoir un ID généré car les métadonnées sont invalides
      expect(result[0].meta.id).toBeDefined();
    });

    it('devrait gérer un JSON valide avec schema Zod invalide', () => {
      // Mock console.warn pour éviter l'erreur et vérifier qu'il est appelé
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Ce commentaire HTML a du JSON valide mais les valeurs ne passent pas le schema Zod
      const markdown = `# Test Schema Invalid

<!-- {"meta":{"id": 123, "role": null, "completenessScore": "invalid"}} -->

Contenu`;
      // Le parsing JSON réussit mais Zod échoue
      const result = parseMarkdownToTree(markdown);

      expect(result).toHaveLength(1);
      // Un nouvel ID devrait être généré
      expect(typeof result[0].meta.id).toBe('string');
      
      // Le warning devrait avoir été appelé pour le parse error
      expect(warnSpy).toHaveBeenCalled();
      
      warnSpy.mockRestore();
    });

    it('devrait parser les blocs de code dans le contenu', () => {
      const markdown = `# Code Example

\`\`\`javascript
const x = 42;
\`\`\`

Texte après`;
      const result = parseMarkdownToTree(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('const x = 42');
    });

    it('devrait parser les citations (blockquote) dans le contenu', () => {
      const markdown = `# Citations

> Ceci est une citation
> sur plusieurs lignes

Texte normal`;
      const result = parseMarkdownToTree(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('citation');
    });

    it('devrait parser les listes dans le contenu', () => {
      const markdown = `# Liste

- Item 1
- Item 2
- Item 3

Texte après`;
      const result = parseMarkdownToTree(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('Item 1');
    });
  });

  describe('parseMarkdownToTree -> treeToMarkdown (aller-retour)', () => {
    it('devrait préserver la structure après conversion', () => {
      const originalMarkdown = `# Document

Introduction

## Section 1

Contenu section 1

### Sous-section

Détails

## Section 2

Contenu section 2`;

      const tree = parseMarkdownToTree(originalMarkdown);
      const regenerated = treeToMarkdown(tree);
      const reparsed = parseMarkdownToTree(regenerated);
      
      // Vérifier que la structure est préservée
      expect(reparsed).toHaveLength(1);
      expect(reparsed[0].children).toHaveLength(2);
      expect(reparsed[0].children[0].children).toHaveLength(1);
    });
  });
});
