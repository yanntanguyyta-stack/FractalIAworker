import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  TreePine, 
  MessageSquare, 
  Key, 
  Sparkles,
  FileText,
  ExternalLink,
  Check,
  Rocket
} from 'lucide-react';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Bienvenue sur FractalIA ! 🎉',
    icon: Sparkles,
    content: (
      <div className="space-y-4">
        <p className="text-gray-600 text-lg">
          FractalIA est un <strong>éditeur de documents intelligent</strong> qui vous aide à structurer, 
          rédiger et améliorer vos contenus grâce à l'IA.
        </p>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <h4 className="font-semibold text-blue-800 mb-2">✨ Ce que vous pouvez faire :</h4>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>📝 Créer des documents structurés en arborescence</li>
            <li>🤖 Utiliser l'IA pour rédiger et améliorer vos contenus</li>
            <li>📊 Générer des tableaux et diagrammes automatiquement</li>
            <li>💾 Exporter vos documents en Markdown</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'structure',
    title: 'Structure en Arborescence',
    icon: TreePine,
    content: (
      <div className="space-y-4">
        <p className="text-gray-600">
          Vos documents sont organisés en <strong>nœuds hiérarchiques</strong>, comme un arbre.
          Chaque titre devient une section que vous pouvez développer, modifier ou réorganiser.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-500">📁</span>
              <span className="font-medium">Mon Projet</span>
            </div>
            <div className="ml-6 flex items-center gap-2">
              <span className="text-green-500">📄</span>
              <span>Introduction</span>
            </div>
            <div className="ml-6 flex items-center gap-2">
              <span className="text-green-500">📄</span>
              <span>Chapitre 1</span>
            </div>
            <div className="ml-12 flex items-center gap-2">
              <span className="text-amber-500">📝</span>
              <span className="text-gray-500">Section 1.1</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          💡 <strong>Astuce :</strong> Cliquez sur un nœud dans la barre latérale pour l'éditer.
          Utilisez les boutons + pour ajouter des sous-sections.
        </p>
      </div>
    ),
  },
  {
    id: 'ai-chat',
    title: 'Assistant IA Intégré',
    icon: MessageSquare,
    content: (
      <div className="space-y-4">
        <p className="text-gray-600">
          L'IA vous accompagne dans la rédaction. Posez des questions, demandez des améliorations
          ou générez du contenu directement depuis le panneau de chat.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <h5 className="font-medium text-purple-800 text-sm mb-1">💬 Mode Discussion</h5>
            <p className="text-xs text-purple-600">
              Posez des questions sur votre contenu, demandez des explications ou des idées.
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <h5 className="font-medium text-green-800 text-sm mb-1">🏗️ Mode Structuration</h5>
            <p className="text-xs text-green-600">
              L'IA propose des modifications directes que vous pouvez accepter ou modifier.
            </p>
          </div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <p className="text-sm text-amber-700">
            📌 <strong>Templates rapides :</strong> Utilisez les modèles prédéfinis pour générer 
            des tableaux, des diagrammes Mermaid, ou restructurer vos contenus.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'api-key',
    title: 'Configurer votre Clé API',
    icon: Key,
    content: (
      <div className="space-y-4">
        <p className="text-gray-600">
          Pour utiliser l'IA, vous avez besoin d'une <strong>clé API gratuite</strong> de Google Gemini ou OpenAI.
        </p>
        
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            🔮 Option recommandée : Google Gemini (Gratuit)
          </h4>
          <ol className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <span>Allez sur <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-blue-900">Google AI Studio</a></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Connectez-vous avec votre compte Google</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>Cliquez sur "Create API Key" → "Create API key in new project"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              <span>Copiez la clé (commence par <code className="bg-blue-100 px-1 rounded">AIza...</code>)</span>
            </li>
          </ol>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            🟢 Alternative : OpenAI ChatGPT
          </h4>
          <p className="text-sm text-gray-600">
            Créez un compte sur <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-green-600 hover:text-green-800">platform.openai.com</a> 
            et générez une clé API (nécessite un compte payant).
          </p>
        </div>

        <p className="text-xs text-gray-500 flex items-center gap-1">
          🔒 <strong>Sécurité :</strong> Votre clé est stockée uniquement dans votre navigateur (localStorage), 
          jamais sur nos serveurs.
        </p>
      </div>
    ),
  },
  {
    id: 'ready',
    title: 'Vous êtes prêt ! 🚀',
    icon: Rocket,
    content: (
      <div className="space-y-4">
        <p className="text-gray-600 text-lg">
          Tout est configuré ! Vous pouvez maintenant commencer à utiliser FractalIA.
        </p>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <h4 className="font-semibold text-green-800 mb-3">📋 Récapitulatif :</h4>
          <ul className="space-y-2 text-sm text-green-700">
            <li className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              Explorez la structure de votre document dans la barre latérale
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              Éditez vos contenus dans le panneau central
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              Utilisez l'assistant IA dans le panneau de droite
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              Configurez votre clé API dans les paramètres (⚙️)
            </li>
          </ul>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <p className="text-sm text-amber-700">
            💡 <strong>Conseil :</strong> Cliquez sur "Nouveau" pour créer un document avec l'aide de l'IA, 
            ou explorez le document de démonstration déjà chargé.
          </p>
        </div>
      </div>
    ),
  },
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, onOpenSettings }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleConfigureAPI = () => {
    onClose();
    onOpenSettings();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <Icon size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{step.title}</h2>
              <p className="text-blue-100 text-sm">
                Étape {currentStep + 1} sur {steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
            title="Passer l'introduction"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 min-h-[320px]">
          {step.content}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            {/* Step dots */}
            <div className="flex gap-1.5">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep 
                      ? 'bg-blue-600 w-6' 
                      : index < currentStep 
                        ? 'bg-blue-300' 
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
                Précédent
              </button>
            )}
            
            {step.id === 'api-key' && (
              <button
                onClick={handleConfigureAPI}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium"
              >
                <Key size={18} />
                Configurer ma clé API
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium"
            >
              {isLastStep ? (
                <>
                  Commencer
                  <Rocket size={18} />
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
