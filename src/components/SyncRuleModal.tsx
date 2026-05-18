import React from 'react';
import { X, Workflow, Trash2, Save } from 'lucide-react';
import { useStore, MAX_SYNC_INSTRUCTION_LENGTH, ProjectDocument } from '../store';

interface SyncRuleModalProps {
  doc: ProjectDocument;
  onClose: () => void;
}

const SyncRuleModal: React.FC<SyncRuleModalProps> = ({ doc, onClose }) => {
  const { documents, setSyncRule } = useStore();
  const otherDocs = documents.filter(d => d.id !== doc.id);

  const [sourceDocId, setSourceDocId] = React.useState<string>(
    doc.syncRule?.sourceDocId ?? otherDocs[0]?.id ?? ''
  );
  const [instruction, setInstruction] = React.useState<string>(
    doc.syncRule?.instruction ?? ''
  );

  const canSave = sourceDocId.length > 0 && instruction.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    setSyncRule(doc.id, { sourceDocId, instruction: instruction.trim() });
    onClose();
  };

  const handleRemove = () => {
    if (!doc.syncRule) return;
    if (confirm('Retirer la règle de synchro de ce document ?')) {
      setSyncRule(doc.id, null);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg glass-strong rounded-3xl shadow-glass overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Workflow size={16} className="text-violet-500" />
            Règle de synchro · {doc.name}
          </h2>
          <button onClick={onClose} className="icon-btn">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {otherDocs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Aucun autre document disponible comme source. Créez d'abord un document principal ou un autre outil dans le projet.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Document source
                </label>
                <select
                  value={sourceDocId}
                  onChange={e => setSourceDocId(e.target.value)}
                  className="input w-full"
                >
                  {otherDocs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.type === 'main' ? '· principal' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Document à analyser quand vous lancerez la synchro.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Instruction
                </label>
                <textarea
                  value={instruction}
                  onChange={e => setInstruction(e.target.value.slice(0, MAX_SYNC_INSTRUCTION_LENGTH))}
                  rows={5}
                  placeholder={'Ex. : "Liste les personnages mentionnés avec leur apparence, leur personnalité et leur rôle dans l\'intrigue. Une entrée par personnage."'}
                  className="input w-full resize-none font-mono text-xs leading-relaxed"
                />
                <div className="flex justify-between mt-1">
                  <p className="text-[11px] text-slate-400">
                    Décrivez ce que l'IA doit extraire et ajouter à ce document outil.
                  </p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {instruction.length} / {MAX_SYNC_INSTRUCTION_LENGTH}
                  </p>
                </div>
              </div>

              <div className="px-3 py-2 bg-amber-50/60 border border-amber-200/50 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                Chaque synchro propose des entrées <strong>nouvelles uniquement</strong> et passe par une revue manuelle avant insertion. Rien n'est ajouté à votre document sans votre accord.
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/30 bg-white/30">
          {doc.syncRule ? (
            <button
              onClick={handleRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={12} />
              Retirer la règle
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs px-3 py-1.5 h-auto">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || otherDocs.length === 0}
              className="btn-primary text-xs px-3 py-1.5 h-auto disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Save size={12} />
              {doc.syncRule ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncRuleModal;
