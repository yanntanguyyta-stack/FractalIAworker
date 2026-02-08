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
export type ChatMode = 'discussion' | 'redaction';

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
      const evaluation = { ...defaultEvaluation, ...node.meta.evaluation, ...updates };
      const updatedMeta = { ...node.meta, evaluation };
      const updated = updateNodeInTree(tree, nodeId, { meta: updatedMeta });
      set({ tree: updated });
    }
  },
    }),
    {
      name: 'irlm-ai-config',
      partialize: (state) => ({ aiConfig: state.aiConfig, assessmentConfig: state.assessmentConfig }),
    }
  )
);
