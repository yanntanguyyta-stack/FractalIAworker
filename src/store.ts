import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeData } from './types';
import {
  parseMarkdownToTree,
  treeToMarkdown,
  updateNodeInTree,
  findNodeById,
  flattenTree,
} from './markdownEngine';

// Configuration IA
export type AIProvider = 'gemini' | 'openai';
export type ChatMode = 'discussion' | 'structuration';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  chatMode: ChatMode;
}

export interface AssessmentConfig {
  enabled: boolean;
  question: string;
}

interface EditorState {
  // Données
  tree: NodeData[];
  activeNodeId: string | null;
  markdown: string;
  
  // Configuration IA
  aiConfig: AIConfig;
  assessmentConfig: AssessmentConfig;

  // Actions
  loadMarkdown: (markdown: string) => void;
  saveToMarkdown: () => string;
  selectNode: (nodeId: string) => void;
  updateNodeContent: (nodeId: string, content: string) => void;
  updateNodeMeta: (nodeId: string, updates: Partial<NodeData['meta']>) => void;
  addChild: (parentId: string, heading: string) => void;
  deleteNode: (nodeId: string) => void;
  getActiveNode: () => NodeData | null;
  getAllNodes: () => NodeData[];
  getNodePath: (nodeId: string) => NodeData[]; // Breadcrumb: chemin vers un nœud
  
  // Actions IA
  setAIConfig: (config: AIConfig) => void;
  setChatMode: (mode: ChatMode) => void;

  // Actions Évaluation
  setAssessmentConfig: (config: AssessmentConfig) => void;
  updateNodeAssessment: (nodeId: string, updates: Partial<NodeData['meta']['evaluation']>) => void;
  
  // Calcul des notes héritées
  getInheritedScores: (nodeId: string) => { completenessScore: number; questionScore: number } | null;
  recalculateAllInheritedScores: () => void;
}

// Générer un ID simple
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Configuration IA par défaut
const defaultAIConfig: AIConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-1.5-flash',
  chatMode: 'discussion',
};

const defaultAssessmentConfig: AssessmentConfig = {
  enabled: false,
  question: '',
};

const defaultEvaluation = {
  completenessScore: 0,
  questionScore: 0,
};

function ensureAssessmentMeta(nodes: NodeData[]): NodeData[] {
  return nodes.map(node => {
    const evaluation = node.meta.evaluation ?? { ...defaultEvaluation };
    const updatedMeta = node.meta.evaluation ? node.meta : { ...node.meta, evaluation };
    const updatedChildren = node.children.length > 0 ? ensureAssessmentMeta(node.children) : node.children;
    if (updatedMeta === node.meta && updatedChildren === node.children) {
      return node;
    }
    return {
      ...node,
      meta: updatedMeta,
      children: updatedChildren,
    };
  });
}

