import React, { useEffect, useRef, useState } from 'react';
import { useStore, DOCUMENT_ROOT_ID } from '../store';
import { NodeData } from '../types';
import { renderPreview } from '../utils/markdownPreview';
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
    <div className={`bg-white border-r border-gray-200 flex flex-col h-full ${className} ${isTransitioning ? 'node-transition' : ''}`}>
      {/* Breadcrumb - Fil d'Ariane */}
      {/* Breadcrumb - uniquement si nœud spécifique sélectionné */}
      {!isDocRoot && nodePath.length > 0 && (
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 flex items-center gap-1 text-xs overflow-x-auto flex-shrink-0">
          <button
            onClick={() => selectNode(DOCUMENT_ROOT_ID)}
            className="hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
            title="Document complet"
          >
            <FileText size={12} className="text-gray-400 flex-shrink-0" />
            <span>Document</span>
          </button>
          {nodePath.map((node, index) => (
            <React.Fragment key={node.id}>
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
              <button
                onClick={() => selectNode(node.id)}
                className={`px-1.5 py-0.5 rounded transition-colors truncate max-w-[120px] ${
                  index === nodePath.length - 1 
                    ? 'bg-blue-100 text-blue-700 font-medium' 
                    : 'hover:bg-gray-200 text-gray-600'
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
      <div className="border-b border-gray-200 bg-gradient-to-r from-slate-50 via-indigo-50 to-purple-50 p-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 truncate flex-1">
            {isDocRoot ? (
              <span className="flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                Document complet
              </span>
            ) : (
              activeNode?.heading || 'Sans titre'
            )}
          </h3>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
            title="Copier le contenu"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-600" />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
          {isDocRoot ? (
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
              H0 • Document racine • {tree.length} nœud(s) racine(s)
            </span>
          ) : activeNode && (
            <>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                H{activeNode.headingDepth} • {activeNode.meta.type}
              </span>
              {activeNode.meta.agentConfig?.role && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  🤖 {activeNode.meta.agentConfig.role}
                </span>
              )}
              {activeNode.meta.contextConfig?.isGlobal && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  ✓ Global
                </span>
              )}
              {activeNode.children.length > 0 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                  📁 {activeNode.children.length} enfant(s)
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Évaluation - uniquement si nœud spécifique */}
      {assessmentConfig.enabled && activeNode && (
        <div className="border-b border-gray-200 bg-white/80 backdrop-blur p-3 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">Évaluation de complétude</span>
            <button
              onClick={() => recalculateAllInheritedScores()}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded transition-colors"
              title="Recalculer les notes héritées"
            >
              <RefreshCw size={12} />
              <span>Recalculer</span>
            </button>
          </div>
          <div className="text-xs text-gray-500 mb-3">
            Question personnalisée : {assessmentConfig.question || 'Définissez une question globale dans les paramètres.'}
          </div>
          
          {/* Notes héritées des enfants */}
          {hasChildren && activeNode && (inheritedCompleteness !== undefined || inheritedQuestion !== undefined) && (
            <div className="mb-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-2">📊 Notes héritées (moyenne des {activeNode.children.length} enfants)</div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600">Complétude:</span>
                  <span className="font-bold text-blue-800">{inheritedCompleteness?.toFixed(1) ?? '-'}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600">Question:</span>
                  <span className="font-bold text-blue-800">{inheritedQuestion?.toFixed(1) ?? '-'}/10</span>
                </div>
              </div>
            </div>
          )}
          
          {hasChildren && activeNode && (
            <div className="text-xs font-semibold text-gray-600 mb-1">📝 Notes propres (ce nœud)</div>
          )}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-40">Complétude du nœud</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={completenessScore}
                onChange={handleScoreChange('completenessScore')}
                className="flex-1 accent-indigo-500"
              />
              <input
                type="number"
                min={0}
                max={10}
                value={completenessScore}
                onChange={handleScoreChange('completenessScore')}
                className="w-14 px-2 py-1 text-xs border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-40">Score question globale</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={questionScore}
                onChange={handleScoreChange('questionScore')}
                className="flex-1 accent-indigo-500"
              />
              <input
                type="number"
                min={0}
                max={10}
                value={questionScore}
                onChange={handleScoreChange('questionScore')}
                className="w-14 px-2 py-1 text-xs border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 px-2 py-1.5 flex items-center gap-0.5 flex-wrap flex-shrink-0">
        {activeNode && toolbarButtons.map((btn, idx) =>
          btn.divider ? (
            <div key={idx} className="w-px h-6 bg-gray-300 mx-1.5" />
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
          <span className="text-xs text-gray-500 italic px-2">
            Document complet — sélectionnez un nœud pour éditer son contenu
          </span>
        )}

        <div className="flex-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-200 rounded-lg p-0.5">
          {!isDocRoot && (
            <>
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'edit' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Edit3 size={14} />
                Markdown
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'split' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Split
              </button>
            </>
          )}
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'preview' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye size={14} />
            Formatté
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
              placeholder="Entrez le contenu du nœud...

Utilisez la barre d'outils pour formater votre texte :
- **Gras** avec **texte**
- *Italique* avec *texte*
- `Code` avec `code`
- Tableaux et diagrammes Mermaid disponibles !"
              className="w-full p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto flex-1 min-h-0"
            />
            {/* Contenu des nœuds enfants — lecture seule */}
            {activeNode.children.length > 0 && (
              <div className="flex-1 min-h-0 border-t-2 border-dashed border-indigo-200 overflow-y-auto p-4 bg-gray-50">
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-3">
                  ↳ Sections enfants
                </p>
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: renderPreview(
                    activeNode.children.map((child: NodeData) => getNodeFullContent(child.id)).join('\n\n')
                  ) }}
                />
              </div>
            )}
          </div>
        )}

        {/* Split mode: textarea (nœud actif) + preview (sous-arbre complet) */}
        {!isDocRoot && viewMode === 'split' && activeNode && (
          <>
            <div className="w-1/2 border-r border-gray-200 flex flex-col overflow-hidden">
              <textarea
                ref={textareaRef}
                value={activeNode.content}
                onChange={(e) => updateNodeContent(activeNode.id, e.target.value)}
                placeholder="Entrez le contenu du nœud..."
                className="w-full h-full p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto"
              />
            </div>
            <div
              ref={previewRef}
              className="w-1/2 overflow-y-auto p-4 bg-white"
            >
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderPreview(previewContent) }}
              />
            </div>
          </>
        )}

        {/* Mode Formatté : contenu complet du sous-arbre (nœud + enfants) en lecture seule */}
        {viewMode === 'preview' && (
          <div
            ref={previewRef}
            className="w-full overflow-y-auto p-4 bg-white"
          >
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(previewContent) }}
            />
          </div>
        )}

        {/* H0 en mode edit ou split : afficher le document complet en lecture seule */}
        {isDocRoot && (viewMode === 'edit' || viewMode === 'split') && (
          <div
            ref={previewRef}
            className="w-full overflow-y-auto p-4 bg-white"
          >
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(previewContent) }}
            />
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600 flex justify-between">
        <span>📝 {previewContent.length} caractères</span>
        <span>📖 {previewContent.split(/\s+/).filter((w: string) => w).length} mots</span>
        <span>📁 {isDocRoot ? tree.length + ' racine(s)' : (activeNode?.children.length || 0) + ' enfants'}</span>
      </div>
    </div>
  );
};

export default EditorPane;
