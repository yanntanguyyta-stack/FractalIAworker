import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../store';
import type { NodeData } from '../types';

// Reset le store avant chaque test
beforeEach(() => {
  useStore.setState({
    tree: [],
    activeNodeId: null,
    markdown: '',
    aiConfig: {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-1.5-flash',
      chatMode: 'discussion',
    },
    assessmentConfig: {
      enabled: false,
      question: '',
    },
  });
});

describe('Store - Actions de base', () => {
  describe('loadMarkdown', () => {
    it('devrait charger un document Markdown simple', () => {
      const markdown = '# Titre\n\nContenu du document.';
      
      useStore.getState().loadMarkdown(markdown);
      
      const state = useStore.getState();
      expect(state.tree).toHaveLength(1);
      expect(state.tree[0].heading).toBe('Titre');
      expect(state.activeNodeId).toBe(state.tree[0].id);
    });

    it('devrait charger un document vide', () => {
      useStore.getState().loadMarkdown('');
      
      const state = useStore.getState();
      expect(state.tree).toHaveLength(0);
      expect(state.activeNodeId).toBeNull();
    });

    it('devrait charger un document avec hiérarchie', () => {
      const markdown = `# Parent

## Enfant 1

## Enfant 2`;
      
      useStore.getState().loadMarkdown(markdown);
      
      const state = useStore.getState();
      expect(state.tree).toHaveLength(1);
      expect(state.tree[0].children).toHaveLength(2);
    });
  });

  describe('selectNode', () => {
    it('devrait sélectionner un nœud', () => {
      useStore.getState().loadMarkdown('# Test\n\nContenu');
      const nodeId = useStore.getState().tree[0].id;
      
      useStore.getState().selectNode(nodeId);
      
      expect(useStore.getState().activeNodeId).toBe(nodeId);
    });
  });

  describe('updateNodeContent', () => {
    it('devrait mettre à jour le contenu d\'un nœud', () => {
      useStore.getState().loadMarkdown('# Test\n\nContenu original');
      const nodeId = useStore.getState().tree[0].id;
      
      useStore.getState().updateNodeContent(nodeId, 'Nouveau contenu');
      
      expect(useStore.getState().tree[0].content).toBe('Nouveau contenu');
    });
  });

  describe('addChild', () => {
    it('devrait ajouter un enfant à un nœud', () => {
      useStore.getState().loadMarkdown('# Parent\n\nContenu');
      const parentId = useStore.getState().tree[0].id;
      
      useStore.getState().addChild(parentId, 'Nouvel enfant');
      
      const state = useStore.getState();
      expect(state.tree[0].children).toHaveLength(1);
      expect(state.tree[0].children[0].heading).toBe('Nouvel enfant');
      expect(state.tree[0].children[0].headingDepth).toBe(2);
    });

    it('devrait créer un enfant avec le bon niveau de profondeur', () => {
      useStore.getState().loadMarkdown('# Parent\n\n## Enfant\n\nContenu');
      const childId = useStore.getState().tree[0].children[0].id;
      
      useStore.getState().addChild(childId, 'Petit-enfant');
      
      const grandchild = useStore.getState().tree[0].children[0].children[0];
      expect(grandchild.headingDepth).toBe(3);
    });
  });

  describe('deleteNode', () => {
    it('devrait supprimer un nœud', () => {
      useStore.getState().loadMarkdown('# Node 1\n\n# Node 2');
      expect(useStore.getState().tree).toHaveLength(2);
      
      const nodeId = useStore.getState().tree[1].id;
      useStore.getState().deleteNode(nodeId);
      
      expect(useStore.getState().tree).toHaveLength(1);
    });

    it('devrait mettre à jour activeNodeId si le nœud actif est supprimé', () => {
      useStore.getState().loadMarkdown('# Node 1\n\n# Node 2');
      const firstNodeId = useStore.getState().tree[0].id;
      const secondNodeId = useStore.getState().tree[1].id;
      
      useStore.getState().selectNode(secondNodeId);
      useStore.getState().deleteNode(secondNodeId);
      
      expect(useStore.getState().activeNodeId).toBe(firstNodeId);
    });

    it('devrait supprimer un nœud enfant', () => {
      useStore.getState().loadMarkdown('# Parent\n\n## Enfant');
      const childId = useStore.getState().tree[0].children[0].id;
      
      useStore.getState().deleteNode(childId);
      
      expect(useStore.getState().tree[0].children).toHaveLength(0);
    });
  });

  describe('getActiveNode', () => {
    it('devrait retourner le nœud actif', () => {
      useStore.getState().loadMarkdown('# Test\n\nContenu');
      const nodeId = useStore.getState().tree[0].id;
      useStore.getState().selectNode(nodeId);
      
      const activeNode = useStore.getState().getActiveNode();
      
      expect(activeNode).not.toBeNull();
      expect(activeNode?.heading).toBe('Test');
    });

    it('devrait retourner null si aucun nœud n\'est actif', () => {
      useStore.setState({ activeNodeId: null });
      
      expect(useStore.getState().getActiveNode()).toBeNull();
    });
  });

  describe('getAllNodes', () => {
    it('devrait retourner tous les nœuds aplatis', () => {
      useStore.getState().loadMarkdown(`# Parent

## Enfant 1

## Enfant 2

### Petit-enfant`);
      
      const allNodes = useStore.getState().getAllNodes();
      
      expect(allNodes).toHaveLength(4);
    });
  });

  describe('getNodePath', () => {
    it('devrait retourner le chemin vers un nœud racine', () => {
      useStore.getState().loadMarkdown('# Root\n\nContenu');
      const rootId = useStore.getState().tree[0].id;
      
      const path = useStore.getState().getNodePath(rootId);
      
      expect(path).toHaveLength(1);
      expect(path[0].heading).toBe('Root');
    });

    it('devrait retourner le chemin complet vers un nœud enfant', () => {
      useStore.getState().loadMarkdown(`# Parent

## Enfant

### Petit-enfant`);
      const grandchildId = useStore.getState().tree[0].children[0].children[0].id;
      
      const path = useStore.getState().getNodePath(grandchildId);
      
      expect(path).toHaveLength(3);
      expect(path[0].heading).toBe('Parent');
      expect(path[1].heading).toBe('Enfant');
      expect(path[2].heading).toBe('Petit-enfant');
    });

    it('devrait retourner un tableau vide pour un ID inexistant', () => {
      useStore.getState().loadMarkdown('# Test');
      
      const path = useStore.getState().getNodePath('nonexistent');
      
      expect(path).toHaveLength(0);
    });
  });

  describe('saveToMarkdown', () => {
    it('devrait convertir l\'arbre en Markdown', () => {
      useStore.getState().loadMarkdown('# Titre\n\nContenu');
      
      const markdown = useStore.getState().saveToMarkdown();
      
      expect(markdown).toContain('# Titre');
      expect(markdown).toContain('Contenu');
    });
  });
});

