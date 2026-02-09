import { describe, it, expect } from 'vitest';
import {
  AgentConfigSchema,
  ContextConfigSchema,
  UIConfigSchema,
  NodeEvaluationSchema,
  NodeMetaSchema,
  NodeDataSchema,
  ProjectRootSchema,
} from '../types';

describe('types - Schémas Zod', () => {
  describe('AgentConfigSchema', () => {
    it('devrait valider une configuration agent valide', () => {
      const config = {
        role: 'Expert Marketing',
        instructions: 'Sois précis et analytique',
      };
      
      const result = AgentConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un rôle vide', () => {
      const config = {
        role: '',
        instructions: 'Test',
      };
      
      const result = AgentConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('devrait accepter un tone optionnel', () => {
      const config = {
        role: 'Assistant',
        instructions: 'Aide l\'utilisateur',
        tone: 'professionnel',
      };
      
      const result = AgentConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tone).toBe('professionnel');
      }
    });

    it('devrait rejeter les propriétés inconnues (strict)', () => {
      const config = {
        role: 'Test',
        instructions: 'Test',
        unknown: 'value',
      };
      
      const result = AgentConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('ContextConfigSchema', () => {
    it('devrait valider une configuration contexte valide', () => {
      const config = {
        isGlobal: true,
        dependencies: ['node-1', 'node-2'],
      };
      
      const result = ContextConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('devrait utiliser false par défaut pour isGlobal', () => {
      const config = {};
      
      const result = ContextConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isGlobal).toBe(false);
      }
    });

    it('devrait accepter des dépendances vides', () => {
      const config = {
        isGlobal: false,
        dependencies: [],
      };
      
      const result = ContextConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('UIConfigSchema', () => {
    it('devrait valider une configuration UI valide', () => {
      const config = {
        x: 100,
        y: 200,
        collapsed: true,
      };
      
      const result = UIConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('devrait utiliser 0 par défaut pour x et y', () => {
      const config = {};
      
      const result = UIConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.x).toBe(0);
        expect(result.data.y).toBe(0);
      }
    });
  });

  describe('NodeEvaluationSchema', () => {
    it('devrait valider des scores valides', () => {
      const evaluation = {
        completenessScore: 7,
        questionScore: 8,
        inheritedCompletenessScore: 6,
        inheritedQuestionScore: 5,
      };
      
      const result = NodeEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter des scores hors limites', () => {
      const evaluation = {
        completenessScore: 15, // > 10
      };
      
      const result = NodeEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter des scores négatifs', () => {
      const evaluation = {
        questionScore: -1,
      };
      
      const result = NodeEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('devrait accepter un objet vide', () => {
      const evaluation = {};
      
      const result = NodeEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(true);
    });
  });

  describe('NodeMetaSchema', () => {
    it('devrait valider des métadonnées valides', () => {
      const meta = {
        id: 'node-123',
        type: 'section' as const,
      };
      
      const result = NodeMetaSchema.safeParse(meta);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un id vide', () => {
      const meta = {
        id: '',
        type: 'section' as const,
      };
      
      const result = NodeMetaSchema.safeParse(meta);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter un type invalide', () => {
      const meta = {
        id: 'test',
        type: 'invalid' as any,
      };
      
      const result = NodeMetaSchema.safeParse(meta);
      expect(result.success).toBe(false);
    });

    it('devrait accepter tous les types valides', () => {
      const types = ['project-root', 'section', 'task'] as const;
      
      for (const type of types) {
        const meta = { id: 'test', type };
        const result = NodeMetaSchema.safeParse(meta);
        expect(result.success).toBe(true);
      }
    });

    it('devrait accepter les configurations optionnelles', () => {
      const meta = {
        id: 'test',
        type: 'section' as const,
        parentId: 'parent',
        agentConfig: { role: 'Expert', instructions: '' },
        contextConfig: { isGlobal: true },
        ui: { x: 0, y: 0 },
        evaluation: { completenessScore: 5 },
      };
      
      const result = NodeMetaSchema.safeParse(meta);
      expect(result.success).toBe(true);
    });
  });

  describe('NodeDataSchema', () => {
    it('devrait valider un nœud simple', () => {
      const node = {
        id: 'node-1',
        heading: 'Titre',
        headingDepth: 1,
        content: 'Contenu du nœud',
        meta: { id: 'node-1', type: 'section' },
        children: [],
      };
      
      const result = NodeDataSchema.safeParse(node);
      expect(result.success).toBe(true);
    });

    it('devrait valider un nœud avec enfants', () => {
      const node = {
        id: 'parent',
        heading: 'Parent',
        headingDepth: 1,
        content: '',
        meta: { id: 'parent', type: 'project-root' },
        children: [
          {
            id: 'child',
            heading: 'Enfant',
            headingDepth: 2,
            content: 'Contenu enfant',
            meta: { id: 'child', type: 'section' },
            children: [],
          },
        ],
      };
      
      const result = NodeDataSchema.safeParse(node);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter une profondeur de titre invalide', () => {
      const node = {
        id: 'test',
        heading: 'Test',
        headingDepth: 7, // > 6
        content: '',
        meta: { id: 'test', type: 'section' },
        children: [],
      };
      
      const result = NodeDataSchema.safeParse(node);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter une profondeur de titre de 0', () => {
      const node = {
        id: 'test',
        heading: 'Test',
        headingDepth: 0, // < 1
        content: '',
        meta: { id: 'test', type: 'section' },
        children: [],
      };
      
      const result = NodeDataSchema.safeParse(node);
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectRootSchema', () => {
    it('devrait valider un projet valide', () => {
      const project = {
        nodes: [
          {
            id: 'root',
            heading: 'Projet',
            headingDepth: 1,
            content: 'Description',
            meta: { id: 'root', type: 'project-root' },
            children: [],
          },
        ],
      };
      
      const result = ProjectRootSchema.safeParse(project);
      expect(result.success).toBe(true);
    });

    it('devrait accepter un projet vide', () => {
      const project = { nodes: [] };
      
      const result = ProjectRootSchema.safeParse(project);
      expect(result.success).toBe(true);
    });
  });
});
