import { useState, useCallback } from 'react';
import type { DragEvent } from 'react';

export interface NodeDragHandlers {
  draggable: true;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  isDropTarget: boolean;
}

export interface RootDropHandlers {
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

export interface UseDragDropResult {
  draggedNodeId: string | null;
  dropTargetId: string | null;
  getNodeHandlers: (nodeId: string) => NodeDragHandlers;
  getRootHandlers: () => RootDropHandlers;
}

/**
 * Manages drag-and-drop state for a tree. `onMove(sourceId, targetId | null)`
 * is invoked when a node is dropped on another node (targetId) or on the root
 * (targetId === null).
 */
export function useDragDrop(
  onMove: (sourceId: string, targetId: string | null) => void
): UseDragDropResult {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const getNodeHandlers = useCallback(
    (nodeId: string): NodeDragHandlers => ({
      draggable: true,
      onDragStart: (event) => {
        event.stopPropagation();
        setDraggedNodeId(nodeId);
        event.dataTransfer.setData('text/plain', nodeId);
        event.dataTransfer.effectAllowed = 'move';
      },
      onDragEnd: () => {
        setDraggedNodeId(null);
        setDropTargetId(null);
      },
      onDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDropTargetId(nodeId);
        event.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: (event) => {
        event.stopPropagation();
        setDropTargetId((current) => (current === nodeId ? null : current));
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceId = draggedNodeId || event.dataTransfer.getData('text/plain');
        setDraggedNodeId(null);
        setDropTargetId(null);
        if (sourceId) onMove(sourceId, nodeId);
      },
      isDropTarget: dropTargetId === nodeId,
    }),
    [draggedNodeId, dropTargetId, onMove]
  );

  const getRootHandlers = useCallback(
    (): RootDropHandlers => ({
      onDragOver: (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      onDrop: (event) => {
        event.preventDefault();
        const sourceId = draggedNodeId || event.dataTransfer.getData('text/plain');
        setDraggedNodeId(null);
        setDropTargetId(null);
        if (sourceId) onMove(sourceId, null);
      },
    }),
    [draggedNodeId, onMove]
  );

  return { draggedNodeId, dropTargetId, getNodeHandlers, getRootHandlers };
}
