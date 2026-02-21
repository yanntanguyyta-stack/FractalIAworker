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

// Historique pour undo/redo
interface HistorySnapshot {
  tree: NodeData[];
  activeNodeId: string | null;
}

const MAX_HISTORY_SIZE = 50;

// ID spécial pour le nœud H0 (document global)
export const DOCUMENT_ROOT_ID = '__document_root__';

interface EditorState {
  // Données
  tree: NodeData[];
  activeNodeId: string | null;  // null ou DOCUMENT_ROOT_ID = vue document complet
  markdown: string;
  clipboardNode: NodeData | null;
  
  // Historique
  history: HistorySnapshot[];
  future: HistorySnapshot[];
  
  // Configuration IA
  aiConfig: AIConfig;
  assessmentConfig: AssessmentConfig;

  // Actions
  loadMarkdown: (markdown: string) => void;
  loadTree: (tree: NodeData[]) => void;
  saveToMarkdown: () => string;
  selectNode: (nodeId: string | null) => void;  // null = sélectionner H0
  selectDocumentRoot: () => void;  // Sélectionner le H0 (document complet)
  updateNodeContent: (nodeId: string, content: string) => void;
  updateNodeHeading: (nodeId: string, heading: string) => void;  // Renommer un nœud
  updateNodeMeta: (nodeId: string, updates: Partial<NodeData['meta']>) => void;
  addChild: (parentId: string, heading: string) => void;
  deleteNode: (nodeId: string) => void;
  copyNode: (nodeId: string) => void;
  pasteNode: (targetId?: string | null) => boolean;
  moveNode: (nodeId: string, targetId?: string | null) => boolean;
  getActiveNode: () => NodeData | null;
  getAllNodes: () => NodeData[];
  getNodePath: (nodeId: string) => NodeData[]; // Breadcrumb: chemin vers un nœud
  getNodeFullContent: (nodeId: string | null) => string;  // Contenu d'un nœud + enfants
  isDocumentRootSelected: () => boolean;
  
