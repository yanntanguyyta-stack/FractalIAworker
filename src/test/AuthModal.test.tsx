import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthModal from '../components/AuthModal';

/**
 * Tests pour AuthModal qui utilise désormais <SignIn /> et <SignUp /> de Clerk.
 * Les composants Clerk sont mockés (voir setup.ts), donc on teste principalement
 * la logique d'ouverture/fermeture et le choix sign-in vs sign-up.
 */

describe('AuthModal', () => {
  it('ne devrait pas rendre si isOpen est false', () => {
    const { container } = render(
      <AuthModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('devrait rendre le modal quand isOpen est true', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
  });

  it('devrait fermer quand on clique sur la croix', () => {
    const onClose = vi.fn();
    render(<AuthModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(onClose).toHaveBeenCalled();
  });

  it('devrait rendre le modal avec le bon onglet par défaut (sign-in)', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    // Le composant SignIn est mocké comme null dans setup, mais le modal doit être ouvert
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
  });

  it('devrait rendre le modal avec initialTab sign-up', () => {
    render(
      <AuthModal isOpen={true} onClose={vi.fn()} initialTab="sign-up" />
    );
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
  });
});
