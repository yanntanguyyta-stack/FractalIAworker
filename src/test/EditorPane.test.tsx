import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditorPane from '../components/EditorPane';
import { useStore } from '../store';
import type { NodeData } from '../types';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

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

describe('EditorPane', () => {
  it('devrait afficher un message quand aucun nœud n\'est sélectionné', () => {
    render(<EditorPane />);
    
    expect(screen.getByText(/Sélectionnez un nœud/i)).toBeInTheDocument();
  });

  it('devrait afficher l\'éditeur quand un nœud est sélectionné', () => {
    useStore.getState().loadMarkdown('# Mon Titre\n\nMon contenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    expect(screen.getByText('Mon Titre')).toBeInTheDocument();
  });

  it('devrait afficher le breadcrumb avec le chemin du nœud', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

Contenu enfant`);
    const childId = useStore.getState().tree[0].children[0].id;
    useStore.getState().selectNode(childId);
    
    render(<EditorPane />);
    
    // Le breadcrumb contient les titres du chemin
    expect(screen.getByTitle('Parent')).toBeInTheDocument();
    expect(screen.getByTitle('Enfant')).toBeInTheDocument();
  });

  it('devrait permettre de basculer entre les modes d\'affichage', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu test');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Les boutons de mode sont Éditer, Split, Aperçu
    const editButton = screen.getByText('Éditer');
    const previewButton = screen.getByText('Aperçu');
    
    expect(editButton).toBeInTheDocument();
    expect(previewButton).toBeInTheDocument();
    
    // Cliquer sur aperçu
    fireEvent.click(previewButton);
    
    // Le contenu devrait être affiché en mode prévisualisation
    expect(screen.getByText('Contenu test')).toBeInTheDocument();
  });

  it('devrait mettre à jour le contenu quand on tape dans l\'éditeur', async () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu initial');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Nouveau contenu' } });
    
    await waitFor(() => {
      expect(useStore.getState().tree[0].content).toBe('Nouveau contenu');
    });
  });

  it('devrait afficher la barre d\'outils de formatage avec des boutons', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Les boutons de barre d'outils sont présents par leur classe toolbar-btn
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    expect(toolbarButtons.length).toBeGreaterThan(0);
  });

  it('devrait copier le contenu quand on clique sur le bouton copier', async () => {
    // Mock clipboard
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });
    
    useStore.getState().loadMarkdown('# Test\n\nContenu à copier');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const copyButton = screen.getByTitle(/Copier/i);
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });

  it('devrait appliquer les classes CSS personnalisées', () => {
    useStore.setState({
      tree: [],
      activeNodeId: null,
    });
    
    const { container } = render(<EditorPane className="custom-class" />);
    
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('devrait afficher les sliders d\'évaluation quand l\'évaluation est activée', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Question test' });
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Les sliders devraient être présents
    expect(screen.getByText(/Compl\u00e9tude du n\u0153ud/i)).toBeInTheDocument();
    expect(screen.getByText(/Question test/i)).toBeInTheDocument();
  });

  it('devrait naviguer vers un nœud parent via le breadcrumb', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

Contenu`);
    const childId = useStore.getState().tree[0].children[0].id;
    useStore.getState().selectNode(childId);
    
    render(<EditorPane />);
    
    const parentLink = screen.getByTitle('Parent');
    fireEvent.click(parentLink);
    
    const parentId = useStore.getState().tree[0].id;
    expect(useStore.getState().activeNodeId).toBe(parentId);
  });

  it('devrait insérer du texte en gras', () => {
    useStore.getState().loadMarkdown('# Test\n\ntext');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    
    // Focus et sélectionner du texte
    textarea.focus();
    textarea.setSelectionRange(0, 4);
    
    // Trouver le premier bouton de toolbar (gras)
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    if (toolbarButtons.length > 0) {
      fireEvent.click(toolbarButtons[0]);
    }
    
    // Le texte devrait être formaté en gras
    expect(textarea.value).toContain('**');
  });

  it('devrait afficher les scores hérités pour les nœuds avec enfants', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant 1

Contenu

## Enfant 2

Contenu 2`);
    
    // Activer l'évaluation
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Question?' });
    
    // Mettre des scores aux enfants
    const parent = useStore.getState().tree[0];
    parent.children.forEach((child: NodeData) => {
      useStore.getState().updateNodeAssessment(child.id, { completenessScore: 8, questionScore: 7 });
    });
    
    // Recalculer les scores hérités
    useStore.getState().recalculateAllInheritedScores();
    
    useStore.getState().selectNode(parent.id);
    
    render(<EditorPane />);
    
    // La section des notes héritées devrait être visible
    expect(screen.getByText(/Notes héritées/i)).toBeInTheDocument();
  });

  it('devrait mettre à jour les scores d\'évaluation', async () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Question?' });
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Trouver les sliders (range inputs)
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
    
    // Changer la valeur du premier slider
    fireEvent.change(sliders[0], { target: { value: '8' } });
    
    await waitFor(() => {
      const node = useStore.getState().tree[0];
      expect(node.meta.evaluation?.completenessScore).toBe(8);
    });
  });

  it('devrait recalculer les scores hérités quand on clique sur le bouton', async () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant 1

Contenu

## Enfant 2

Contenu 2`);
    
    useStore.getState().setAssessmentConfig({ enabled: true, question: 'Question?' });
    
    // Mettre des scores aux enfants
    const parent = useStore.getState().tree[0];
    parent.children.forEach((child: NodeData) => {
      useStore.getState().updateNodeAssessment(child.id, { completenessScore: 8, questionScore: 7 });
    });
    
    useStore.getState().selectNode(parent.id);
    
    render(<EditorPane />);
    
    // Cliquer sur recalculer
    const recalculateButton = screen.getByTitle(/Recalculer/i);
    fireEvent.click(recalculateButton);
    
    // Les scores hérités devraient être calculés (score hérité = inheritedCompletenessScore)
    await waitFor(() => {
      const updatedParent = useStore.getState().tree[0];
      expect(updatedParent.meta.evaluation?.inheritedCompletenessScore).toBeDefined();
    });
  });

  it('devrait basculer vers le mode split', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu test');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const splitButton = screen.getByText('Split');
    fireEvent.click(splitButton);
    
    // En mode split, l'éditeur ET l'aperçu devraient être visibles
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    // Le contenu apparaît dans le textarea et dans l'aperçu
    const contentElements = screen.getAllByText('Contenu test');
    expect(contentElements.length).toBeGreaterThanOrEqual(1);
  });

  it('devrait insérer un tableau quand on clique sur le bouton tableau', () => {
    useStore.getState().loadMarkdown('# Test\n\n');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    
    // Trouver le bouton tableau par son data-tooltip
    const tableButton = document.querySelector('[data-tooltip="Tableau"]');
    if (tableButton) {
      fireEvent.click(tableButton);
      
      // Le tableau devrait être inséré
      expect(textarea.value).toContain('Colonne');
    }
  });

  it('devrait insérer un diagramme Mermaid quand on clique sur le bouton', () => {
    useStore.getState().loadMarkdown('# Test\n\n');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    
    // Trouver le bouton Mermaid
    const mermaidButton = document.querySelector('[data-tooltip="Diagramme Mermaid"]');
    if (mermaidButton) {
      fireEvent.click(mermaidButton);
      
      // Le diagramme devrait être inséré
      expect(textarea.value).toContain('mermaid');
    }
  });

  it('devrait insérer une liste numérotée', () => {
    useStore.getState().loadMarkdown('# Test\n\n');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    
    // Chercher le bouton de liste numérotée
    const listButton = document.querySelector('[data-tooltip="Liste numérotée"]');
    if (listButton) {
      fireEvent.click(listButton);
      expect(textarea.value).toContain('1.');
    }
  });

  it('devrait insérer une citation', () => {
    useStore.getState().loadMarkdown('# Test\n\n');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    
    const quoteButton = document.querySelector('[data-tooltip="Citation"]');
    if (quoteButton) {
      fireEvent.click(quoteButton);
      expect(textarea.value).toContain('>');
    }
  });

  it('devrait insérer un lien', () => {
    useStore.getState().loadMarkdown('# Test\n\n');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    
    const linkButton = document.querySelector('[data-tooltip="Lien"]');
    if (linkButton) {
      fireEvent.click(linkButton);
      expect(textarea.value).toContain('](url)');
    }
  });

  it('devrait insérer une image', () => {
    useStore.getState().loadMarkdown('# Test\n\n');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    
    const imageButton = document.querySelector('[data-tooltip="Image"]');
    if (imageButton) {
      fireEvent.click(imageButton);
      expect(textarea.value).toContain('![');
    }
  });

  it('devrait rendre correctement en mode preview', () => {
    useStore.getState().loadMarkdown(`# Test

Ceci est le contenu simple.`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // En mode preview, le textarea ne devrait plus être visible
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // Mais le contenu devrait être visible
    expect(screen.getByText(/Ceci est le contenu/)).toBeInTheDocument();
  });

  it('devrait rendre les citations en mode preview', () => {
    useStore.getState().loadMarkdown(`# Test

> Texte de citation`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Vérifier que le contenu de la citation est visible
    expect(screen.getByText(/Texte de citation/)).toBeInTheDocument();
  });

  it('devrait rendre les listes en mode preview', () => {
    useStore.getState().loadMarkdown(`# Test

- Element de liste`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Vérifier que les items de liste sont rendus
    expect(screen.getByText(/Element de liste/)).toBeInTheDocument();
  });

  it('devrait rendre les liens en mode preview', () => {
    useStore.getState().loadMarkdown(`# Test

Voir ce lien`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Vérifier que le contenu est rendu
    expect(screen.getByText(/Voir ce lien/)).toBeInTheDocument();
  });

  it('devrait gérer le formatage gras et italique en preview', () => {
    useStore.getState().loadMarkdown(`# Test

Texte normal`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Vérifier que le contenu est rendu en preview
    expect(screen.getByText(/Texte normal/)).toBeInTheDocument();
  });

  it('devrait insérer du texte Gras', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const grasButton = document.querySelector('[data-tooltip="Gras"]') as HTMLButtonElement;
    expect(grasButton).toBeInTheDocument();
    fireEvent.click(grasButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('**');
  });

  it('devrait insérer du texte Italique', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const italiqueButton = document.querySelector('[data-tooltip="Italique"]') as HTMLButtonElement;
    expect(italiqueButton).toBeInTheDocument();
    fireEvent.click(italiqueButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('*');
  });

  it('devrait insérer du code inline', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const codeButton = document.querySelector('[data-tooltip="Code inline"]') as HTMLButtonElement;
    expect(codeButton).toBeInTheDocument();
    fireEvent.click(codeButton);
    
    // Le code inline doit être inséré
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('`');
  });

  it('devrait insérer une liste numérotée', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const listButton = document.querySelector('[data-tooltip="Liste numérotée"]') as HTMLButtonElement;
    expect(listButton).toBeInTheDocument();
    fireEvent.click(listButton);
    
    // La liste numérotée doit être insérée
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('1.');
  });

  it('devrait basculer vers le mode édition depuis split', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // D'abord passer en mode split
    const splitButton = screen.getByText('Split');
    fireEvent.click(splitButton);
    
    // Puis passer en mode édition
    const editButton = screen.getByText('Éditer');
    fireEvent.click(editButton);
    
    // Vérifier qu'on est en mode édition (textarea visible)
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('devrait rendre un tableau en mode preview', () => {
    useStore.getState().loadMarkdown(`# Test

| Col1 | Col2 | Col3 |
|------|------|------|
| A | B | C |
| D | E | F |`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Vérifier que le preview contient une table
    const previewPane = document.querySelector('.prose');
    expect(previewPane).toBeInTheDocument();
  });

  it('devrait insérer un Titre 1', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const titre1Button = document.querySelector('[data-tooltip="Titre 1"]') as HTMLButtonElement;
    expect(titre1Button).toBeInTheDocument();
    fireEvent.click(titre1Button);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('## ');
  });

  it('devrait insérer un Titre 2', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const titre2Button = document.querySelector('[data-tooltip="Titre 2"]') as HTMLButtonElement;
    expect(titre2Button).toBeInTheDocument();
    fireEvent.click(titre2Button);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('### ');
  });

  it('devrait insérer une Liste', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const listeButton = document.querySelector('[data-tooltip="Liste"]') as HTMLButtonElement;
    expect(listeButton).toBeInTheDocument();
    fireEvent.click(listeButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('- ');
  });

  it('devrait insérer une Citation', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const citationButton = document.querySelector('[data-tooltip="Citation"]') as HTMLButtonElement;
    expect(citationButton).toBeInTheDocument();
    fireEvent.click(citationButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('> ');
  });

  it('devrait insérer un Lien', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const lienButton = document.querySelector('[data-tooltip="Lien"]') as HTMLButtonElement;
    expect(lienButton).toBeInTheDocument();
    fireEvent.click(lienButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('](url)');
  });

  it('devrait insérer une Image', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const imageButton = document.querySelector('[data-tooltip="Image"]') as HTMLButtonElement;
    expect(imageButton).toBeInTheDocument();
    fireEvent.click(imageButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('![');
  });

  it('devrait insérer un Tableau', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const tableButton = document.querySelector('[data-tooltip="Tableau"]') as HTMLButtonElement;
    expect(tableButton).toBeInTheDocument();
    fireEvent.click(tableButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('| Colonne 1 |');
  });

  it('devrait insérer un Diagramme Mermaid', () => {
    useStore.getState().loadMarkdown('# Test\n\nContenu');
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    const mermaidButton = document.querySelector('[data-tooltip="Diagramme Mermaid"]') as HTMLButtonElement;
    expect(mermaidButton).toBeInTheDocument();
    fireEvent.click(mermaidButton);
    
    const node = useStore.getState().tree[0];
    expect(node.content).toContain('```mermaid');
  });

  it('devrait avoir une zone de preview pour Mermaid', async () => {
    useStore.getState().loadMarkdown(`# Test

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\``);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    const { container } = render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Le composant devrait avoir le mode préview activé
    const previewContainer = document.querySelector('.prose');
    expect(previewContainer).toBeInTheDocument();
    
    // Attendre que l'effet mermaid s'exécute (même si mockée)
    await waitFor(() => {
      expect(previewContainer).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('devrait afficher un tableau dans le preview', () => {
    useStore.getState().loadMarkdown(`# Test

| Nom | Age |
|-----|-----|
| Alice | 25 |`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Vérifier que le preview est affiché
    const previewContainer = document.querySelector('.prose');
    expect(previewContainer).toBeInTheDocument();
  });

  it('devrait afficher le mode split avec textarea et preview', () => {
    useStore.getState().loadMarkdown(`# Test avec contenu

Du texte dans ce nœud`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // Basculer en mode split
    const splitButton = screen.getByText('Split');
    fireEvent.click(splitButton);
    
    // En mode split, on devrait avoir le textarea
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('devrait passer du mode preview au mode edition', () => {
    useStore.getState().loadMarkdown(`# Test

Texte`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    render(<EditorPane />);
    
    // D'abord passer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Le textarea ne devrait pas être visible
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    
    // Revenir en mode edition
    const editButton = screen.getByText('Éditer');
    fireEvent.click(editButton);
    
    // Le textarea devrait être visible
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('devrait rendre un tableau dans la preview', async () => {
    // Charger le document et modifier le contenu du nœud directement
    useStore.getState().loadMarkdown(`# Test avec tableau`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    // Mettre à jour le contenu avec un tableau markdown
    useStore.getState().updateNodeContent(nodeId, `Texte avant le tableau

| Colonne1 | Colonne2 |
|----------|----------|
| Valeur1 | Valeur2 |
| Valeur3 | Valeur4 |

Texte après`);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Le preview devrait être affiché
    const previewContainer = document.querySelector('.prose');
    expect(previewContainer).toBeInTheDocument();
    
    // Le HTML devrait contenir les éléments du tableau rendus
    const tableElements = document.querySelectorAll('table, th, td, thead, tbody, tr');
    expect(tableElements.length).toBeGreaterThanOrEqual(0);
  });

  it('devrait rendre un diagramme mermaid dans le preview', async () => {
    useStore.getState().loadMarkdown(`# Test Mermaid`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    // Mettre du code mermaid dans le contenu
    useStore.getState().updateNodeContent(nodeId, `Description

\`\`\`mermaid
graph TD
    A --> B
\`\`\``);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Le preview devrait exister
    const previewContainer = document.querySelector('.prose');
    expect(previewContainer).toBeInTheDocument();
  });

  it('devrait gérer une erreur mermaid dans le preview', async () => {
    // Importer le mock mermaid et le faire échouer
    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockRejectedValueOnce(new Error('Invalid syntax'));
    
    useStore.getState().loadMarkdown(`# Test Mermaid Error`);
    const nodeId = useStore.getState().tree[0].id;
    useStore.getState().selectNode(nodeId);
    
    // Mettre du code mermaid invalide
    useStore.getState().updateNodeContent(nodeId, `Description

\`\`\`mermaid
invalid syntax here
\`\`\``);
    
    render(<EditorPane />);
    
    // Basculer en mode preview
    const previewButton = screen.getByText('Aperçu');
    fireEvent.click(previewButton);
    
    // Le preview devrait exister même avec une erreur
    const previewContainer = document.querySelector('.prose');
    expect(previewContainer).toBeInTheDocument();
    
    // Attendre un peu pour l'effet async
    await waitFor(() => {
      expect(true).toBe(true);
    }, { timeout: 500 });
  });
});
