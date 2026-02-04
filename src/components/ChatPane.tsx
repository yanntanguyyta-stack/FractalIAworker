import React from 'react';
import { Send, Copy, Check, Settings, MessageSquare, FileText, Zap, ChevronDown } from 'lucide-react';
import { useStore, ChatMode } from '../store';
import { buildContextSandwich, buildSystemPrompt, buildUserMessage, callAIAPI } from '../aiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatPaneProps {
  className?: string;
  onOpenSettings?: () => void;
}

// Templates de prompts rapides
const promptTemplates = [
  { icon: '📝', label: 'Développe ce point', prompt: 'Développe et détaille le contenu de cette section de manière approfondie.' },
  { icon: '📋', label: 'Résume', prompt: 'Fais un résumé concis du contenu actuel de cette section.' },
  { icon: '💡', label: 'Ajoute des exemples', prompt: 'Ajoute des exemples concrets et pertinents pour illustrer les points de cette section.' },
  { icon: '📊', label: 'Crée un tableau', prompt: 'Crée un tableau Markdown récapitulatif basé sur le contenu de cette section.' },
  { icon: '🔀', label: 'Diagramme Mermaid', prompt: 'Génère un diagramme Mermaid pour visualiser les concepts de cette section.' },
  { icon: '✅', label: 'Liste de tâches', prompt: 'Transforme le contenu en une liste de tâches actionables.' },
];

const ChatPane: React.FC<ChatPaneProps> = ({ className = '', onOpenSettings }) => {
  const { getActiveNode, getAllNodes, updateNodeContent, aiConfig, setChatMode } = useStore();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [showTemplates, setShowTemplates] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const activeNode = getActiveNode();
  const allNodes = getAllNodes();

  if (!activeNode) {
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
      const context = buildContextSandwich(allNodes, activeNode);
      const systemPrompt = buildSystemPrompt(context, aiConfig.chatMode);
      const messageForAI = buildUserMessage(context, input);

      // Appeler l'IA avec la configuration
      const aiResponse = await callAIAPI(systemPrompt, messageForAI, aiConfig);

      // Ajouter la réponse de l'IA
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
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
      <div className="border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 p-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">Assistant IA</h3>
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
            title="Configurer l'IA"
          >
            <Settings size={18} className="text-purple-600" />
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
              onClick={() => setChatMode('redaction')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                aiConfig.chatMode === 'redaction' 
                  ? 'bg-white shadow text-orange-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText size={14} />
              Rédaction
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {activeNode.meta.agentConfig?.role && (
            <span className="text-purple-700">
              👤 <strong>{activeNode.meta.agentConfig.role}</strong>
            </span>
          )}
          <span className="text-gray-400">•</span>
          <span className={`px-2 py-0.5 rounded-full ${
            aiConfig.provider === 'gemini' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {aiConfig.provider === 'gemini' ? '🔮 ' : '🤖 '}{aiConfig.model}
          </span>
          {aiConfig.chatMode === 'redaction' && (
            <>
              <span className="text-gray-400">•</span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                ✍️ Mode Rédaction
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
              {aiConfig.chatMode === 'redaction' 
                ? 'Mode Rédaction : les réponses seront prêtes à intégrer au document.'
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
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {msg.timestamp.toLocaleTimeString()}
              </p>

              {msg.role === 'assistant' && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleCopy(idx, msg.content)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white/50 hover:bg-white text-xs text-gray-700 transition-colors"
                  >
                    {copiedId === idx ? (
                      <>
                        <Check size={12} />
                        Copié
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copier
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCommit(msg.content, false)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-green-500 hover:bg-green-600 text-white text-xs transition-colors"
                    title="Ajouter à la fin du contenu"
                  >
                    + Ajouter
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Remplacer tout le contenu de la section par cette réponse ?')) {
                        handleCommit(msg.content, true);
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs transition-colors"
                    title="Remplacer le contenu"
                  >
                    ↻ Remplacer
                  </button>
                </div>
              )}
            </div>
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

      {/* Templates rapides */}
      {showTemplates && (
        <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {promptTemplates.map((template) => (
              <button
                key={template.label}
                onClick={() => handleUseTemplate(template.prompt)}
                className="flex items-center gap-2 p-2 text-left text-xs bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <span>{template.icon}</span>
                <span className="font-medium">{template.label}</span>
              </button>
            ))}
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
            placeholder={aiConfig.chatMode === 'redaction' 
              ? "Décrivez le contenu à générer..." 
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
