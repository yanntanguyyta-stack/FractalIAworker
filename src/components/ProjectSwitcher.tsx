import React from 'react';
import { X, Plus, Pencil, Trash2, FolderOpen, FolderPlus, Check } from 'lucide-react';
import { useStore, Project, MAX_PROJECT_NAME_LENGTH } from '../store';

interface ProjectSwitcherProps {
  onClose: () => void;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ onClose }) => {
  const { projects, activeProjectId, createProject, switchProject, renameProject, deleteProject } = useStore();
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const renameRef = React.useRef<HTMLInputElement>(null);
  const newNameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (renamingId) setTimeout(() => renameRef.current?.select(), 0);
  }, [renamingId]);

  React.useEffect(() => {
    if (creating) setTimeout(() => newNameRef.current?.focus(), 0);
  }, [creating]);

  const startRename = (p: Project) => {
    setRenamingId(p.id);
    setRenameValue(p.name);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim()) renameProject(id, renameValue.trim());
    setRenamingId(null);
  };

  const commitCreate = () => {
    const name = newName.trim() || 'Nouveau projet';
    createProject(name);
    setCreating(false);
    setNewName('');
    onClose();
  };

  const handleDelete = (p: Project) => {
    if (projects.length <= 1) return;
    if (confirm(`Supprimer le projet "${p.name}" et tous ses documents ?`)) {
      deleteProject(p.id);
    }
  };

  const handleSwitch = (id: string) => {
    switchProject(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl glass-strong rounded-3xl shadow-glass overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen size={16} className="text-accent-500" />
            Mes projets
          </h2>
          <button onClick={onClose} className="icon-btn">
            <X size={15} />
          </button>
        </div>

        {/* Project grid */}
        <div className="p-5 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => handleSwitch(p.id)}
              className={`group relative flex flex-col gap-2 p-4 rounded-2xl border cursor-pointer transition-all duration-150 hover:shadow-soft active:scale-[0.98] ${
                p.id === activeProjectId
                  ? 'bg-accent-50/80 border-accent-300/60 shadow-soft'
                  : 'bg-white/60 border-white/60 hover:bg-white/80'
              }`}
            >
              {/* Active indicator */}
              {p.id === activeProjectId && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full accent-gradient flex items-center justify-center shadow-glow-accent">
                  <Check size={10} className="text-white" />
                </span>
              )}

              <div className="flex items-start gap-2 pr-5">
                <FolderOpen size={18} className={p.id === activeProjectId ? 'text-accent-500' : 'text-slate-400'} />
                {renamingId === p.id ? (
                  <input
                    ref={renameRef}
                    className="flex-1 text-sm font-semibold bg-transparent border-b border-accent-400 outline-none text-slate-900"
                    maxLength={MAX_PROJECT_NAME_LENGTH}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(p.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(p.id); }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm font-semibold text-slate-900 leading-tight">{p.name}</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>{p.documents.length} document{p.documents.length > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{new Date(p.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </div>

              {/* Action buttons (appear on hover) */}
              <div
                className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => startRename(p)}
                  className="icon-btn-sm tooltip-wrapper text-slate-500 hover:text-accent-600"
                  data-tooltip="Renommer"
                >
                  <Pencil size={11} />
                </button>
                {projects.length > 1 && (
                  <button
                    onClick={() => handleDelete(p)}
                    className="icon-btn-sm tooltip-wrapper text-slate-500 hover:text-rose-600"
                    data-tooltip="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* New project card */}
          {creating ? (
            <div className="flex flex-col gap-3 p-4 rounded-2xl border border-dashed border-accent-300 bg-accent-50/40">
              <input
                ref={newNameRef}
                className="text-sm font-semibold bg-transparent border-b border-accent-400 outline-none text-slate-900 placeholder:text-slate-400"
                maxLength={MAX_PROJECT_NAME_LENGTH}
                placeholder="Nom du projet"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
              />
              <div className="flex gap-2">
                <button onClick={commitCreate} className="btn-primary text-xs px-3 py-1.5 h-auto">Créer</button>
                <button onClick={() => { setCreating(false); setNewName(''); }} className="btn-secondary text-xs px-3 py-1.5 h-auto">Annuler</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400 hover:text-accent-500 hover:border-accent-300 hover:bg-accent-50/40 transition-all cursor-pointer"
            >
              <FolderPlus size={20} />
              <span className="text-xs font-medium">Nouveau projet</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectSwitcher;
