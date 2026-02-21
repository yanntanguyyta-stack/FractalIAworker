import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewDocumentWizard from '../components/NewDocumentWizard';
import { useStore } from '../store';

// Mock des APIs
global.fetch = vi.fn();

// Reset le store avant chaque test
beforeEach(() => {
  vi.clearAllMocks();
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

describe('NewDocumentWizard', () => {
  it('ne devrait pas rendre le wizard quand isOpen est false', () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={false} onClose={onClose} />);
    
    expect(screen.queryByText(/Créer un nouveau document/i)).not.toBeInTheDocument();
  });

  it('devrait rendre le wizard quand isOpen est true', () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    expect(screen.getByText(/Créer un nouveau document/i)).toBeInTheDocument();
  });

  it('devrait afficher les suggestions de types de documents', () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    expect(screen.getByText('Plan de projet')).toBeInTheDocument();
    expect(screen.getByText('Business Plan')).toBeInTheDocument();
    expect(screen.getByText('Documentation technique')).toBeInTheDocument();
  });

  it('devrait permettre la saisie d\'un type personnalisé', () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    // Le placeholder complet contient "Décrivez le document que vous voulez créer..."
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Mon document personnalisé' } });
    
    expect(input).toHaveValue('Mon document personnalisé');
  });

  it('devrait sélectionner un type suggéré quand on clique dessus', () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const suggestion = screen.getByText('Plan de projet');
    fireEvent.click(suggestion);
    
    // Le texte devrait être mis dans le champ avec le prompt complet
    const input = screen.getByPlaceholderText(/Décrivez le document/i) as HTMLTextAreaElement;
    expect(input.value).toContain('projet');
  });

  it('devrait afficher une erreur si pas de clé API', async () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test document' } });
    
    const generateButton = screen.getByText(/Générer le plan/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Clé API non configurée/i)).toBeInTheDocument();
    });
  });

  it('devrait appeler l\'API pour générer un plan', async () => {
    const mockPlan = {
      title: 'Mon Projet',
      description: 'Description du projet',
      sections: [
        { title: 'Section 1', description: 'Desc 1', role: 'Expert' },
        { title: 'Section 2', description: 'Desc 2', role: 'Analyste' },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
      }),
    });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test document' } });
    
    const generateButton = screen.getByText(/Générer le plan/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Mon Projet')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('devrait créer le document après validation du plan', async () => {
    const mockPlan = {
      title: 'Projet Test',
      description: 'Description',
      sections: [
        { title: 'Section', description: 'Desc', role: 'Expert' },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
      }),
    });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    const generateButton = screen.getByText(/Générer le plan/i);
    fireEvent.click(generateButton);
    
    // Attendre que le plan soit affiché
    await waitFor(() => {
      expect(screen.getByText('Projet Test')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Cliquer sur créer
    const createButton = screen.getByText(/Créer ce document/i);
    fireEvent.click(createButton);
    
    // Le document devrait être chargé
    await waitFor(() => {
      expect(useStore.getState().tree.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('devrait permettre de régénérer le plan', async () => {
    const mockPlan = {
      title: 'Plan 1',
      description: 'Desc',
      sections: [{ title: 'S1', description: 'D1', role: 'R1' }],
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ ...mockPlan, title: 'Plan 2' }) }] } }],
        }),
      });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    // Première génération
    const generateButton = screen.getByText(/Générer le plan/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Plan 1')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Régénérer
    const regenerateButton = screen.getByText(/Régénérer/i);
    fireEvent.click(regenerateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Plan 2')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('devrait appeler onClose quand on clique sur Annuler', () => {
    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('devrait gérer les erreurs d\'API gracieusement', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Erreur réseau'));

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    const generateButton = screen.getByText(/Générer le plan/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Erreur/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('devrait permettre de recommencer après avoir vu le plan', async () => {
    const mockPlan = {
      title: 'Mon Projet',
      description: 'Description',
      sections: [{ title: 'Section', description: 'Desc', role: 'Expert' }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
      }),
    });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    const generateButton = screen.getByText(/Générer le plan/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Mon Projet')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // En mode review, le bouton devrait être "Recommencer"
    const restartButton = screen.getByText('Recommencer');
    fireEvent.click(restartButton);
    
    // Devrait revenir à l'étape input
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Décrivez le document/i)).toBeInTheDocument();
    });
  });

  it('devrait afficher le message de succès après création', async () => {
    const mockPlan = {
      title: 'Projet Succès',
      description: 'Desc',
      sections: [{ title: 'S', description: 'D', role: 'R' }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
      }),
    });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    fireEvent.click(screen.getByText(/Générer le plan/i));
    
    await waitFor(() => {
      expect(screen.getByText('Projet Succès')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    fireEvent.click(screen.getByText(/Créer ce document/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Document créé avec succès/i)).toBeInTheDocument();
    });

    // Attendre que le timeout se déclenche et appelle onClose
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('devrait nettoyer le JSON avec ```json au début', async () => {
    const mockPlan = {
      title: 'Plan Clean',
      description: 'Desc',
      sections: [{ title: 'S', description: 'D', role: 'R' }],
    };

    // Simuler une réponse avec ```json au début
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(mockPlan) + '\n```' }] } }],
      }),
    });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    fireEvent.click(screen.getByText(/Générer le plan/i));
    
    await waitFor(() => {
      expect(screen.getByText('Plan Clean')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('devrait nettoyer le JSON avec ``` simple au début', async () => {
    const mockPlan = {
      title: 'Plan Simple',
      description: 'Desc',
      sections: [{ title: 'S', description: 'D', role: 'R' }],
    };

    // Simuler une réponse avec ``` simple au début
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: '```\n' + JSON.stringify(mockPlan) + '\n```' }] } }],
      }),
    });

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });

    const onClose = vi.fn();
    render(<NewDocumentWizard isOpen={true} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/Décrivez le document/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    
    fireEvent.click(screen.getByText(/Générer le plan/i));
    
    await waitFor(() => {
      expect(screen.getByText('Plan Simple')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
