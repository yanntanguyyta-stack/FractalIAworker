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
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors ${
            isActive ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              className="p-0 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}

          <span
            className="flex-1 truncate text-sm font-medium"
            onClick={() => selectNode(node.id)}
          >
            {node.heading || '(Sans titre)'}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              addChild(node.id, 'Nouveau nœud');
            }}
            className="p-1 hover:bg-green-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Ajouter un enfant"
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
            className="p-1 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Supprimer le nœud"
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
