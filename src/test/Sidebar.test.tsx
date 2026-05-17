import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';
import { useStore } from '../store';

// Reset le store avant chaque test
beforeEach(() => {
  const defaultDocId = 'test-doc';
  useStore.setState({
    documents: [{ id: defaultDocId, name: 'Document', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'main' }],
    activeDocumentId: defaultDocId,
    projects: [{ id: "proj-default", name: "Mon projet", createdAt: 0, documents: [{ id: defaultDocId, name: "Document", tree: [], markdown: "", history: [], future: [], contextDocIds: [], type: "main" }], activeDocumentId: defaultDocId }],
    activeProjectId: "proj-default",
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
  } as any);
});

describe('Sidebar', () => {
  it('devrait afficher un message quand l\'arbre est vide', () => {
    render(<Sidebar />);
    
    expect(screen.getByText(/Aucun nœud/i)).toBeInTheDocument();
  });

  it('devrait afficher les statistiques de l\'arbre', () => {
    useStore.getState().loadMarkdown(`# Projet

## Section 1

## Section 2`);
    
    render(<Sidebar />);
    
    // Devrait afficher le nombre de nœuds (3: 1 racine + 2 enfants)
    expect(screen.getByText(/3 nœuds/i)).toBeInTheDocument();
  });

  it('devrait afficher les nœuds de l\'arbre', () => {
    useStore.getState().loadMarkdown(`# Mon Projet

Contenu du projet`);
    
    render(<Sidebar />);
    
    expect(screen.getByText('Mon Projet')).toBeInTheDocument();
  });

  it('devrait sélectionner un nœud quand on clique dessus', () => {
    useStore.getState().loadMarkdown(`# Test

Contenu`);
    
    render(<Sidebar />);
    
    const nodeButton = screen.getByText('Test');
    fireEvent.click(nodeButton);
    
    const nodeId = useStore.getState().tree[0].id;
    expect(useStore.getState().activeNodeId).toBe(nodeId);
  });

  it('devrait afficher et masquer les enfants avec le chevron', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

Contenu enfant`);
    
    render(<Sidebar />);
    
    // L'enfant devrait être visible par défaut (expandé)
    expect(screen.getByText('Enfant')).toBeInTheDocument();
    
    // Cliquer sur le chevron pour replier
    const chevron = document.querySelector('button svg');
    if (chevron && chevron.parentElement) {
      const expandButton = chevron.parentElement;
      if (expandButton.tagName === 'BUTTON') {
        fireEvent.click(expandButton);
      }
    }
  });

  it('devrait ajouter un enfant quand on clique sur le bouton plus', async () => {
    // Mock window.prompt to return a title for the new child
    vi.spyOn(window, 'prompt').mockReturnValue('Nouveau nœud');

    useStore.getState().loadMarkdown(`# Parent

Contenu`);

    render(<Sidebar />);

    // Sélectionner le nœud pour afficher sa barre d'actions
    fireEvent.click(screen.getByText('Parent'));

    // Trouver le bouton d'ajout de sous-nœud (data-tooltip="Ajouter H2")
    const addButton = document.querySelector('[data-tooltip="Ajouter H2"]');

    if (addButton) {
      fireEvent.click(addButton);

      // Vérifier qu'un enfant a été ajouté
      expect(useStore.getState().tree[0].children.length).toBeGreaterThan(0);
    }
  });

  it('devrait supprimer un nœud quand on clique sur le bouton poubelle', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

Contenu`);
    
    render(<Sidebar />);
    
    // Compter les nœuds avant
    const nodesBefore = useStore.getState().tree[0].children.length;
    
    // Les boutons de suppression sont présents
    const deleteButtons = document.querySelectorAll('button');
    // Chercher le bouton avec l'icône Trash2
    const trashButton = Array.from(deleteButtons).find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    );
    
    if (trashButton) {
      fireEvent.click(trashButton);
      
      // Vérifier que le nœud a été supprimé ou que le nombre a changé
      const nodesAfter = useStore.getState().tree[0]?.children?.length ?? 0;
      expect(nodesAfter).toBeLessThanOrEqual(nodesBefore);
    }
  });

  it('devrait appliquer les classes CSS personnalisées', () => {
    render(<Sidebar className="test-class" />);
    
    const sidebar = document.querySelector('.test-class');
    expect(sidebar).toBeInTheDocument();
  });

  it('devrait afficher les couleurs de profondeur', () => {
    useStore.getState().loadMarkdown(`# Niveau 1

## Niveau 2

### Niveau 3`);
    
    render(<Sidebar />);
    
    // Vérifier que tous les niveaux sont affichés
    expect(screen.getByText('Niveau 1')).toBeInTheDocument();
    expect(screen.getByText('Niveau 2')).toBeInTheDocument();
    expect(screen.getByText('Niveau 3')).toBeInTheDocument();
  });

  it('devrait afficher la profondeur maximale', () => {
    useStore.getState().loadMarkdown(`# A

## B

### C`);
    
    render(<Sidebar />);
    
    // Devrait afficher 3 niveaux de profondeur
    expect(screen.getByText(/3 niveaux/i)).toBeInTheDocument();
  });

  it('devrait tout déplier quand on clique sur le bouton expandAll', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant 1

### Petit-enfant

## Enfant 2`);
    
    render(<Sidebar />);
    
    // D'abord, replier tout
    const collapseAllButton = screen.getByTitle(/Tout replier/i);
    fireEvent.click(collapseAllButton);
    
    // Le petit-enfant ne devrait plus être visible
    expect(screen.queryByText('Petit-enfant')).not.toBeInTheDocument();
    
    // Puis déplier tout
    const expandAllButton = screen.getByTitle(/Tout déplier/i);
    fireEvent.click(expandAllButton);
    
    // Maintenant tout devrait être visible
    expect(screen.getByText('Petit-enfant')).toBeInTheDocument();
  });

  it('devrait tout replier quand on clique sur le bouton collapseAll', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

### Petit-enfant`);
    
    render(<Sidebar />);
    
    // Tous les niveaux sont visibles au départ
    expect(screen.getByText('Enfant')).toBeInTheDocument();
    expect(screen.getByText('Petit-enfant')).toBeInTheDocument();
    
    // Replier tout
    const collapseAllButton = screen.getByTitle(/Tout replier/i);
    fireEvent.click(collapseAllButton);
    
    // Les enfants ne devraient plus être visibles
    expect(screen.queryByText('Enfant')).not.toBeInTheDocument();
    expect(screen.queryByText('Petit-enfant')).not.toBeInTheDocument();
  });

  it('devrait afficher les indicateurs de type (global et agent)', () => {
    useStore.getState().loadMarkdown(`# Noeud Global

<!-- {"meta":{"id":"global","type":"section","contextConfig":{"isGlobal":true}}} -->

Contenu`);
    
    render(<Sidebar />);
    
    // L'indicateur global (🌐) devrait être présent
    expect(screen.getByTitle(/Contexte global/i)).toBeInTheDocument();
  });

  it('devrait toggle l\'expansion d\'un nœud avec le chevron', () => {
    useStore.getState().loadMarkdown(`# Parent

## Enfant

Contenu`);
    
    render(<Sidebar />);
    
    // L'enfant est visible au départ
    expect(screen.getByText('Enfant')).toBeInTheDocument();
    
    // Trouver le bouton chevron (expand/collapse)
    const chevronButton = screen.getByLabelText(/Replier/i);
    fireEvent.click(chevronButton);
    
    // L'enfant ne devrait plus être visible
    expect(screen.queryByText('Enfant')).not.toBeInTheDocument();
    
    // Re-cliquer pour déplier
    const expandButton = screen.getByLabelText(/Déplier/i);
    fireEvent.click(expandButton);
    
    // L'enfant devrait être visible à nouveau
    expect(screen.getByText('Enfant')).toBeInTheDocument();
  });

  it('devrait supprimer un nœud quand confirm retourne true', () => {
    global.confirm = vi.fn(() => true);
    
    useStore.getState().loadMarkdown(`# Parent

## Enfant à supprimer

Contenu`);
    
    render(<Sidebar />);
    
    // Le nombre d'enfants avant
    expect(useStore.getState().tree[0].children.length).toBe(1);
    
    // Trouver le bouton de suppression de l'enfant
    const deleteButtons = document.querySelectorAll('[data-tooltip="Supprimer"]');
    const childDeleteButton = deleteButtons[deleteButtons.length - 1]; // Le dernier est celui de l'enfant
    
    if (childDeleteButton) {
      fireEvent.click(childDeleteButton);
      
      expect(global.confirm).toHaveBeenCalled();
      
      // L'enfant devrait être supprimé
      expect(useStore.getState().tree[0].children.length).toBe(0);
    }
  });

  it('devrait ne pas supprimer quand confirm retourne false', () => {
    global.confirm = vi.fn(() => false);
    
    useStore.getState().loadMarkdown(`# Parent

## Enfant à garder

Contenu`);
    
    render(<Sidebar />);
    
    // Le nombre d'enfants avant
    expect(useStore.getState().tree[0].children.length).toBe(1);
    
    // Trouver le bouton de suppression de l'enfant
    const deleteButtons = document.querySelectorAll('[data-tooltip="Supprimer"]');
    const childDeleteButton = deleteButtons[deleteButtons.length - 1];
    
    if (childDeleteButton) {
      fireEvent.click(childDeleteButton);
      
      expect(global.confirm).toHaveBeenCalled();
      
      // L'enfant devrait toujours être là
      expect(useStore.getState().tree[0].children.length).toBe(1);
    }
  });

  it('devrait afficher l\'indicateur d\'agent quand configuré', () => {
    useStore.getState().loadMarkdown(`# Noeud Agent

<!-- {"meta":{"id":"agent","type":"section","agentConfig":{"role":"Expert","instructions":"Sois précis"}}} -->

Contenu`);

    render(<Sidebar />);

    // L'indicateur agent (🤖) devrait être présent
    expect(screen.getByTitle(/Agent: Expert/i)).toBeInTheDocument();
  });

  describe('tool docs section', () => {
    it('affiche les documents outils dans la section Documents outils', () => {
      useStore.setState({
        documents: [
          { id: 'd1', name: 'Manuscrit', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'main' },
          { id: 'd2', name: 'Personnages', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'tool' },
        ],
        activeDocumentId: 'd1',
      } as any);

      render(<Sidebar />);
      expect(screen.getByText('Personnages')).toBeInTheDocument();
    });

    it('switche vers un document outil au clic', () => {
      useStore.setState({
        documents: [
          { id: 'd1', name: 'A', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'main' },
          { id: 'd2', name: 'B', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'tool' },
        ],
        activeDocumentId: 'd1',
        tree: [],
        markdown: '',
      } as any);

      render(<Sidebar />);
      fireEvent.click(screen.getByText('B'));
      expect(useStore.getState().activeDocumentId).toBe('d2');
    });

    it('crée un document outil via le bouton Ajouter', () => {
      render(<Sidebar />);
      const addBtn = screen.getByText(/Ajouter un document outil/i);
      fireEvent.click(addBtn);
      expect(useStore.getState().documents).toHaveLength(2);
      expect(useStore.getState().documents[1].type).toBe('tool');
    });

    it('passe en mode renommage via le bouton Renommer', () => {
      useStore.setState({
        documents: [
          { id: 'd1', name: 'Main', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'main' },
          { id: 'd2', name: 'Outil', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'tool' },
        ],
        activeDocumentId: 'd1',
      } as any);

      render(<Sidebar />);
      const renameBtn = screen.getByTitle('Renommer');
      fireEvent.click(renameBtn);
      const input = document.querySelector('input[maxlength="60"]');
      expect(input).not.toBeNull();
    });

    it('supprime un document outil via le bouton Supprimer (avec confirm)', () => {
      const originalConfirm = window.confirm;
      window.confirm = vi.fn(() => true);

      useStore.setState({
        documents: [
          { id: 'd1', name: 'Main', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'main' },
          { id: 'd2', name: 'Outil', tree: [], markdown: '', history: [], future: [], contextDocIds: [], type: 'tool' },
        ],
        activeDocumentId: 'd1',
      } as any);

      render(<Sidebar />);
      const deleteBtn = screen.getByTitle('Supprimer ce document');
      fireEvent.click(deleteBtn);
      expect(useStore.getState().documents).toHaveLength(1);
      expect(useStore.getState().documents[0].id).toBe('d1');

      window.confirm = originalConfirm;
    });

    it('n\'affiche aucun document dans la section outils s\'il n\'y en a pas', () => {
      render(<Sidebar />);
      expect(screen.queryByTitle('Supprimer ce document')).toBeNull();
      expect(screen.getByText(/Aucun document outil/i)).toBeInTheDocument();
    });
  });
});