  // Actions Historique
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Actions de niveau de nœud
  promoteNode: (nodeId: string, withChildren: boolean) => boolean;
  demoteNode: (nodeId: string, withChildren: boolean) => boolean;
  
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

const MAX_HEADING_DEPTH = 6;

function getSubtreeMaxDepth(node: NodeData): number {
  let maxDepth = node.headingDepth;
  for (const child of node.children) {
    maxDepth = Math.max(maxDepth, getSubtreeMaxDepth(child));
  }
  return maxDepth;
}

function adjustNodeDepth(node: NodeData, depthDelta: number): NodeData {
  return {
    ...node,
    headingDepth: node.headingDepth + depthDelta,
    children: node.children.map((child: NodeData) => adjustNodeDepth(child, depthDelta)),
  };
}

function cloneNodeWithNewIds(node: NodeData, depthDelta: number): NodeData {
  const newMetaId = generateId();
  return {
    ...node,
    id: generateId(),
    headingDepth: node.headingDepth + depthDelta,
    meta: { ...node.meta, id: newMetaId },
    children: node.children.map((child: NodeData) => cloneNodeWithNewIds(child, depthDelta)),
  };
}

function isNodeInSubtree(node: NodeData, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some((child: NodeData) => isNodeInSubtree(child, targetId));
}

function removeNodeById(nodes: NodeData[], nodeId: string): { nodes: NodeData[]; removed: NodeData | null } {
  let removed: NodeData | null = null;
  const updated = nodes
    .filter(node => {
      if (node.id === nodeId) {
        removed = node;
        return false;
      }
      return true;
    })
    .map(node => {
      if (node.children.length === 0) {
        return node;
      }
      const result = removeNodeById(node.children, nodeId);
      if (result.removed) {
        removed = result.removed;
      }
      if (result.nodes === node.children) {
        return node;
      }
      return { ...node, children: result.nodes };
    });

  return { nodes: updated, removed };
}

function insertNode(nodes: NodeData[], targetId: string | null, nodeToInsert: NodeData): NodeData[] {
  if (!targetId) {
    return [...nodes, nodeToInsert];
  }
  return nodes.map(node => {
    if (node.id === targetId) {
      return { ...node, children: [...node.children, nodeToInsert] };
    }
    if (node.children.length > 0) {
      return { ...node, children: insertNode(node.children, targetId, nodeToInsert) };
    }
    return node;
  });
}

// Trouver l'emplacement d'un nœud dans l'arbre (son conteneur et son index)
function findNodeLocation(treeNodes: NodeData[], nodeId: string): {
  container: NodeData[];
  parent: NodeData | null;
  index: number;
} | null {
  for (let i = 0; i < treeNodes.length; i++) {
    if (treeNodes[i].id === nodeId) {
      return { container: treeNodes, parent: null, index: i };
    }
  }
  function traverse(nodes: NodeData[]): { container: NodeData[]; parent: NodeData; index: number } | null {
    for (const node of nodes) {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].id === nodeId) {
          return { container: node.children, parent: node, index: i };
        }
      }
      if (node.children.length > 0) {
        const result = traverse(node.children);
        if (result) return result;
      }
    }
    return null;
  }
  return traverse(treeNodes);
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
      clipboardNode: null,
      history: [],
      future: [],
      aiConfig: defaultAIConfig,
      assessmentConfig: defaultAssessmentConfig,

  // Helper interne pour sauvegarder l'état dans l'historique
  _pushHistory: () => {
    const { tree, activeNodeId, history } = get();
    const snapshot: HistorySnapshot = {
      tree: JSON.parse(JSON.stringify(tree)),
      activeNodeId,
    };
    const newHistory = [...history, snapshot].slice(-MAX_HISTORY_SIZE);
    set({ history: newHistory, future: [] });
  },

  // Undo - restaurer l'état précédent
  undo: () => {
    const { tree, activeNodeId, history, future } = get();
    if (history.length === 0) return;
    
    const currentSnapshot: HistorySnapshot = {
      tree: JSON.parse(JSON.stringify(tree)),
      activeNodeId,
    };
    
    const previousSnapshot = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const newFuture = [currentSnapshot, ...future];
    
    set({
      tree: previousSnapshot.tree,
      activeNodeId: previousSnapshot.activeNodeId,
      history: newHistory,
      future: newFuture,
    });
  },

  // Redo - restaurer l'état suivant
  redo: () => {
    const { tree, activeNodeId, history, future } = get();
    if (future.length === 0) return;
    
    const currentSnapshot: HistorySnapshot = {
      tree: JSON.parse(JSON.stringify(tree)),
      activeNodeId,
    };
    
    const nextSnapshot = future[0];
    const newFuture = future.slice(1);
    const newHistory = [...history, currentSnapshot];
    
    set({
      tree: nextSnapshot.tree,
      activeNodeId: nextSnapshot.activeNodeId,
      history: newHistory,
      future: newFuture,
    });
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  // Promouvoir un nœud : le remonter d'un niveau dans l'arbre
  promoteNode: (nodeId: string, withChildren: boolean) => {
    const { tree } = get();
    const node = findNodeById(tree, nodeId);
    if (!node || node.headingDepth <= 1) return false;
    
    // Vérifier que le nœud n'est pas déjà à la racine de l'arbre
    const location = findNodeLocation(tree, nodeId);
    if (!location || !location.parent) return false;
    
    (get() as any)._pushHistory();
    
    // Deep clone pour mutation immutable
    const newTree = JSON.parse(JSON.stringify(tree)) as NodeData[];
    const loc = findNodeLocation(newTree, nodeId);
    if (!loc || !loc.parent) return false;
    
    // Retirer le nœud de son parent
    const [removedNode] = loc.container.splice(loc.index, 1);
    
    // Ajuster la profondeur
    const adjusted = withChildren
      ? adjustNodeDepth(removedNode, -1)
      : { ...removedNode, headingDepth: removedNode.headingDepth - 1 };
    
    // Trouver le parent dans l'arbre et insérer après lui
    const parentLoc = findNodeLocation(newTree, loc.parent.id);
    if (!parentLoc) return false;
    
    parentLoc.container.splice(parentLoc.index + 1, 0, adjusted);
    
    set({ tree: newTree });
    return true;
  },

  // Rétrograder un nœud : le descendre d'un niveau (devient enfant du frère précédent)
  demoteNode: (nodeId: string, withChildren: boolean) => {
    const { tree } = get();
    const node = findNodeById(tree, nodeId);
    if (!node) return false;
    
    // Vérifier la profondeur maximale
    const maxDepth = getSubtreeMaxDepth(node);
    if (node.headingDepth + 1 > MAX_HEADING_DEPTH ||
        (withChildren && maxDepth + 1 > MAX_HEADING_DEPTH)) {
      return false;
    }
    
    // Trouver l'emplacement du nœud et vérifier qu'il a un frère précédent
    const location = findNodeLocation(tree, nodeId);
    if (!location || location.index === 0) return false;
    
    (get() as any)._pushHistory();
    
    // Deep clone pour mutation immutable
    const newTree = JSON.parse(JSON.stringify(tree)) as NodeData[];
    const loc = findNodeLocation(newTree, nodeId);
    if (!loc || loc.index === 0) return false;
    
    // Obtenir le frère précédent
    const prevSibling = loc.container[loc.index - 1];
    
    // Retirer le nœud de sa position actuelle
    const [removedNode] = loc.container.splice(loc.index, 1);
    
    // Ajuster la profondeur
    const adjusted = withChildren
      ? adjustNodeDepth(removedNode, 1)
      : { ...removedNode, headingDepth: removedNode.headingDepth + 1 };
    
    // Ajouter comme dernier enfant du frère précédent
    prevSibling.children.push(adjusted);
    
    set({ tree: newTree });
    return true;
  },

  // Charger le Markdown et parser l'arbre
  loadMarkdown: (markdown: string) => {
    const parsedTree = parseMarkdownToTree(markdown);
    const { assessmentConfig } = get();
    const tree = assessmentConfig.enabled ? ensureAssessmentMeta(parsedTree) : parsedTree;
    // Par défaut, sélectionner le document complet (H0)
    set({ tree, markdown, activeNodeId: DOCUMENT_ROOT_ID, history: [], future: [] });
  },

  // Charger un arbre directement (restauration depuis le stockage utilisateur)
  loadTree: (tree: NodeData[]) => {
    set({ tree, activeNodeId: DOCUMENT_ROOT_ID, history: [], future: [] });
  },

  // Sauvegarder l'arbre en Markdown
  saveToMarkdown: () => {
    const { tree } = get();
    const markdown = treeToMarkdown(tree);
    set({ markdown });
    return markdown;
  },

  // Sélectionner un nœud actif (ou DOCUMENT_ROOT_ID pour le document complet)
  selectNode: (nodeId: string | null) => {
    set({ activeNodeId: nodeId || DOCUMENT_ROOT_ID });
  },

  // Sélectionner le document complet (H0)
  selectDocumentRoot: () => {
    set({ activeNodeId: DOCUMENT_ROOT_ID });
  },

  // Vérifier si le document complet (H0) est sélectionné
  isDocumentRootSelected: () => {
    return get().activeNodeId === DOCUMENT_ROOT_ID;
  },

  // Obtenir le contenu complet d'un nœud et de tous ses enfants
  getNodeFullContent: (nodeId: string | null) => {
    const { tree } = get();
    
    // Fonction récursive pour construire le contenu avec la hiérarchie
    function buildContent(nodes: NodeData[]): string {
      let content = '';
      for (const node of nodes) {
        // Ajouter le titre avec le bon niveau de heading
        const heading = '#'.repeat(node.headingDepth) + ' ' + node.heading;
        content += heading + '\n\n';
        
        // Ajouter le contenu du nœud
        if (node.content.trim()) {
          content += node.content.trim() + '\n\n';
        }
        
        // Ajouter récursivement le contenu des enfants
        if (node.children.length > 0) {
          content += buildContent(node.children);
        }
      }
      return content;
    }

    // Si nodeId est null ou DOCUMENT_ROOT_ID, retourner tout le document
    if (!nodeId || nodeId === DOCUMENT_ROOT_ID) {
      return buildContent(tree);
    }

    // Sinon, trouver le nœud et retourner son contenu + enfants
    const node = findNodeById(tree, nodeId);
    if (!node) return '';
    
    return buildContent([node]);
  },

  // Mettre à jour le contenu d'un nœud
  updateNodeContent: (nodeId: string, content: string) => {
    const { tree } = get();
    // Sauvegarder l'état avant modification
    (get() as any)._pushHistory();
    const updated = updateNodeInTree(tree, nodeId, { content });
    set({ tree: updated });
  },

  // Renommer un nœud (modifier son heading)
  updateNodeHeading: (nodeId: string, heading: string) => {
    const { tree } = get();
    // Sauvegarder l'état avant modification
    (get() as any)._pushHistory();
    const updated = updateNodeInTree(tree, nodeId, { heading });
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

  // Ajouter un enfant à un nœud (ou un nœud racine H1 si parentId === DOCUMENT_ROOT_ID)
  addChild: (parentId: string, heading: string) => {
    const { tree } = get();
    const { assessmentConfig } = get();
    
    // Cas spécial : ajouter un nœud racine (H1)
    if (parentId === DOCUMENT_ROOT_ID) {
      (get() as any)._pushHistory();
      const newNode: NodeData = {
        id: generateId(),
        heading,
        headingDepth: 1,
        content: '',
        meta: {
          id: generateId(),
          type: 'section',
          evaluation: assessmentConfig.enabled ? { ...defaultEvaluation } : undefined,
        },
        children: [],
      };
      set({ tree: [...tree, newNode] });
      return;
    }
    
    const parent = findNodeById(tree, parentId);
    if (parent) {
      (get() as any)._pushHistory();
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
    
    // Sauvegarder l'état avant modification
    (get() as any)._pushHistory();
    
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

  copyNode: (nodeId: string) => {
    const { tree } = get();
    const node = findNodeById(tree, nodeId);
    if (node) {
      const snapshot = typeof structuredClone === 'function'
        ? (structuredClone(node) as NodeData)
        : (JSON.parse(JSON.stringify(node)) as NodeData);
      set({ clipboardNode: snapshot });
    }
  },

  pasteNode: (targetId: string | null = null) => {
    const { tree, clipboardNode } = get();
    if (!clipboardNode) return false;
    const targetNode = targetId ? findNodeById(tree, targetId) : null;
    if (targetId && !targetNode) return false;
    const newDepth = targetNode ? targetNode.headingDepth + 1 : 1;
    const maxDepth = getSubtreeMaxDepth(clipboardNode);
    const depthDelta = newDepth - clipboardNode.headingDepth;
    if (newDepth < 1 || newDepth + (maxDepth - clipboardNode.headingDepth) > MAX_HEADING_DEPTH) {
      return false;
    }
    // Sauvegarder l'état avant modification
    (get() as any)._pushHistory();
    const clonedNode = cloneNodeWithNewIds(clipboardNode, depthDelta);
    const updated = insertNode(tree, targetId, clonedNode);
    set({ tree: updated });
    return true;
  },

  moveNode: (nodeId: string, targetId: string | null = null) => {
    const { tree } = get();
    if (nodeId === targetId) return false;
    const node = findNodeById(tree, nodeId);
    if (!node) return false;
    if (targetId && isNodeInSubtree(node, targetId)) {
      return false;
    }
    const targetNode = targetId ? findNodeById(tree, targetId) : null;
    if (targetId && !targetNode) return false;
    const newDepth = targetNode ? targetNode.headingDepth + 1 : 1;
    const maxDepth = getSubtreeMaxDepth(node);
    if (newDepth < 1 || newDepth + (maxDepth - node.headingDepth) > MAX_HEADING_DEPTH) {
      return false;
    }
    // Sauvegarder l'état avant modification
    (get() as any)._pushHistory();
    const depthDelta = newDepth - node.headingDepth;
    const adjustedNode = adjustNodeDepth(node, depthDelta);
    const removedResult = removeNodeById(tree, nodeId);
    if (!removedResult.removed) return false;
    const updated = insertNode(removedResult.nodes, targetId, adjustedNode);
    set({ tree: updated });
    return true;
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
