import React from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import App from './App';
import HomePage from './HomePage';
import AuthModal from './AuthModal';

const Root: React.FC = () => {
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

  return (
    <>
      {/* Utilisateur connecté → application */}
      <SignedIn>
        <App />
      </SignedIn>

      {/* Utilisateur non connecté → page d'accueil + modal auth */}
      <SignedOut>
        <HomePage onLogin={openLogin} onRegister={openRegister} />
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialTab={authTab}
        />
      </SignedOut>
    </>
  );
};

export default Root;