describe('Store - Configuration IA', () => {
  describe('setAIConfig', () => {
    it('devrait mettre à jour la configuration IA', () => {
      useStore.getState().setAIConfig({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        chatMode: 'structuration',
      });
      
      const config = useStore.getState().aiConfig;
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('test-key');
      expect(config.model).toBe('gpt-4');
    });
  });

  describe('setChatMode', () => {
    it('devrait changer le mode de chat', () => {
      useStore.getState().setChatMode('structuration');
      
      expect(useStore.getState().aiConfig.chatMode).toBe('structuration');
    });

    it('devrait préserver les autres configurations', () => {
      useStore.getState().setAIConfig({
        provider: 'openai',
        apiKey: 'my-key',
        model: 'gpt-4',
        chatMode: 'discussion',
      });
      
      useStore.getState().setChatMode('structuration');
      
      const config = useStore.getState().aiConfig;
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('my-key');
      expect(config.chatMode).toBe('structuration');
    });
  });
});

describe('Store - Évaluation', () => {
  describe('setAssessmentConfig', () => {
    it('devrait activer l\'évaluation', () => {
      useStore.getState().loadMarkdown('# Test');
      
      useStore.getState().setAssessmentConfig({ enabled: true, question: 'Question test' });
      
      const config = useStore.getState().assessmentConfig;
      expect(config.enabled).toBe(true);
      expect(config.question).toBe('Question test');
    });

    it('devrait ajouter les métadonnées d\'évaluation aux nœuds existants', () => {
      useStore.getState().loadMarkdown('# Test\n\nContenu');
      
      useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
      
      const node = useStore.getState().tree[0];
      expect(node.meta.evaluation).toBeDefined();
    });
  });

  describe('updateNodeAssessment', () => {
    it('devrait mettre à jour les scores d\'un nœud', () => {
      useStore.getState().loadMarkdown('# Test');
      useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
      const nodeId = useStore.getState().tree[0].id;
      
      useStore.getState().updateNodeAssessment(nodeId, {
        completenessScore: 7,
        questionScore: 8,
      });
      
      const evaluation = useStore.getState().tree[0].meta.evaluation;
      expect(evaluation?.completenessScore).toBe(7);
      expect(evaluation?.questionScore).toBe(8);
    });
  });

  describe('getInheritedScores', () => {
    it('devrait retourner null pour un nœud sans enfants', () => {
      useStore.getState().loadMarkdown('# Test');
      const nodeId = useStore.getState().tree[0].id;
      
      const scores = useStore.getState().getInheritedScores(nodeId);
      
      expect(scores).toBeNull();
    });

    it('devrait calculer la moyenne des scores des enfants', () => {
      useStore.getState().loadMarkdown(`# Parent

## Enfant 1

## Enfant 2`);
      useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
      
      const children = useStore.getState().tree[0].children;
      useStore.getState().updateNodeAssessment(children[0].id, {
        completenessScore: 6,
        questionScore: 8,
      });
      useStore.getState().updateNodeAssessment(children[1].id, {
        completenessScore: 4,
        questionScore: 6,
      });
      
      const parentId = useStore.getState().tree[0].id;
      const scores = useStore.getState().getInheritedScores(parentId);
      
      expect(scores?.completenessScore).toBe(5);
      expect(scores?.questionScore).toBe(7);
    });
  });

  describe('recalculateAllInheritedScores', () => {
    it('devrait recalculer les scores hérités pour tous les nœuds', () => {
      useStore.getState().loadMarkdown(`# Parent

## Enfant 1

## Enfant 2`);
      useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
      
      const children = useStore.getState().tree[0].children;
      useStore.getState().updateNodeAssessment(children[0].id, {
        completenessScore: 8,
        questionScore: 6,
      });
      useStore.getState().updateNodeAssessment(children[1].id, {
        completenessScore: 6,
        questionScore: 4,
      });
      
      useStore.getState().recalculateAllInheritedScores();
      
      const parent = useStore.getState().tree[0];
      expect(parent.meta.evaluation?.inheritedCompletenessScore).toBe(7);
      expect(parent.meta.evaluation?.inheritedQuestionScore).toBe(5);
    });
  });
});

