import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
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
  Heading2,
  Eye,
  Edit3,
  Copy,
  Check,
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
  const { getActiveNode, updateNodeContent } = useStore();
  const activeNode = getActiveNode();
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [copied, setCopied] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const prevNodeIdRef = useRef<string | null>(null);

  // Animation lors du changement de nœud
  useEffect(() => {
    if (activeNode && prevNodeIdRef.current !== activeNode.id) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 250);
      prevNodeIdRef.current = activeNode.id;
      return () => clearTimeout(timer);
    }
  }, [activeNode?.id]);

  // Render Mermaid diagrams
  useEffect(() => {
    if (viewMode !== 'edit' && previewRef.current) {
      const mermaidDivs = previewRef.current.querySelectorAll('.mermaid');
      mermaidDivs.forEach(async (div, index) => {
        const code = div.textContent || '';
        try {
          const { svg } = await mermaid.render(`mermaid-${activeNode?.id}-${index}`, code);
          div.innerHTML = svg;
        } catch (e) {
          div.innerHTML = `<pre class="text-red-500 text-sm">Erreur Mermaid: ${e}</pre>`;
        }
      });
    }
  }, [viewMode, activeNode?.content]);

  if (!activeNode) {
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

  // Insérer du texte à la position du curseur
  const insertText = (before: string, after: string = '', placeholder: string = '') => {
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

  const toolbarButtons = [
    { icon: <Bold size={16} />, label: 'Gras', action: () => insertText('**', '**', 'texte gras') },
    { icon: <Italic size={16} />, label: 'Italique', action: () => insertText('*', '*', 'texte italique') },
    { icon: <Code size={16} />, label: 'Code inline', action: () => insertText('`', '`', 'code') },
    { divider: true },
    { icon: <Heading1 size={16} />, label: 'Titre 1', action: () => insertText('\n## ', '\n', 'Titre') },
    { icon: <Heading2 size={16} />, label: 'Titre 2', action: () => insertText('\n### ', '\n', 'Sous-titre') },
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
    navigator.clipboard.writeText(activeNode.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convertir le Markdown en HTML simple pour la preview
  const renderPreview = (content: string) => {
    // Remplacer les blocs Mermaid par des divs spéciaux
    let html = content.replace(/```mermaid\n([\s\S]*?)```/g, '<div class="mermaid">$1</div>');

    // Markdown basique
    html = html
      // Titres
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      // Gras et italique
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code inline
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Listes
      .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Citations
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">$1</blockquote>')
      // Liens
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>')
      // Lignes horizontales
      .replace(/^---$/gm, '<hr class="my-4 border-gray-300" />')
      // Tableaux (simple)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.some(c => c.match(/^[-:]+$/))) {
          return ''; // Skip separator row
        }
        return `<tr>${cells.map(c => `<td class="border border-gray-300 px-3 py-2">${c.trim()}</td>`).join('')}</tr>`;
      })
      // Paragraphes
      .replace(/\n\n/g, '</p><p class="my-2">')
      .replace(/\n/g, '<br />');

    return `<div class="prose max-w-none"><p class="my-2">${html}</p></div>`;
  };

  return (
    <div className={`bg-white border-r border-gray-200 flex flex-col h-full ${className} ${isTransitioning ? 'node-transition' : ''}`}>
      {/* Header avec métadonnées */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 truncate flex-1">
            {activeNode.heading}
          </h3>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
            title="Copier le contenu"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-600" />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {activeNode.meta.type}
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
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 px-2 py-1.5 flex items-center gap-0.5 flex-wrap flex-shrink-0">
        {toolbarButtons.map((btn, idx) =>
          btn.divider ? (
            <div key={idx} className="w-px h-6 bg-gray-300 mx-1.5" />
          ) : (
            <button
              key={idx}
              onClick={btn.action}
              className="toolbar-btn tooltip-wrapper"
              data-tooltip={btn.label}
            >
              {btn.icon}
            </button>
          )
        )}

        <div className="flex-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'edit' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit3 size={14} />
            Éditer
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'split' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'preview' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye size={14} />
            Aperçu
          </button>
        </div>
      </div>

      {/* Éditeur de contenu */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'w-full'} flex flex-col overflow-hidden`}>
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
              className="w-full h-full p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto"
            />
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            ref={previewRef}
            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto p-4 bg-white`}
          >
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(activeNode.content) }}
            />
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600 flex justify-between">
        <span>📝 {activeNode.content.length} caractères</span>
        <span>📖 {activeNode.content.split(/\s+/).filter((w: string) => w).length} mots</span>
        <span>📁 {activeNode.children.length} enfants</span>
      </div>
    </div>
  );
};

export default EditorPane;
