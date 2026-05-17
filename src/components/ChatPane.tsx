import React from 'react';
import { Send, Copy, Check, Settings, MessageSquare, FileText, Zap, ChevronDown, Plus, ChevronRight } from 'lucide-react';
import { useStore, ChatMode, DOCUMENT_ROOT_ID } from '../store';
import { buildContextSandwich, buildSystemPrompt, buildUserMessage, callAIAPI, parseAIResponse, ParsedAIResponse, SubsectionProposal } from '../aiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parsed?: ParsedAIResponse; // Réponse parsée pour les messages assistant
}

interface ChatPaneProps {
  className?: string;
  onOpenSettings?: () => void;
}

// Templates de prompts rapides - organisés par catégorie
const promptTemplates = [
  // Structuration
  { icon: '🏗️', label: 'Propose des sous-sections', prompt: 'Analyse ce nœud et propose une décomposition en sous-sections logiques. Liste les sous-thèmes avec des titres Markdown du niveau approprié.', category: 'structuration' },
  { icon: '📋', label: 'Décompose en tâches', prompt: 'Décompose ce sujet en tâches ou étapes distinctes. Propose une liste de sous-nœuds avec leur objectif.', category: 'structuration' },
  { icon: '🎯', label: 'Identifie les axes', prompt: 'Identifie les différents axes ou dimensions de ce sujet qui mériteraient chacun une section dédiée.', category: 'structuration' },
  { icon: '🔀', label: 'Réorganise la structure', prompt: 'Analyse la structure actuelle et propose une meilleure organisation des sous-sections.', category: 'structuration' },
  { icon: '✅', label: 'Évalue la complétude', prompt: 'Évalue si ce nœud et ses enfants couvrent bien le sujet. Quelles sous-sections manquent ?', category: 'structuration' },
  
  // Tableaux
  { icon: '📊', label: 'Tableau récapitulatif', prompt: 'Crée un tableau Markdown récapitulatif basé sur le contenu de cette section.', category: 'tableau' },
  { icon: '📈', label: 'Tableau comparatif', prompt: 'Crée un tableau Markdown comparatif (avantages/inconvénients ou comparaison de solutions).', category: 'tableau' },
  { icon: '📅', label: 'Planning/Timeline', prompt: 'Crée un tableau Markdown avec un planning ou une timeline des étapes.', category: 'tableau' },
  
  // Diagrammes Mermaid
  { icon: '🔀', label: 'Flowchart', prompt: 'Génère un diagramme Mermaid de type flowchart (graph TD) pour visualiser le processus ou les étapes décrites. Utilise des formes appropriées : rectangles pour les actions, losanges pour les décisions, cercles pour début/fin.', category: 'mermaid' },
  { icon: '🔄', label: 'Diagramme séquence', prompt: 'Génère un diagramme Mermaid de type séquence (sequenceDiagram) pour illustrer les interactions entre les acteurs ou systèmes mentionnés.', category: 'mermaid' },
  { icon: '🧠', label: 'Mind Map', prompt: 'Génère un diagramme Mermaid de type mindmap pour organiser les concepts et idées de cette section de façon hiérarchique.', category: 'mermaid' },
  { icon: '📦', label: 'Diagramme de classes', prompt: 'Génère un diagramme Mermaid de type classDiagram pour représenter les entités et leurs relations.', category: 'mermaid' },
  { icon: '🗓️', label: 'Diagramme Gantt', prompt: 'Génère un diagramme Mermaid de type gantt pour planifier les tâches et leurs durées.', category: 'mermaid' },
  { icon: '🥧', label: 'Graphique circulaire', prompt: 'Génère un diagramme Mermaid de type pie pour représenter les proportions ou répartitions mentionnées.', category: 'mermaid' },
  { icon: '🔄', label: 'État/Transitions', prompt: 'Génère un diagramme Mermaid de type stateDiagram-v2 pour représenter les différents états et transitions.', category: 'mermaid' },
];

// Extrait les sections (titre + contenu) depuis du markdown brut avec des headings.
function extractHeadingSections(markdown: string): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = [];
  let current: { heading: string; content: string } | null = null;
  for (const line of markdown.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+)/);
    if (m) {
      if (current) sections.push({ ...current, content: current.content.trim() });
      current = { heading: m[1].trim(), content: '' };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push({ ...current, content: current.content.trim() });
  return sections;
}