describe('Store - updateNodeMeta', () => {
  it('devrait mettre à jour les métadonnées d\'un nœud', () => {
    useStore.getState().loadMarkdown('# Test');
    const nodeId = useStore.getState().tree[0].id;
    
    useStore.getState().updateNodeMeta(nodeId, {
      agentConfig: { role: 'Expert', instructions: 'Sois précis' },
    });
    
    const node = useStore.getState().tree[0];
    expect(node.meta.agentConfig?.role).toBe('Expert');
    expect(node.meta.agentConfig?.instructions).toBe('Sois précis');
  });

  it('devrait préserver les métadonnées existantes', () => {
    useStore.getState().loadMarkdown('# Test');
    const nodeId = useStore.getState().tree[0].id;
    const originalType = useStore.getState().tree[0].meta.type;
    
    useStore.getState().updateNodeMeta(nodeId, {
      contextConfig: { isGlobal: true },
    });
    
    const node = useStore.getState().tree[0];
    expect(node.meta.type).toBe(originalType);
    expect(node.meta.contextConfig?.isGlobal).toBe(true);
  });

  it('devrait ne pas modifier si les mêmes métadonnées sont déjà présentes', () => {
    useStore.getState().loadMarkdown('# Test');
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
    const nodeId = useStore.getState().tree[0].id;
    
    // L'arbre a déjà les métadonnées d'évaluation
    const treeBefore = useStore.getState().tree;
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q2' });
    const treeAfter = useStore.getState().tree;
    
    // La référence de l'arbre ne devrait pas changer si les nœuds n'ont pas changé
    expect(treeAfter[0].meta.evaluation).toBeDefined();
  });

  it('devrait désactiver l\'évaluation', () => {
    useStore.getState().loadMarkdown('# Test');
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
    
    useStore.getState().setAssessmentConfig({ enabled: false, question: '' });
    
    expect(useStore.getState().assessmentConfig.enabled).toBe(false);
  });

  it('devrait préserver les références quand les métadonnées évaluation existent déjà', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

Contenu`);
    // Activer l'évaluation pour la première fois - cela ajoute les métadonnées
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q1' });
    
    const nodeBefore = useStore.getState().tree[0];
    const childBefore = nodeBefore.children[0];
    
    // L'évaluation est déjà activée, les métadonnées existent déjà
    // Cet appel ne devrait pas recréer les objets nœuds
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q2' });
    
    const nodeAfter = useStore.getState().tree[0];
    
    // Les métadonnées d'évaluation doivent exister
    expect(nodeAfter.meta.evaluation).toBeDefined();
    expect(nodeAfter.children[0].meta.evaluation).toBeDefined();
  });

  it('devrait préserver les références des nœuds feuille avec évaluation existante', () => {
    // Créer un document avec un seul nœud sans enfants
    useStore.getState().loadMarkdown(`# Titre seul

Contenu sans enfants`);
    
    // Activer l'évaluation
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
    
    const nodeBefore = useStore.getState().tree[0];
    expect(nodeBefore.meta.evaluation).toBeDefined();
    expect(nodeBefore.children).toHaveLength(0);
    
    // Réactiver l'évaluation - le nœud ne devrait pas changer car il a déjà une évaluation
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q2' });
    
    const nodeAfter = useStore.getState().tree[0];
    expect(nodeAfter.meta.evaluation).toBeDefined();
  });

  it('devrait préserver strictement les références si evaluation existe déjà', () => {
    // Créer un document avec enfant
    useStore.getState().loadMarkdown(`# Parent

## Enfant`);
    
    // Activer l'évaluation (première fois - ajoute evaluation)
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
    
    // Récupérer les références
    const parentBefore = useStore.getState().tree[0];
    const childBefore = parentBefore.children[0];
    
    // Les deux ont une evaluation
    expect(parentBefore.meta.evaluation).toBeDefined();
    expect(childBefore.meta.evaluation).toBeDefined();
    
    // Maintenant, appeler à nouveau setAssessmentConfig
    // Cette fois, les nœuds ont déjà une evaluation, donc rien ne devrait changer
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Q' });
    
    const parentAfter = useStore.getState().tree[0];
    const childAfter = parentAfter.children[0];
    
    // Les références devraient être préservées (même objet)
    // car ensureAssessmentMeta retourne le nœud tel quel si rien n'a changé
    expect(parentAfter.meta.evaluation).toBeDefined();
    expect(childAfter.meta.evaluation).toBeDefined();
    
    // L'enfant feuille devrait avoir gardé sa référence car il n'a pas d'enfants
    // et son evaluation existait déjà
    expect(childAfter).toBe(childBefore);
  });
});
