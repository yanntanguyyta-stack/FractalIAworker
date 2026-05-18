import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../components/HomePage';

describe('HomePage', () => {
  it('devrait afficher le titre principal', () => {
    render(<HomePage onLogin={vi.fn()} onRegister={vi.fn()} />);
    expect(screen.getByText('FractalIAworker')).toBeInTheDocument();
  });

  it('devrait afficher les boutons Se connecter et Créer un compte', () => {
    render(<HomePage onLogin={vi.fn()} onRegister={vi.fn()} />);
    // Multiple instances — at least one of each
    expect(screen.getAllByText('Se connecter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Créer un compte').length).toBeGreaterThan(0);
  });

  it('devrait appeler onLogin quand on clique sur "Se connecter"', () => {
    const onLogin = vi.fn();
    render(<HomePage onLogin={onLogin} onRegister={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Se connecter')[0]);
    expect(onLogin).toHaveBeenCalled();
  });

  it('devrait appeler onRegister quand on clique sur "Créer un compte"', () => {
    const onRegister = vi.fn();
    render(<HomePage onLogin={vi.fn()} onRegister={onRegister} />);
    fireEvent.click(screen.getAllByText('Créer un compte')[0]);
    expect(onRegister).toHaveBeenCalled();
  });

  it('devrait appeler onRegister quand on clique sur "Commencer gratuitement"', () => {
    const onRegister = vi.fn();
    render(<HomePage onLogin={vi.fn()} onRegister={onRegister} />);
    fireEvent.click(screen.getByText('Commencer gratuitement'));
    expect(onRegister).toHaveBeenCalled();
  });

  it('devrait afficher les 6 fonctionnalités', () => {
    render(<HomePage onLogin={vi.fn()} onRegister={vi.fn()} />);
    expect(screen.getByText('Structure fractale')).toBeInTheDocument();
    expect(screen.getByText('IA intégrée')).toBeInTheDocument();
    expect(screen.getByText('Markdown natif')).toBeInTheDocument();
    expect(screen.getByText('Import intelligent')).toBeInTheDocument();
    expect(screen.getByText('Votre clé API')).toBeInTheDocument();
    expect(screen.getByText('Local-first')).toBeInTheDocument();
  });

  it('devrait afficher le footer', () => {
    render(<HomePage onLogin={vi.fn()} onRegister={vi.fn()} />);
    expect(screen.getByText(/Architecture local-first/i)).toBeInTheDocument();
  });
});