const ChatPane: React.FC<ChatPaneProps> = ({ className = '', onOpenSettings }) => {
  const { getActiveNode, tree, activeNodeId, updateNodeContent, aiConfig, setChatMode, setAIConfig, addChild, insertSectionsAsChildren, pendingAIPrompt, setPendingAIPrompt } = useStore();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(['discussion', 'content', 'subsections']));
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Consume pending AI prompt from sidebar enrichment action
  React.useEffect(() => {
    if (pendingAIPrompt) {
      setInput(pendingAIPrompt);
      setPendingAIPrompt(null);
    }
  }, [pendingAIPrompt, setPendingAIPrompt]);

  const toggleSection = (messageIdx: number, section: string) => {
    const key = `${messageIdx}-${section}`;
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isSectionExpanded = (messageIdx: number, section: string) => {
    return expandedSections.has(`${messageIdx}-${section}`) || expandedSections.has(section);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const activeNode = getActiveNode();
  const isDocRoot = activeNodeId === DOCUMENT_ROOT_ID;

  if (!activeNode && !isDocRoot) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center px-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl accent-gradient flex items-center justify-center shadow-glow-accent opacity-60">
            <MessageSquare size={20} className="text-white" />
          </div>
          <p className="text-sm text-slate-500">Sélectionnez un nœud pour discuter</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    // Ajouter le message utilisateur
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Construire le contexte sandwich
      const context = buildContextSandwich(tree, activeNode);
      const systemPrompt = buildSystemPrompt(context, aiConfig.chatMode);
      const messageForAI = buildUserMessage(context, input);

      // Appeler l'IA avec la configuration
      const aiResponse = await callAIAPI(systemPrompt, messageForAI, aiConfig);

      // Parser la réponse structurée
      const parsedResponse = parseAIResponse(aiResponse);

      // Ajouter la réponse de l'IA avec parsing
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        parsed: parsedResponse,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erreur lors de l\'appel IA:', error);
      const message = error instanceof Error
        ? error.message
        : 'Erreur: Impossible de communiquer avec l\'IA.';
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = (messageContent: string, replaceContent: boolean = false) => {
    if (!activeNode) return; // H0 : pas de nœud cible
    if (replaceContent) {
      updateNodeContent(activeNode.id, messageContent);
    } else {
      const currentContent = activeNode.content;
      const newContent = currentContent
        ? `${currentContent}\n\n${messageContent}`
        : messageContent;
      updateNodeContent(activeNode.id, newContent);
    }
  };

  const handleUseTemplate = (prompt: string) => {
    setInput(prompt);
    setShowTemplates(false);
  };

  const handleCopy = (index: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-white/40 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate tracking-tight" title={activeNode?.heading || 'Document complet'}>
              {activeNode ? activeNode.heading : 'Document complet'}
            </h3>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5" title={activeNode?.meta.agentConfig?.role || 'Assistant IA'}>
              <span className="text-fuchsia-500">✦</span>
              <span className="italic text-fuchsia-600 font-medium">{activeNode?.meta.agentConfig?.role || 'Assistant IA'}</span>
            </p>
          </div>
          <button
            onClick={onOpenSettings}
            className="icon-btn tooltip-wrapper flex-shrink-0"
            data-tooltip="Configurer l'IA"
            title="Configurer l'IA"
          >
            <Settings size={15} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-white/50 border border-white/60 rounded-xl p-0.5 shadow-soft mb-2">
          <button
            onClick={() => setChatMode('discussion')}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-spring ${
              aiConfig.chatMode === 'discussion'
                ? 'bg-white shadow-soft text-accent-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare size={12} />
            Discussion
          </button>
          <button
            onClick={() => setChatMode('structuration')}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-spring ${
              aiConfig.chatMode === 'structuration'
                ? 'bg-white shadow-soft text-orange-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={12} />
            Structuration
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className={`relative flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg border ${
            aiConfig.provider === 'gemini'
              ? 'bg-sky-50/70 border-sky-200/60 text-sky-700'
              : 'bg-emerald-50/70 border-emerald-200/60 text-emerald-700'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">{aiConfig.provider === 'gemini' ? 'Gemini' : 'OpenAI'}</span>
            <span className="w-px h-3 bg-current opacity-30" />
            <select
              value={aiConfig.model}
              onChange={(e) => setAIConfig({ ...aiConfig, model: e.target.value })}
              className="bg-transparent border-none outline-none text-xs font-medium appearance-none cursor-pointer pr-4 pl-1"
              style={{ backgroundImage: 'none' }}
            >
              {aiConfig.provider === 'gemini' ? (
                <>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </>
              ) : (
                <>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              )}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 pointer-events-none opacity-60" />
          </div>
          {aiConfig.chatMode === 'structuration' && (
            <span className="chip bg-orange-100 text-orange-700">
              Mode Structuration
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4 animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl accent-gradient-soft border border-accent-200/60 flex items-center justify-center">
              <Zap size={18} className="text-accent-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">Aucun message pour l'instant</p>
            <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto leading-relaxed">
              {aiConfig.chatMode === 'structuration'
                ? 'Mode Structuration · l\'IA agit comme chef de projet et propose des sous-sections.'
                : 'Mode Discussion · posez vos questions librement.'}
            </p>
            <p className="text-[11px] text-slate-400">
              Utilisez les templates rapides pour démarrer
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md accent-gradient text-white shadow-soft">
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                <p className="text-[10px] mt-1 opacity-70 tabular-nums">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            ) : (
              // Message assistant - affichage structuré
              <div className="max-w-[90%] space-y-2">
                {/* Vérifier si on a une réponse parsée avec des sections */}
                {msg.parsed && (msg.parsed.discussion || msg.parsed.content || msg.parsed.subsections.length > 0) ? (
                  <>
                    {/* Section DISCUSSION */}
                    {msg.parsed.discussion && (
                      <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden shadow-soft">
                        <button
                          onClick={() => toggleSection(idx, 'discussion')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/50 transition-colors"
                        >
                          <ChevronRight
                            size={13}
                            className={`text-slate-400 transition-transform duration-200 ${isSectionExpanded(idx, 'discussion') ? 'rotate-90' : ''}`}
                          />
                          <span className="text-xs font-semibold text-slate-700 tracking-wide">Discussion</span>
                        </button>
                        {isSectionExpanded(idx, 'discussion') && (
                          <div className="px-3 pb-3 pt-1 animate-fade-in">
                            <p className="text-sm whitespace-pre-wrap break-words text-slate-700 leading-relaxed">{msg.parsed.discussion}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section CONTENU */}
                    {msg.parsed.content && (
                      <div className="bg-emerald-50/50 backdrop-blur-md border border-emerald-200/50 rounded-2xl overflow-hidden shadow-soft">
                        <button
                          onClick={() => toggleSection(idx, 'content')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50/80 transition-colors"
                        >
                          <ChevronRight
                            size={13}
                            className={`text-emerald-500 transition-transform duration-200 ${isSectionExpanded(idx, 'content') ? 'rotate-90' : ''}`}
                          />
                          <span className="text-xs font-semibold text-emerald-700 tracking-wide">Contenu à intégrer</span>
                        </button>
                        {isSectionExpanded(idx, 'content') && (
                          <div className="px-3 pb-3 pt-1 animate-fade-in">
                            <p className="text-sm whitespace-pre-wrap break-words text-slate-800 leading-relaxed mb-3">{msg.parsed.content}</p>
                            {activeNode && (() => {
                              const headingSections = extractHeadingSections(msg.parsed!.content);
                              return (
                              <div className="flex flex-wrap gap-1.5">
                                {headingSections.length > 0 ? (
                                  <button
                                    onClick={() => {
                                      insertSectionsAsChildren(activeNode.id, headingSections);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-semibold transition-all duration-150 active:scale-95 shadow-soft"
                                    title="Chaque heading devient un nœud fils dans l'arbre"
                                  >
                                    <Plus size={12} />
                                    Insérer {headingSections.length} section{headingSections.length > 1 ? 's' : ''} dans l'arbre
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCommit(msg.parsed!.content, false)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all duration-150 active:scale-95 shadow-soft hover:shadow-soft-lg"
                                  >
                                    <Plus size={12} />
                                    Ajouter au nœud
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirm('Remplacer tout le contenu du nœud ?')) {
                                      handleCommit(msg.parsed!.content, true);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-all duration-150 active:scale-95 shadow-soft hover:shadow-soft-lg"
                                >
                                  ↻ Remplacer
                                </button>
                              </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section SOUS-SECTIONS */}
                    {msg.parsed.subsections.length > 0 && (
                      <div className="bg-fuchsia-50/50 backdrop-blur-md border border-fuchsia-200/50 rounded-2xl overflow-hidden shadow-soft">
                        <button
                          onClick={() => toggleSection(idx, 'subsections')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-fuchsia-50/80 transition-colors"
                        >
                          <ChevronRight
                            size={13}
                            className={`text-fuchsia-500 transition-transform duration-200 ${isSectionExpanded(idx, 'subsections') ? 'rotate-90' : ''}`}
                          />
                          <span className="text-xs font-semibold text-fuchsia-700 tracking-wide">
                            Sous-sections proposées · {msg.parsed.subsections.length}
                          </span>
                        </button>
                        {isSectionExpanded(idx, 'subsections') && (
                          <div className="px-3 pb-3 pt-1 space-y-1.5 animate-fade-in">
                            {msg.parsed.subsections.map((sub, subIdx) => (
                              <div key={subIdx} className="flex items-start gap-2 p-2 bg-white/70 rounded-xl border border-fuchsia-100/60">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-fuchsia-600 bg-fuchsia-100 px-1.5 py-0.5 rounded tracking-wider">
                                      H{sub.level}
                                    </span>
                                    <span className="font-semibold text-sm text-slate-800 truncate">{sub.title}</span>
                                  </div>
                                  {sub.description && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{sub.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const targetId = activeNode ? activeNode.id : DOCUMENT_ROOT_ID;
                                    addChild(targetId, sub.title, sub.description);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap shadow-soft"
                                  title="Créer ce nœud enfant"
                                >
                                  <Plus size={11} />
                                  Créer
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                if (confirm(`Créer les ${msg.parsed!.subsections.length} sous-sections ?`)) {
                                  const targetId = activeNode ? activeNode.id : DOCUMENT_ROOT_ID;
                                  const sections = msg.parsed!.subsections.map(sub => ({
                                    heading: sub.title,
                                    content: sub.description,
                                  }));
                                  insertSectionsAsChildren(targetId, sections);
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold transition-all active:scale-95 shadow-soft hover:shadow-glow-accent"
                            >
                              <Plus size={13} />
                              Créer toutes les sous-sections
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // Fallback: affichage classique
                  <div className="bg-white/70 backdrop-blur-md border border-white/60 text-slate-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-soft">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Réponse IA</div>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <button
                        onClick={() => handleCopy(idx, msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-xs text-slate-700 transition-colors"
                      >
                        {copiedId === idx ? <><Check size={11} /> Copié</> : <><Copy size={11} /> Copier</>}
                      </button>
                      {activeNode && (() => {
                        const headingSections = extractHeadingSections(msg.content);
                        return headingSections.length > 0 ? (
                          <button
                            onClick={() => insertSectionsAsChildren(activeNode.id, headingSections)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs transition-colors"
                            title="Chaque heading devient un nœud fils dans l'arbre"
                          >
                            <Plus size={11} />
                            {headingSections.length} section{headingSections.length > 1 ? 's' : ''} → arbre
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCommit(msg.content, false)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs transition-colors"
                          >
                            + Ajouter
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Timestamp et actions globales */}
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                  <button
                    onClick={() => handleCopy(idx, msg.content)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 transition-colors font-medium"
                  >
                    {copiedId === idx ? '✓ Copié' : 'Copier tout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white/70 backdrop-blur-md border border-white/60 text-slate-600 px-4 py-3 rounded-2xl rounded-bl-md shadow-soft">
              <p className="text-sm flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                L'IA réfléchit...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Templates rapides */}
      {showTemplates && (
        <div className="border-t border-white/40 px-3 py-3 flex-shrink-0 max-h-64 overflow-y-auto animate-fade-in-up">
          {([
            { key: 'structuration', label: '🏗️ Structuration', accent: 'text-accent-600', hoverBg: 'hover:bg-accent-50' },
            { key: 'tableau', label: '📊 Tableaux', accent: 'text-emerald-600', hoverBg: 'hover:bg-emerald-50' },
            { key: 'mermaid', label: '📐 Diagrammes Mermaid', accent: 'text-fuchsia-600', hoverBg: 'hover:bg-fuchsia-50' },
          ] as const).map((cat, ci) => (
            <div key={cat.key} className={ci > 0 ? 'mt-3' : ''}>
              <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${cat.accent}`}>{cat.label}</h4>
              <div className="grid grid-cols-2 gap-1">
                {promptTemplates.filter(t => t.category === cat.key).map((template) => (
                  <button
                    key={template.label}
                    onClick={() => handleUseTemplate(template.prompt)}
                    className={`flex items-center gap-1.5 p-1.5 text-left text-xs bg-white/60 ${cat.hoverBg} border border-white/60 rounded-lg transition-all duration-150 active:scale-95`}
                  >
                    <span className="text-sm">{template.icon}</span>
                    <span className="font-medium truncate text-slate-700">{template.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-white/40 p-3 flex-shrink-0"
      >
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className={`px-2.5 py-2 rounded-xl text-sm font-medium flex items-center gap-0.5 transition-all duration-150 active:scale-95 ${
              showTemplates
                ? 'bg-accent-100 text-accent-700'
                : 'bg-white/60 text-slate-600 hover:bg-white/90 border border-white/60'
            }`}
            title="Templates rapides"
          >
            <Zap size={14} />
            <ChevronDown size={12} className={`transition-transform duration-200 ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={aiConfig.chatMode === 'structuration'
              ? "Demandez une analyse ou structuration..."
              : "Posez une question..."
            }
            className="input flex-1"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary px-3"
            title="Envoyer"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPane;
