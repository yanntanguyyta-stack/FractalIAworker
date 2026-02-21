import React from 'react';
import { Brain, FileText, MessageSquare, Layers, Upload, Shield } from 'lucide-react';

interface HomePageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const features = [
  {
    icon: <Layers size={28} />,
    title: 'Structure fractale',
    description:
      "Organisez vos documents en hiérarchies multi-niveaux jusqu'à 6 niveaux de profondeur.",
  },
  {
    icon: <MessageSquare size={28} />,
    title: 'IA intégrée',
    description: 'Discutez avec Gemini ou GPT-4 pour enrichir, corriger ou structurer vos contenus.',
  },
  {
    icon: <FileText size={28} />,
    title: 'Markdown natif',
    description: 'Éditez en Markdown avec prévisualisation en temps réel et support des diagrammes.',
  },
  {
    icon: <Upload size={28} />,
    title: 'Import intelligent',
    description: "Importez vos fichiers PDF, DOCX, TXT et laissez l'IA analyser leur structure.",
  },
  {
    icon: <Shield size={28} />,
    title: 'Votre clé API',
    description:
      'Utilisez votre propre clé Gemini ou OpenAI. Aucune donnée ne transite par nos serveurs.',
  },
  {
    icon: <Brain size={28} />,
    title: 'Local-First',
    description:
      'Vos documents sont sauvegardés dans votre navigateur. Pas de serveur, pas de fuite.',
  },
];

const HomePage: React.FC<HomePageProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Brain size={32} className="text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Node IA Worker</h1>
            <p className="text-xs text-indigo-300">Fractalia — Local-First Markdown</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onLogin}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors text-sm"
          >
            Se connecter
          </button>
          <button
            onClick={onRegister}
            className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-xl font-medium transition-colors text-sm"
          >
            Créer un compte
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-6">
          <span>✨</span>
          <span>Éditeur Markdown fractal avec IA intégrée</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold mb-6 leading-tight">
          Structurez vos idées{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            avec l'intelligence artificielle
          </span>
        </h2>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl">
          Node IA Worker est un éditeur de documents fractal qui combine la puissance du Markdown
          avec des assistants IA (Gemini, OpenAI) pour vous aider à créer, structurer et enrichir
          vos contenus.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <button
            onClick={onRegister}
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-indigo-500/25"
          >
            Commencer gratuitement
          </button>
          <button
            onClick={onLogin}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-lg transition-colors"
          >
            Se connecter
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-7xl mx-auto w-full">
        <h3 className="text-3xl font-bold text-center mb-12">Tout ce dont vous avez besoin</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
            >
              <div className="text-indigo-400 mb-4">{feature.icon}</div>
              <h4 className="text-lg font-semibold mb-2">{feature.title}</h4>
              <p className="text-slate-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-white/10 text-center text-slate-500 text-sm">
        Node IA Worker — Fractalia &bull; {new Date().getFullYear()} &bull; Local-First Architecture
      </footer>
    </div>
  );
};

export default HomePage;
