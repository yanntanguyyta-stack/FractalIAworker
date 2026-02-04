import React from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { NodeData } from '../types';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const { tree, activeNodeId, selectNode, addChild, deleteNode } = useStore();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpanded(newExpanded);
  };

  const renderNode = (node: NodeData, depth: number = 0) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isActive = activeNodeId === node.id;

    return (
      <div key={node.id} className="select-none sidebar-node-item">
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-all duration-150 ${
            isActive 
              ? 'node-active' 
              : 'hover:bg-gray-100 border-l-4 border-transparent'
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
          onClick={() => selectNode(node.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              aria-label={isExpanded ? 'Replier' : 'Déplier'}
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          <span className="flex-1 truncate text-sm font-medium">
            {node.heading || '(Sans titre)'}
          </span>

          {/* Indicateur de type */}
          {node.meta.contextConfig?.isGlobal && (
            <span className="text-green-500 text-xs" title="Contexte global">🌐</span>
          )}
          {node.meta.agentConfig?.role && (
            <span className="text-purple-500 text-xs" title={`Agent: ${node.meta.agentConfig.role}`}>🤖</span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              addChild(node.id, 'Nouveau nœud');
            }}
            className="p-1 hover:bg-green-200 rounded node-action tooltip-wrapper"
            data-tooltip="Ajouter un enfant"
          >
            <Plus size={14} className="text-green-600" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer "${node.heading}" ?`)) {
                deleteNode(node.id);
              }
            }}
            className="p-1 hover:bg-red-200 rounded node-action tooltip-wrapper"
            data-tooltip="Supprimer"
          >
            <Trash2 size={14} className="text-red-600" />
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child: NodeData) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`bg-white flex flex-col h-full ${className}`}
    >
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900">Nœuds du Projet</h2>
        <p className="text-xs text-gray-500 mt-1">{tree.length} nœuds racine</p>
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
