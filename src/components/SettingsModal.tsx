import React from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { useAuthCompat } from '../useAuthCompat';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { aiConfig, assessmentConfig, setAIConfig, setAssessmentConfig } = useStore();
  const { saveApiConfig } = useAuthCompat();
  const [provider, setProvider] = React.useState(aiConfig.provider);
  const [apiKey, setApiKey] = React.useState(aiConfig.apiKey);
  const [model, setModel] = React.useState(aiConfig.model);
  const [assessmentEnabled, setAssessmentEnabled] = React.useState(assessmentConfig.enabled);
  const [assessmentQuestion, setAssessmentQuestion] = React.useState(assessmentConfig.question);
  const [saved, setSaved] = React.useState(false);
  const isApiKeyMissing = !apiKey.trim();

  // Modèles disponibles par provider
  const models = {
    gemini: [
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview (SOTA)' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Fast)' },
      { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp (Legacy)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Stable)' },
    ],
    openai: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (économique)' },
      { value: 'gpt-4o', label: 'GPT-4o (performant)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (rapide)' },
    ],
  };

  // Mettre à jour le modèle par défaut quand le provider change
  React.useEffect(() => {
    const defaultModel = provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini';
    if (!models[provider].find(m => m.value === model)) {
      setModel(defaultModel);
    }
  }, [provider]);

  React.useEffect(() => {
    if (isOpen) {
      setProvider(aiConfig.provider);
      setApiKey(aiConfig.apiKey);
      setModel(aiConfig.model);
      setAssessmentEnabled(assessmentConfig.enabled);
      setAssessmentQuestion(assessmentConfig.question);
    }
  }, [isOpen, aiConfig, assessmentConfig]);

  const handleSave = () => {
    const newConfig = {
      provider,
      apiKey,
      model,
      chatMode: aiConfig.chatMode,
    };
    setAIConfig(newConfig);
    saveApiConfig({ provider, apiKey, model });
    setAssessmentConfig({
      enabled: assessmentEnabled,
      question: assessmentQuestion.trim(),
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="glass-card w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-glow-accent">
              <Key size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold accent-text-gradient tracking-tight">Configuration IA</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Provider Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Fournisseur d'IA
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProvider('gemini')}
                className={`p-4 rounded-2xl border-2 transition-all duration-200 ease-spring text-left ${
                  provider === 'gemini'
                    ? 'border-sky-400 bg-sky-50/70 shadow-soft scale-[1.02]'
                    : 'border-white/60 bg-white/40 hover:bg-white/70 hover:border-sky-200'
                }`}
              >
                <div className="text-2xl mb-1">🔮</div>
                <div className="font-semibold text-slate-800">Google Gemini</div>
                <div className="text-xs text-slate-500 mt-0.5">API Google AI</div>
              </button>
              <button
                onClick={() => setProvider('openai')}
                className={`p-4 rounded-2xl border-2 transition-all duration-200 ease-spring text-left ${
                  provider === 'openai'
                    ? 'border-emerald-400 bg-emerald-50/70 shadow-soft scale-[1.02]'
                    : 'border-white/60 bg-white/40 hover:bg-white/70 hover:border-emerald-200'
                }`}
              >
                <div className="text-2xl mb-1">🤖</div>
                <div className="font-semibold text-slate-800">OpenAI ChatGPT</div>
                <div className="text-xs text-slate-500 mt-0.5">API OpenAI</div>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Modèle
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input"
            >
              {models[provider].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Clé API {provider === 'gemini' ? 'Google AI' : 'OpenAI'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'gemini' ? 'AIza...' : 'sk-...'}
              className="input font-mono"
            />
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <AlertCircle size={12} className="text-slate-400" />
              Clé stockée localement dans votre navigateur uniquement.
            </p>
          </div>

          {/* Help Links */}
          <div className="glass border-white/60 rounded-2xl p-4 text-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Obtenir une clé API</p>
            <ul className="space-y-1.5 text-slate-700">
              <li className="flex items-center gap-2">
                <span>🔮</span>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline font-medium">
                  Google AI Studio
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span>🤖</span>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline font-medium">
                  OpenAI Platform
                </a>
              </li>
            </ul>
          </div>

          {/* Assessment Settings */}
          <div className="glass border-white/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Évaluation de complétude</p>
                <p className="text-xs text-slate-500 mt-0.5">Ajoute des scores /10 dans les métadonnées de chaque nœud.</p>
              </div>
              <button
                onClick={() => setAssessmentEnabled(!assessmentEnabled)}
                className={`w-11 h-6 rounded-full transition-all duration-200 ease-spring relative flex-shrink-0 ${
                  assessmentEnabled ? 'accent-gradient shadow-glow-accent' : 'bg-slate-200'
                }`}
                type="button"
                aria-pressed={assessmentEnabled}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-soft transition-transform duration-200 ease-spring ${
                    assessmentEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <input
              type="text"
              value={assessmentQuestion}
              onChange={(e) => setAssessmentQuestion(e.target.value)}
              placeholder="Question : Est-ce que le projet est viable ?"
              disabled={!assessmentEnabled}
              className="input-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/40 px-6 py-4 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button
            onClick={handleSave}
            className={
              saved
                ? 'btn bg-emerald-500 text-white shadow-soft'
                : isApiKeyMissing
                  ? 'btn bg-orange-500 text-white shadow-soft hover:scale-[1.02]'
                  : 'btn-primary'
            }
          >
            {saved ? (
              <>
                <Check size={15} />
                Enregistré
              </>
            ) : (
              isApiKeyMissing ? 'Enregistrer (sans clé)' : 'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
