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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-white/80 hover:bg-white rounded-full shadow transition-colors"
          aria-label="Fermer"
        >
          <X size={18} className="text-gray-600" />
        </button>

        {/* Composants Clerk pré-construits */}
        <div className="flex items-center justify-center p-6">
          {initialTab === 'sign-up' ? (
            <SignUp
              routing="hash"
              signInUrl="#sign-in"
              appearance={{
                variables: { colorPrimary: '#4F46E5' },
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none w-full',
                },
              }}
            />
          ) : (
            <SignIn
              routing="hash"
              signUpUrl="#sign-up"
              appearance={{
                variables: { colorPrimary: '#4F46E5' },
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none w-full',
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
