import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsModal from '../components/SettingsModal';
import { useStore } from '../store';

// Reset le store avant chaque test
beforeEach(() => {
  useStore.setState({
    tree: [],
    activeNodeId: null,
    markdown: '',
    aiConfig: {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-1.5-flash',
      chatMode: 'discussion',
    },
    assessmentConfig: {
      enabled: false,
      question: '',
    },
  });
});

describe('SettingsModal', () => {
  it('ne devrait pas rendre le modal quand isOpen est false', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={false} onClose={onClose} />);
    
    expect(screen.queryByText('Configuration IA')).not.toBeInTheDocument();
  });

  it('devrait rendre le modal quand isOpen est true', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    expect(screen.getByText('Configuration IA')).toBeInTheDocument();
  });

  it('devrait afficher les options de provider', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('OpenAI ChatGPT')).toBeInTheDocument();
  });

  it('devrait afficher le champ de saisie de la clé API', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Pour Gemini, le placeholder est "AIza..."
    expect(screen.getByPlaceholderText('AIza...')).toBeInTheDocument();
  });

  it('devrait appeler onClose quand on clique sur le bouton fermer', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Le bouton Annuler ferme le modal
    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('devrait changer le provider quand on sélectionne OpenAI', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    const openaiButton = screen.getByText('OpenAI ChatGPT');
    fireEvent.click(openaiButton);
    
    // Le placeholder devrait changer pour OpenAI
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
  });

  it('devrait sauvegarder la configuration quand on clique sur Enregistrer', async () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Entrer une clé API
    const apiKeyInput = screen.getByPlaceholderText('AIza...');
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    
    // Cliquer sur Enregistrer
    const saveButton = screen.getByText('Enregistrer');
    fireEvent.click(saveButton);
    
    // Vérifier que le store a été mis à jour
    await waitFor(() => {
      expect(useStore.getState().aiConfig.apiKey).toBe('test-api-key');
    });
  });

  it('devrait activer l\'évaluation quand on bascule le switch', async () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Trouver le bouton bascule (toggle)
    const toggleButton = screen.getByRole('button', { pressed: false });
    fireEvent.click(toggleButton);
    
    // Le champ de question devrait être activé
    const questionInput = screen.getByPlaceholderText(/Est-ce que le projet est viable/i);
    expect(questionInput).not.toBeDisabled();
  });

  it('devrait permettre de changer le modèle via le select', async () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Trouver le select des modèles
    const modelSelect = screen.getByRole('combobox');
    fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });
    
    // Entrer une clé API et sauvegarder
    const apiKeyInput = screen.getByPlaceholderText('AIza...');
    fireEvent.change(apiKeyInput, { target: { value: 'key' } });
    
    const saveButton = screen.getByText('Enregistrer');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useStore.getState().aiConfig.model).toBe('gemini-3-pro-preview');
    });
  });

  it('devrait fermer le modal automatiquement après sauvegarde', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Entrer une clé API
    const apiKeyInput = screen.getByPlaceholderText('AIza...');
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });
    
    // Sauvegarder
    const saveButton = screen.getByText('Enregistrer');
    fireEvent.click(saveButton);
    
    // Attendre le timeout
    vi.advanceTimersByTime(1100);
    
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('devrait fermer le modal avec le bouton X', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Le bouton X est dans le header du modal
    const xButton = document.querySelector('.lucide-x')?.closest('button');
    
    if (xButton) {
      fireEvent.click(xButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('devrait désactiver le champ question quand l\'évaluation est désactivée', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Par défaut, l'évaluation est désactivée
    const questionInput = screen.getByPlaceholderText(/Est-ce que le projet est viable/i);
    expect(questionInput).toBeDisabled();
  });

  it('devrait sauvegarder la configuration d\'évaluation', async () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Activer l'évaluation
    const toggleButtons = screen.getAllByRole('button');
    const toggleButton = toggleButtons.find(btn => 
      btn.getAttribute('aria-pressed') !== null
    );
    
    if (toggleButton) {
      fireEvent.click(toggleButton);
    }
    
    // Entrer une question
    const questionInput = screen.getByPlaceholderText(/Est-ce que le projet est viable/i);
    fireEvent.change(questionInput, { target: { value: 'Ma question personnalisée' } });
    
    // Sauvegarder
    const apiKeyInput = screen.getByPlaceholderText('AIza...');
    fireEvent.change(apiKeyInput, { target: { value: 'key' } });
    
    const saveButton = screen.getByText('Enregistrer');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(useStore.getState().assessmentConfig.question).toBe('Ma question personnalisée');
    });
  });

  it('devrait changer de provider de OpenAI vers Gemini', async () => {
    // Mettre le provider en openai
    useStore.setState({
      aiConfig: {
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);
    
    // Cliquer sur Google Gemini
    const geminiButton = screen.getByText('Google Gemini');
    fireEvent.click(geminiButton);
    
    // Sauvegarder
    const apiKeyInput = screen.getByPlaceholderText('AIza...');
    fireEvent.change(apiKeyInput, { target: { value: 'AIzaNewKey' } });
    
    const saveButton = screen.getByText('Enregistrer');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(useStore.getState().aiConfig.provider).toBe('gemini');
    });
  });
});
