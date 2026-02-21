import React, { useState } from 'react';
import { useAuthStore } from '../authStore';
import App from './App';
import HomePage from './HomePage';
import AuthModal from './AuthModal';

const Root: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  const openLogin = () => {
    setAuthTab('login');
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthTab('register');
    setAuthOpen(true);
  };

  if (!currentUser) {
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
  }

  return <App />;
};

export default Root;
