import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildContextSandwich,
  buildSystemPrompt,
  buildUserMessage,
  callAIAPI,
} from '../aiService';
import { NodeData } from '../types';
import { AIConfig } from '../store';

// Helper pour créer des nœuds de test
function createTestNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'test-node',
    heading: 'Test Node',
    headingDepth: 1,
    content: 'Test content',
    meta: {
      id: 'test-node',
      type: 'section',
    },
    children: [],
    ...overrides,
  };
}

describe('aiService', () => {
  describe('buildContextSandwich', () => {
    it('devrait construire un contexte sandwich basique', () => {
      const node = createTestNode();
      const result = buildContextSandwich([node], node);

      expect(result.currentNodeContent).toBe('Test content');
      expect(result.agentRole).toBe('Assistant');
      expect(result.agentInstructions).toBe('');
      expect(result.dependencies).toEqual([]);
      expect(result.nodePath).toHaveLength(1);
    });

    it('devrait extraire le contexte global des nœuds marqués isGlobal', () => {
      const globalNode = createTestNode({
        id: 'global-node',
        heading: 'Global Info',
        content: 'Global content',
        meta: {
          id: 'global-node',
          type: 'project-root',
          contextConfig: { isGlobal: true },
        },
      });
      const activeNode = createTestNode({
        id: 'active-node',
        heading: 'Active',
        content: 'Active content',
      });

      const result = buildContextSandwich([globalNode, activeNode], activeNode);

      expect(result.globalContext).toContain('Global Info');
      expect(result.globalContext).toContain('Global content');
    });

    it('devrait construire le chemin hiérarchique pour un nœud enfant', () => {
      const child = createTestNode({
        id: 'child-node',
        heading: 'Child',
        headingDepth: 2,
        content: 'Child content',
      });
      const parent = createTestNode({
        id: 'parent-node',
        heading: 'Parent',
        headingDepth: 1,
        content: 'Parent content',
        children: [child],
      });

      const result = buildContextSandwich([parent], child);

      expect(result.nodePath).toHaveLength(2);
      expect(result.nodePath[0].id).toBe('parent-node');
      expect(result.nodePath[1].id).toBe('child-node');
      expect(result.hierarchicalContext).toContain('Parent');
    });

    it('devrait utiliser le rôle et les instructions de l\'agent si configurés', () => {
      const node = createTestNode({
        meta: {
          id: 'test-node',
          type: 'section',
          agentConfig: {
            role: 'Expert Marketing',
            instructions: 'Analyse avec un focus marketing',
          },
        },
      });

      const result = buildContextSandwich([node], node);

      expect(result.agentRole).toBe('Expert Marketing');
      expect(result.agentInstructions).toBe('Analyse avec un focus marketing');
    });

    it('devrait résoudre les dépendances explicites', () => {
      const depNode = createTestNode({
        id: 'dep-node',
        heading: 'Dependency',
        content: 'Dependency content',
      });
      const activeNode = createTestNode({
        id: 'active-node',
        meta: {
          id: 'active-node',
          type: 'section',
          contextConfig: {
            isGlobal: false,
            dependencies: ['dep-node'],
          },
        },
      });

      const result = buildContextSandwich([depNode, activeNode], activeNode);

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].id).toBe('dep-node');
    });

    it('devrait ignorer les dépendances inexistantes', () => {
      const activeNode = createTestNode({
        id: 'active-node',
        meta: {
          id: 'active-node',
          type: 'section',
          contextConfig: {
            isGlobal: false,
            dependencies: ['non-existent-id'],
          },
        },
      });

      const result = buildContextSandwich([activeNode], activeNode);

      expect(result.dependencies).toHaveLength(0);
    });

    it('devrait trouver les nœuds globaux dans les enfants', () => {
      const globalChild = createTestNode({
        id: 'global-child',
        heading: 'Global Child',
        content: 'Global child content',
        headingDepth: 2,
        meta: {
          id: 'global-child',
          type: 'section',
          contextConfig: { isGlobal: true },
        },
      });
      const parent = createTestNode({
        id: 'parent',
        heading: 'Parent',
        children: [globalChild],
      });
      const activeNode = createTestNode({ id: 'active' });

      const result = buildContextSandwich([parent, activeNode], activeNode);

      expect(result.globalContext).toContain('Global Child');
    });

    it('injecte les documents additionnels dans le contexte global', () => {
      const node = createTestNode();
      const result = buildContextSandwich([node], node, [
        { name: 'Personnages', markdown: '# Alice\n\nbrave' },
        { name: 'Décors', markdown: '# Forêt' },
      ]);

      expect(result.globalContext).toContain('Documents additionnels');
      expect(result.globalContext).toContain('Personnages');
      expect(result.globalContext).toContain('Alice');
      expect(result.globalContext).toContain('Décors');
    });

    it('marque les documents additionnels vides comme "(vide)"', () => {
      const node = createTestNode();
      const result = buildContextSandwich([node], node, [
        { name: 'Brouillon', markdown: '   ' },
      ]);
      expect(result.globalContext).toContain('(vide)');
    });

    it('omet la section "Documents additionnels" quand aucune fournie', () => {
      const node = createTestNode();
      const result = buildContextSandwich([node], node);
      expect(result.globalContext).not.toContain('Documents additionnels');
    });
  });

  describe('buildSystemPrompt', () => {
    it('devrait construire un prompt système pour le mode discussion', () => {
      const context = buildContextSandwich(
        [createTestNode()],
        createTestNode()
      );

      const prompt = buildSystemPrompt(context, 'discussion');

      expect(prompt).toContain('MODE DISCUSSION');
      expect(prompt).toContain('TON RÔLE');
      expect(prompt).not.toContain('MODE STRUCTURATION');
    });

    it('le mode discussion encourage l\'IA à proposer du contenu insérable', () => {
      const context = buildContextSandwich([createTestNode()], createTestNode());
      const prompt = buildSystemPrompt(context, 'discussion');
      // The Discussion prompt must mention proactive content/subsection emission
      // so that the existing one-click insertion UI gets triggered when relevant.
      expect(prompt).toMatch(/proactivement|proposes/i);
      expect(prompt).toContain('📝 CONTENU');
      expect(prompt).toContain('🏗️ SOUS-SECTIONS');
    });

    it('le mode discussion rappelle d\'éviter les doublons avec l\'existant', () => {
      const context = buildContextSandwich([createTestNode()], createTestNode());
      const prompt = buildSystemPrompt(context, 'discussion');
      expect(prompt).toMatch(/duplique|cohérence|existant/i);
    });

    it('devrait construire un prompt système pour le mode structuration', () => {
      const context = buildContextSandwich(
        [createTestNode()],
        createTestNode()
      );

      const prompt = buildSystemPrompt(context, 'structuration');

      expect(prompt).toContain('MODE STRUCTURATION');
      expect(prompt).toContain('CHEF DE PROJET');
    });

    it('devrait inclure le contexte global quand présent', () => {
      const globalNode = createTestNode({
        id: 'global',
        heading: 'Global',
        content: 'Global info',
        meta: {
          id: 'global',
          type: 'project-root',
          contextConfig: { isGlobal: true },
        },
      });
      const activeNode = createTestNode();
      const context = buildContextSandwich([globalNode, activeNode], activeNode);

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('CONTEXTE GLOBAL DU PROJET');
      expect(prompt).toContain('Global info');
    });

    it('devrait inclure les instructions de l\'agent quand configurées', () => {
      const node = createTestNode({
        meta: {
          id: 'test',
          type: 'section',
          agentConfig: {
            role: 'Expert',
            instructions: 'Instructions spéciales',
          },
        },
      });
      const context = buildContextSandwich([node], node);

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('Instructions spéciales');
    });

    it('devrait inclure le chemin quand il y a plusieurs nœuds', () => {
      const child = createTestNode({
        id: 'child',
        heading: 'Child Node',
        headingDepth: 2,
      });
      const parent = createTestNode({
        id: 'parent',
        heading: 'Parent Node',
        children: [child],
      });
      const context = buildContextSandwich([parent], child);

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('Chemin');
      expect(prompt).toContain('Parent Node > Child Node');
    });

    it('devrait inclure les dépendances quand présentes', () => {
      const depNode = createTestNode({
        id: 'dep',
        heading: 'Dependency',
        content: 'Dep content',
      });
      const activeNode = createTestNode({
        id: 'active',
        meta: {
          id: 'active',
          type: 'section',
          contextConfig: { isGlobal: false, dependencies: ['dep'] },
        },
      });
      const context = buildContextSandwich([depNode, activeNode], activeNode);

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('CONTEXTE DÉPENDANT');
      expect(prompt).toContain('Dependency');
    });

    it('devrait utiliser le mode discussion par défaut', () => {
      const context = buildContextSandwich([createTestNode()], createTestNode());

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('MODE DISCUSSION');
    });

    it('devrait inclure le contexte hiérarchique pour les nœuds enfants', () => {
      const child = createTestNode({
        id: 'child',
        heading: 'Child',
        headingDepth: 2,
        content: 'Child content',
      });
      const parent = createTestNode({
        id: 'parent',
        heading: 'Parent',
        content: 'Parent content',
        children: [child],
      });
      const context = buildContextSandwich([parent], child);

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('POSITION DANS LA HIÉRARCHIE');
    });
  });

  describe('buildUserMessage', () => {
    it('devrait construire un message utilisateur basique', () => {
      const node = createTestNode({
        heading: 'Mon Nœud',
        content: 'Contenu du nœud',
      });
      const context = buildContextSandwich([node], node);

      const message = buildUserMessage(context, 'Ma question');

      expect(message).toContain('Mon Nœud');
      expect(message).toContain('Ma question');
      expect(message).toContain('Contenu du nœud');
    });

    it('devrait indiquer quand le nœud est vide', () => {
      const node = createTestNode({
        content: '',
      });
      const context = buildContextSandwich([node], node);

      const message = buildUserMessage(context, 'Question');

      expect(message).toContain('vide pour l\'instant');
    });

    it('devrait utiliser le titre du nœud dans le message', () => {
      const node = createTestNode({
        heading: 'Titre Spécifique',
      });
      const context = buildContextSandwich([node], node);

      const message = buildUserMessage(context, 'Test');

      expect(message).toContain('Titre Spécifique');
    });
  });

  describe('callAIAPI', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('devrait lever une erreur si la clé API est manquante', async () => {
      const config: AIConfig = {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-pro',
        chatMode: 'discussion',
      };

      await expect(callAIAPI('system', 'user', config)).rejects.toThrow(
        'Clé API manquante'
      );
    });

    it('devrait appeler Gemini quand le provider est gemini', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Réponse Gemini' }],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const config: AIConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-pro',
        chatMode: 'discussion',
      };

      const result = await callAIAPI('system prompt', 'user message', config);

      expect(result).toBe('Réponse Gemini');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object)
      );
    });

    it('devrait appeler OpenAI quand le provider est openai', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Réponse OpenAI' },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        chatMode: 'discussion',
      };

      const result = await callAIAPI('system prompt', 'user message', config);

      expect(result).toBe('Réponse OpenAI');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('devrait gérer les erreurs Gemini', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key'),
      });

      const config: AIConfig = {
        provider: 'gemini',
        apiKey: 'invalid-key',
        model: 'gemini-pro',
        chatMode: 'discussion',
      };

      await expect(callAIAPI('system', 'user', config)).rejects.toThrow(
        'Erreur Gemini'
      );
    });

    it('devrait gérer les erreurs OpenAI', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'invalid-key',
        model: 'gpt-4',
        chatMode: 'discussion',
      };

      await expect(callAIAPI('system', 'user', config)).rejects.toThrow(
        'Erreur OpenAI'
      );
    });

    it('devrait lever une erreur pour une réponse Gemini vide', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      });

      const config: AIConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-pro',
        chatMode: 'discussion',
      };

      await expect(callAIAPI('system', 'user', config)).rejects.toThrow(
        'Réponse Gemini vide'
      );
    });

    it('devrait lever une erreur pour une réponse OpenAI vide', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        chatMode: 'discussion',
      };

      await expect(callAIAPI('system', 'user', config)).rejects.toThrow(
        'Réponse OpenAI vide'
      );
    });

    it('devrait utiliser une température de 1.0 pour Gemini 3', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Réponse' }],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const config: AIConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-3-pro-preview',
        chatMode: 'discussion',
      };

      await callAIAPI('system', 'user', config);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"temperature":1'),
        })
      );
    });

    it('devrait gérer les erreurs OpenAI sans message d\'erreur détaillé', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      });

      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        chatMode: 'discussion',
      };

      await expect(callAIAPI('system', 'user', config)).rejects.toThrow(
        'Erreur HTTP 500'
      );
    });

    it('devrait trouver une dépendance profondément imbriquée', () => {
      const deepNode = createTestNode({
        id: 'deep-dep',
        heading: 'Deep Dependency',
        content: 'Deep content',
      });
      const middleNode = createTestNode({
        id: 'middle',
        heading: 'Middle',
        children: [deepNode],
      });
      const rootNode = createTestNode({
        id: 'root',
        heading: 'Root',
        children: [middleNode],
      });
      const activeNode = createTestNode({
        id: 'active',
        meta: {
          id: 'active',
          type: 'section',
          contextConfig: {
            isGlobal: false,
            dependencies: ['deep-dep'],
          },
        },
      });

      const result = buildContextSandwich([rootNode, activeNode], activeNode);

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].id).toBe('deep-dep');
      expect(result.dependencies[0].heading).toBe('Deep Dependency');
    });
  });
});
