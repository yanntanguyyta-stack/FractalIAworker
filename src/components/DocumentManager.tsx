import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen, FilePlus, Trash2, Edit3, Copy, X, FileText, Clock, Check, AlertTriangle, Tag, Search, Download, Upload
} from 'lucide-react';
import {
  DocumentMeta,
  DocumentIndex,
  loadDocumentIndex,
  loadDocumentTree,
  saveDocumentIndex,
  saveDocumentTree,
  deleteDocument,
  renameDocument,
  setActiveDocument,
  duplicateDocument,
  updateDocumentTags,
} from '../documentStore';
import { exportDocumentsToZip, importDocumentsFromZip, mergeImportedDocuments } from '../utils/zipExport';

interface DocumentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  activeDocId: string | null;
  onOpenDocument: (docId: string) => void;
  onNewDocument: () => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({
  isOpen, onClose, userId, activeDocId, onOpenDocument, onNewDocument,
}) => {
  const [docIndex, setDocIndex] = useState<DocumentIndex>({ activeDocId: null, documents: [] });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilterId, setTagFilterId] = useState<string | null>(null);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDocIndex(loadDocumentIndex(userId));
    }
  }, [isOpen, userId]);

  const handleOpenDoc = (docId: string) => {
    if (docId === activeDocId) {
      onClose();
      return;
    }
    setActiveDocument(userId, docId);
    onOpenDocument(docId);
    onClose();
  };

  const handleDeleteDoc = (docId: string) => {
    deleteDocument(userId, docId);
    const updated = loadDocumentIndex(userId);
    setDocIndex(updated);
    setDeleteConfirmId(null);
    // Si le document actif a été supprimé, ouvrir le premier disponible
    if (docId === activeDocId && updated.documents.length > 0) {
      onOpenDocument(updated.documents[0].id);
    }
  };

  const handleRenameDoc = (docId: string) => {
    if (renameValue.trim()) {
      renameDocument(userId, docId, renameValue.trim());
      setDocIndex(loadDocumentIndex(userId));
    }
    setRenamingId(null);
  };

  const handleDuplicateDoc = (docId: string) => {
    const newId = duplicateDocument(userId, docId);
    if (newId) {
      setDocIndex(loadDocumentIndex(userId));
    }
  };

  const handleSaveTags = (docId: string) => {
    const tags = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    updateDocumentTags(userId, docId, tags);
    setDocIndex(loadDocumentIndex(userId));
    setEditingTagsId(null);
    setTagInput('');
  };

  const handleRemoveTag = (docId: string, tag: string, currentTags: string[]) => {
    const updatedTags = currentTags.filter(t => t !== tag);
    updateDocumentTags(userId, docId, updatedTags);
    setDocIndex(loadDocumentIndex(userId));
  };

  const handleExportZip = async () => {
    if (docIndex.documents.length === 0) return;
    setIsExportingZip(true);
    try {
      const blob = await exportDocumentsToZip(userId, docIndex, loadDocumentTree);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fractalia-documents-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de l\'export ZIP.');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleImportZip = async (file: File) => {
    setIsImportingZip(true);
    try {
      const bundle = await importDocumentsFromZip(file);
      const currentIndex = loadDocumentIndex(userId);
      const { mergedIndex, mergedDocs } = mergeImportedDocuments(currentIndex, bundle);
      saveDocumentIndex(userId, mergedIndex);
      for (const [docId, tree] of Object.entries(mergedDocs)) {
        saveDocumentTree(userId, docId, tree);
      }
      setDocIndex(loadDocumentIndex(userId));
      alert(`${bundle.index.documents.length} document(s) importé(s) avec succès.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'import ZIP.';
      alert(`Erreur d'import : ${message}`);
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  // All unique tags across all documents
  const allTags = Array.from(
    new Set(docIndex.documents.flatMap(d => d.tags ?? []))
  ).sort();

  // Filter documents by search query and active tag filter
  const lowerQuery = searchQuery.toLowerCase();
  const filteredDocuments = docIndex.documents.filter(doc => {
    const matchesName = lowerQuery === '' || doc.name.toLowerCase().includes(lowerQuery);
    const matchesTag = tagFilterId === null || (doc.tags ?? []).includes(tagFilterId);
    return matchesName && matchesTag;
  });

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/40 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-glow-accent">
                <FolderOpen size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold accent-text-gradient tracking-tight">Mes documents</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filteredDocuments.length}/{docIndex.documents.length} document{docIndex.documents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="icon-btn" aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
          {/* Search bar */}
          <div className="mt-3 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom..."
              className="input pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn-sm"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              <button
                onClick={() => setTagFilterId(null)}
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all duration-150 ${tagFilterId === null ? 'accent-gradient text-white shadow-glow-accent' : 'bg-white/60 text-slate-600 hover:bg-white/90 border border-white/60'}`}
              >
                Tous
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setTagFilterId(tagFilterId === tag ? null : tag)}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all duration-150 ${tagFilterId === tag ? 'accent-gradient text-white shadow-glow-accent' : 'bg-white/60 text-slate-600 hover:bg-white/90 border border-white/60'}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {docIndex.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl accent-gradient-soft border border-accent-200/60 flex items-center justify-center mb-4">
                <FileText size={22} className="text-accent-500" />
              </div>
              <p className="text-base font-semibold text-slate-700">Aucun document</p>
              <p className="text-sm text-slate-500 mb-5">Créez votre premier document pour commencer</p>
              <button onClick={() => { onClose(); onNewDocument(); }} className="btn-primary">
                <FilePlus size={15} />
                Créer un document
              </button>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search size={28} className="mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">Aucun document ne correspond à la recherche.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredDocuments
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`group relative p-3 rounded-2xl border transition-all duration-200 ease-spring cursor-pointer ${
                      doc.id === activeDocId
                        ? 'border-accent-300 accent-gradient-soft shadow-soft'
                        : 'border-white/60 bg-white/40 hover:bg-white/70 hover:border-accent-200/50'
                    }`}
                    onClick={() => handleOpenDoc(doc.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          doc.id === activeDocId ? 'accent-gradient text-white shadow-glow-accent' : 'bg-white/60 text-slate-500 border border-white/80'
                        }`}>
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {renamingId === doc.id ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameDoc(doc.id);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                className="flex-1 px-3 py-1 border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleRenameDoc(doc.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => setRenamingId(null)}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-semibold text-gray-900 truncate">{doc.name}</h3>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  Modifié {formatDate(doc.updatedAt)}
                                </span>
                                <span>Créé {formatDate(doc.createdAt)}</span>
                                {doc.nodeCount !== undefined && (
                                  <span>{doc.nodeCount} nœud{doc.nodeCount !== 1 ? 's' : ''}</span>
                                )}
                                {doc.id === activeDocId && (
                                  <span className="text-indigo-600 font-medium">• Actif</span>
                                )}
                              </div>
                              {/* Tags display */}
                              {editingTagsId === doc.id ? (
                                <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveTags(doc.id);
                                      if (e.key === 'Escape') { setEditingTagsId(null); setTagInput(''); }
                                    }}
                                    placeholder="tag1, tag2, ..."
                                    className="flex-1 px-2 py-1 text-xs border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveTags(doc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                                  <button onClick={() => { setEditingTagsId(null); setTagInput(''); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-wrap items-center gap-1">
                                  {(doc.tags ?? []).map(tag => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      #{tag}
                                      <button
                                        onClick={() => handleRemoveTag(doc.id, tag, doc.tags ?? [])}
                                        className="hover:text-red-500 transition-colors"
                                        title="Retirer ce tag"
                                      >
                                        <X size={10} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {renamingId !== doc.id && (
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setRenamingId(doc.id);
                              setRenameValue(doc.name);
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Renommer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTagsId(doc.id);
                              setTagInput((doc.tags ?? []).join(', '));
                            }}
                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                            title="Gérer les tags"
                          >
                            <Tag size={15} />
                          </button>
                          <button
                            onClick={() => handleDuplicateDoc(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Dupliquer"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Confirmation suppression */}
                    {deleteConfirmId === doc.id && (
                      <div
                        className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 text-sm text-red-700">
                          <AlertTriangle size={16} />
                          Supprimer ce document ?
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="px-3 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/40 px-6 py-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <button onClick={onClose} className="btn-ghost">
            Fermer
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportZip}
              disabled={isExportingZip || docIndex.documents.length === 0}
              className="btn-secondary"
              title="Exporter tous les documents en ZIP"
            >
              <Download size={14} />
              {isExportingZip ? 'Export…' : 'Export ZIP'}
            </button>
            <button
              onClick={() => zipInputRef.current?.click()}
              disabled={isImportingZip}
              className="btn-secondary"
              title="Importer des documents depuis un ZIP"
            >
              <Upload size={14} />
              {isImportingZip ? 'Import…' : 'Import ZIP'}
            </button>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportZip(file);
              }}
            />
            <button onClick={() => { onClose(); onNewDocument(); }} className="btn-primary">
              <FilePlus size={15} />
              Nouveau document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