export const useStore = create<EditorState>()(
  persist(
    (set, get) => ({
      tree: [],
      activeNodeId: null,
      markdown: '',
      aiConfig: defaultAIConfig,
      assessmentConfig: defaultAssessmentConfig,

  // Charger le Markdown et parser l'arbre
  loadMarkdown: (markdown: string) => {
    const parsedTree = parseMarkdownToTree(markdown);
    const { assessmentConfig } = get();
    const tree = assessmentConfig.enabled ? ensureAssessmentMeta(parsedTree) : parsedTree;
    const activeNodeId = tree.length > 0 ? tree[0].id : null;
    set({ tree, markdown, activeNodeId });
  },

  // Sauvegarder l'arbre en Markdown
  saveToMarkdown: () => {
    const { tree } = get();
    const markdown = treeToMarkdown(tree);
    set({ markdown });
    return markdown;
  },

  // Sélectionner un nœud actif
  selectNode: (nodeId: string) => {
    set({ activeNodeId: nodeId });
  },

  // Mettre à jour le contenu d'un nœud
  updateNodeContent: (nodeId: string, content: string) => {
    const { tree } = get();
    const updated = updateNodeInTree(tree, nodeId, { content });
    set({ tree: updated });
  },

  // Mettre à jour les métadonnées d'un nœud
  updateNodeMeta: (nodeId: string, updates: Partial<NodeData['meta']>) => {
    const { tree } = get();
    const node = findNodeById(tree, nodeId);
    if (node) {
      const updatedMeta = { ...node.meta, ...updates };
      const updated = updateNodeInTree(tree, nodeId, { meta: updatedMeta });
      set({ tree: updated });
    }
  },

  // Ajouter un enfant à un nœud
  addChild: (parentId: string, heading: string) => {
    const { tree } = get();
    const parent = findNodeById(tree, parentId);
    if (parent) {
      const { assessmentConfig } = get();
      const newNode: NodeData = {
        id: generateId(),
        heading,
        headingDepth: parent.headingDepth + 1,
        content: '',
        meta: {
          id: generateId(),
          type: 'section',
          evaluation: assessmentConfig.enabled ? { ...defaultEvaluation } : undefined,
        },
        children: [],
      };
      const updated = updateNodeInTree(tree, parentId, {
        children: [...parent.children, newNode],
      });
      set({ tree: updated });
    }
  },

  // Supprimer un nœud
  deleteNode: (nodeId: string) => {
    const { tree, activeNodeId } = get();
    
    function removeNode(nodes: NodeData[]): NodeData[] {
      return nodes
        .filter(n => n.id !== nodeId)
        .map(n => ({
          ...n,
          children: removeNode(n.children),
        }));
    }

    const updated = removeNode(tree);
    const newActiveId = activeNodeId === nodeId ? (updated.length > 0 ? updated[0].id : null) : activeNodeId;
    set({ tree: updated, activeNodeId: newActiveId });
  },

  // Obtenir le nœud actif
  getActiveNode: () => {
    const { tree, activeNodeId } = get();
    if (!activeNodeId) return null;
    return findNodeById(tree, activeNodeId);
  },

  // Obtenir tous les nœuds aplatis
  getAllNodes: () => {
    const { tree } = get();
    return flattenTree(tree);
  },

  // Obtenir le chemin (breadcrumb) vers un nœud
  getNodePath: (nodeId: string) => {
    const { tree } = get();
    const path: NodeData[] = [];
    
    function findPath(nodes: NodeData[], currentPath: NodeData[]): boolean {
      for (const node of nodes) {
        const newPath = [...currentPath, node];
        if (node.id === nodeId) {
          path.push(...newPath);
          return true;
        }
        if (node.children.length > 0) {
          if (findPath(node.children, newPath)) {
            return true;
          }
        }
      }
      return false;
    }
    
    findPath(tree, []);
    return path;
  },

  // Mettre à jour la configuration IA
  setAIConfig: (config: AIConfig) => {
    set({ aiConfig: config });
  },

  // Changer le mode de chat
  setChatMode: (mode: ChatMode) => {
    const { aiConfig } = get();
    set({ aiConfig: { ...aiConfig, chatMode: mode } });
  },

  setAssessmentConfig: (config: AssessmentConfig) => {
    const { assessmentConfig, tree } = get();
    if (!assessmentConfig.enabled && config.enabled) {
      const updatedTree = ensureAssessmentMeta(tree);
      set({ assessmentConfig: config, tree: updatedTree });
      return;
    }
    set({ assessmentConfig: config });
  },

  updateNodeAssessment: (nodeId: string, updates: Partial<NodeData['meta']['evaluation']>) => {
    const { tree } = get();
    const node = findNodeById(tree, nodeId);
    if (node) {
      const baseEvaluation = node.meta.evaluation ?? defaultEvaluation;
      const evaluation = { ...baseEvaluation, ...updates };
      const updatedMeta = { ...node.meta, evaluation };
      const updated = updateNodeInTree(tree, nodeId, { meta: updatedMeta });
      set({ tree: updated });
    }
  },

  // Calcule les notes héritées d'un nœud (moyenne des enfants directs)
  getInheritedScores: (nodeId: string) => {
    const { tree } = get();
    const node = findNodeById(tree, nodeId);
    if (!node || node.children.length === 0) return null;

    let totalCompleteness = 0;
    let totalQuestion = 0;
    let count = 0;

    for (const child of node.children) {
      const childScore = child.meta.evaluation;
      if (childScore) {
        totalCompleteness += childScore.completenessScore ?? 0;
        totalQuestion += childScore.questionScore ?? 0;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      completenessScore: Math.round((totalCompleteness / count) * 10) / 10,
      questionScore: Math.round((totalQuestion / count) * 10) / 10,
    };
  },

  // Recalcule les notes héritées pour tous les nœuds (bottom-up)
  recalculateAllInheritedScores: () => {
    const { tree } = get();

    // Fonction récursive qui calcule les scores bottom-up
    function calculateScores(nodes: NodeData[]): NodeData[] {
      return nodes.map(node => {
        // D'abord, traiter les enfants récursivement
        const updatedChildren = node.children.length > 0 
          ? calculateScores(node.children) 
          : node.children;

        // Si le nœud a des enfants, calculer les scores hérités
        if (updatedChildren.length > 0) {
          let totalCompleteness = 0;
          let totalQuestion = 0;
          let count = 0;

          for (const child of updatedChildren) {
            const childEval = child.meta.evaluation;
            if (childEval) {
              totalCompleteness += childEval.completenessScore ?? 0;
              totalQuestion += childEval.questionScore ?? 0;
              count++;
            }
          }

          if (count > 0) {
            const inheritedCompleteness = Math.round((totalCompleteness / count) * 10) / 10;
            const inheritedQuestion = Math.round((totalQuestion / count) * 10) / 10;
            
            return {
              ...node,
              children: updatedChildren,
              meta: {
                ...node.meta,
                evaluation: {
                  ...node.meta.evaluation,
                  inheritedCompletenessScore: inheritedCompleteness,
                  inheritedQuestionScore: inheritedQuestion,
                },
              },
            };
          }
        }

        return {
          ...node,
          children: updatedChildren,
        };
      });
    }

    const updatedTree = calculateScores(tree);
    set({ tree: updatedTree });
  },
    }),
    {
      name: 'irlm-ai-config',
      partialize: (state) => ({ aiConfig: state.aiConfig, assessmentConfig: state.assessmentConfig }),
    }
  )
);
