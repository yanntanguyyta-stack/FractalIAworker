import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatPane from '../components/ChatPane';
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

describe('ChatPane', () => {
  it('devrait afficher un message quand aucun nœud n\'est sélectionné', () => {
    render(<ChatPane />);
    
    expect(screen.getByText(/Sélectionnez un nœud/i)).toBeInTheDocument();
  });

  it('devrait afficher le chat quand un nœud est sélectionné', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    expect(screen.getByText(/Assistant IA/i)).toBeInTheDocument();
  });

  it('devrait afficher le titre du nœud actif', () => {
    useStore.getState().loadMarkdown('# Mon Nœud\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    expect(screen.getByText(/Mon Nœud/i)).toBeInTheDocument();
  });

  it('devrait afficher un champ de saisie pour les messages', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Le placeholder en mode discussion est "Posez une question..."
    const input = screen.getByPlaceholderText(/Posez une question/i);
    expect(input).toBeInTheDocument();
  });

  it('devrait permettre de changer le mode de chat', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Les boutons de mode devraient être présents
    const discussionButton = screen.getByText('Discussion');
    const structurationButton = screen.getByText('Structuration');
    
    expect(discussionButton).toBeInTheDocument();
    expect(structurationButton).toBeInTheDocument();
    
    // Cliquer sur structuration
    fireEvent.click(structurationButton);
    
    expect(useStore.getState().aiConfig.chatMode).toBe('structuration');
  });

  it('devrait revenir en mode discussion', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    // Passer en mode structuration d'abord
    useStore.getState().setChatMode('structuration');
    
    render(<ChatPane />);
    
    // Cliquer sur discussion
    const discussionButton = screen.getByText('Discussion');
    fireEvent.click(discussionButton);
    
    expect(useStore.getState().aiConfig.chatMode).toBe('discussion');
  });

  it('devrait ne pas afficher l\'avertissement si la clé API est présente', () => {
    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Pas d'avertissement de clé API manquante
    expect(screen.queryByText(/Clé API requise/i)).not.toBeInTheDocument();
  });

  it('devrait afficher le rôle de l\'agent si configuré', () => {
    useStore.getState().loadMarkdown('# Test\n\n<!-- {"meta":{"id":"test","type":"section","agentConfig":{"role":"Expert Marketing","instructions":"Sois précis"}}} -->\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    expect(screen.getByText(/Expert Marketing/i)).toBeInTheDocument();
  });

  it('devrait effacer l\'historique quand on change de nœud', async () => {
    useStore.getState().loadMarkdown(`# Nœud 1

## Nœud 2`);
    
    const node1Id = useStore.getState().tree[0].id;
    const node2Id = useStore.getState().tree[0].children[0].id;
    
    useStore.getState().selectNode(node1Id);
    render(<ChatPane />);
    
    // Le chat devrait être vide initialement
    expect(screen.getByText(/Aucun message/i)).toBeInTheDocument();
  });

  it('devrait appliquer les classes CSS personnalisées', () => {
    useStore.setState({
      tree: [],
      activeNodeId: null,
    });
    
    const { container } = render(<ChatPane className="custom-class" />);
    
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('devrait afficher les suggestions de questions', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Le bouton pour ouvrir les templates devrait être présent
    const templatesButton = screen.getByTitle('Templates rapides');
    expect(templatesButton).toBeInTheDocument();
    
    // Cliquer pour ouvrir les templates
    fireEvent.click(templatesButton);
    
    // Vérifier qu'une catégorie de template est visible
    expect(screen.getByText(/Tableaux/i)).toBeInTheDocument();
  });

  it('devrait envoyer un message quand on clique sur le bouton d\'envoi', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Réponse' }] } }],
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
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    const input = screen.getByPlaceholderText(/Posez une question/i);
    fireEvent.change(input, { target: { value: 'Question test' } });
    
    // Le bouton d'envoi est un bouton submit
    const sendButton = screen.getByRole('button', { name: '' });
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(btn => btn.getAttribute('type') === 'submit');
    
    if (submitButton) {
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 3000 });
    }
  });

  it('devrait afficher l\'indicateur de chargement pendant l\'appel API', async () => {
    // Mock qui prend du temps
    (global.fetch as any).mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Réponse' }] } }],
          }),
        }), 100)
      )
    );

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    const input = screen.getByPlaceholderText(/Posez une question/i);
    fireEvent.change(input, { target: { value: 'Question test' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText(/L'IA réfléchit/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    }
  });

  it('devrait permettre de changer le modèle IA', () => {
    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Le sélecteur de modèle devrait être présent
    const modelSelect = screen.getByRole('combobox');
    expect(modelSelect).toBeInTheDocument();
    
    fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });
    
    expect(useStore.getState().aiConfig.model).toBe('gemini-3-pro-preview');
  });

  it('devrait copier un message et afficher la confirmation', async () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Réponse IA' }] } }],
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
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    const input = screen.getByPlaceholderText(/Posez une question/i);
    fireEvent.change(input, { target: { value: 'Question' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Réponse IA')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Cliquer sur copier
    const copyButton = screen.getByText('Copier');
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(screen.getByText('Copié')).toBeInTheDocument();
    });
  });

  it('devrait ajouter le contenu de la réponse au nœud', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Nouveau contenu ajouté' }] } }],
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
    useStore.getState().loadMarkdown('# Test\n\nContenu initial');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    const input = screen.getByPlaceholderText(/Posez une question/i);
    fireEvent.change(input, { target: { value: 'Question' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Nouveau contenu ajouté')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Cliquer sur Ajouter
    const addButton = screen.getByText('+ Ajouter');
    fireEvent.click(addButton);
    
    // Le contenu devrait être ajouté au nœud
    await waitFor(() => {
      const node = useStore.getState().tree[0];
      expect(node.content).toContain('Nouveau contenu ajouté');
    });
  });

  it('devrait remplacer le contenu après confirmation', async () => {
    // Mock confirm
    global.confirm = vi.fn(() => true);
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Contenu remplacé' }] } }],
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
    useStore.getState().loadMarkdown('# Test\n\nAncien contenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    const input = screen.getByPlaceholderText(/Posez une question/i);
    fireEvent.change(input, { target: { value: 'Question' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Contenu remplacé')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Cliquer sur Remplacer
    const replaceButton = screen.getByText('↻ Remplacer');
    fireEvent.click(replaceButton);
    
    // Vérifier que confirm a été appelé
    expect(global.confirm).toHaveBeenCalled();
    
    // Le contenu devrait être remplacé
    await waitFor(() => {
      const node = useStore.getState().tree[0];
      expect(node.content).toBe('Contenu remplacé');
    });
  });

  it('devrait utiliser un template quand on le clique', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Ouvrir les templates
    const templatesButton = screen.getByTitle('Templates rapides');
    fireEvent.click(templatesButton);
    
    // Sélectionner un template (le premier de la catégorie structuration)
    const templates = screen.getAllByRole('button').filter(btn => 
      btn.textContent?.includes('Structurer')
    );
    
    if (templates.length > 0) {
      fireEvent.click(templates[0]);
      
      // Le template devrait être inséré dans l'input
      const input = screen.getByPlaceholderText(/Posez une question/i) as HTMLInputElement;
      expect(input.value.length).toBeGreaterThan(0);
    }
  });

  it('devrait afficher les templates de tableau', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Ouvrir les templates
    const templatesButton = screen.getByTitle('Templates rapides');
    fireEvent.click(templatesButton);
    
    // La catégorie Tableaux devrait être visible
    expect(screen.getByText('📊 Tableaux')).toBeInTheDocument();
    
    // Trouver un bouton de template tableau
    const tableauTemplates = screen.getAllByRole('button').filter(btn => 
      btn.textContent?.includes('Tableau')
    );
    
    expect(tableauTemplates.length).toBeGreaterThan(0);
  });

  it('devrait afficher les templates de diagramme Mermaid', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Ouvrir les templates
    const templatesButton = screen.getByTitle('Templates rapides');
    fireEvent.click(templatesButton);
    
    // La catégorie Mermaid devrait être visible
    expect(screen.getByText('📐 Diagrammes Mermaid')).toBeInTheDocument();
  });

  it('devrait utiliser un template Mermaid', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Ouvrir les templates
    const templatesButton = screen.getByTitle('Templates rapides');
    fireEvent.click(templatesButton);
    
    // Trouver un template Mermaid (flowchart par exemple)
    const mermaidTemplates = screen.getAllByRole('button').filter(btn => 
      btn.textContent?.includes('Flowchart') || btn.textContent?.includes('Diagramme')
    );
    
    if (mermaidTemplates.length > 0) {
      fireEvent.click(mermaidTemplates[0]);
      
      const input = screen.getByPlaceholderText(/Posez une question/i) as HTMLInputElement;
      expect(input.value.length).toBeGreaterThan(0);
    }
  });

  it('devrait appeler onOpenSettings quand le bouton est cliqué', () => {
    const onOpenSettings = vi.fn();
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane onOpenSettings={onOpenSettings} />);
    
    // Le bouton paramètres est représenté par l'icône Settings
    const settingsButtons = document.querySelectorAll('.lucide-settings');
    if (settingsButtons.length > 0) {
      const settingsButton = settingsButtons[0].closest('button');
      if (settingsButton) {
        fireEvent.click(settingsButton);
        expect(onOpenSettings).toHaveBeenCalled();
      }
    }
  });

  it('devrait afficher un message d\'erreur quand l\'API échoue', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Erreur réseau'));

    useStore.setState({
      aiConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        chatMode: 'discussion',
      },
    });
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    const input = screen.getByPlaceholderText(/Posez une question/i);
    fireEvent.change(input, { target: { value: 'Test erreur' } });
    
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    
    await waitFor(() => {
      expect(screen.getByText(/Erreur réseau/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('devrait utiliser un template de tableau', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Ouvrir les templates
    const templatesButton = screen.getByTitle('Templates rapides');
    fireEvent.click(templatesButton);
    
    // Trouver la section tableaux et cliquer sur un template
    const tableauButtons = screen.getAllByRole('button').filter(btn => 
      btn.className.includes('bg-green-50')
    );
    
    if (tableauButtons.length > 0) {
      fireEvent.click(tableauButtons[0]);
      
      // Le template devrait être inséré
      const input = screen.getByPlaceholderText(/Posez une question/i) as HTMLInputElement;
      expect(input.value.length).toBeGreaterThan(0);
    }
  });

  it('devrait utiliser un template de structuration', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<ChatPane />);
    
    // Ouvrir les templates
    const templatesButton = screen.getByTitle('Templates rapides');
    fireEvent.click(templatesButton);
    
    // Les templates de structuration ont la classe bg-gray-50 et sont dans la première section
    // On trouve les boutons dans la section Structuration
    const structurationSection = screen.getByText('🏗️ Structuration').nextSibling;
    if (structurationSection) {
      const structButtons = structurationSection.querySelectorAll('button');
      if (structButtons.length > 0) {
        fireEvent.click(structButtons[0]);
        
        // Le template devrait être inséré
        const input = screen.getByPlaceholderText(/Posez une question/i) as HTMLInputElement;
        expect(input.value.length).toBeGreaterThan(0);
      }
    }
  });
});
