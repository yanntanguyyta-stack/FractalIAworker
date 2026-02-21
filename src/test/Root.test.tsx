import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Root from '../components/Root';
import { useAuthStore } from '../authStore';
import { useStore } from '../store';

// Mock crypto.subtle
Object.defineProperty(global, 'crypto', {
  value: { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xab).buffer) } },
  writable: true,
});

// Silence confirm/alert
global.confirm = vi.fn(() => true);
global.alert = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ currentUser: null, users: [] });
  useStore.setState({
    tree: [],
    activeNodeId: null,
    markdown: '',
    aiConfig: { provider: 'gemini', apiKey: '', model: 'gemini-1.5-flash', chatMode: 'discussion' },
    assessmentConfig: { enabled: false, question: '' },
  });
});

describe('Root', () => {
  it('devrait afficher la HomePage quand l\'utilisateur n\'est pas connecté', () => {
    render(<Root />);
    expect(screen.getByText('Commencer gratuitement')).toBeInTheDocument();
  });

  it('devrait afficher l\'application quand l\'utilisateur est connecté', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'test-id',
        email: 'alice@test.com',
        name: 'Alice',
        isAdmin: false,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      },
      users: [],
    });
    render(<Root />);
    // L'App devrait s'afficher (titre Node IA Worker dans le header de l'éditeur)
    expect(screen.getByText(/Node IA Worker/i)).toBeInTheDocument();
  });

  it('devrait ouvrir le modal d\'authentification quand on clique sur Se connecter', async () => {
    render(<Root />);
    const loginButtons = screen.getAllByText('Se connecter');
    loginButtons[0].click();
    // Le modal devrait s'afficher
    const modal = await screen.findByPlaceholderText('votre@email.com');
    expect(modal).toBeInTheDocument();
  });
});
