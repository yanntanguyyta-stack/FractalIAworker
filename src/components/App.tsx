import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { useAuthCompat } from '../useAuthCompat';
import { INITIAL_MARKDOWN } from '../mockData';
import Sidebar from './Sidebar';
import EditorPane from './EditorPane';
import ChatPane from './ChatPane';
import SettingsModal from './SettingsModal';
import NewDocumentWizard from './NewDocumentWizard';
import OnboardingWizard from './OnboardingWizard';
import ImportWizard from './ImportWizard';
import AdminDashboard from './AdminDashboard';
import DocumentManager from './DocumentManager';
import { Download, Upload, RefreshCw, Settings, FilePlus, Share2, FileText, FileCode, ChevronDown, Printer, HelpCircle, LogOut, Shield, User, FolderOpen, Menu, X } from 'lucide-react';
import { buildHtmlDocument, buildPrintHtmlDocument, buildWordDocument, decodeMarkdownFromShare, encodeMarkdownForShare, importFileToMarkdown } from '../utils/documentConversion';
import { buildDocxBlob } from '../utils/docxExport';
import {
  loadDocumentIndex,
  loadDocumentTree,
  saveDocumentTree,
  createDocument as createDocEntry,
  setActiveDocument,
  initUserStore,
} from '../documentStore';

const ONBOARDING_COMPLETED_KEY = 'fractalia_onboarding_completed';
const MOBILE_BREAKPOINT = '(max-width: 767px)';

interface AppProps {
  className?: string;
}

