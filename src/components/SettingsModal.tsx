import React from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { aiConfig, assessmentConfig, setAIConfig, setAssessmentConfig } = useStore();
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
    setAIConfig({
      provider,
      apiKey,
      model,
      chatMode: aiConfig.chatMode,
    });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key size={24} />
            <h2 className="text-xl font-bold">Configuration IA</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fournisseur d'IA
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setProvider('gemini')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  provider === 'gemini'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🔮</div>
                <div className="font-medium">Google Gemini</div>
                <div className="text-xs text-gray-500">API Google AI</div>
              </button>
              <button
                onClick={() => setProvider('openai')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  provider === 'openai'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🤖</div>
                <div className="font-medium">OpenAI ChatGPT</div>
                <div className="text-xs text-gray-500">API OpenAI</div>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modèle
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clé API {provider === 'gemini' ? 'Google AI' : 'OpenAI'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'gemini' ? 'AIza...' : 'sk-...'}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <AlertCircle size={12} />
              La clé est stockée localement dans votre navigateur uniquement.
            </p>
          </div>

          {/* Help Links */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Obtenir une clé API :</p>
            <ul className="space-y-1 text-gray-600">
              <li>
                🔮 Gemini :{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </li>
              <li>
                🤖 OpenAI :{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  OpenAI Platform
                </a>
              </li>
            </ul>
          </div>

          {/* Assessment Settings */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Évaluation de complétude</p>
                <p className="text-xs text-gray-500">Ajoute des scores /10 dans les métadonnées de chaque nœud.</p>
              </div>
              <button
                onClick={() => setAssessmentEnabled(!assessmentEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  assessmentEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
                type="button"
                aria-pressed={assessmentEnabled}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    assessmentEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Question globale à évaluer (score personnalisé)
              </label>
              <input
                type="text"
                value={assessmentQuestion}
                onChange={(e) => setAssessmentQuestion(e.target.value)}
                placeholder="Ex: Est-ce que le projet est viable ?"
                disabled={!assessmentEnabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : !isApiKeyMissing
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {saved ? (
              <>
                <Check size={18} />
                Enregistré !
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
