import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeData } from './types';
import {
  parseMarkdownToTree,
  treeToMarkdown,
  updateNodeInTree,
  findNodeById,
  flattenTree,
  flattenTreeForRebuild,
  rebuildTreeFromFlat,
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

// Un document dans le projet (chaque onglet)
export interface ProjectDocument {
  id: string;
  name: string;
  tree: NodeData[];
  markdown: string;
  history: HistorySnapshot[];
  future: HistorySnapshot[];
}

const MAX_HISTORY_SIZE = 50;

// ID spécial pour le nœud H0 (document global)
export const DOCUMENT_ROOT_ID = '__document_root__';

interface EditorState {
  // Projet multi-documents
  documents: ProjectDocument[];
  activeDocumentId: string;

  // Données du document actif (miroir de documents[activeDocumentId])
  tree: NodeData[];
  activeNodeId: string | null;  // null ou DOCUMENT_ROOT_ID = vue document complet
  selectedNodeIds: Set<string>;  // sélection multiple pour opérations groupées
  lastSelectedNodeId: string | null;  // dernière sélection pour shift-click
  recentlyMovedNodeId: string | null;  // pour highlight/scroll après une opération
  markdown: string;
  clipboardNode: NodeData | null;
  
  // Historique
  history: HistorySnapshot[];
  future: HistorySnapshot[];
  
  // Configuration IA
  aiConfig: AIConfig;
  assessmentConfig: AssessmentConfig;

  // IA d'assistance éditoriale
  pendingAIPrompt: string | null;

  // Actions
  loadMarkdown: (markdown: string) => void;
  loadTree: (tree: NodeData[]) => void;
  saveToMarkdown: () => string;
  selectNode: (nodeId: string | null) => void;  // null = sélectionner H0
  selectDocumentRoot: () => void;  // Sélectionner le H0 (document complet)
  updateNodeContent: (nodeId: string, content: string) => void;
  updateNodeHeading: (nodeId: string, heading: string) => void;  // Renommer un nœud
  updateNodeMeta: (nodeId: string, updates: Partial<NodeData['meta']>) => void;
  addChild: (parentId: string, heading: string, content?: string) => void;
  insertSectionsAsChildren: (parentId: string, sections: { heading: string; content: string }[]) => void;
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
  
  // Actions de niveau de nœud (préservent l'ordre du document)
  promoteNode: (nodeId: string, withChildren: boolean) => boolean;
  demoteNode: (nodeId: string, withChildren: boolean) => boolean;

  // Opérations groupées (une seule entrée d'historique)
  promoteNodes: (nodeIds: string[], withChildren: boolean) => { ok: number; skipped: number };
  demoteNodes: (nodeIds: string[], withChildren: boolean) => { ok: number; skipped: number };
  deleteNodes: (nodeIds: string[]) => number;

  // Sélection multiple
  toggleNodeSelection: (nodeId: string) => void;
  selectRangeTo: (nodeId: string) => void;
  setSelection: (nodeIds: string[]) => void;
  clearSelection: () => void;
  clearRecentlyMoved: () => void;
  
  // Actions IA
  setAIConfig: (config: AIConfig) => void;
  setChatMode: (mode: ChatMode) => void;
  setPendingAIPrompt: (prompt: string | null) => void;

  // Actions Multi-documents
  createDocument: (name: string) => void;
  switchDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
  deleteDocument: (id: string) => void;
  importAsDocument: (name: string, markdown: string) => void;

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

// État transient à réinitialiser à chaque switch de document.
const TRANSIENT_RESET = {
  activeNodeId: DOCUMENT_ROOT_ID,
  selectedNodeIds: new Set<string>(),
  lastSelectedNodeId: null,
  recentlyMovedNodeId: null,
} as const;

// Crée un nouveau NodeData pour une section (used by addChild + insertSectionsAsChildren).
function createSectionNode(
  heading: string,
  headingDepth: number,
  content: string,
  assessmentEnabled: boolean
): NodeData {
  return {
    id: generateId(),
    heading,
    headingDepth,
    content,
    meta: {
      id: generateId(),
      type: 'section',
      evaluation: assessmentEnabled ? { ...defaultEvaluation } : undefined,
    },
    children: [],
  };
}

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

/**
 * Apply a +1 / -1 depth delta to a set of nodes (and optionally their
 * descendants), while preserving document order. The tree is then
 * re-derived from the flat doc-ordered list using stack-based
 * hierarchy rules.
 *
 * - delta < 0: promote (H3 → H2). Stops at headingDepth=1.
 * - delta > 0: demote. Stops at MAX_HEADING_DEPTH.
 * - withChildren=true: every descendant's depth also shifts by delta
 *   (preserves the relative shape of the sub-tree).
 *
 * Returns { ok, skipped } so bulk callers can report partial success.
 */
function applyDepthDelta(
  get: () => EditorState & { _pushHistory?: () => void },
  set: (state: Partial<EditorState>) => void,
  nodeIds: string[],
  delta: -1 | 1,
  withChildren: boolean
): { ok: number; skipped: number } {
  if (nodeIds.length === 0) return { ok: 0, skipped: 0 };

  const state = get();
  const flat = flattenTreeForRebuild(state.tree);

  // For each target: descendants are consecutive doc-ordered entries with
  // strictly greater headingDepth, until we hit a sibling or shallower entry.
  // We compute the final shift set after validation (below) — no need for a
  // pre-pass.
  const idSet = new Set(nodeIds);

  // Validate: a promote is only valid if no shifted node would go below 1;
  // a demote is only valid if no shifted node would exceed MAX_HEADING_DEPTH.
  // Targets that fail validation are skipped (entire shift block for that
  // target is preserved unchanged).
  const okIds = new Set<string>();
  const skippedIds = new Set<string>();

  for (let i = 0; i < flat.length; i++) {
    if (!idSet.has(flat[i].id)) continue;
    const baseDepth = flat[i].headingDepth;
    const newDepth = baseDepth + delta;
    if (newDepth < 1 || newDepth > MAX_HEADING_DEPTH) {
      skippedIds.add(flat[i].id);
      continue;
    }
    if (withChildren) {
      let subtreeMax = baseDepth;
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[j].headingDepth <= baseDepth) break;
        subtreeMax = Math.max(subtreeMax, flat[j].headingDepth);
      }
      if (subtreeMax + delta > MAX_HEADING_DEPTH) {
        skippedIds.add(flat[i].id);
        continue;
      }
    }
    okIds.add(flat[i].id);
  }

  if (okIds.size === 0) return { ok: 0, skipped: skippedIds.size };

  // Re-compute shiftIds limited to OK targets only.
  const finalShift = new Set<string>();
  for (let i = 0; i < flat.length; i++) {
    if (!okIds.has(flat[i].id)) continue;
    finalShift.add(flat[i].id);
    if (!withChildren) continue;
    const baseDepth = flat[i].headingDepth;
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j].headingDepth <= baseDepth) break;
      finalShift.add(flat[j].id);
    }
  }

  const _push = (get() as any)._pushHistory;
  if (_push) _push();

  const updated = flat.map(n =>
    finalShift.has(n.id) ? { ...n, headingDepth: n.headingDepth + delta } : n
  );
  const newTree = rebuildTreeFromFlat(updated);

  set({
    tree: newTree,
    recentlyMovedNodeId: nodeIds.find(id => okIds.has(id)) ?? null,
  });

  return { ok: okIds.size, skipped: skippedIds.size };
}

