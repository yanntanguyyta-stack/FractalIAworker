import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../components/App';
import { useStore } from '../store';

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock confirm et alert
global.confirm = vi.fn(() => true);
global.alert = vi.fn();

// Mock localStorage pour désactiver l'onboarding
const localStorageMock = {
  getItem: vi.fn((key: string) => key === 'fractalia_onboarding_completed' ? 'true' : null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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

describe('App', () => {
  it('devrait rendre l\'application avec le titre', () => {
    render(<App />);

    expect(screen.getByText(/FractalIA/i)).toBeInTheDocument();
  });

  it('devrait charger les données initiales au montage', async () => {
    render(<App />);
    
    // Après le montage, le store devrait avoir des données
    await waitFor(() => {
      expect(useStore.getState().tree.length).toBeGreaterThan(0);
    });
  });

  it('devrait afficher le bouton Nouveau', () => {
    render(<App />);
    
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
  });

  it('devrait afficher le bouton Importer', () => {
    render(<App />);
    
    expect(screen.getByText('Importer')).toBeInTheDocument();
  });

  it('devrait afficher le bouton Exporter', () => {
    render(<App />);
    
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('devrait afficher le bouton Paramètres', () => {
    render(<App />);
    
    // Le bouton paramètres a le titre "Configuration IA"
    const settingsButton = screen.getByTitle(/Configuration IA/i);
    expect(settingsButton).toBeInTheDocument();
  });

  it('devrait ouvrir le modal des paramètres', async () => {
    render(<App />);
    
    const settingsButton = screen.getByTitle(/Configuration IA/i);
    fireEvent.click(settingsButton);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configuration IA' })).toBeInTheDocument();
    });
  });

  it('devrait ouvrir le wizard de nouveau document', async () => {
    render(<App />);
    
    const newButton = screen.getByText('Nouveau');
    fireEvent.click(newButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Créer un nouveau document/i)).toBeInTheDocument();
    });
  });

  it('devrait réinitialiser avec les données par défaut', async () => {
    render(<App />);
    
    const resetButton = screen.getByTitle(/Réinitialiser/i);
    fireEvent.click(resetButton);
    
    expect(global.confirm).toHaveBeenCalled();
  });

  it('devrait appliquer les classes CSS personnalisées', () => {
    const { container } = render(<App className="custom-class" />);
    
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('devrait rendre le Sidebar', () => {
    render(<App />);
    
    // Le sidebar contient l'icône FolderTree et le texte "Structure"
    expect(screen.getByText('Structure')).toBeInTheDocument();
  });

  it('devrait rendre le ChatPane', async () => {
    render(<App />);
    
    await waitFor(() => {
      // Le ChatPane contient "Assistant IA"
      expect(screen.getByText(/Assistant IA/i)).toBeInTheDocument();
    });
  });

  it('devrait permettre le redimensionnement des panneaux', () => {
    render(<App />);
    
    // Les séparateurs de redimensionnement sont présents
    const resizers = document.querySelectorAll('[class*="cursor-col-resize"]');
    expect(resizers.length).toBeGreaterThan(0);
  });
});

describe('App - Gestion des fichiers', () => {
  it('devrait télécharger le markdown', async () => {
    render(<App />);
    
    // Charger du contenu d'abord
    await waitFor(() => {
      expect(useStore.getState().tree.length).toBeGreaterThan(0);
    });
    
    // Ouvrir le menu Exporter
    const exportButton = screen.getByText('Exporter');
    fireEvent.click(exportButton);
    
    // Cliquer sur Markdown dans le dropdown export
    const markdownExportButton = await screen.findByRole('button', { name: /^Markdown$/i });
    
    // Mock createElement pour capturer le téléchargement
    const mockClick = vi.fn();
    const mockRemove = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        element.click = mockClick;
      }
      return element;
    });
    
    fireEvent.click(markdownExportButton);
    
    expect(mockClick).toHaveBeenCalled();
  });

  it('devrait gérer le chargement de fichier', async () => {
    render(<App />);
    
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    
    // Simuler un fichier avec une méthode text() qui retourne une promesse
    const mockText = vi.fn().mockResolvedValue('# Nouveau Contenu\n\nTexte du fichier');
    const file = {
      text: mockText,
      name: 'test.md',
      type: 'text/markdown',
    } as unknown as File;
    
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: true,
      });
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        // La fonction text() devrait être appelée
        expect(mockText).toHaveBeenCalled();
      }, { timeout: 3000 });
      
      await waitFor(() => {
        // Le contenu devrait être chargé
        const tree = useStore.getState().tree;
        expect(tree.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    }
  });

  it('devrait afficher une erreur lors d\'un fichier invalide', async () => {
    render(<App />);
    
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    
    // Simuler un fichier qui génère une erreur
    const mockText = vi.fn().mockRejectedValue(new Error('Erreur de lecture'));
    const file = {
      text: mockText,
      name: 'error.md',
    } as unknown as File;
    
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
      });
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Erreur'));
      }, { timeout: 3000 });
    }
  });

  it('devrait ouvrir le wizard d\'import quand on clique sur Importer', async () => {
    render(<App />);
    
    // Cliquer sur le bouton Importer
    const loadButton = screen.getByTitle(/Importer un fichier/i);
    fireEvent.click(loadButton);
    
    // Le wizard d'import devrait s'ouvrir
    await waitFor(() => {
      expect(screen.getByText('Import de document')).toBeInTheDocument();
    });
  });
});

