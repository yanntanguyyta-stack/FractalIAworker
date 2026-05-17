import React from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'sign-in' | 'sign-up';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'sign-in' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="relative glass-card w-full max-w-md overflow-hidden animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 icon-btn"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center p-6">
          {initialTab === 'sign-up' ? (
            <SignUp
              routing="hash"
              signInUrl="#sign-in"
              appearance={{
                variables: { colorPrimary: '#6366f1', borderRadius: '0.75rem' },
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none w-full bg-transparent',
                },
              }}
            />
          ) : (
            <SignIn
              routing="hash"
              signUpUrl="#sign-up"
              appearance={{
                variables: { colorPrimary: '#6366f1', borderRadius: '0.75rem' },
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none w-full bg-transparent',
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
