import { describe, it, expect } from 'vitest';
import { INITIAL_MARKDOWN } from '../mockData';
import { parseMarkdownToTree } from '../markdownEngine';

describe('mockData', () => {
  it('devrait exporter INITIAL_MARKDOWN comme une chaîne non vide', () => {
    expect(typeof INITIAL_MARKDOWN).toBe('string');
    expect(INITIAL_MARKDOWN.length).toBeGreaterThan(0);
  });

  it('devrait contenir un document Markdown valide', () => {
    const tree = parseMarkdownToTree(INITIAL_MARKDOWN);
    
    expect(tree.length).toBeGreaterThan(0);
  });

  it('devrait contenir un titre de projet', () => {
    expect(INITIAL_MARKDOWN).toContain('# ');
  });

  it('devrait contenir des métadonnées JSON', () => {
    expect(INITIAL_MARKDOWN).toContain('<!-- {');
    expect(INITIAL_MARKDOWN).toContain('"meta"');
  });

  it('devrait avoir des nœuds avec des configurations d\'agent', () => {
    expect(INITIAL_MARKDOWN).toContain('agentConfig');
    expect(INITIAL_MARKDOWN).toContain('role');
  });

  it('devrait avoir des nœuds avec des configurations de contexte', () => {
    expect(INITIAL_MARKDOWN).toContain('contextConfig');
    expect(INITIAL_MARKDOWN).toContain('isGlobal');
  });

  it('devrait avoir une hiérarchie multi-niveaux', () => {
    expect(INITIAL_MARKDOWN).toContain('## ');
    expect(INITIAL_MARKDOWN).toContain('### ');
  });

  it('devrait parser correctement la structure', () => {
    const tree = parseMarkdownToTree(INITIAL_MARKDOWN);
    
    // Le premier nœud devrait être la racine du projet
    expect(tree[0].headingDepth).toBe(1);
    
    // Il devrait y avoir des enfants
    expect(tree[0].children.length).toBeGreaterThan(0);
  });
});
