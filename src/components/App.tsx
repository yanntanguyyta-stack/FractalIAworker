import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { INITIAL_MARKDOWN } from '../mockData';
import Sidebar from './Sidebar';
import EditorPane from './EditorPane';
import ChatPane from './ChatPane';
import SettingsModal from './SettingsModal';
import NewDocumentWizard from './NewDocumentWizard';
import OnboardingWizard from './OnboardingWizard';
import { Download, Upload, RefreshCw, Settings, FilePlus, GripVertical, Share2, FileText, FileCode, ChevronDown, Printer, HelpCircle } from 'lucide-react';
import { buildHtmlDocument, decodeMarkdownFromShare, encodeMarkdownForShare, importFileToMarkdown } from '../utils/documentConversion';

const ONBOARDING_COMPLETED_KEY = 'fractalia_onboarding_completed';

interface AppProps {
  className?: string;
}

const App: React.FC<AppProps> = ({ className = '' }) => {
  const { loadMarkdown, tree, saveToMarkdown, aiConfig } = useStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDocWizardOpen, setNewDocWizardOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    return !localStorage.getItem(ONBOARDING_COMPLETED_KEY);
  });

  const handleCloseOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  }, []);
  
  // État pour les largeurs des panneaux (en pourcentage)
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [editorWidth, setEditorWidth] = useState(45);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'sidebar' | 'editor' | null>(null);

  // Charger les données mock ou partagées au premier rendu
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const payload = hash.replace('#share=', '');
        const markdown = decodeMarkdownFromShare(payload);
        loadMarkdown(markdown);
        return;
      } catch (error) {
        console.error('Erreur lors du décodage du lien partagé:', error);
      }
    }
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

  useEffect(() => {
    if (!showExportMenu) return;
    const closeMenu = () => setShowExportMenu(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [showExportMenu]);

  const getExportTitle = () => tree[0]?.heading?.trim() || 'document-irlm';

  const triggerDownload = (content: string, filename: string, type: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportMarkdown = () => {
    const markdown = saveToMarkdown();
    triggerDownload(markdown, `${getExportTitle()}.md`, 'text/markdown');
  };

  const handleExportHtml = () => {
    const markdown = saveToMarkdown();
    const html = buildHtmlDocument(markdown, getExportTitle());
    triggerDownload(html, `${getExportTitle()}.html`, 'text/html');
  };

  const handleExportDocx = () => {
    const markdown = saveToMarkdown();
    const html = buildHtmlDocument(markdown, getExportTitle());
    triggerDownload(
      html,
      `${getExportTitle()}.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  };

  const handleExportPdf = () => {
    const markdown = saveToMarkdown();
    const html = buildHtmlDocument(markdown, getExportTitle());
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Impossible d’ouvrir la fenêtre d’impression. Vérifiez votre bloqueur de pop-up.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleShareLink = async () => {
    const markdown = saveToMarkdown();
    const payload = encodeMarkdownForShare(markdown);
    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${payload}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: getExportTitle(),
          text: 'Partage du document IRLM',
          url: shareUrl,
        });
        return;
      } catch (error) {
        console.warn('Partage annulé ou indisponible:', error);
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    alert('Lien de partage copié dans le presse-papiers.');
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const markdown = await importFileToMarkdown(file);
      loadMarkdown(markdown);
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      const message = error instanceof Error ? error.message : 'Impossible d’importer ce fichier.';
      alert(`Erreur d’import : ${message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleUploadMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImportFile(file);
    }
    if (e.target.value) {
      e.target.value = '';
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Êtes-vous sûr? Cette action rechargera les données par défaut.')) {
      loadMarkdown(INITIAL_MARKDOWN);
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    dragCounter.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    dragCounter.current = 0;
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleImportFile(file);
    }
  };

  return (
    <div
      className={`w-full h-screen bg-slate-100 flex flex-col relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🧠 IRLM Node Interface</h1>
            <p className="text-slate-200 text-sm">
              Local-First Markdown Collaboration avec IA Persona
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setNewDocWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-xl font-medium transition-colors shadow-sm"
              title="Créer un nouveau document avec l'IA"
            >
              <FilePlus size={18} />
              Nouveau
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white/90 text-slate-900 hover:bg-white rounded-xl font-medium transition-colors shadow-sm"
              title="Importer un fichier (Markdown, PDF, DOCX)"
            >
              <Upload size={18} />
              Importer
            </button>

            <div className="relative">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setShowExportMenu((current) => !current);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/90 text-slate-900 hover:bg-white rounded-xl font-medium transition-colors shadow-sm"
                title="Exporter ou partager"
              >
                <Download size={18} />
                Exporter
                <ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      handleExportMarkdown();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100"
                  >
                    <FileText size={16} className="text-indigo-600" />
                    Export Markdown
                  </button>
                  <button
                    onClick={() => {
                      handleExportHtml();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100"
                  >
                    <FileCode size={16} className="text-blue-600" />
                    Export HTML
                  </button>
                  <button
                    onClick={() => {
                      handleExportDocx();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100"
                  >
                    <FileText size={16} className="text-green-600" />
                    Export DOCX
                  </button>
                  <button
                    onClick={() => {
                      handleExportPdf();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100"
                  >
                    <Printer size={16} className="text-rose-600" />
                    Export PDF
                  </button>
                  <button
                    onClick={() => {
                      handleShareLink();
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100 border-t border-slate-200"
                  >
                    <Share2 size={16} className="text-purple-600" />
                    Partager le lien
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-medium transition-colors shadow-sm"
              title="Réinitialiser aux données par défaut"
            >
              <RefreshCw size={18} />
              Réinitialiser
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm ${
                aiConfig.apiKey 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-orange-500 hover:bg-orange-600 animate-pulse'
              }`}
              title="Configuration IA"
            >
              <Settings size={18} />
              {aiConfig.apiKey ? 'IA Configurée' : 'Configurer IA'}
            </button>

            <button
              onClick={() => setOnboardingOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors shadow-sm"
              title="Aide et tutoriel"
            >
              <HelpCircle size={18} />
              Aide
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
        accept=".md,.markdown,.txt,.pdf,.docx"
        onChange={handleUploadMarkdown}
        className="hidden"
      />

      {(isDragActive || isImporting) && (
        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-30 pointer-events-none">
          <div className="bg-white rounded-xl px-6 py-4 text-center shadow-xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-800">
              {isImporting ? 'Import en cours...' : 'Déposez votre fichier pour l’importer'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Markdown, PDF, DOCX et TXT acceptés</p>
          </div>
        </div>
      )}

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

      {/* Onboarding pour les nouveaux utilisateurs */}
      <OnboardingWizard 
        isOpen={onboardingOpen} 
        onClose={handleCloseOnboarding}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
};

export default App;
