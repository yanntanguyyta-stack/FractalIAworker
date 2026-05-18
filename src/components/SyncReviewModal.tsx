import React from 'react';
import { X, Check, CheckSquare, Square, Plus, Sparkles } from 'lucide-react';
import { useStore, DOCUMENT_ROOT_ID, ProjectDocument } from '../store';
import { SubsectionProposal } from '../aiService';

interface SyncReviewModalProps {
  targetDoc: ProjectDocument;        // the tool doc being enriched
  sourceDocName: string;
  proposals: SubsectionProposal[];
  onClose: () => void;
}

const SyncReviewModal: React.FC<SyncReviewModalProps> = ({
  targetDoc, sourceDocName, proposals, onClose,
}) => {
  const { switchDocument, activeDocumentId, insertSectionsAsChildren } = useStore();
  const [selected, setSelected] = React.useState<Set<number>>(
    () => new Set(proposals.map((_, i) => i))
  );

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === proposals.length) setSelected(new Set());
    else setSelected(new Set(proposals.map((_, i) => i)));
  };

  const handleInsert = () => {
    const sections = proposals
      .filter((_, i) => selected.has(i))
      .map(p => ({ heading: p.title, content: p.description }));
    if (sections.length === 0) {
      onClose();
      return;
    }
    // Insertion happens on the target tool doc → switch to it first if needed.
    if (activeDocumentId !== targetDoc.id) switchDocument(targetDoc.id);
    // Insert at root level of the tool doc.
    insertSectionsAsChildren(DOCUMENT_ROOT_ID, sections);
    onClose();
  };

  const allSelected = selected.size === proposals.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col glass-strong rounded-3xl shadow-glass overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              Revue de synchro · {targetDoc.name}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {proposals.length === 0
                ? 'Aucune nouvelle entrée trouvée dans le document source.'
                : `${proposals.length} entrée${proposals.length > 1 ? 's' : ''} nouvelle${proposals.length > 1 ? 's' : ''} détectée${proposals.length > 1 ? 's' : ''} dans "${sourceDocName}".`}
            </p>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={15} />
          </button>
        </div>

        {proposals.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-white/20 flex-shrink-0">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-white/50 transition-colors"
            >
              {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <span className="text-[11px] text-slate-400 ml-auto tabular-nums">
              {selected.size} / {proposals.length} sélectionnés
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-0">
          {proposals.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              L'IA n'a rien trouvé à ajouter. Le document outil est déjà à jour par rapport au document source, ou l'instruction est peut-être trop restrictive.
            </p>
          ) : (
            proposals.map((p, idx) => {
              const isSelected = selected.has(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggle(idx)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-violet-50/70 border-violet-300/60'
                      : 'bg-white/40 border-white/60 hover:bg-white/70'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                    isSelected ? 'bg-violet-500' : 'border border-slate-300 bg-white/50'
                  }`}>
                    {isSelected && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 mb-0.5">{p.title}</h4>
                    {p.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{p.description}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/30 bg-white/30 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary text-xs px-3 py-1.5 h-auto">
            {proposals.length === 0 ? 'Fermer' : 'Annuler'}
          </button>
          {proposals.length > 0 && (
            <button
              onClick={handleInsert}
              disabled={selected.size === 0}
              className="btn-primary text-xs px-3 py-1.5 h-auto disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Plus size={12} />
              Insérer {selected.size > 0 ? `${selected.size} entrée${selected.size > 1 ? 's' : ''}` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncReviewModal;
