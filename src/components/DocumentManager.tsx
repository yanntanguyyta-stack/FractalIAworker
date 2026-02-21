import React, { useState, useEffect } from 'react';
import {
  FolderOpen, FilePlus, Trash2, Edit3, Copy, X, FileText, Clock, Check, AlertTriangle
} from 'lucide-react';
import {
  DocumentMeta,
  DocumentIndex,
  loadDocumentIndex,
  loadDocumentTree,
  deleteDocument,
  renameDocument,
  setActiveDocument,
  duplicateDocument,
} from '../documentStore';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-indigo-800 text-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <FolderOpen size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Mes documents</h2>
                <p className="text-slate-300 text-sm">
                  {docIndex.documents.length} document{docIndex.documents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {docIndex.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium text-gray-500">Aucun document</p>
              <p className="text-sm text-gray-400 mb-6">Créez votre premier document pour commencer</p>
              <button
                onClick={() => { onClose(); onNewDocument(); }}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium transition-colors"
              >
                <FilePlus size={18} />
                Créer un document
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {docIndex.documents
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      doc.id === activeDocId
                        ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleOpenDoc(doc.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg mt-0.5 ${
                          doc.id === activeDocId ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'
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
                                {doc.id === activeDocId && (
                                  <span className="text-indigo-600 font-medium">• Actif</span>
                                )}
                              </div>
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
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={() => { onClose(); onNewDocument(); }}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium transition-colors"
          >
            <FilePlus size={18} />
            Nouveau document
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
