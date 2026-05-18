import React from 'react';
import {
  ChevronDown, ChevronRight, Plus, Trash2, FolderTree, Copy, ClipboardPaste,
  GripVertical, Search, Undo2, Redo2, FileText, Pencil, X, Download,
  ChevronUp as LevelUp, ChevronDown as LevelDown, Sparkles,
  Wrench, ArrowRight, FolderOpen, Workflow, RefreshCw,
} from 'lucide-react';
import { useStore, DOCUMENT_ROOT_ID, ProjectDocument, DocumentType, MAX_DOCUMENT_NAME_LENGTH } from '../store';
import { exportProjectToZip } from '../utils/projectExport';
import { runSyncRule, SubsectionProposal } from '../aiService';
import ProjectSwitcher from './ProjectSwitcher';
import SyncRuleModal from './SyncRuleModal';
import SyncReviewModal from './SyncReviewModal';
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

// Accent-tinted depth palette (used on the active border + H{n} chip)
const depthBorder = [
  'border-sky-500',
  'border-indigo-500',
  'border-violet-500',
  'border-fuchsia-500',
  'border-rose-500',
  'border-amber-500',
];

const depthChipBg = [
  'bg-sky-100 text-sky-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
];

const depthActiveBg = [
  'bg-sky-50/70',
  'bg-indigo-50/70',
  'bg-violet-50/70',
  'bg-fuchsia-50/70',
  'bg-rose-50/70',
  'bg-amber-50/70',
];

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const {
    tree, activeNodeId, selectNode, addChild, deleteNode, copyNode, pasteNode,
    moveNode, clipboardNode, undo, redo, canUndo, canRedo, promoteNode,
    demoteNode, selectDocumentRoot, updateNodeHeading, setPendingAIPrompt,
    selectedNodeIds, toggleNodeSelection, selectRangeTo, clearSelection,
    recentlyMovedNodeId, clearRecentlyMoved, promoteNodes, demoteNodes,
    deleteNodes,
    documents, activeDocumentId, createDocument, switchDocument, renameDocument, deleteDocument,
    switchToAdjacentDocument, setDocumentType,
    projects, activeProjectId, aiConfig,
  } = useStore();
  const isDocumentRoot = activeNodeId === DOCUMENT_ROOT_ID;
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [showProjectSwitcher, setShowProjectSwitcher] = React.useState(false);
  const [showToolDocs, setShowToolDocs] = React.useState(true);
  const [renamingDocId, setRenamingDocId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  // Sync rule UI state
  const [syncRuleEditDoc, setSyncRuleEditDoc] = React.useState<ProjectDocument | null>(null);
  const [syncRunningDocId, setSyncRunningDocId] = React.useState<string | null>(null);
  const [syncReview, setSyncReview] = React.useState<{
    targetDoc: ProjectDocument; sourceDocName: string; proposals: SubsectionProposal[];
  } | null>(null);

  const handleRunSync = async (toolDoc: ProjectDocument) => {
    if (!toolDoc.syncRule) return;
    const source = documents.find(d => d.id === toolDoc.syncRule!.sourceDocId);
    if (!source) {
      alert('Le document source de la règle de synchro est introuvable.');
      return;
    }
    if (!aiConfig.apiKey) {
      alert('Clé API manquante. Configurez votre clé IA dans les paramètres.');
      return;
    }
    setSyncRunningDocId(toolDoc.id);
    try {
      // Make sure the latest in-progress edits of the active doc are flushed
      // into the documents[] mirror before we read its markdown for the sync.
      (useStore.getState() as any)._saveCurrentDocSnapshot?.();
      const freshDocs = useStore.getState().documents;
      const freshTool = freshDocs.find(d => d.id === toolDoc.id) ?? toolDoc;
      const freshSource = freshDocs.find(d => d.id === source.id) ?? source;
      const proposals = await runSyncRule({
        sourceDocName: freshSource.name,
        sourceMarkdown: freshSource.markdown,
        toolDocName: freshTool.name,
        toolMarkdown: freshTool.markdown,
        instruction: toolDoc.syncRule.instruction,
        config: aiConfig,
      });
      setSyncReview({ targetDoc: freshTool, sourceDocName: freshSource.name, proposals });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      alert('Échec de la synchro : ' + message);
    } finally {
      setSyncRunningDocId(null);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);
  const mainDoc = documents.find(d => d.type === 'main') ?? documents[0];
  const toolDocs = documents.filter(d => d.type === 'tool');
  const activeDoc = documents.find(d => d.id === activeDocumentId);
  const isEditingTool = activeDoc?.type === 'tool';

  const startRename = (id: string, name: string) => {
    setRenamingDocId(id);
    setRenameValue(name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };
  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) renameDocument(id, trimmed);
    setRenamingDocId(null);
  };
  const cancelRename = () => setRenamingDocId(null);

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

  // Scroll the recently-moved node into view + clear the marker after the
  // glow-pulse animation (~700ms). The pulse class is gated on the marker
  // in renderNode.
  React.useEffect(() => {
    if (!recentlyMovedNodeId) return;
    // IDs can come from imported Markdown — avoid building a raw CSS selector.
    const el = Array.from(document.querySelectorAll('[data-node-id]')).find(
      n => n.getAttribute('data-node-id') === recentlyMovedNodeId
    );
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const timer = window.setTimeout(() => clearRecentlyMoved(), 800);
    return () => window.clearTimeout(timer);
  }, [recentlyMovedNodeId, clearRecentlyMoved]);

  // Raccourci clavier Ctrl+Tab / Ctrl+Shift+Tab pour naviguer entre les documents
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.key !== 'Tab') return;
      // Ne pas intercepter si l'utilisateur est en train de renommer
      if (renamingDocId) return;
      e.preventDefault();
      switchToAdjacentDocument(e.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switchToAdjacentDocument, renamingDocId]);

  const handleExportProject = async () => {
    try {
      const blob = await exportProjectToZip(documents);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `projet-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur lors de l\'export du projet : ' + (err instanceof Error ? err.message : String(err)));
    }
  };

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

  const renderNode = (node: NodeData, treeDepth: number = 0, parentHeadingDepth: number = 0) => {
    const isExpanded = effectiveExpanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isActive = activeNodeId === node.id;
    const isSelected = selectedNodeIds.has(node.id);
    const isRecentlyMoved = recentlyMovedNodeId === node.id;
    // Visual indentation follows the HEADING level (H1=0, H2=1, …), not the
    // tree-walk depth. Two H3 siblings under different parents always end up
    // at the same indent — the chip and the indent stay consistent even when
    // the markdown skips levels.
    const indentLevel = Math.max(0, node.headingDepth - 1);
    const colorIndex = Math.min(indentLevel, depthBorder.length - 1);
    const dragHandlers = getNodeHandlers(node.id);
    const incomplete = isNodeIncomplete(node);
    // Skip-level: heading deeper than parent + 1 (or > 1 with no parent)
    const expectedDepth = parentHeadingDepth === 0 ? 1 : parentHeadingDepth + 1;
    const skipsLevel = node.headingDepth > expectedDepth;

    const handleRowClick = (e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        selectRangeTo(node.id);
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleNodeSelection(node.id);
      } else {
        if (selectedNodeIds.size > 0) clearSelection();
        selectNode(node.id);
      }
    };

    return (
      <div key={node.id} className="select-none sidebar-node-item">
        <div className="relative">
          {indentLevel > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-slate-200/60"
              style={{ left: `${(indentLevel - 1) * 16 + 14}px` }}
            />
          )}
          <div
            data-node-id={node.id}
            className={`group flex items-center gap-1.5 pl-2 pr-2 py-1.5 cursor-pointer rounded-xl transition-all duration-200 ease-spring border-l-2 ${
              isSelected
                ? 'bg-accent-100/70 border-accent-500 ring-1 ring-accent-300'
                : isActive
                  ? `${depthActiveBg[colorIndex]} ${depthBorder[colorIndex]} shadow-soft`
                  : 'border-transparent hover:bg-white/60'
            } ${dragHandlers.isDropTarget ? 'ring-2 ring-accent-400/60' : ''} ${
              isRecentlyMoved ? 'animate-glow-pulse' : ''
            }`}
            style={{ marginLeft: `${indentLevel * 16}px` }}
            onClick={handleRowClick}
            draggable={dragHandlers.draggable}
            onDragStart={dragHandlers.onDragStart}
            onDragEnd={dragHandlers.onDragEnd}
            onDragOver={dragHandlers.onDragOver}
            onDragLeave={dragHandlers.onDragLeave}
            onDrop={dragHandlers.onDrop}
          >
            <GripVertical size={11} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpanded(node.id); }}
                className="p-0.5 hover:bg-white/80 rounded-md transition-colors flex-shrink-0"
                aria-label={isExpanded ? 'Replier' : 'Déplier'}
              >
                {isExpanded ? (
                  <ChevronDown size={13} className="text-slate-500" />
                ) : (
                  <ChevronRight size={13} className="text-slate-500" />
                )}
              </button>
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}

            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${depthChipBg[colorIndex]} flex-shrink-0 tracking-wider`}>
              H{node.headingDepth}
            </span>

            {skipsLevel && (
              <span
                className="text-[9px] font-bold px-1 py-0.5 bg-amber-100 text-amber-700 rounded flex-shrink-0 tooltip-wrapper"
                data-tooltip={`Saut de niveau (attendu H${expectedDepth})`}
              >
                ⚠
              </span>
            )}

            <span className={`flex-1 truncate text-sm leading-tight ${isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
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
              <span className="text-emerald-500 text-[10px] flex-shrink-0" title="Contexte global">●</span>
            )}
            {node.meta.agentConfig?.role && (
              <span className="text-fuchsia-500 text-[10px] flex-shrink-0" title={`Agent: ${node.meta.agentConfig.role}`}>✦</span>
            )}
            {hasChildren && (
              <span className="text-[10px] text-slate-400 flex-shrink-0 font-mono" title={`${node.children.length} enfant(s)`}>
                {node.children.length}
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div
            className="flex items-center gap-0.5 px-1.5 py-1 mx-1 mb-1 mt-1 bg-white/70 backdrop-blur-md rounded-xl border border-white/80 shadow-soft flex-wrap animate-fade-in-down"
            style={{ marginLeft: `${indentLevel * 16 + 8}px` }}
          >
            {node.headingDepth < 6 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const childLevel = node.headingDepth + 1;
                  const title = prompt(`Créer un sous-nœud (H${childLevel}) sous "${node.heading}":\n\nTitre du nouveau nœud :`);
                  if (title && title.trim()) addChild(node.id, title.trim());
                }}
                className="icon-btn-sm tooltip-wrapper text-emerald-600 hover:bg-emerald-50"
                data-tooltip={`Ajouter H${node.headingDepth + 1}`}
              >
                <Plus size={13} />
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
              className="icon-btn-sm tooltip-wrapper text-sky-600 hover:bg-sky-50"
              data-tooltip="Renommer"
            >
              <Pencil size={13} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); copyNode(node.id); }}
              className="icon-btn-sm tooltip-wrapper text-accent-600 hover:bg-accent-50"
              data-tooltip="Copier"
            >
              <Copy size={13} />
            </button>

            {clipboardNode && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePasteNode(node.id); }}
                className="icon-btn-sm tooltip-wrapper text-indigo-600 hover:bg-indigo-50"
                data-tooltip="Coller comme enfant"
              >
                <ClipboardPaste size={13} />
              </button>
            )}

            <span className="w-px h-4 bg-slate-200 mx-0.5" />

            {node.headingDepth > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); promoteNode(node.id, true); }}
                className="icon-btn-sm tooltip-wrapper text-amber-600 hover:bg-amber-50 px-1.5 gap-0.5 w-auto"
                data-tooltip={`Promouvoir en H${node.headingDepth - 1}`}
              >
                <LevelUp size={13} />
                <span className="text-[9px] font-bold">H{node.headingDepth - 1}</span>
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
                className="icon-btn-sm tooltip-wrapper text-orange-600 hover:bg-orange-50 px-1.5 gap-0.5 w-auto"
                data-tooltip={`Rétrograder en H${node.headingDepth + 1}`}
              >
                <LevelDown size={13} />
                <span className="text-[9px] font-bold">H{node.headingDepth + 1}</span>
              </button>
            )}

            <span className="w-px h-4 bg-slate-200 mx-0.5" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Supprimer "${node.heading}" et ses ${countAllNodes(node.children)} enfants ?`)) {
                  deleteNode(node.id);
                }
              }}
              className="icon-btn-sm tooltip-wrapper text-rose-600 hover:bg-rose-50"
              data-tooltip="Supprimer"
            >
              <Trash2 size={13} />
            </button>

            {incomplete && (
              <>
                <span className="w-px h-4 bg-slate-200 mx-0.5" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingAIPrompt(
                      `Ce nœud intitulé "${node.heading}" semble incomplet ou vide. Propose un enrichissement pertinent : développe le contenu, ajoute des détails, des exemples ou des sous-sections adaptées au contexte.`
                    );
                  }}
                  className="icon-btn-sm tooltip-wrapper text-amber-600 hover:bg-amber-50"
                  data-tooltip="Enrichissement IA"
                >
                  <Sparkles size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className="relative">
            {node.children.map((child: NodeData) => renderNode(child, treeDepth + 1, node.headingDepth))}
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

  const selectionCount = selectedNodeIds.size;
  const selectedIdsArray = React.useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds]);

  const handleBulkPromote = () => {
    const { ok, skipped } = promoteNodes(selectedIdsArray, true);
    if (ok === 0 && skipped > 0) {
      alert('Aucun nœud n\'a pu être promu (déjà à H1 ou limite atteinte).');
    }
  };
  const handleBulkDemote = () => {
    const { ok, skipped } = demoteNodes(selectedIdsArray, true);
    if (ok === 0 && skipped > 0) {
      alert('Aucun nœud n\'a pu être rétrogradé (profondeur maximale atteinte).');
    }
  };
  const handleBulkDelete = () => {
    if (!confirm(`Supprimer ${selectionCount} nœud${selectionCount > 1 ? 's' : ''} et tous leurs enfants ?`)) return;
    deleteNodes(selectedIdsArray);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {showProjectSwitcher && (
        <ProjectSwitcher onClose={() => setShowProjectSwitcher(false)} />
      )}
      {syncRuleEditDoc && (
        <SyncRuleModal
          doc={documents.find(d => d.id === syncRuleEditDoc.id) ?? syncRuleEditDoc}
          onClose={() => setSyncRuleEditDoc(null)}
        />
      )}
      {syncReview && (
        <SyncReviewModal
          targetDoc={syncReview.targetDoc}
          sourceDocName={syncReview.sourceDocName}
          proposals={syncReview.proposals}
          onClose={() => setSyncReview(null)}
        />
      )}

      {/* ── En-tête projet ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 border-b border-white/40 flex-shrink-0">
        <button
          onClick={() => setShowProjectSwitcher(true)}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-white/60 transition-colors text-left group"
          title="Changer de projet"
        >
          <FolderOpen size={13} className="text-accent-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-800 truncate flex-1">
            {activeProject?.name ?? 'Mon projet'}
          </span>
          <ChevronDown size={11} className="text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
        </button>
        <button
          onClick={handleExportProject}
          className="icon-btn-sm tooltip-wrapper text-slate-400 hover:text-emerald-600"
          data-tooltip="Exporter le projet (ZIP)"
          title="Exporter le projet (ZIP)"
        >
          <Download size={13} />
        </button>
      </div>

      {/* ── Nom du document principal (avec rename inline) ───────────────── */}
      {!isEditingTool && mainDoc && (
        <div className="flex items-center gap-1 px-3 pt-1.5 pb-1 flex-shrink-0">
          <FileText size={11} className="text-accent-400 flex-shrink-0" />
          {renamingDocId === mainDoc.id ? (
            <input
              ref={renameInputRef}
              className="flex-1 text-xs bg-transparent border-b border-accent-400 outline-none text-slate-900 min-w-0"
              maxLength={MAX_DOCUMENT_NAME_LENGTH}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => commitRename(mainDoc.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(mainDoc.id);
                if (e.key === 'Escape') cancelRename();
              }}
            />
          ) : (
            <span className="flex-1 text-xs text-slate-600 font-medium truncate">{mainDoc.name}</span>
          )}
          <button
            onClick={() => startRename(mainDoc.id, mainDoc.name)}
            className="icon-btn-sm text-slate-300 hover:text-accent-600 flex-shrink-0"
            title="Renommer le document principal"
          >
            <Pencil size={10} />
          </button>
        </div>
      )}

      {/* ── Bandeau "retour au document principal" si on édite un outil ── */}
      {isEditingTool && mainDoc && (
        <div className="flex-shrink-0 mx-2 mt-2 mb-0 px-3 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/60 flex items-center gap-2 animate-fade-in">
          <Wrench size={11} className="text-amber-500 flex-shrink-0" />
          <span className="text-[11px] text-amber-700 font-medium truncate flex-1">
            {activeDoc?.name}
          </span>
          <button
            onClick={() => switchDocument(mainDoc.id)}
            className="flex items-center gap-1 text-[11px] text-accent-600 hover:text-accent-800 font-semibold whitespace-nowrap"
          >
            <ArrowRight size={11} />
            Principal
          </button>
        </div>
      )}

      <div className="px-3 pt-3 pb-2 flex-shrink-0 border-b border-white/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FolderTree size={13} className="text-accent-500" />
            Structure
          </h2>
          <div className="flex gap-0.5 items-center">
            <button
              onClick={undo}
              disabled={!historyCanUndo}
              className="icon-btn-sm tooltip-wrapper disabled:opacity-30"
              data-tooltip="Annuler (Ctrl+Z)"
              title="Annuler"
            >
              <Undo2 size={13} />
            </button>
            <button
              onClick={redo}
              disabled={!historyCanRedo}
              className="icon-btn-sm tooltip-wrapper disabled:opacity-30"
              data-tooltip="Rétablir (Ctrl+Y)"
              title="Rétablir"
            >
              <Redo2 size={13} />
            </button>
            <span className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              onClick={handleAddRootNode}
              className="icon-btn-sm tooltip-wrapper text-emerald-600 hover:bg-emerald-50 px-1.5 gap-0.5 w-auto"
              data-tooltip="Nouveau nœud racine (H1)"
              title="Nouveau H1"
            >
              <span className="text-[10px] font-bold leading-none">+H1</span>
            </button>
            <button
              onClick={expandAll}
              className="icon-btn-sm tooltip-wrapper"
              data-tooltip="Tout déplier"
              title="Tout déplier"
            >
              <ChevronDown size={13} />
            </button>
            <button
              onClick={collapseAll}
              className="icon-btn-sm tooltip-wrapper"
              data-tooltip="Tout replier"
              title="Tout replier"
            >
              <ChevronRight size={13} />
            </button>
            {clipboardNode && (
              <button
                onClick={() => handlePasteNode(null)}
                className="icon-btn-sm tooltip-wrapper text-accent-600 hover:bg-accent-50"
                data-tooltip="Coller à la racine"
                title="Coller à la racine"
              >
                <ClipboardPaste size={13} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-medium mb-2">
          {totalNodes} nœud{totalNodes > 1 ? 's' : ''} · {maxDepth} niveau{maxDepth > 1 ? 'x' : ''}
        </p>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher…"
              className="input-sm pl-7"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="icon-btn-sm"
              title="Effacer"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {clipboardNode && (
          <div className="mt-2 px-2 py-1 rounded-lg bg-accent-50/70 text-[10px] text-accent-700 flex items-center gap-1.5">
            <Copy size={10} />
            <span className="truncate font-medium">{clipboardNode.heading || 'Sans titre'}</span>
          </div>
        )}
      </div>

      {selectionCount >= 2 && (
        <div className="flex-shrink-0 mx-2 mt-2 mb-1 p-2 glass-strong rounded-xl flex items-center gap-1.5 animate-fade-in-down shadow-glass">
          <span className="text-[11px] font-bold tracking-wide text-accent-700 mr-1 ml-1">
            {selectionCount} sélectionnés
          </span>
          <button
            onClick={handleBulkPromote}
            className="icon-btn-sm tooltip-wrapper text-amber-600 hover:bg-amber-50 px-1.5 gap-0.5 w-auto"
            data-tooltip="Promouvoir tout"
            title="Promouvoir"
          >
            <LevelUp size={13} />
          </button>
          <button
            onClick={handleBulkDemote}
            className="icon-btn-sm tooltip-wrapper text-orange-600 hover:bg-orange-50 px-1.5 gap-0.5 w-auto"
            data-tooltip="Rétrograder tout"
            title="Rétrograder"
          >
            <LevelDown size={13} />
          </button>
          <button
            onClick={handleBulkDelete}
            className="icon-btn-sm tooltip-wrapper text-rose-600 hover:bg-rose-50"
            data-tooltip="Supprimer tout"
            title="Supprimer"
          >
            <Trash2 size={13} />
          </button>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="icon-btn-sm tooltip-wrapper"
            data-tooltip="Désélectionner"
            title="Désélectionner"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto min-h-0 px-2 pb-2"
        onDragOver={rootHandlers.onDragOver}
        onDrop={rootHandlers.onDrop}
      >
        <div className="pt-2 pb-1">
          <div
            className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-xl transition-all duration-200 ease-spring border-l-2 ${
              isDocumentRoot
                ? 'accent-gradient-soft border-accent-500 shadow-soft'
                : 'border-transparent hover:bg-white/60'
            }`}
            onClick={() => selectDocumentRoot()}
          >
            <FileText size={14} className={isDocumentRoot ? 'text-accent-600' : 'text-slate-500'} />
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${isDocumentRoot ? 'bg-accent-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
              H0
            </span>
            <span className={`flex-1 text-sm leading-tight ${isDocumentRoot ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
              Document complet
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {tree.length} racine{tree.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="divider my-1" />

        {visibleTree.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            {searchTerm ? (
              <span>Aucun résultat pour <span className="font-mono">"{searchTerm}"</span></span>
            ) : (
              <span>Aucun nœud. Importez un Markdown pour commencer.</span>
            )}
          </div>
        ) : (
          <div className="pt-1">
            {visibleTree.map(node => renderNode(node))}
          </div>
        )}
      </div>

      {/* ── Documents outils ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/40">
        <button
          onClick={() => setShowToolDocs(v => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-white/50 transition-colors"
        >
          <Wrench size={11} className="text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex-1 text-left">
            Documents outils
          </span>
          <span className="text-[10px] text-slate-400 font-mono mr-1">{toolDocs.length}</span>
          <ChevronRight size={11} className={`text-slate-400 transition-transform ${showToolDocs ? 'rotate-90' : ''}`} />
        </button>

        {showToolDocs && (
          <div className="pb-2 px-2 space-y-0.5 animate-fade-in">
            {toolDocs.length === 0 && (
              <p className="text-[11px] text-slate-400 text-center py-2">
                Aucun document outil.
              </p>
            )}
            {toolDocs.map((doc: ProjectDocument) => (
              <div
                key={doc.id}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
                  doc.id === activeDocumentId
                    ? 'bg-amber-50/80 border border-amber-200/60'
                    : 'hover:bg-white/60 border border-transparent'
                }`}
                onClick={() => switchDocument(doc.id)}
              >
                <Wrench size={11} className={doc.id === activeDocumentId ? 'text-amber-500' : 'text-slate-400'} />
                {renamingDocId === doc.id ? (
                  <input
                    ref={renameInputRef}
                    className="flex-1 text-xs bg-transparent border-b border-accent-400 outline-none text-slate-900 min-w-0"
                    maxLength={MAX_DOCUMENT_NAME_LENGTH}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(doc.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(doc.id);
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-xs font-medium text-slate-700 truncate">{doc.name}</span>
                )}
                {doc.syncRule && (
                  <span
                    className="text-violet-500 text-[10px] flex-shrink-0"
                    title={`Synchro depuis ${documents.find(d => d.id === doc.syncRule!.sourceDocId)?.name ?? '?'}`}
                  >
                    ⟳
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                  {doc.tree.length > 0 ? `${countAllNodes(doc.tree)}` : '—'}
                </span>
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0 transition-opacity">
                  {doc.syncRule && (
                    <button
                      onClick={e => { e.stopPropagation(); handleRunSync(doc); }}
                      disabled={syncRunningDocId === doc.id}
                      className="icon-btn-sm text-slate-400 hover:text-violet-600 disabled:opacity-50"
                      title="Lancer la synchro"
                    >
                      <RefreshCw size={10} className={syncRunningDocId === doc.id ? 'animate-spin' : ''} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setSyncRuleEditDoc(doc); }}
                    className={`icon-btn-sm ${doc.syncRule ? 'text-violet-500 hover:text-violet-700' : 'text-slate-400 hover:text-violet-600'}`}
                    title={doc.syncRule ? 'Modifier la règle de synchro' : 'Configurer une règle de synchro'}
                  >
                    <Workflow size={10} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); startRename(doc.id, doc.name); }}
                    className="icon-btn-sm text-slate-400 hover:text-accent-600"
                    title="Renommer"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`Passer "${doc.name}" en document principal ?`)) setDocumentType(doc.id, 'main'); }}
                    className="icon-btn-sm text-slate-400 hover:text-emerald-600"
                    title="Définir comme document principal"
                  >
                    <ArrowRight size={10} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`Supprimer "${doc.name}" ?`)) deleteDocument(doc.id); }}
                    className="icon-btn-sm text-slate-400 hover:text-rose-600"
                    title="Supprimer ce document"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => createDocument('Nouveau document', 'tool')}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-accent-600 hover:bg-white/60 transition-colors border border-dashed border-slate-200 mt-1"
            >
              <Plus size={11} />
              <span>Ajouter un document outil</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
