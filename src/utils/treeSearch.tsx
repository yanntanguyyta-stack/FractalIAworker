import React from 'react';
import { NodeData } from '../types';

export const PLACEHOLDER_PATTERNS = [
  /\btodo\b/i,
  /\bà compléter\b/i,
  /\btbd\b/i,
  /\bwip\b/i,
  /\ben cours\b/i,
  /\bà rédiger\b/i,
  /\bà définir\b/i,
];

export const MIN_CONTENT_LENGTH = 50;

export function countAllNodes(nodes: NodeData[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children.length > 0) count += countAllNodes(node.children);
  }
  return count;
}

export function getMaxDepth(nodes: NodeData[], currentDepth: number = 1): number {
  let maxDepth = currentDepth;
  for (const node of nodes) {
    if (node.children.length > 0) {
      const childDepth = getMaxDepth(node.children, currentDepth + 1);
      if (childDepth > maxDepth) maxDepth = childDepth;
    }
  }
  return maxDepth;
}

export function isNodeIncomplete(node: NodeData): boolean {
  const content = node.content.trim();
  if (content === '') return true;
  if (content.length < MIN_CONTENT_LENGTH) return true;
  if (PLACEHOLDER_PATTERNS.some(re => re.test(content))) return true;
  return false;
}

export interface TreeSearchResult {
  nodes: NodeData[];
  expandedIds: Set<string>;
  matchIds: Set<string>;
}

export function filterTreeForSearch(nodes: NodeData[], term: string): TreeSearchResult {
  const expandedIds = new Set<string>();
  const matchIds = new Set<string>();
  const lowerTerm = term.toLowerCase();

  function filterNodes(list: NodeData[]): NodeData[] {
    const result: NodeData[] = [];
    for (const node of list) {
      const matchesHeading = node.heading.toLowerCase().includes(lowerTerm);
      const matchesContent = node.content.toLowerCase().includes(lowerTerm);
      const filteredChildren = filterNodes(node.children);
      if (matchesHeading || matchesContent || filteredChildren.length > 0) {
        if (filteredChildren.length > 0) expandedIds.add(node.id);
        if (matchesHeading || matchesContent) matchIds.add(node.id);
        result.push({ ...node, children: filteredChildren });
      }
    }
    return result;
  }

  return { nodes: filterNodes(nodes), expandedIds, matchIds };
}

export function highlightMatch(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + term.length);
  const after = text.slice(index + term.length);
  return (
    <>
      {before}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}
