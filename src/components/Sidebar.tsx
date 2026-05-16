import React from 'react';
import {
  ChevronDown, ChevronRight, Plus, Trash2, FolderTree, Copy, ClipboardPaste,
  GripVertical, Search, Undo2, Redo2, FileText, Pencil,
  ChevronUp as LevelUp, ChevronDown as LevelDown, Sparkles,
} from 'lucide-react';
import { useStore, DOCUMENT_ROOT_ID } from '../store';
import { NodeData } from '../types';
import {
  countAllNodes,
  getMaxDepth,
  isNodeIncomplete,
  highlightMatch,
} from '../utils/treeSearch';
import { useTreeSearch } from '../hooks/useTreeSearch';
import { useDragDrop } from '../hooks/useDragDrop';

interface SidebarProps {
  className?: string;
}

const depthColors = [
  'border-blue-500',
  'border-indigo-500',
  'border-purple-500',
  'border-pink-500',
  'border-rose-500',
  'border-orange-500',
];

const depthBgColors = [
  'bg-blue-50',
  'bg-indigo-50',
  'bg-purple-50',
  'bg-pink-50',
  'bg-rose-50',
  'bg-orange-50',
];

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const {
    tree, activeNodeId, selectNode, addChild, deleteNode, copyNode, pasteNode,
    moveNode, clipboardNode, undo, redo, canUndo, canRedo, promoteNode,
    demoteNode, selectDocumentRoot, updateNodeHeading, setPendingAIPrompt,
  } = useStore();
  const isDocumentRoot = activeNodeId === DOCUMENT_ROOT_ID;
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const {
    searchTerm, setSearchTerm, trimmedSearch, searchResults,
    visibleTree, matchIds,
  } = useTreeSearch(tree);

  const handleMoveNode = React.useCallback((sourceId: string, targetId: string | null) => {
    const success = moveNode(sourceId, targetId);
    if (!success) {
      alert('Impossible de déplacer ce nœud (profondeur maximale atteinte ou cible invalide).');
    }
  }, [moveNode]);

  const { getNodeHandlers, getRootHandlers } = useDragDrop(handleMoveNode);
  const rootHandlers = getRootHandlers();

  const effectiveExpanded = searchResults ? searchResults.expandedIds : expanded;

  // Expand all by default on first load, and re-expand new nodes on tree change
  const prevTreeRef = React.useRef<string>('');
  React.useEffect(() => {
    const allIds = new Set<string>();
    function collectIds(nodes: NodeData[]) {
      for (const node of nodes) {
        allIds.add(node.id);
        if (node.children.length > 0) collectIds(node.children);
      }
    }
    collectIds(tree);
    const treeSignature = Array.from(allIds).sort().join(',');
    if (treeSignature !== prevTreeRef.current) {
      setExpanded(prev => {
        const merged = new Set(prev);
        allIds.forEach(id => merged.add(id));
        return merged;
      });
      prevTreeRef.current = treeSignature;
    }
  }, [tree]);

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(nodeId)) newExpanded.delete(nodeId);
    else newExpanded.add(nodeId);
    setExpanded(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    function collectIds(nodes: NodeData[]) {
      for (const node of nodes) {
        allIds.add(node.id);
        if (node.children.length > 0) collectIds(node.children);
      }
    }
    collectIds(tree);
    setExpanded(allIds);
  };

  const collapseAll = () => setExpanded(new Set());

  const handlePasteNode = (targetId: string | null) => {
    const success = pasteNode(targetId);
    if (!success) {
      alert('Impossible de coller ce nœud ici (profondeur maximale atteinte ou cible invalide).');
    }
  };

  const renderNode = (node: NodeData, depth: number = 0) => {
    const isExpanded = effectiveExpanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isActive = activeNodeId === node.id;
    const colorIndex = Math.min(depth, depthColors.length - 1);
    const dragHandlers = getNodeHandlers(node.id);
    const incomplete = isNodeIncomplete(node);

    return (
      <div key={node.id} className="select-none sidebar-node-item">
        <div className="relative">
          {depth > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-gray-200"
              style={{ left: `${(depth - 1) * 16 + 10}px` }}
            />
          )}
          <div
            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-150 ${
              isActive
                ? `${depthBgColors[colorIndex]} border-l-4 ${depthColors[colorIndex]} shadow-sm`
                : 'hover:bg-gray-100 border-l-4 border-transparent'
            } ${dragHandlers.isDropTarget ? 'ring-2 ring-blue-400' : ''}`}
            style={{ marginLeft: `${depth * 16}px` }}
            onClick={() => selectNode(node.id)}
            draggable={dragHandlers.draggable}
            onDragStart={dragHandlers.onDragStart}
            onDragEnd={dragHandlers.onDragEnd}
            onDragOver={dragHandlers.onDragOver}
            onDragLeave={dragHandlers.onDragLeave}
            onDrop={dragHandlers.onDrop}
          >
            <GripVertical size={12} className="text-gray-400 flex-shrink-0" />
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpanded(node.id); }}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                aria-label={isExpanded ? 'Replier' : 'Déplier'}
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-gray-500" />
                ) : (
                  <ChevronRight size={14} className="text-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}

            <span className={`text-[10px] font-bold px-1 rounded ${depthBgColors[colorIndex]} ${depthColors[colorIndex].replace('border-', 'text-')}`}>
              H{node.headingDepth}
            </span>

            <span className="flex-1 truncate text-sm font-medium">
              {matchIds.has(node.id) ? highlightMatch(node.heading || '(Sans titre)', trimmedSearch) : node.heading || '(Sans titre)'}
            </span>

            {incomplete && (
              <span
                className="text-[9px] font-bold px-1 py-0.5 bg-amber-100 text-amber-700 rounded flex-shrink-0"
                title="Contenu incomplet ou vide"
              >
                ✎
              </span>
            )}

            {node.meta.contextConfig?.isGlobal && (
              <span className="text-green-500 text-[10px] flex-shrink-0" title="Contexte global">🌐</span>
            )}
            {node.meta.agentConfig?.role && (
              <span className="text-purple-500 text-[10px] flex-shrink-0" title={`Agent: ${node.meta.agentConfig.role}`}>🤖</span>
            )}
            {hasChildren && (
              <span className="text-[10px] text-gray-400 flex-shrink-0" title={`${node.children.length} enfant(s)`}>
                ({node.children.length})
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div
            className="flex items-center gap-1 px-2 py-1 mx-1 mb-1 bg-slate-100 rounded-md border border-slate-200 flex-wrap"
            style={{ marginLeft: `${depth * 16 + 8}px` }}
          >
            {node.headingDepth < 6 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const childLevel = node.headingDepth + 1;
                  const title = prompt(`Créer un sous-nœud (H${childLevel}) sous "${node.heading}":\n\nTitre du nouveau nœud :`);
                  if (title && title.trim()) addChild(node.id, title.trim());
                }}
                className="p-1.5 hover:bg-green-200 rounded text-green-700 tooltip-wrapper"
                data-tooltip={`Ajouter H${node.headingDepth + 1}`}
              >
                <Plus size={14} />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                const newName = prompt(`Renommer "${node.heading}" :`, node.heading);
                if (newName && newName.trim() && newName.trim() !== node.heading) {
                  updateNodeHeading(node.id, newName.trim());
                }
              }}
              className="p-1.5 hover:bg-cyan-200 rounded text-cyan-700 tooltip-wrapper"
              data-tooltip="Renommer"
            >
              <Pencil size={14} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); copyNode(node.id); }}
              className="p-1.5 hover:bg-blue-200 rounded text-blue-700 tooltip-wrapper"
              data-tooltip="Copier"
            >
              <Copy size={14} />
            </button>

            {clipboardNode && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePasteNode(node.id); }}
                className="p-1.5 hover:bg-indigo-200 rounded text-indigo-700 tooltip-wrapper"
                data-tooltip="Coller comme enfant"
              >
                <ClipboardPaste size={14} />
              </button>
            )}

            <span className="w-px h-5 bg-slate-300 mx-0.5" />

            {node.headingDepth > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); promoteNode(node.id, true); }}
                className="p-1.5 hover:bg-amber-200 rounded tooltip-wrapper flex items-center gap-0.5"
                data-tooltip={`Promouvoir en H${node.headingDepth - 1}`}
              >
                <LevelUp size={14} className="text-amber-700" />
                <span className="text-[9px] font-bold text-amber-700">H{node.headingDepth - 1}</span>
              </button>
            )}

            {node.headingDepth < 6 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const success = demoteNode(node.id, true);
                  if (!success) {
                    alert('Impossible : pas de nœud frère précédent ou profondeur max atteinte.');
                  }
                }}
                className="p-1.5 hover:bg-orange-200 rounded tooltip-wrapper flex items-center gap-0.5"
                data-tooltip={`Rétrograder en H${node.headingDepth + 1}`}
              >
                <LevelDown size={14} className="text-orange-700" />
                <span className="text-[9px] font-bold text-orange-700">H{node.headingDepth + 1}</span>
              </button>
            )}

            <span className="w-px h-5 bg-slate-300 mx-0.5" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Supprimer "${node.heading}" et ses ${countAllNodes(node.children)} enfants ?`)) {
                  deleteNode(node.id);
                }
              }}
              className="p-1.5 hover:bg-red-200 rounded text-red-600 tooltip-wrapper"
              data-tooltip="Supprimer"
            >
              <Trash2 size={14} />
            </button>

            {incomplete && (
              <>
                <span className="w-px h-5 bg-slate-300 mx-0.5" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingAIPrompt(
                      `Ce nœud intitulé "${node.heading}" semble incomplet ou vide. Propose un enrichissement pertinent : développe le contenu, ajoute des détails, des exemples ou des sous-sections adaptées au contexte.`
                    );
                  }}
                  className="p-1.5 hover:bg-amber-200 rounded text-amber-700 tooltip-wrapper flex items-center gap-0.5"
                  data-tooltip="Proposer un enrichissement IA"
                >
                  <Sparkles size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className="relative">
            {node.children.map((child: NodeData) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const totalNodes = countAllNodes(tree);
  const maxDepth = getMaxDepth(tree);

  const handleAddRootNode = () => {
    const title = prompt('Créer un nouveau nœud racine (H1) :\n\nTitre du nœud :');
    if (title && title.trim()) {
      const state = useStore.getState() as any;
      if (state._pushHistory) state._pushHistory();

      const { tree } = useStore.getState();
      const newNode = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        heading: title.trim(),
        headingDepth: 1,
        content: '',
        meta: {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          type: 'section' as const,
        },
        children: [],
      };
      useStore.setState({ tree: [...tree, newNode] });
    }
  };

  const historyCanUndo = canUndo();
  const historyCanRedo = canRedo();

  return (
    <div className={`bg-white flex flex-col h-full ${className}`}>
      <div className="p-3 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-slate-50 via-indigo-50 to-purple-50">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FolderTree size={18} className="text-blue-600" />
            Structure
          </h2>
          <div className="flex gap-1">
            <button
              onClick={undo}
              disabled={!historyCanUndo}
              className={`text-xs px-2 py-1 rounded transition-colors ${historyCanUndo ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!historyCanRedo}
              className={`text-xs px-2 py-1 rounded transition-colors ${historyCanRedo ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
              title="Rétablir (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
            <span className="w-px bg-gray-300 mx-1"></span>
            <button
              onClick={handleAddRootNode}
              className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors font-medium"
              title="Ajouter un nœud racine (H1)"
            >
              + H1
            </button>
            <button
              onClick={expandAll}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Tout déplier"
            >
              ⊞
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Tout replier"
            >
              ⊟
            </button>
            {clipboardNode && (
              <button
                onClick={() => handlePasteNode(null)}
                className="text-xs px-2 py-1 bg-indigo-100 hover:bg-indigo-200 rounded transition-colors"
                title="Coller à la racine"
              >
                ↧
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {totalNodes} nœuds • {maxDepth} niveaux
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher un nœud..."
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Effacer la recherche"
            >
              ✕
            </button>
          )}
        </div>
        {clipboardNode && (
          <p className="mt-2 text-[10px] text-gray-500">
            📋 Copié : <span className="font-medium">{clipboardNode.heading || 'Sans titre'}</span>
          </p>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto min-h-0"
        onDragOver={rootHandlers.onDragOver}
        onDrop={rootHandlers.onDrop}
      >
        <div className="p-2 border-b border-gray-200">
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg transition-all duration-150 ${
              isDocumentRoot
                ? 'bg-gradient-to-r from-indigo-100 to-purple-100 border-l-4 border-indigo-500 shadow-sm'
                : 'hover:bg-gray-100 border-l-4 border-transparent'
            }`}
            onClick={() => selectDocumentRoot()}
          >
            <FileText size={16} className={isDocumentRoot ? 'text-indigo-600' : 'text-gray-500'} />
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDocumentRoot ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
              H0
            </span>
            <span className={`flex-1 text-sm font-semibold ${isDocumentRoot ? 'text-indigo-900' : 'text-gray-700'}`}>
              Document complet
            </span>
            <span className="text-[10px] text-gray-400">
              ({tree.length} racine{tree.length > 1 ? 's' : ''})
            </span>
          </div>
        </div>

        {visibleTree.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            {searchTerm ? 'Aucun résultat pour cette recherche.' : 'Aucun nœud. Chargez un Markdown pour commencer.'}
          </div>
        ) : (
          <div className="p-2">
            {visibleTree.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
