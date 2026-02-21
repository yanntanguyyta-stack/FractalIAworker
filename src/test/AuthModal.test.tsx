import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthModal from '../components/AuthModal';
import { useAuthStore } from '../authStore';

// Mock crypto.subtle for hashing
const mockDigest = vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
Object.defineProperty(global, 'crypto', {
  value: { subtle: { digest: mockDigest } },
  writable: true,
});

beforeEach(() => {
  useAuthStore.setState({ currentUser: null, users: [] });
  vi.clearAllMocks();
  mockDigest.mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
});

describe('AuthModal', () => {
  it('ne devrait pas rendre si isOpen est false', () => {
    const { container } = render(
      <AuthModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('devrait afficher le modal de connexion par défaut', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    // Multiple "Se connecter" in title + button: use role queries
    expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Votre mot de passe')).toBeInTheDocument();
  });

  it('devrait afficher le modal d\'inscription si initialTab=register', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} initialTab="register" />);
    expect(screen.getByPlaceholderText('Votre nom')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Au moins 6 caractères')).toBeInTheDocument();
  });

  it('devrait basculer vers l\'inscription', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Inscription'));
    expect(screen.getByPlaceholderText('Votre nom')).toBeInTheDocument();
  });

  it('devrait basculer vers la connexion depuis l\'inscription', () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} initialTab="register" />);
    fireEvent.click(screen.getByText('Connexion'));
    expect(screen.queryByPlaceholderText('Votre nom')).not.toBeInTheDocument();
  });

  it('devrait fermer quand on clique sur la croix', () => {
    const onClose = vi.fn();
    render(<AuthModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(onClose).toHaveBeenCalled();
  });

  it('devrait inscrire un utilisateur et appeler onClose', async () => {
    const onClose = vi.fn();
    render(<AuthModal isOpen={true} onClose={onClose} initialTab="register" />);

    fireEvent.change(screen.getByPlaceholderText('Votre nom'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Au moins 6 caractères'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('devrait afficher une erreur si l\'email est invalide', async () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} initialTab="register" />);

    // Fill name and password but provide an invalid email
    fireEvent.change(screen.getByPlaceholderText('Votre nom'), {
      target: { value: 'Alice' },
    });
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByPlaceholderText('Au moins 6 caractères'), {
      target: { value: 'password123' },
    });

    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByText(/email/i)).toBeInTheDocument();
    });
  });

  it('devrait afficher une erreur si l\'email est déjà utilisé', async () => {
    // Register first user
    await useAuthStore.getState().register('taken@example.com', 'Alice', 'password123');
    useAuthStore.setState(state => ({ ...state, currentUser: null }));

    const onClose = vi.fn();
    render(<AuthModal isOpen={true} onClose={onClose} initialTab="register" />);

    fireEvent.change(screen.getByPlaceholderText('Votre nom'), {
      target: { value: 'Bob' },
    });
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Au moins 6 caractères'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByText('Créer mon compte'));

    await waitFor(() => {
      expect(screen.getByText(/déjà utilisé/i)).toBeInTheDocument();
    });
  });
});
