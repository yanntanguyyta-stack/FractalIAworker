import React from 'react';
import { FileText, Sparkles, Check, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { callAIAPI } from '../aiService';

interface DocumentPlan {
  title: string;
  description: string;
  sections: {
    title: string;
    description: string;
    role?: string;
  }[];
}

interface NewDocumentWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewDocumentWizard: React.FC<NewDocumentWizardProps> = ({ isOpen, onClose }) => {
  const { aiConfig, loadMarkdown } = useStore();
  const [step, setStep] = React.useState<'input' | 'loading' | 'review' | 'creating'>('input');
  const [documentType, setDocumentType] = React.useState('');
  const [plan, setPlan] = React.useState<DocumentPlan | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const documentSuggestions = [
    { icon: '📋', label: 'Plan de projet', prompt: 'Un plan de projet professionnel' },
    { icon: '📊', label: 'Business Plan', prompt: 'Un business plan pour une startup' },
    { icon: '📚', label: 'Documentation technique', prompt: 'Une documentation technique pour un logiciel' },
    { icon: '🎯', label: 'Stratégie marketing', prompt: 'Une stratégie marketing digitale' },
    { icon: '📝', label: 'Rapport d\'analyse', prompt: 'Un rapport d\'analyse de marché' },
    { icon: '🎓', label: 'Cours/Formation', prompt: 'Un cours ou une formation en ligne' },
  ];

  const generatePlan = async (prompt: string) => {
    if (!aiConfig.apiKey) {
      setError('Veuillez d\'abord configurer votre clé API dans les paramètres.');
      return;
    }

    setStep('loading');
    setError(null);

    const systemPrompt = `Tu es un expert en structuration de documents. L'utilisateur veut créer un document.
Tu dois proposer un plan structuré avec:
- Un titre principal
- Une description courte du document
- 4 à 6 sections principales, chacune avec:
  - Un titre
  - Une description courte
  - Un rôle d'expert IA qui assistera l'utilisateur sur cette section

IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires. Format exact:
{
  "title": "Titre du document",
  "description": "Description courte",
  "sections": [
    {"title": "Section 1", "description": "Description", "role": "Expert en..."},
    {"title": "Section 2", "description": "Description", "role": "Expert en..."}
  ]
}`;

    const userMessage = `Je souhaite créer: ${prompt}

Propose-moi un plan structuré pour ce document.`;

    try {
      const response = await callAIAPI(systemPrompt, userMessage, aiConfig);
      
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      let cleanJson = response.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsedPlan = JSON.parse(cleanJson) as DocumentPlan;
      setPlan(parsedPlan);
      setStep('review');
    } catch (err) {
      console.error('Erreur génération plan:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération du plan');
      setStep('input');
    }
  };

  const createDocument = () => {
    if (!plan) return;

    setStep('creating');

    // Générer le Markdown avec les métadonnées
    let markdown = `# ${plan.title}\n\n`;
    markdown += `<!-- {"meta": {"id": "root-${Date.now()}", "type": "project-root", "contextConfig": {"isGlobal": true}}} -->\n\n`;
    markdown += `${plan.description}\n\n`;

    plan.sections.forEach((section, index) => {
      const sectionId = `section-${Date.now()}-${index}`;
      markdown += `## ${section.title}\n\n`;
      markdown += `<!-- {"meta": {"id": "${sectionId}", "type": "section", "agentConfig": {"role": "${section.role || 'Assistant'}", "instructions": "Tu es un expert en ${section.title.toLowerCase()}. Aide l'utilisateur à développer cette section avec précision et clarté."}, "contextConfig": {"isGlobal": false}}} -->\n\n`;
      markdown += `${section.description}\n\n`;
      markdown += `*Cette section attend votre contenu...*\n\n`;
    });

    // Charger le nouveau document
    loadMarkdown(markdown);

    // Fermer le wizard
    setTimeout(() => {
      onClose();
      resetWizard();
    }, 500);
  };

  const resetWizard = () => {
    setStep('input');
    setDocumentType('');
    setPlan(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Créer un nouveau document</h2>
              <p className="text-indigo-100 text-sm">L'IA va vous aider à structurer votre document</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            {['Décrire', 'Planifier', 'Créer'].map((label, idx) => (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-2 ${
                  idx === 0 && step === 'input' ? 'text-indigo-600' :
                  idx === 1 && (step === 'loading' || step === 'review') ? 'text-indigo-600' :
                  idx === 2 && step === 'creating' ? 'text-indigo-600' :
                  'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === 0 && step === 'input' ? 'bg-indigo-600 text-white' :
                    idx === 1 && (step === 'loading' || step === 'review') ? 'bg-indigo-600 text-white' :
                    idx === 2 && step === 'creating' ? 'bg-indigo-600 text-white' :
                    (step === 'review' && idx === 0) || (step === 'creating' && idx <= 1) ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {(step === 'review' && idx === 0) || (step === 'creating' && idx <= 1) ? <Check size={16} /> : idx + 1}
                  </div>
                  <span className="hidden sm:inline font-medium">{label}</span>
                </div>
                {idx < 2 && <ChevronRight size={20} className="mx-4 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quel type de document souhaitez-vous créer ?
                </label>
                <textarea
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  placeholder="Décrivez le document que vous voulez créer... Ex: Un plan marketing pour le lancement d'une application mobile"
                  className="w-full h-32 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-3">Ou choisissez un type prédéfini :</p>
                <div className="grid grid-cols-2 gap-3">
                  {documentSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => {
                        setDocumentType(suggestion.prompt);
                        generatePlan(suggestion.prompt);
                      }}
                      className="p-4 text-left border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                    >
                      <span className="text-2xl mb-2 block">{suggestion.icon}</span>
                      <span className="font-medium text-gray-900">{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <Loader2 size={48} className="text-indigo-600 animate-spin" />
                <Sparkles size={20} className="absolute -top-1 -right-1 text-yellow-500 animate-pulse" />
              </div>
              <p className="mt-6 text-lg font-medium text-gray-900">L'IA génère votre plan...</p>
              <p className="text-gray-500 text-sm">Cela peut prendre quelques secondes</p>
            </div>
          )}

          {/* Step 3: Review Plan */}
          {step === 'review' && plan && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.title}</h3>
                <p className="text-gray-600">{plan.description}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Structure proposée :</h4>
                <div className="space-y-3">
                  {plan.sections.map((section, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900">{section.title}</h5>
                          <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                          {section.role && (
                            <p className="text-xs text-purple-600 mt-2">
                              🤖 Assistant: {section.role}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Creating */}
          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="text-lg font-medium text-gray-900">Document créé avec succès !</p>
              <p className="text-gray-500 text-sm">Redirection en cours...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={() => {
              if (step === 'review') {
                resetWizard();
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {step === 'review' ? 'Recommencer' : 'Annuler'}
          </button>

          <div className="flex gap-3">
            {step === 'review' && (
              <button
                onClick={() => generatePlan(documentType)}
                className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
                Régénérer
              </button>
            )}

            {step === 'input' && documentType.trim() && (
              <button
                onClick={() => generatePlan(documentType)}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium transition-colors"
              >
                <Sparkles size={18} />
                Générer le plan
              </button>
            )}

            {step === 'review' && (
              <button
                onClick={createDocument}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                <Check size={18} />
                Créer ce document
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewDocumentWizard;
