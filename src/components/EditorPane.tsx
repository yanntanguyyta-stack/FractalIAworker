import React, { useEffect, useRef, useState } from 'react';
import { useStore, DOCUMENT_ROOT_ID } from '../store';
import { NodeData } from '../types';
import MarkdownPreview from './MarkdownPreview';
import mermaid from 'mermaid';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Table,
  Code,
  GitBranch,
  Quote,
  Link,
  Image,
  Heading1,
  Eye,
  Edit3,
  Copy,
  Check,
  ChevronRight,
  RefreshCw,
  FileText,
} from 'lucide-react';

// Initialiser Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

interface EditorPaneProps {
  className?: string;
}

type ViewMode = 'edit' | 'preview' | 'split';

const EditorPane: React.FC<EditorPaneProps> = ({ className = '' }) => {
  const { 
    getActiveNode, 
    updateNodeContent, 
    getNodePath, 
    selectNode, 
    activeNodeId, 
    assessmentConfig, 
    updateNodeAssessment, 
    recalculateAllInheritedScores,
    getNodeFullContent,
    isDocumentRootSelected,
    tree,
    addChild
  } = useStore();
  const activeNode = getActiveNode();
  const isDocRoot = isDocumentRootSelected();
  const nodePath = activeNodeId && activeNodeId !== DOCUMENT_ROOT_ID ? getNodePath(activeNodeId) : [];
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [copied, setCopied] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const prevNodeIdRef = useRef<string | null>(null);

  // Animation lors du changement de nœud
  useEffect(() => {
    if (activeNodeId && prevNodeIdRef.current !== activeNodeId) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 250);
      prevNodeIdRef.current = activeNodeId;
      return () => clearTimeout(timer);
    }
  }, [activeNodeId]);

  // Render Mermaid diagrams
  useEffect(() => {
    if (viewMode !== 'edit') {
      const container = previewRef.current;
      if (container) {
        const mermaidDivs = container.querySelectorAll('.mermaid');
        mermaidDivs.forEach(async (div, index) => {
          const code = div.textContent || '';
          try {
            const { svg } = await mermaid.render(`mermaid-${activeNodeId}-${index}`, code);
            div.innerHTML = svg;
          } catch (e) {
            div.innerHTML = `<pre class="text-red-500 text-sm">Erreur Mermaid: ${e}</pre>`;
          }
        });
      }
    }
  }, [viewMode, activeNodeId, activeNode?.content]);

  // Contenu complet (avec enfants)
  const fullContent = getNodeFullContent(activeNodeId);
  // Le contenu prévisualisé est toujours le contenu complet du sous-arbre (nœud + enfants)
  const previewContent = fullContent;
  
  // Si ni H0 ni nœud actif, afficher un message
  if (!isDocRoot && !activeNode) {
    return (
      <div
        className={`bg-gray-50 border-r border-gray-200 flex items-center justify-center ${className}`}
      >
        <div className="text-center">
          <p className="text-gray-500">Sélectionnez un nœud pour l'éditer</p>
        </div>
      </div>
    );
  }

  // Données pour l'évaluation (uniquement si un nœud spécifique est sélectionné)
  const evaluation = activeNode?.meta?.evaluation;
  const completenessScore = evaluation?.completenessScore ?? 0;
  const questionScore = evaluation?.questionScore ?? 0;
  const inheritedCompleteness = evaluation?.inheritedCompletenessScore;
  const inheritedQuestion = evaluation?.inheritedQuestionScore;
  const hasChildren = activeNode ? activeNode.children.length > 0 : tree.length > 0;

  const handleScoreChange = (key: 'completenessScore' | 'questionScore') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (activeNode) {
        updateNodeAssessment(activeNode.id, { [key]: Number(event.target.value) });
      }
    };

  // Insérer du texte à la position du curseur (uniquement si un nœud est sélectionné)
  const insertText = (before: string, after: string = '', placeholder: string = '') => {
    if (!activeNode) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = activeNode.content.substring(start, end) || placeholder;
    const newContent =
      activeNode.content.substring(0, start) +
      before +
      selectedText +
      after +
      activeNode.content.substring(end);

    updateNodeContent(activeNode.id, newContent);

    // Repositionner le curseur
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  // Calculer les niveaux disponibles pour les sous-titres
  const currentLevel = activeNode?.headingDepth || 1;
  const canCreateChild = currentLevel < 6;

  const toolbarButtons = [
    { icon: <Bold size={16} />, label: 'Gras', action: () => insertText('**', '**', 'texte gras') },
    { icon: <Italic size={16} />, label: 'Italique', action: () => insertText('*', '*', 'texte italique') },
    { icon: <Code size={16} />, label: 'Code inline', action: () => insertText('`', '`', 'code') },
    { divider: true },
    { 
      icon: <Heading1 size={16} />, 
      label: `Créer nœud enfant H${currentLevel + 1}`, 
      action: () => {
        if (!activeNode) return;
        const childLevel = activeNode.headingDepth + 1;
        if (childLevel > 6) {
          alert(`Impossible de créer un nœud H${childLevel} (maximum H6)`);
          return;
        }
        const title = prompt(`Créer un nouveau nœud enfant H${childLevel} :`);
        if (title && title.trim()) {
          addChild(activeNode.id, title.trim());
        }
      },
      disabled: !canCreateChild
    },
    { divider: true },
    { icon: <List size={16} />, label: 'Liste', action: () => insertText('\n- ', '\n', 'élément') },
    { icon: <ListOrdered size={16} />, label: 'Liste numérotée', action: () => insertText('\n1. ', '\n', 'élément') },
    { icon: <Quote size={16} />, label: 'Citation', action: () => insertText('\n> ', '\n', 'citation') },
    { divider: true },
    { icon: <Link size={16} />, label: 'Lien', action: () => insertText('[', '](url)', 'texte du lien') },
    { icon: <Image size={16} />, label: 'Image', action: () => insertText('![', '](url)', 'alt text') },
    { divider: true },
    {
      icon: <Table size={16} />,
      label: 'Tableau',
      action: () =>
        insertText(
          '\n| Colonne 1 | Colonne 2 | Colonne 3 |\n|-----------|-----------|----------|\n| Cellule 1 | Cellule 2 | Cellule 3 |\n| Cellule 4 | Cellule 5 | Cellule 6 |\n',
          '',
          ''
        ),
    },
    {
      icon: <GitBranch size={16} />,
      label: 'Diagramme Mermaid',
      action: () =>
        insertText(
          '\n```mermaid\ngraph TD\n    A[Début] --> B{Décision}\n    B -->|Oui| C[Action 1]\n    B -->|Non| D[Action 2]\n    C --> E[Fin]\n    D --> E\n```\n',
          '',
          ''
        ),
    },
  ];

  const handleCopy = () => {
    // Copier le contenu complet (nœud + enfants) ou juste le contenu du nœud actif
    const contentToCopy = isDocRoot ? fullContent : (activeNode?.content || fullContent);
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col h-full ${className} ${isTransitioning ? 'node-transition' : ''}`}>
      {/* Breadcrumb */}
      {!isDocRoot && nodePath.length > 0 && (
        <div className="border-b border-white/40 px-3 py-1.5 flex items-center gap-0.5 text-[11px] overflow-x-auto flex-shrink-0">
          <button
            onClick={() => selectNode(DOCUMENT_ROOT_ID)}
            className="px-2 py-1 rounded-md hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5"
            title="Document complet"
          >
            <FileText size={11} className="text-slate-400 flex-shrink-0" />
            <span>Document</span>
          </button>
          {nodePath.map((node, index) => (
            <React.Fragment key={node.id}>
              <ChevronRight size={10} className="text-slate-300 flex-shrink-0" />
              <button
                onClick={() => selectNode(node.id)}
                className={`px-2 py-1 rounded-md transition-colors truncate max-w-[140px] ${
                  index === nodePath.length - 1
                    ? 'bg-accent-100/80 text-accent-700 font-semibold'
                    : 'hover:bg-white/60 text-slate-500 hover:text-slate-700'
                }`}
                title={node.heading}
              >
                {node.heading}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Header avec métadonnées */}
      <div className="border-b border-white/40 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="text-xl font-bold text-slate-900 truncate flex-1 tracking-tight">
            {isDocRoot ? (
              <span className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg accent-gradient flex items-center justify-center shadow-glow-accent">
                  <FileText size={14} className="text-white" />
                </span>
                Document complet
              </span>
            ) : (
              activeNode?.heading || 'Sans titre'
            )}
          </h3>
          <button
            onClick={handleCopy}
            className="icon-btn tooltip-wrapper"
            data-tooltip="Copier le contenu"
            title="Copier le contenu"
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {isDocRoot ? (
            <span className="chip-accent">
              H0 · {tree.length} racine{tree.length > 1 ? 's' : ''}
            </span>
          ) : activeNode && (
            <>
              <span className="chip-accent">
                H{activeNode.headingDepth} · {activeNode.meta.type}
              </span>
              {activeNode.meta.agentConfig?.role && (
                <span className="chip bg-fuchsia-100 text-fuchsia-700">
                  ✦ {activeNode.meta.agentConfig.role}
                </span>
              )}
              {activeNode.meta.contextConfig?.isGlobal && (
                <span className="chip bg-emerald-100 text-emerald-700">
                  ● Global
                </span>
              )}
              {activeNode.children.length > 0 && (
                <span className="chip-neutral">
                  {activeNode.children.length} enfant{activeNode.children.length > 1 ? 's' : ''}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Évaluation */}
      {assessmentConfig.enabled && activeNode && (
        <div className="border-b border-white/40 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Évaluation de complétude</span>
            <button
              onClick={() => recalculateAllInheritedScores()}
              className="btn-ghost text-xs py-1 px-2"
              title="Recalculer les notes héritées"
            >
              <RefreshCw size={11} />
              Recalculer
            </button>
          </div>
          <div className="text-xs text-slate-500 mb-3 italic">
            {assessmentConfig.question || 'Définissez une question globale dans les paramètres.'}
          </div>

          {hasChildren && activeNode && (inheritedCompleteness !== undefined || inheritedQuestion !== undefined) && (
            <div className="mb-3 p-3 accent-gradient-soft rounded-xl border border-accent-200/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-accent-600 mb-2">
                Notes héritées · moyenne {activeNode.children.length} enfant{activeNode.children.length > 1 ? 's' : ''}
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Complétude</span>
                  <span className="font-bold text-accent-700 tabular-nums">{inheritedCompleteness?.toFixed(1) ?? '—'}<span className="text-slate-400 font-normal">/10</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Question</span>
                  <span className="font-bold text-accent-700 tabular-nums">{inheritedQuestion?.toFixed(1) ?? '—'}<span className="text-slate-400 font-normal">/10</span></span>
                </div>
              </div>
            </div>
          )}

          {hasChildren && activeNode && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Notes propres</div>
          )}
          <div className="space-y-2.5">
            {[
              { label: 'Complétude du nœud', key: 'completenessScore' as const, value: completenessScore },
              { label: 'Score question globale', key: 'questionScore' as const, value: questionScore },
            ].map((row) => (
              <div key={row.key} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-40 flex-shrink-0">{row.label}</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={row.value}
                  onChange={handleScoreChange(row.key)}
                  className="flex-1 accent-accent-500"
                />
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={row.value}
                  onChange={handleScoreChange(row.key)}
                  className="input-sm w-14 text-center tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="border-b border-white/40 px-2 py-1.5 flex items-center gap-0.5 flex-wrap flex-shrink-0">
        {activeNode && toolbarButtons.map((btn, idx) =>
          btn.divider ? (
            <div key={idx} className="w-px h-5 bg-slate-200 mx-1" />
          ) : (
            <button
              key={idx}
              onClick={btn.action}
              className="toolbar-btn tooltip-wrapper"
              data-tooltip={btn.label}
              disabled={btn.disabled}
            >
              {btn.icon}
            </button>
          )
        )}

        {isDocRoot && (
          <span className="text-xs text-slate-500 italic px-2">
            Sélectionnez un nœud pour éditer son contenu
          </span>
        )}

        <div className="flex-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-white/50 border border-white/60 rounded-xl p-0.5 shadow-soft">
          {!isDocRoot && (
            <>
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ease-spring ${
                  viewMode === 'edit' ? 'bg-white shadow-soft text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={12} />
                Markdown
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ease-spring ${
                  viewMode === 'split' ? 'bg-white shadow-soft text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Split
              </button>
            </>
          )}
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ease-spring ${
              viewMode === 'preview' ? 'bg-white shadow-soft text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye size={12} />
            Formaté
          </button>
        </div>
      </div>

      {/* Éditeur de contenu */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Editor textarea - uniquement si nœud spécifique sélectionné en mode edit */}
        {!isDocRoot && viewMode === 'edit' && activeNode && (
          <div className="w-full flex flex-col overflow-hidden">
            <textarea
              ref={textareaRef}
              value={activeNode.content}
              onChange={(e) => updateNodeContent(activeNode.id, e.target.value)}
              placeholder="Entrez le contenu du nœud..."
              className="w-full p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto flex-1 min-h-0 bg-transparent text-slate-800 placeholder:text-slate-400"
            />
            {/* Contenu des nœuds enfants — lecture seule */}
            {activeNode.children.length > 0 && (
              <div className="flex-1 min-h-0 border-t border-white/40 overflow-y-auto p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent-500 mb-3 flex items-center gap-1.5">
                  <ChevronRight size={11} /> Sections enfants
                </p>
                <MarkdownPreview
                  className="prose-sm text-slate-600"
                  content={activeNode.children
                    .map((child: NodeData) => getNodeFullContent(child.id))
                    .join('\n\n')}
                />
              </div>
            )}
          </div>
        )}

        {/* Split mode */}
        {!isDocRoot && viewMode === 'split' && activeNode && (
          <>
            <div className="w-1/2 border-r border-white/40 flex flex-col overflow-hidden">
              <textarea
                ref={textareaRef}
                value={activeNode.content}
                onChange={(e) => updateNodeContent(activeNode.id, e.target.value)}
                placeholder="Entrez le contenu du nœud..."
                className="w-full h-full p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto bg-transparent text-slate-800"
              />
            </div>
            <div ref={previewRef} className="w-1/2 overflow-y-auto p-4">
              <MarkdownPreview className="prose-sm" content={previewContent} />
            </div>
          </>
        )}

        {/* Mode Formatté */}
        {viewMode === 'preview' && (
          <div ref={previewRef} className="w-full overflow-y-auto p-6">
            <MarkdownPreview className="prose-sm" content={previewContent} />
          </div>
        )}

        {/* H0 en mode edit ou split */}
        {isDocRoot && (viewMode === 'edit' || viewMode === 'split') && (
          <div ref={previewRef} className="w-full overflow-y-auto p-6">
            <MarkdownPreview className="prose-sm" content={previewContent} />
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="flex-shrink-0 border-t border-white/40 px-4 py-2 text-[11px] text-slate-500 flex justify-between font-medium tabular-nums">
        <span>{previewContent.length.toLocaleString()} caractères</span>
        <span>{previewContent.split(/\s+/).filter((w: string) => w).length.toLocaleString()} mots</span>
        <span>{isDocRoot ? `${tree.length} racine${tree.length > 1 ? 's' : ''}` : `${activeNode?.children.length || 0} enfant${(activeNode?.children.length || 0) > 1 ? 's' : ''}`}</span>
      </div>
    </div>
  );
};

export default EditorPane;
