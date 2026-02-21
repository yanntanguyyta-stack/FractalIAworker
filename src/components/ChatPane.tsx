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

const ChatPane: React.FC<ChatPaneProps> = ({ className = '', onOpenSettings }) => {
  const { getActiveNode, tree, activeNodeId, updateNodeContent, aiConfig, setChatMode, setAIConfig, addChild, pendingAIPrompt, setPendingAIPrompt } = useStore();
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
      <div className={`bg-gray-50 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-gray-500">Sélectionnez un nœud pour discuter</p>
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
    <div className={`bg-white flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-slate-50 via-indigo-50 to-purple-50 p-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate" title={activeNode?.heading || 'Document complet'}>
              📄 {activeNode ? activeNode.heading : 'Document complet'}
            </h3>
            <p className="text-sm text-purple-600 font-medium truncate" title={activeNode?.meta.agentConfig?.role || 'Assistant IA'}>
              🤖 <span className="italic">{activeNode?.meta.agentConfig?.role || 'Assistant IA (rôle par défaut)'}</span>
            </p>
          </div>
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors flex-shrink-0 ml-2"
            title="Configurer l'IA"
          >
            <Settings size={18} className="text-indigo-600" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 flex-1">
            <button
              onClick={() => setChatMode('discussion')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                aiConfig.chatMode === 'discussion' 
                  ? 'bg-white shadow text-purple-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare size={14} />
              Discussion
            </button>
            <button
              onClick={() => setChatMode('structuration')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                aiConfig.chatMode === 'structuration' 
                  ? 'bg-white shadow text-orange-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText size={14} />
              Structuration
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className={`relative flex items-center gap-1 px-2 py-0.5 rounded-full ${
            aiConfig.provider === 'gemini' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            <span>{aiConfig.provider === 'gemini' ? '🔮 ' : '🤖 '}</span>
            <select
              value={aiConfig.model}
              onChange={(e) => setAIConfig({ ...aiConfig, model: e.target.value })}
              className="bg-transparent border-none outline-none text-xs font-medium appearance-none cursor-pointer pr-4"
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
            <ChevronDown size={10} className="absolute right-2 pointer-events-none" />
          </div>
          {aiConfig.chatMode === 'structuration' && (
            <>
              <span className="text-gray-400">•</span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                🏗️ Mode Structuration
              </span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="mb-2">Aucun message pour l'instant.</p>
            <p className="text-xs mb-4">
              {aiConfig.chatMode === 'structuration' 
                ? 'Mode Structuration : l\'IA agit comme chef de projet et propose des sous-sections.'
                : 'Mode Discussion : posez vos questions librement.'}
            </p>
            <p className="text-xs text-gray-400">
              Utilisez les templates rapides ⚡ pour démarrer
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              // Message utilisateur (inchangé)
              <div className="max-w-[85%] p-3 rounded-lg bg-blue-500 text-white rounded-br-none">
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                <p className="text-xs mt-1 opacity-70">
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
                      <div className="bg-slate-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSection(idx, 'discussion')}
                          className="w-full flex items-center gap-2 p-2 bg-slate-200 hover:bg-slate-300 transition-colors"
                        >
                          <ChevronRight 
                            size={14} 
                            className={`transition-transform ${isSectionExpanded(idx, 'discussion') ? 'rotate-90' : ''}`} 
                          />
                          <span className="text-sm font-medium text-slate-700">📣 Discussion</span>
                        </button>
                        {isSectionExpanded(idx, 'discussion') && (
                          <div className="p-3">
                            <p className="text-sm whitespace-pre-wrap break-words text-gray-700">{msg.parsed.discussion}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section CONTENU */}
                    {msg.parsed.content && (
                      <div className="bg-green-50 rounded-lg overflow-hidden border border-green-200">
                        <button
                          onClick={() => toggleSection(idx, 'content')}
                          className="w-full flex items-center gap-2 p-2 bg-green-100 hover:bg-green-200 transition-colors"
                        >
                          <ChevronRight 
                            size={14} 
                            className={`transition-transform ${isSectionExpanded(idx, 'content') ? 'rotate-90' : ''}`} 
                          />
                          <span className="text-sm font-medium text-green-700">📝 Contenu à intégrer</span>
                        </button>
                        {isSectionExpanded(idx, 'content') && (
                          <div className="p-3">
                            <p className="text-sm whitespace-pre-wrap break-words text-gray-800 mb-3">{msg.parsed.content}</p>
                            {activeNode && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCommit(msg.parsed!.content, false)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                              >
                                <Plus size={12} />
                                Ajouter au nœud
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Remplacer tout le contenu du nœud ?')) {
                                    handleCommit(msg.parsed!.content, true);
                                  }
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
                              >
                                ↻ Remplacer
                              </button>
                            </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section SOUS-SECTIONS */}
                    {msg.parsed.subsections.length > 0 && (
                      <div className="bg-purple-50 rounded-lg overflow-hidden border border-purple-200">
                        <button
                          onClick={() => toggleSection(idx, 'subsections')}
                          className="w-full flex items-center gap-2 p-2 bg-purple-100 hover:bg-purple-200 transition-colors"
                        >
                          <ChevronRight 
                            size={14} 
                            className={`transition-transform ${isSectionExpanded(idx, 'subsections') ? 'rotate-90' : ''}`} 
                          />
                          <span className="text-sm font-medium text-purple-700">
                            🏗️ Sous-sections proposées ({msg.parsed.subsections.length})
                          </span>
                        </button>
                        {isSectionExpanded(idx, 'subsections') && (
                          <div className="p-3 space-y-2">
                            {msg.parsed.subsections.map((sub, subIdx) => (
                              <div key={subIdx} className="flex items-start gap-2 p-2 bg-white rounded border border-purple-100">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                                      H{sub.level}
                                    </span>
                                    <span className="font-medium text-sm text-gray-800 truncate">{sub.title}</span>
                                  </div>
                                  {sub.description && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{sub.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const targetId = activeNode ? activeNode.id : DOCUMENT_ROOT_ID;
                                    addChild(targetId, sub.title);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium transition-colors whitespace-nowrap"
                                  title="Créer ce nœud enfant"
                                >
                                  <Plus size={12} />
                                  Créer
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                if (confirm(`Créer les ${msg.parsed!.subsections.length} sous-sections ?`)) {
                                  const targetId = activeNode ? activeNode.id : DOCUMENT_ROOT_ID;
                                  msg.parsed!.subsections.forEach(sub => {
                                    addChild(targetId, sub.title);
                                  });
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                            >
                              <Plus size={14} />
                              Créer toutes les sous-sections
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // Fallback: affichage classique si pas de parsing
                  <div className="bg-gray-100 text-gray-900 rounded-lg rounded-bl-none p-3">
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => handleCopy(idx, msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/50 hover:bg-white text-xs text-gray-700 transition-colors"
                      >
                        {copiedId === idx ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
                      </button>
                      {activeNode && (
                      <button
                        onClick={() => handleCommit(msg.content, false)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-green-500 hover:bg-green-600 text-white text-xs transition-colors"
                      >
                        + Ajouter
                      </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamp et actions globales */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-gray-400">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                  <button
                    onClick={() => handleCopy(idx, msg.content)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {copiedId === idx ? '✓ Copié' : 'Copier tout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-600 p-3 rounded-lg rounded-bl-none">
              <p className="text-sm">L'IA réfléchit...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Templates rapides - organisés par catégorie */}
      {showTemplates && (
        <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0 max-h-64 overflow-y-auto">
          {/* Structuration */}
          <div className="mb-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🏗️ Structuration</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {promptTemplates.filter(t => t.category === 'structuration').map((template) => (
                <button
                  key={template.label}
                  onClick={() => handleUseTemplate(template.prompt)}
                  className="flex items-center gap-2 p-2 text-left text-xs bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent rounded-lg transition-colors"
                >
                  <span>{template.icon}</span>
                  <span className="font-medium truncate">{template.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Tableaux */}
          <div className="mb-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📊 Tableaux</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {promptTemplates.filter(t => t.category === 'tableau').map((template) => (
                <button
                  key={template.label}
                  onClick={() => handleUseTemplate(template.prompt)}
                  className="flex items-center gap-2 p-2 text-left text-xs bg-green-50 hover:bg-green-100 hover:border-green-200 border border-transparent rounded-lg transition-colors"
                >
                  <span>{template.icon}</span>
                  <span className="font-medium truncate">{template.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Diagrammes Mermaid */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📐 Diagrammes Mermaid</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {promptTemplates.filter(t => t.category === 'mermaid').map((template) => (
                <button
                  key={template.label}
                  onClick={() => handleUseTemplate(template.prompt)}
                  className="flex items-center gap-2 p-2 text-left text-xs bg-purple-50 hover:bg-purple-100 hover:border-purple-200 border border-transparent rounded-lg transition-colors"
                >
                  <span>{template.icon}</span>
                  <span className="font-medium truncate">{template.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-200 p-3 bg-gray-50 flex-shrink-0"
      >
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
              showTemplates 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Templates rapides"
          >
            <Zap size={14} />
            <ChevronDown size={14} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={aiConfig.chatMode === 'structuration' 
              ? "Demandez une analyse ou structuration..." 
              : "Posez une question..."
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPane;
