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

interface EditorState {
  // Données
  tree: NodeData[];
  activeNodeId: string | null;
  markdown: string;
  
  // Configuration IA
  aiConfig: AIConfig;

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
  
  // Actions IA
  setAIConfig: (config: AIConfig) => void;
  setChatMode: (mode: ChatMode) => void;
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

export const useStore = create<EditorState>()(
  persist(
    (set, get) => ({
      tree: [],
      activeNodeId: null,
      markdown: '',
      aiConfig: defaultAIConfig,

  // Charger le Markdown et parser l'arbre
  loadMarkdown: (markdown: string) => {
    const tree = parseMarkdownToTree(markdown);
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
      const newNode: NodeData = {
        id: generateId(),
        heading,
        headingDepth: parent.headingDepth + 1,
        content: '',
        meta: {
          id: generateId(),
          type: 'section',
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

  // Mettre à jour la configuration IA
  setAIConfig: (config: AIConfig) => {
    set({ aiConfig: config });
  },

  // Changer le mode de chat
  setChatMode: (mode: ChatMode) => {
    const { aiConfig } = get();
    set({ aiConfig: { ...aiConfig, chatMode: mode } });
  },
    }),
    {
      name: 'irlm-ai-config',
      partialize: (state) => ({ aiConfig: state.aiConfig }),
    }
  )
);
