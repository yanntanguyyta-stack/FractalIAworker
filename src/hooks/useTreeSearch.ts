import { useMemo, useState } from 'react';
import { NodeData } from '../types';
import { filterTreeForSearch, TreeSearchResult } from '../utils/treeSearch';

export interface UseTreeSearchResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  trimmedSearch: string;
  searchResults: TreeSearchResult | null;
  visibleTree: NodeData[];
  matchIds: Set<string>;
  hasActiveSearch: boolean;
}

export function useTreeSearch(tree: NodeData[]): UseTreeSearchResult {
  const [searchTerm, setSearchTerm] = useState('');
  const trimmedSearch = searchTerm.trim();

  const searchResults = useMemo(
    () => (trimmedSearch ? filterTreeForSearch(tree, trimmedSearch) : null),
    [tree, trimmedSearch]
  );

  return {
    searchTerm,
    setSearchTerm,
    trimmedSearch,
    searchResults,
    visibleTree: searchResults ? searchResults.nodes : tree,
    matchIds: searchResults ? searchResults.matchIds : new Set<string>(),
    hasActiveSearch: Boolean(trimmedSearch),
  };
}