describe('App - Redimensionnement', () => {
  it('devrait gérer le redimensionnement du sidebar', async () => {
    render(<App />);
    
    // Trouver le séparateur
    const resizers = document.querySelectorAll('[class*="cursor-col-resize"]');
    expect(resizers.length).toBeGreaterThan(0);
    
    // Simuler le drag du premier séparateur (sidebar)
    const sidebarResizer = resizers[0];
    fireEvent.mouseDown(sidebarResizer);
    
    // Simuler le mouvement de souris
    fireEvent.mouseMove(document, { clientX: 300 });
    fireEvent.mouseUp(document);
    
    // Le test vérifie que le redimensionnement ne plante pas
    expect(sidebarResizer).toBeInTheDocument();
  });

  it('devrait gérer le redimensionnement de l\'éditeur', async () => {
    render(<App />);
    
    const resizers = document.querySelectorAll('[class*="cursor-col-resize"]');
    expect(resizers.length).toBeGreaterThan(1);
    
    // Le deuxième séparateur est pour l'éditeur
    const editorResizer = resizers[1];
    fireEvent.mouseDown(editorResizer);
    fireEvent.mouseMove(document, { clientX: 500 });
    fireEvent.mouseUp(document);
    
    expect(editorResizer).toBeInTheDocument();
  });
});

describe('App - Intégration ChatPane', () => {
  it('devrait ouvrir les paramètres depuis le ChatPane', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(useStore.getState().tree.length).toBeGreaterThan(0);
    });
    
    // Sélectionner un nœud pour afficher le chat
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    // Chercher le bouton paramètres dans le ChatPane (icône Settings dans header)
    const settingsButtons = screen.getAllByTitle(/Configuration IA/i);
    if (settingsButtons.length > 1) {
      // Le premier est dans la barre du haut, le second dans ChatPane
      fireEvent.click(settingsButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Configuration IA' })).toBeInTheDocument();
      });
    }
  });

  it('devrait afficher le footer avec les informations', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(useStore.getState().tree.length).toBeGreaterThan(0);
    });
    
    // Vérifier que le footer est présent (le footer contient "v2.0" et "Local-first")
    expect(screen.getByText(/v2\.0 · Local-first/i)).toBeInTheDocument();
    expect(screen.getByText(/Sauvegarde auto/i)).toBeInTheDocument();
  });

  it('devrait afficher l\'input file hidden', () => {
    render(<App />);
    
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass('hidden');
    expect(fileInput?.getAttribute('accept')).toBe('.md,.markdown,.txt,.pdf,.docx');
  });

  it('devrait fermer le modal des paramètres', async () => {
    render(<App />);
    
    // Ouvrir le modal
    const settingsButton = screen.getByTitle(/Configuration IA/i);
    fireEvent.click(settingsButton);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configuration IA' })).toBeInTheDocument();
    });
    
    // Fermer le modal
    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Configuration IA' })).not.toBeInTheDocument();
    });
  });

  it('devrait fermer le wizard nouveau document', async () => {
    render(<App />);
    
    // Ouvrir le wizard
    const newButton = screen.getByText('Nouveau');
    fireEvent.click(newButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Créer un nouveau document/i)).toBeInTheDocument();
    });
    
    // Fermer le wizard en cliquant sur Annuler
    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByText(/Créer un nouveau document/i)).not.toBeInTheDocument();
    });
  });

  it('devrait afficher tous les éléments du header', () => {
    render(<App />);

    // Vérifier les boutons du header (Réinitialiser est désormais icon-only)
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getByText('Importer')).toBeInTheDocument();
    expect(screen.getByText('Exporter')).toBeInTheDocument();
    expect(screen.getByTitle('Réinitialiser')).toBeInTheDocument();
  });
});
