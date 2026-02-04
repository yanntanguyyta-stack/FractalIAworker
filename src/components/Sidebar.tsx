import React from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, FolderTree } from 'lucide-react';
import { useStore } from '../store';
import { NodeData } from '../types';

interface SidebarProps {
  className?: string;
}

// Couleurs par niveau de profondeur
const depthColors = [
  'border-blue-500',    // niveau 1
  'border-indigo-500',  // niveau 2
  'border-purple-500',  // niveau 3
  'border-pink-500',    // niveau 4
  'border-rose-500',    // niveau 5
  'border-orange-500',  // niveau 6
];

const depthBgColors = [
  'bg-blue-50',
  'bg-indigo-50',
  'bg-purple-50',
  'bg-pink-50',
  'bg-rose-50',
  'bg-orange-50',
];

// Compter tous les nœuds récursivement
function countAllNodes(nodes: NodeData[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children.length > 0) {
      count += countAllNodes(node.children);
    }
  }
  return count;
}

// Trouver la profondeur maximale
function getMaxDepth(nodes: NodeData[], currentDepth: number = 1): number {
  let maxDepth = currentDepth;
  for (const node of nodes) {
    if (node.children.length > 0) {
      const childDepth = getMaxDepth(node.children, currentDepth + 1);
      if (childDepth > maxDepth) maxDepth = childDepth;
    }
  }
  return maxDepth;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const { tree, activeNodeId, selectNode, addChild, deleteNode } = useStore();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Expand all by default on first load
  React.useEffect(() => {
    const allIds = new Set<string>();
    function collectIds(nodes: NodeData[]) {
      for (const node of nodes) {
        allIds.add(node.id);
        if (node.children.length > 0) {
          collectIds(node.children);
        }
      }
    }
    collectIds(tree);
    setExpanded(allIds);
  }, [tree.length]); // Re-expand when tree changes

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpanded(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    function collectIds(nodes: NodeData[]) {
      for (const node of nodes) {
        allIds.add(node.id);
        if (node.children.length > 0) {
          collectIds(node.children);
        }
      }
    }
    collectIds(tree);
    setExpanded(allIds);
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const renderNode = (node: NodeData, depth: number = 0) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isActive = activeNodeId === node.id;
    const colorIndex = Math.min(depth, depthColors.length - 1);

    return (
      <div key={node.id} className="select-none sidebar-node-item">
        {/* Ligne de connexion verticale */}
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
            }`}
            style={{ marginLeft: `${depth * 16}px` }}
            onClick={() => selectNode(node.id)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(node.id);
                }}
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

            {/* Indicateur de niveau */}
            <span className={`text-[10px] font-bold px-1 rounded ${depthBgColors[colorIndex]} ${depthColors[colorIndex].replace('border-', 'text-')}`}>
              H{node.headingDepth}
            </span>

            <span className="flex-1 truncate text-sm font-medium">
              {node.heading || '(Sans titre)'}
            </span>

            {/* Indicateurs de type */}
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

            <button
              onClick={(e) => {
                e.stopPropagation();
                addChild(node.id, 'Nouveau nœud');
              }}
              className="p-1 hover:bg-green-200 rounded node-action tooltip-wrapper flex-shrink-0"
              data-tooltip="Ajouter un enfant"
            >
              <Plus size={12} className="text-green-600" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Supprimer "${node.heading}" et ses ${countAllNodes(node.children)} enfants ?`)) {
                  deleteNode(node.id);
                }
              }}
              className="p-1 hover:bg-red-200 rounded node-action tooltip-wrapper flex-shrink-0"
              data-tooltip="Supprimer"
            >
              <Trash2 size={12} className="text-red-600" />
            </button>
          </div>
        </div>

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

  return (
    <div
      className={`bg-white flex flex-col h-full ${className}`}
    >
      <div className="p-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FolderTree size={18} className="text-blue-600" />
            Structure
          </h2>
          <div className="flex gap-1">
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
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {totalNodes} nœuds • {maxDepth} niveaux
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tree.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            Aucun nœud. Chargez un Markdown pour commencer.
          </div>
        ) : (
          <div className="p-2">
            {tree.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
