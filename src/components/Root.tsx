import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import App from './App';
import HomePage from './HomePage';
import AuthModal from './AuthModal';

const Root: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<'sign-in' | 'sign-up'>('sign-in');

  const openLogin = () => {
    setAuthTab('sign-in');
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthTab('sign-up');
    setAuthOpen(true);
  };

  // Attendre que Clerk soit initialisé avant d'afficher quoi que ce soit
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-indigo-300 text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  // Utilisateur connecté → application de travail
  if (isSignedIn) {
    return <App />;
  }

  // Utilisateur non connecté → page d'accueil + modal d'authentification
  return (
    <>
      <HomePage onLogin={openLogin} onRegister={openRegister} />
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialTab={authTab}
      />
    </>
  );
};

export default Root;