export const useStore = create<EditorState>()(
  persist(
    (set, get) => {
      const defaultDocId = generateId();
      return ({
      documents: [{ id: defaultDocId, name: 'Document', tree: [], markdown: '', history: [], future: [] }],
      activeDocumentId: defaultDocId,
      tree: [],
      activeNodeId: null,
      selectedNodeIds: new Set<string>(),
      lastSelectedNodeId: null,
      recentlyMovedNodeId: null,
      markdown: '',
      clipboardNode: null,
      history: [],
      future: [],
      aiConfig: defaultAIConfig,
      assessmentConfig: defaultAssessmentConfig,
      pendingAIPrompt: null,

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
  // Promote: décrémente le headingDepth puis re-dérive l'arbre depuis la liste
  // doc-ordered. Le nœud ne bouge PAS dans l'ordre du document — seule sa
  // hiérarchie change. withChildren=true décale aussi tous ses descendants
  // pour préserver la structure relative du sous-arbre.
  promoteNode: (nodeId, withChildren) => {
    const result = applyDepthDelta(get, set, [nodeId], -1, withChildren);
    return result.ok > 0;
  },

  // Demote: incrémente le headingDepth. Comme pour promote, doc-order
  // préservé. Le nouveau parent est dérivé naturellement par l'algorithme
  // de stack (typiquement le H{n-1} qui le précède dans le doc).
  demoteNode: (nodeId, withChildren) => {
    const result = applyDepthDelta(get, set, [nodeId], 1, withChildren);
    return result.ok > 0;
  },

  promoteNodes: (nodeIds, withChildren) =>
    applyDepthDelta(get, set, nodeIds, -1, withChildren),

  demoteNodes: (nodeIds, withChildren) =>
    applyDepthDelta(get, set, nodeIds, 1, withChildren),

  deleteNodes: (nodeIds) => {
    if (nodeIds.length === 0) return 0;
    (get() as any)._pushHistory();
    const targetIds = new Set(nodeIds);
    const flat = flattenTreeForRebuild(get().tree);

    // Expand targets to include each subtree (consecutive doc-ordered entries
    // with strictly greater headingDepth) so deletion cascades like the
    // single-node deleteNode.
    const idSet = new Set<string>();
    for (let i = 0; i < flat.length; i++) {
      if (!targetIds.has(flat[i].id)) continue;
      idSet.add(flat[i].id);
      const baseDepth = flat[i].headingDepth;
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[j].headingDepth <= baseDepth) break;
        idSet.add(flat[j].id);
      }
    }

    const filtered = flat.filter(n => !idSet.has(n.id));
    const removed = flat.length - filtered.length;
    const newTree = rebuildTreeFromFlat(filtered);
    const { activeNodeId, selectedNodeIds } = get();
    const newSelected = new Set(selectedNodeIds);
    nodeIds.forEach(id => newSelected.delete(id));
    set({
      tree: newTree,
      activeNodeId: activeNodeId && idSet.has(activeNodeId) ? DOCUMENT_ROOT_ID : activeNodeId,
      selectedNodeIds: newSelected,
    });
    return removed;
  },

  toggleNodeSelection: (nodeId) => {
    const { selectedNodeIds } = get();
    const next = new Set(selectedNodeIds);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    set({ selectedNodeIds: next, lastSelectedNodeId: nodeId });
  },

  selectRangeTo: (nodeId) => {
    const { tree, lastSelectedNodeId, selectedNodeIds } = get();
    if (!lastSelectedNodeId) {
      const next = new Set(selectedNodeIds);
      next.add(nodeId);
      set({ selectedNodeIds: next, lastSelectedNodeId: nodeId });
      return;
    }
    const flat = flattenTree(tree);
    const iStart = flat.findIndex(n => n.id === lastSelectedNodeId);
    const iEnd = flat.findIndex(n => n.id === nodeId);
    if (iStart === -1 || iEnd === -1) return;
    const [lo, hi] = iStart < iEnd ? [iStart, iEnd] : [iEnd, iStart];
    const next = new Set(selectedNodeIds);
    for (let k = lo; k <= hi; k++) next.add(flat[k].id);
    set({ selectedNodeIds: next, lastSelectedNodeId: nodeId });
  },

  setSelection: (nodeIds) =>
    set({ selectedNodeIds: new Set(nodeIds), lastSelectedNodeId: nodeIds[nodeIds.length - 1] ?? null }),

  clearSelection: () =>
    set({ selectedNodeIds: new Set(), lastSelectedNodeId: null }),

  clearRecentlyMoved: () => set({ recentlyMovedNodeId: null }),

  // Charger le Markdown dans le document actif
  loadMarkdown: (markdown: string) => {
    const parsedTree = parseMarkdownToTree(markdown);
    const { assessmentConfig, documents, activeDocumentId } = get();
    const tree = assessmentConfig.enabled ? ensureAssessmentMeta(parsedTree) : parsedTree;
    const updatedDocs = documents.map(d =>
      d.id === activeDocumentId ? { ...d, tree, markdown, history: [], future: [] } : d
    );
    set({
      documents: updatedDocs,
      tree, markdown,
      history: [], future: [],
      ...TRANSIENT_RESET,
    });
  },

  // Charger un arbre directement (restauration depuis le stockage utilisateur)
  loadTree: (tree: NodeData[]) => {
    const { documents, activeDocumentId } = get();
    const updatedDocs = documents.map(d =>
      d.id === activeDocumentId ? { ...d, tree, history: [], future: [] } : d
    );
    set({
      documents: updatedDocs,
      tree,
      history: [], future: [],
      ...TRANSIENT_RESET,
    });
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
  addChild: (parentId: string, heading: string, content: string = '') => {
    (get() as any).insertSectionsAsChildren(parentId, [{ heading, content }]);
  },

  // Insérer plusieurs sections comme enfants en une seule opération (un seul undo)
  insertSectionsAsChildren: (parentId: string, sections: { heading: string; content: string }[]) => {
    if (sections.length === 0) return;
    const { tree, assessmentConfig } = get();

    const isRoot = parentId === DOCUMENT_ROOT_ID;
    const parent = isRoot ? null : findNodeById(tree, parentId);
    if (!isRoot && !parent) return;

    const childDepth = isRoot ? 1 : parent!.headingDepth + 1;
    (get() as any)._pushHistory();

    const newChildren = sections.map(s =>
      createSectionNode(s.heading, childDepth, s.content, assessmentConfig.enabled)
    );

    if (isRoot) {
      set({ tree: [...tree, ...newChildren] });
      return;
    }
    set({
      tree: updateNodeInTree(tree, parentId, {
        children: [...parent!.children, ...newChildren],
      }),
    });
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

  // Définir un prompt IA en attente (pour l'assistance éditoriale)
  setPendingAIPrompt: (prompt: string | null) => {
    set({ pendingAIPrompt: prompt });
  },

  // ── Multi-documents ──────────────────────────────────────────────────────

  // Sauvegarde l'état courant dans le tableau documents (appelé avant tout switch)
  _saveCurrentDocSnapshot: () => {
    const { documents, activeDocumentId, tree, markdown, history, future } = get();
    const updated = documents.map(d =>
      d.id === activeDocumentId ? { ...d, tree, markdown, history, future } : d
    );
    set({ documents: updated });
  },

  createDocument: (name: string) => {
    (get() as any)._saveCurrentDocSnapshot();
    const newDoc: ProjectDocument = {
      id: generateId(),
      name,
      tree: [],
      markdown: '',
      history: [],
      future: [],
    };
    const { documents } = get();
    set({
      documents: [...documents, newDoc],
      activeDocumentId: newDoc.id,
      tree: [],
      markdown: '',
      history: [],
      future: [],
      ...TRANSIENT_RESET,
    });
  },

  switchDocument: (id: string) => {
    const { activeDocumentId } = get();
    if (id === activeDocumentId) return;
    (get() as any)._saveCurrentDocSnapshot();
    const { documents } = get();
    const target = documents.find(d => d.id === id);
    if (!target) return;
    set({
      activeDocumentId: id,
      tree: target.tree,
      markdown: target.markdown,
      history: target.history,
      future: target.future,
      ...TRANSIENT_RESET,
    });
  },

  renameDocument: (id: string, name: string) => {
    (get() as any)._saveCurrentDocSnapshot();
    const { documents } = get();
    set({ documents: documents.map(d => d.id === id ? { ...d, name } : d) });
  },

  deleteDocument: (id: string) => {
    const { documents, activeDocumentId } = get();
    if (documents.length <= 1) return; // garder au moins 1 document
    (get() as any)._saveCurrentDocSnapshot();
    const remaining = documents.filter(d => d.id !== id);
    if (id !== activeDocumentId) {
      set({ documents: remaining });
      return;
    }
    // Switcher vers le document précédent ou premier restant
    const deletedIndex = documents.findIndex(d => d.id === id);
    const nextDoc = remaining[Math.max(0, deletedIndex - 1)];
    set({
      documents: remaining,
      activeDocumentId: nextDoc.id,
      tree: nextDoc.tree,
      markdown: nextDoc.markdown,
      history: nextDoc.history,
      future: nextDoc.future,
      ...TRANSIENT_RESET,
    });
  },

  importAsDocument: (name: string, markdown: string) => {
    (get() as any)._saveCurrentDocSnapshot();
    const { assessmentConfig, documents } = get();
    const parsed = parseMarkdownToTree(markdown);
    const tree = assessmentConfig.enabled ? ensureAssessmentMeta(parsed) : parsed;
    const newDoc: ProjectDocument = {
      id: generateId(),
      name,
      tree,
      markdown,
      history: [],
      future: [],
    };
    set({
      documents: [...documents, newDoc],
      activeDocumentId: newDoc.id,
      tree,
      markdown,
      history: [],
      future: [],
      ...TRANSIENT_RESET,
    });
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
    });},
    {
      name: 'irlm-ai-config',
      partialize: (state) => ({
        aiConfig: state.aiConfig,
        assessmentConfig: state.assessmentConfig,
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
      }),
      // After rehydration, hydrate the top-level mirror fields from the
      // active document so the editor doesn't render an empty tree.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const activeDoc = state.documents?.find((d: ProjectDocument) => d.id === state.activeDocumentId);
        if (activeDoc) {
          state.tree = activeDoc.tree;
          state.markdown = activeDoc.markdown;
          state.history = activeDoc.history;
          state.future = activeDoc.future;
        }
      },
    }
  )
);
