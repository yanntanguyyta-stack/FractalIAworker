import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Root from '../components/Root';
import { useStore } from '../store';

// Silence confirm/alert
global.confirm = vi.fn(() => true);
global.alert = vi.fn();

// Reset state
import { beforeEach } from 'vitest';
beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    tree: [],
    activeNodeId: null,
    markdown: '',
    aiConfig: { provider: 'gemini', apiKey: '', model: 'gemini-1.5-flash', chatMode: 'discussion' },
    assessmentConfig: { enabled: false, question: '' },
  });
});

describe('Root', () => {
  it('devrait rendre sans erreur', () => {
    render(<Root />);
    // Avec les mocks de setup.ts, SignedIn et SignedOut rendent tous deux leurs children
    // Donc on devrait voir du contenu de la HomePage ou de l'App
    expect(document.body).toBeTruthy();
  });

  it('devrait afficher la HomePage (via SignedOut)', () => {
    render(<Root />);
    expect(screen.getByText('Commencer gratuitement')).toBeInTheDocument();
  });

  it('devrait afficher le titre Node IA Worker', () => {
    render(<Root />);
    expect(screen.getAllByText(/Node IA Worker/i).length).toBeGreaterThan(0);
  });
});
