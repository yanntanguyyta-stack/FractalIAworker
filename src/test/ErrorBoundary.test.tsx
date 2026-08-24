import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../components/ErrorBoundary';

const ProblemChild = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Erreur de test simulée');
  }
  return <div>Contenu normal</div>;
};

describe('ErrorBoundary', () => {
  it('devrait afficher les enfants s\'il n\'y a pas d\'erreur', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Contenu normal')).toBeInTheDocument();
  });

  it('devrait intercepter l\'erreur et afficher l\'interface de secours', () => {
    // Désactiver la sortie de console d'erreur pour ce test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Un problème est survenu dans cet affichage')).toBeInTheDocument();
    expect(screen.getByText('Erreur de test simulée')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('devrait réinitialiser l\'état au clic sur le bouton réinstaller', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Un problème est survenu dans cet affichage')).toBeInTheDocument();

    // Rerender sans l'erreur
    rerender(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    const retryBtn = screen.getByRole('button', { name: /Réessayer/i });
    fireEvent.click(retryBtn);

    expect(screen.getByText('Contenu normal')).toBeInTheDocument();

    spy.mockRestore();
  });
});