const App: React.FC<AppProps> = ({ className = '' }) => {
  const { loadMarkdown, loadTree, tree, saveToMarkdown, aiConfig, setAIConfig, undo, redo, canUndo, canRedo } = useStore();
  const { currentUser, logout, saveApiConfig, updateLastActive } = useAuthCompat();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDocWizardOpen, setNewDocWizardOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const dragCounter = useRef(0);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    return !localStorage.getItem(ONBOARDING_COMPLETED_KEY);
  });
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [docManagerOpen, setDocManagerOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const handleCloseOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  }, []);
  
  // Détection mobile
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BREAKPOINT).matches);
  const [activeMobilePanel, setActiveMobilePanel] = useState<'sidebar' | 'editor' | 'chat'>('editor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // État pour les largeurs des panneaux (en pourcentage)
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [editorWidth, setEditorWidth] = useState(45);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'sidebar' | 'editor' | null>(null);

  // Charger les données au montage (partagées, utilisateur ou mock)
  useEffect(() => {
    let cancelled = false;

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

    async function loadUserDocuments() {
      if (currentUser) {
        if (currentUser.savedApiConfig) {
          setAIConfig({ ...aiConfig, ...currentUser.savedApiConfig });
        }

        await initUserStore(currentUser.id);
        if (cancelled) return;

        const index = loadDocumentIndex(currentUser.id);
        if (index.activeDocId && index.documents.length > 0) {
          const docTree = loadDocumentTree(currentUser.id, index.activeDocId);
          if (docTree) {
            setActiveDocId(index.activeDocId);
            loadTree(docTree);
            return;
          }
        }
      }

      if (cancelled) return;
      loadMarkdown(INITIAL_MARKDOWN);
      if (currentUser) {
        setTimeout(() => {
          if (cancelled) return;
          const currentTree = useStore.getState().tree;
          const docId = createDocEntry(currentUser.id, 'Bienvenue - Démo', currentTree);
          setActiveDocId(docId);
        }, 100);
      }
    }

    loadUserDocuments();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Sauvegarde automatique des documents par utilisateur
  useEffect(() => {
    if (currentUser && tree.length > 0 && activeDocId) {
      saveDocumentTree(currentUser.id, activeDocId, tree);
    }
  }, [tree, currentUser?.id, activeDocId]);

  // Ouvrir un document existant par ID
  const handleOpenDocument = useCallback((docId: string) => {
    if (!currentUser) return;
    const docTree = loadDocumentTree(currentUser.id, docId);
    if (docTree) {
      setActiveDocId(docId);
      setActiveDocument(currentUser.id, docId);
      loadTree(docTree);
    }
  }, [currentUser, loadTree]);

  // Callback après création d'un document via le wizard
  const handleDocumentCreated = useCallback((title: string) => {
    if (!currentUser) return;
    // Le wizard a déjà appelé loadMarkdown, tree est à jour après le prochain render
    // On crée l'entrée dans l'index après un tick pour avoir le tree mis à jour
    setTimeout(() => {
      const currentTree = useStore.getState().tree;
      const docId = createDocEntry(currentUser.id, title, currentTree);
      setActiveDocId(docId);
    }, 600); // après la fermeture du wizard (500ms timeout dans wizard)
  }, [currentUser]);

  // Mise à jour de l'activité utilisateur
  useEffect(() => {
    if (!currentUser) return;
    updateLastActive();
    const interval = setInterval(updateLastActive, 5 * 60 * 1000); // toutes les 5 min
    return () => clearInterval(interval);
  }, [currentUser?.id]);

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

  // Raccourcis clavier Ctrl+Z (Undo) et Ctrl+Y/Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un champ de saisie
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Ctrl+Z ou Cmd+Z pour Undo
        if (!isInputField && canUndo()) {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        // Ctrl+Y ou Ctrl+Shift+Z ou Cmd+Shift+Z pour Redo
        if (!isInputField && canRedo()) {
          e.preventDefault();
          redo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    if (!showExportMenu) return;
    const closeMenu = () => setShowExportMenu(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [showExportMenu]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const getExportTitle = () => tree[0]?.heading?.trim() || 'document-node-ia';

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
    const html = buildWordDocument(markdown, getExportTitle());
    triggerDownload(
      html,
      `${getExportTitle()}.doc`,
      'application/msword'
    );
  };

  const handleExportDocxNative = async () => {
    const markdown = saveToMarkdown();
    const blob = await buildDocxBlob(markdown, getExportTitle());
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `${getExportTitle()}.docx`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

    const handleExportPdf = () => {
    const markdown = saveToMarkdown();
    const html = buildPrintHtmlDocument(markdown, getExportTitle());
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez votre bloqueur de pop-up.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleShareLink = async () => {
    const markdown = saveToMarkdown();
    const payload = encodeMarkdownForShare(markdown);
    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${payload}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: getExportTitle(),
          text: 'Partage du document FractalIAworker',
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

  const aiConfigured = !!aiConfig.apiKey;

  return (
    <div
      className={`w-full h-screen flex flex-col relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ===== MOBILE TOP BAR ===== */}
      {isMobile ? (
        <div className="glass-strong flex-shrink-0 sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl accent-gradient flex items-center justify-center shadow-glow-accent">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <div>
                <h1 className="text-base font-bold accent-text-gradient tracking-tight">FractalIAworker</h1>
                <p className="text-slate-500 text-[10px] -mt-0.5">Markdown · IA contextuelle</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="icon-btn"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="px-4 pb-4 pt-1 flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto animate-fade-in-down">
              <button
                onClick={() => { setDocManagerOpen(true); setMobileMenuOpen(false); }}
                className="btn-secondary justify-start"
              >
                <FolderOpen size={16} /> Mes documents
              </button>
              <button
                onClick={() => { setNewDocWizardOpen(true); setMobileMenuOpen(false); }}
                className="btn-primary justify-start"
              >
                <FilePlus size={16} /> Nouveau document
              </button>
              <button
                onClick={() => { setImportWizardOpen(true); setMobileMenuOpen(false); }}
                className="btn-secondary justify-start"
              >
                <Upload size={16} /> Importer un fichier
              </button>
              <div className="divider my-1" />
              <button onClick={() => { handleExportMarkdown(); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <FileText size={16} className="text-accent-600" /> Export Markdown
              </button>
              <button onClick={() => { handleExportHtml(); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <FileCode size={16} className="text-sky-600" /> Export HTML
              </button>
              <button onClick={() => { handleExportDocxNative(); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <FileText size={16} className="text-emerald-600" /> Export Word
              </button>
              <button onClick={() => { handleExportPdf(); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <Printer size={16} className="text-rose-500" /> Export PDF
              </button>
              <button onClick={() => { handleShareLink(); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <Share2 size={16} className="text-fuchsia-500" /> Partager le lien
              </button>
              <div className="divider my-1" />
              <button
                onClick={() => { setSettingsOpen(true); setMobileMenuOpen(false); }}
                className={aiConfigured ? 'btn-secondary justify-start' : 'btn-primary justify-start animate-glow-pulse'}
              >
                <Settings size={16} /> {aiConfigured ? 'IA configurée' : 'Configurer l\'IA'}
              </button>
              <button onClick={() => { setOnboardingOpen(true); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <HelpCircle size={16} /> Aide
              </button>
              <button onClick={() => { handleResetToDefault(); setMobileMenuOpen(false); }} className="btn-ghost justify-start">
                <RefreshCw size={16} /> Réinitialiser
              </button>
              {currentUser && (
                <>
                  <div className="divider my-1" />
                  {currentUser.isAdmin && (
                    <button onClick={() => { setAdminOpen(true); setMobileMenuOpen(false); }} className="btn-secondary justify-start">
                      <Shield size={16} className="text-amber-500" /> Admin
                    </button>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/40 text-sm text-slate-600">
                    <User size={14} /> <span className="truncate">{currentUser.name}</span>
                  </div>
                  <button onClick={logout} className="btn-ghost justify-start">
                    <LogOut size={16} /> Déconnexion
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ===== DESKTOP TOP BAR ===== */
        <header className="glass-strong sticky top-0 z-30 flex-shrink-0">
          <div className="px-5 py-2.5 flex items-center gap-3">
            {/* Brand */}
            <div className="flex items-center gap-2.5 mr-2">
              <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-glow-accent">
                <span className="text-white font-bold text-base tracking-tight">F</span>
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-bold accent-text-gradient tracking-tight">FractalIAworker</h1>
                <p className="text-[10px] text-slate-500 -mt-0.5">Markdown hiérarchique · IA contextuelle</p>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-200/80 mx-1" />

            {/* Primary actions */}
            <button onClick={() => setNewDocWizardOpen(true)} className="btn-primary" title="Créer un nouveau document">
              <FilePlus size={15} /> Nouveau
            </button>
            <button onClick={() => setDocManagerOpen(true)} className="btn-secondary" title="Gérer mes documents">
              <FolderOpen size={15} /> Documents
            </button>
            <button onClick={() => setImportWizardOpen(true)} className="btn-secondary" title="Importer un fichier">
              <Upload size={15} /> Importer
            </button>

            {/* Export menu */}
            <div className="relative">
              <button
                onClick={(event) => { event.stopPropagation(); setShowExportMenu((c) => !c); }}
                className="btn-secondary"
                title="Exporter ou partager"
              >
                <Download size={15} /> Exporter <ChevronDown size={13} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 glass-card p-1 z-40 origin-top-right animate-scale-in">
                  <button onClick={() => { handleExportMarkdown(); setShowExportMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-white/60 text-slate-700 transition-colors">
                    <FileText size={15} className="text-accent-600" /> Markdown
                  </button>
                  <button onClick={() => { handleExportHtml(); setShowExportMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-white/60 text-slate-700 transition-colors">
                    <FileCode size={15} className="text-sky-600" /> HTML
                  </button>
                  <button onClick={() => { handleExportDocx(); setShowExportMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-white/60 text-slate-700 transition-colors">
                    <FileText size={15} className="text-green-600" /> Word (.doc)
                  </button>
                  <button onClick={() => { handleExportDocxNative(); setShowExportMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-white/60 text-slate-700 transition-colors">
                    <FileText size={15} className="text-emerald-600" /> Word (.docx)
                  </button>
                  <button onClick={() => { handleExportPdf(); setShowExportMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-white/60 text-slate-700 transition-colors">
                    <Printer size={15} className="text-rose-500" /> PDF
                  </button>
                  <div className="my-1 mx-2 divider" />
                  <button onClick={() => { handleShareLink(); setShowExportMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-white/60 text-slate-700 transition-colors">
                    <Share2 size={15} className="text-fuchsia-500" /> Partager le lien
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* AI config indicator */}
            <button
              onClick={() => setSettingsOpen(true)}
              className={aiConfigured ? 'btn-secondary' : 'btn-primary animate-glow-pulse'}
              title="Configuration IA"
            >
              <Settings size={15} />
              {aiConfigured ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  IA active
                </span>
              ) : 'Configurer IA'}
            </button>

            {/* Icon-only secondary actions */}
            <button onClick={handleResetToDefault} className="icon-btn tooltip-wrapper" data-tooltip="Réinitialiser" title="Réinitialiser">
              <RefreshCw size={16} />
            </button>
            <button onClick={() => setOnboardingOpen(true)} className="icon-btn tooltip-wrapper" data-tooltip="Aide & tutoriel" title="Aide">
              <HelpCircle size={16} />
            </button>

            {currentUser && (
              <>
                <div className="h-7 w-px bg-slate-200/80 mx-1" />
                {currentUser.isAdmin && (
                  <button onClick={() => setAdminOpen(true)} className="icon-btn tooltip-wrapper text-amber-600 hover:text-amber-700" data-tooltip="Admin dashboard" title="Admin">
                    <Shield size={16} />
                  </button>
                )}
                <div className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-xl bg-white/50 border border-white/60">
                  <div className="w-6 h-6 rounded-full accent-gradient flex items-center justify-center text-white text-[10px] font-bold">
                    {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-medium text-slate-700 max-w-[100px] truncate">{currentUser.name}</span>
                </div>
                <button onClick={logout} className="icon-btn tooltip-wrapper" data-tooltip="Se déconnecter" title="Se déconnecter">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* ===== MOBILE: panneau unique ===== */}
      {isMobile ? (
        <div className="flex-1 overflow-hidden flex flex-col p-2">
          <div className="flex-1 glass-panel rounded-2xl overflow-hidden">
            {activeMobilePanel === 'sidebar' && <Sidebar />}
            {activeMobilePanel === 'editor' && <EditorPane />}
            {activeMobilePanel === 'chat' && (
              <ChatPane onOpenSettings={() => setSettingsOpen(true)} />
            )}
          </div>
        </div>
      ) : (
        /* ===== DESKTOP: 3 Colonnes Redimensionnables ===== */
        <div ref={containerRef} className="flex-1 flex overflow-hidden p-3 gap-1.5">
          {/* Colonne Gauche - Sidebar (Navigation) */}
          <div
            className="h-full glass-panel rounded-2xl overflow-hidden flex flex-col flex-shrink-0"
            style={{ width: `calc(${sidebarWidth}% - 0.375rem)` }}
          >
            <Sidebar />
          </div>

          {/* Séparateur 1 */}
          <div
            className="w-1.5 cursor-col-resize flex-shrink-0 flex items-center justify-center group rounded-full transition-colors hover:bg-accent-200/40"
            onMouseDown={() => handleMouseDown('sidebar')}
          >
            <div className="w-0.5 h-12 rounded-full bg-slate-300/0 group-hover:bg-accent-500/70 transition-colors" />
          </div>

          {/* Colonne Centrale - Éditeur */}
          <div
            className="h-full glass-panel rounded-2xl overflow-hidden flex flex-col flex-shrink-0"
            style={{ width: `calc(${editorWidth}% - 0.375rem)` }}
          >
            <EditorPane />
          </div>

          {/* Séparateur 2 */}
          <div
            className="w-1.5 cursor-col-resize flex-shrink-0 flex items-center justify-center group rounded-full transition-colors hover:bg-accent-200/40"
            onMouseDown={() => handleMouseDown('editor')}
          >
            <div className="w-0.5 h-12 rounded-full bg-slate-300/0 group-hover:bg-accent-500/70 transition-colors" />
          </div>

          {/* Colonne Droite - Chat IA */}
          <div className="h-full glass-panel rounded-2xl overflow-hidden flex flex-col flex-1">
            <ChatPane onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </div>
      )}

      {/* Input fichier caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,.pdf,.docx"
        onChange={handleUploadMarkdown}
        className="hidden"
      />

      {(isDragActive || isImporting) && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-fade-in" style={{ backgroundColor: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card px-8 py-6 text-center animate-scale-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl accent-gradient flex items-center justify-center shadow-glow-accent-lg">
              <Upload size={22} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {isImporting ? 'Import en cours…' : 'Déposez votre fichier ici'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Markdown, PDF, DOCX et TXT acceptés</p>
          </div>
        </div>
      )}

      {/* ===== MOBILE: barre de navigation basse ===== */}
      {isMobile && (
        <div className="flex-shrink-0 p-2 pt-0">
          <div className="glass-strong rounded-2xl flex p-1">
            {[
              { key: 'sidebar' as const, label: 'Structure', icon: <FolderOpen size={16} /> },
              { key: 'editor' as const, label: 'Éditeur', icon: <FileText size={16} /> },
              { key: 'chat' as const, label: 'Chat IA', icon: <span className="text-base leading-none">✦</span> },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setActiveMobilePanel(p.key)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] font-medium rounded-xl transition-all duration-200 ease-spring ${
                  activeMobilePanel === p.key
                    ? 'text-white accent-gradient shadow-glow-accent'
                    : 'text-slate-600 hover:bg-white/40'
                }`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== DESKTOP: Footer ===== */}
      {!isMobile && (
        <div className="flex-shrink-0 px-6 py-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-white/40 bg-white/30 backdrop-blur-md">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            {tree.length} nœud{tree.length > 1 ? 's' : ''} racine · v2.0 · Local-first
          </span>
          <span className="text-slate-400">
            Sauvegarde auto · Contexte sandwich IA · Métadonnées HTML
          </span>
        </div>
      )}

      {/* Modal Configuration IA */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Wizard Nouveau Document */}
      <NewDocumentWizard 
        isOpen={newDocWizardOpen} 
        onClose={() => setNewDocWizardOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onDocumentCreated={handleDocumentCreated}
      />

      {/* Onboarding pour les nouveaux utilisateurs */}
      <OnboardingWizard 
        isOpen={onboardingOpen} 
        onClose={handleCloseOnboarding}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Wizard Import avec analyse de structure */}
      <ImportWizard 
        isOpen={importWizardOpen} 
        onClose={() => setImportWizardOpen(false)}
      />

      {/* Tableau de bord Admin */}
      <AdminDashboard isOpen={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* Gestionnaire de documents */}
      <DocumentManager
        isOpen={docManagerOpen}
        onClose={() => setDocManagerOpen(false)}
        userId={currentUser?.id || ''}
        activeDocId={activeDocId}
        onOpenDocument={handleOpenDocument}
        onNewDocument={() => setNewDocWizardOpen(true)}
      />
    </div>
  );
};

export default App;
