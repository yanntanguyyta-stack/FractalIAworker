import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { treeToMarkdown } from '../markdownEngine';
import { INITIAL_MARKDOWN } from '../mockData';
import Sidebar from './Sidebar';
import EditorPane from './EditorPane';
import ChatPane from './ChatPane';
import SettingsModal from './SettingsModal';
import NewDocumentWizard from './NewDocumentWizard';
import { Download, Upload, RefreshCw, Settings, FilePlus, GripVertical } from 'lucide-react';

interface AppProps {
  className?: string;
}

const App: React.FC<AppProps> = ({ className = '' }) => {
  const { loadMarkdown, tree, saveToMarkdown, aiConfig } = useStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDocWizardOpen, setNewDocWizardOpen] = useState(false);
  
  // État pour les largeurs des panneaux (en pourcentage)
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [editorWidth, setEditorWidth] = useState(45);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'sidebar' | 'editor' | null>(null);

  // Charger les données mock au premier rendu
  useEffect(() => {
    loadMarkdown(INITIAL_MARKDOWN);
  }, []);

  // Gestionnaire de redimensionnement
  const handleMouseDown = useCallback((separator: 'sidebar' | 'editor') => {
    isDragging.current = separator;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;
    const percentage = (mouseX / containerWidth) * 100;

    if (isDragging.current === 'sidebar') {
      // Limiter entre 10% et 40%
      const newWidth = Math.max(10, Math.min(40, percentage));
      setSidebarWidth(newWidth);
    } else if (isDragging.current === 'editor') {
      // La position du séparateur éditeur = sidebarWidth + editorWidth
      const newEditorWidth = Math.max(20, Math.min(60, percentage - sidebarWidth));
      setEditorWidth(newEditorWidth);
    }
  }, [sidebarWidth]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleDownloadMarkdown = () => {
    const markdown = saveToMarkdown();
    const element = document.createElement('a');
    const file = new Blob([markdown], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = 'project.md';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleUploadMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        loadMarkdown(text);
      } catch (error) {
        console.error('Erreur lors de la lecture du fichier:', error);
        alert('Erreur: Impossible de lire le fichier.');
      }
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Êtes-vous sûr? Cette action rechargera les données par défaut.')) {
      loadMarkdown(INITIAL_MARKDOWN);
    }
  };

  return (
    <div className={`w-full h-screen bg-gray-50 flex flex-col ${className}`}>
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🧠 IRLM Node Interface</h1>
            <p className="text-blue-100 text-sm">
              Local-First Markdown Collaboration avec IA Persona
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setNewDocWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors"
              title="Créer un nouveau document avec l'IA"
            >
              <FilePlus size={18} />
              Nouveau
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              title="Charger un fichier Markdown"
            >
              <Upload size={18} />
              Charger
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              title="Télécharger le Markdown"
            >
              <Download size={18} />
              Télécharger
            </button>

            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
              title="Réinitialiser aux données par défaut"
            >
              <RefreshCw size={18} />
              Réinitialiser
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                aiConfig.apiKey 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-orange-500 hover:bg-orange-600 animate-pulse'
              }`}
              title="Configuration IA"
            >
              <Settings size={18} />
              {aiConfig.apiKey ? 'IA Configurée' : 'Configurer IA'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout - 3 Colonnes Redimensionnables */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Colonne Gauche - Sidebar (Navigation) */}
        <div 
          className="h-full bg-white overflow-hidden flex flex-col flex-shrink-0"
          style={{ width: `${sidebarWidth}%` }}
        >
          <Sidebar />
        </div>

        {/* Séparateur 1 - Entre Sidebar et Éditeur */}
        <div
          className="w-2 bg-gray-300 hover:bg-blue-500 active:bg-blue-600 cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors group"
          onMouseDown={() => handleMouseDown('sidebar')}
        >
          <GripVertical size={12} className="text-gray-500 group-hover:text-white" />
        </div>

        {/* Colonne Centrale - Éditeur */}
        <div 
          className="h-full bg-white overflow-hidden flex flex-col flex-shrink-0"
          style={{ width: `${editorWidth}%` }}
        >
          <EditorPane />
        </div>

        {/* Séparateur 2 - Entre Éditeur et Chat */}
        <div
          className="w-2 bg-gray-300 hover:bg-blue-500 active:bg-blue-600 cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors group"
          onMouseDown={() => handleMouseDown('editor')}
        >
          <GripVertical size={12} className="text-gray-500 group-hover:text-white" />
        </div>

        {/* Colonne Droite - Chat IA (prend le reste) */}
        <div className="h-full bg-white overflow-hidden flex flex-col flex-1">
          <ChatPane onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </div>

      {/* Input fichier caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleUploadMarkdown}
        className="hidden"
      />

      {/* Footer - Info */}
      <div className="bg-gray-100 border-t border-gray-200 px-6 py-3 text-xs text-gray-600 flex items-center justify-between">
        <span>
          📁 {tree.length} nœuds racine chargés • Version 2.0 • Local-First Architecture
        </span>
        <span>
          💾 Modification automatique • 🤖 Contexte Sandwich IA • 📝 Métadonnées HTML invisibles
        </span>
      </div>

      {/* Modal Configuration IA */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Wizard Nouveau Document */}
      <NewDocumentWizard isOpen={newDocWizardOpen} onClose={() => setNewDocWizardOpen(false)} />
    </div>
  );
};

export default App;
