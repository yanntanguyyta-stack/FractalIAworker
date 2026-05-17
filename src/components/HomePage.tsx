import React from 'react';
import { Brain, FileText, MessageSquare, Layers, Upload, Shield, ArrowRight, Sparkles } from 'lucide-react';

interface HomePageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const features = [
  {
    icon: <Layers size={22} />,
    title: 'Structure fractale',
    description:
      "Organisez vos documents en hiérarchies multi-niveaux jusqu'à 6 niveaux de profondeur.",
    tint: 'from-sky-500 to-indigo-500',
  },
  {
    icon: <MessageSquare size={22} />,
    title: 'IA intégrée',
    description: 'Discutez avec Gemini ou GPT-4 pour enrichir, corriger ou structurer vos contenus.',
    tint: 'from-indigo-500 to-violet-500',
  },
  {
    icon: <FileText size={22} />,
    title: 'Markdown natif',
    description: 'Éditez en Markdown avec prévisualisation en temps réel et support des diagrammes.',
    tint: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: <Upload size={22} />,
    title: 'Import intelligent',
    description: "Importez vos fichiers PDF, DOCX, TXT et laissez l'IA analyser leur structure.",
    tint: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: <Shield size={22} />,
    title: 'Votre clé API',
    description:
      'Utilisez votre propre clé Gemini ou OpenAI. Aucune donnée ne transite par nos serveurs.',
    tint: 'from-emerald-500 to-teal-500',
  },
  {
    icon: <Brain size={22} />,
    title: 'Local-first',
    description:
      'Vos documents sont sauvegardés dans votre navigateur. Pas de serveur, pas de fuite.',
    tint: 'from-amber-500 to-orange-500',
  },
];

const HomePage: React.FC<HomePageProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-3 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl accent-gradient flex items-center justify-center shadow-glow-accent-lg">
            <span className="text-white font-bold text-lg tracking-tight">F</span>
          </div>
          <div>
            <h1 className="text-base font-bold accent-text-gradient leading-tight tracking-tight">FractalIA</h1>
            <p className="text-[10px] text-slate-500 -mt-0.5">Markdown · IA contextuelle</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onLogin} className="btn-secondary">
            Se connecter
          </button>
          <button onClick={onRegister} className="btn-primary">
            Créer un compte
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 glass-strong rounded-full px-3 py-1 text-xs font-medium text-accent-700 mb-6 animate-fade-in-down">
          <Sparkles size={12} className="text-accent-500" />
          <span>Éditeur Markdown fractal avec IA intégrée</span>
        </div>
        <h2 className="text-4xl sm:text-6xl font-extrabold mb-6 leading-[1.05] tracking-tight text-slate-900 animate-fade-in-up">
          Structurez vos idées{' '}
          <span className="accent-text-gradient">
            avec l'intelligence
          </span>
        </h2>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl leading-relaxed animate-fade-in-up">
          FractalIA est un éditeur de documents hiérarchique qui combine la puissance du Markdown
          avec des assistants IA (Gemini, OpenAI) pour vous aider à créer, structurer et enrichir
          vos contenus.
        </p>
        <div className="flex gap-3 flex-wrap justify-center animate-fade-in-up">
          <button
            onClick={onRegister}
            className="btn-primary text-base px-7 py-3 shadow-glow-accent-lg"
          >
            Commencer gratuitement
            <ArrowRight size={16} />
          </button>
          <button
            onClick={onLogin}
            className="btn-secondary text-base px-7 py-3"
          >
            Se connecter
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-7xl mx-auto w-full">
        <h3 className="text-3xl font-bold text-center mb-2 text-slate-900 tracking-tight">Tout ce dont vous avez besoin</h3>
        <p className="text-center text-slate-500 mb-12">Un éditeur conçu pour la pensée structurée</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="glass-card p-6 hover:shadow-glass-lg hover:scale-[1.02] transition-all duration-300 ease-spring"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.tint} flex items-center justify-center text-white shadow-soft mb-4`}>
                {feature.icon}
              </div>
              <h4 className="text-base font-semibold mb-1.5 text-slate-900 tracking-tight">{feature.title}</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-slate-500 text-xs">
        FractalIA · {new Date().getFullYear()} · Architecture local-first
      </footer>
    </div>
  );
};

export default HomePage;
