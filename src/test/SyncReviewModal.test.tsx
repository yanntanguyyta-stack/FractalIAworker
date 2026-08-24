import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SyncReviewModal from '../components/SyncReviewModal';
import { useStore, ProjectDocument } from '../store';

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store')>();
  return {
    ...actual,
    useStore: vi.fn(),
  };
});

describe('SyncReviewModal', () => {
  const mockSwitchDocument = vi.fn();
  const mockInsertSectionsAsChildren = vi.fn();

  const targetDoc: ProjectDocument = {
    id: 'doc-target',
    name: 'Document Outil',
    tree: [],
    markdown: '',
    history: [],
    future: [],
    contextDocIds: [],
    type: 'tool',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useStore as any).mockReturnValue({
      switchDocument: mockSwitchDocument,
      activeDocumentId: 'doc-target',
      insertSectionsAsChildren: mockInsertSectionsAsChildren,
    });
  });

  it('devrait afficher un message vide lorsque les propositions sont vides', () => {
    const handleClose = vi.fn();
    render(
      <SyncReviewModal
        targetDoc={targetDoc}
        sourceDocName="Doc Source"
        proposals={[]}
        onClose={handleClose}
      />
    );

    expect(screen.getByText(/L'IA n'a rien trouvé à ajouter/i)).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: 'Fermer' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('devrait afficher les propositions et permettre la sélection/désélection', () => {
    const proposals = [
      { title: 'Prop 1', description: 'Desc 1', level: 2 },
      { title: 'Prop 2', description: 'Desc 2', level: 2 },
    ];
    const handleClose = vi.fn();

    render(
      <SyncReviewModal
        targetDoc={targetDoc}
        sourceDocName="Doc Source"
        proposals={proposals}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('Prop 1')).toBeInTheDocument();
    expect(screen.getByText('Prop 2')).toBeInTheDocument();

    // Toggle tout désélectionner
    const toggleAllBtn = screen.getByText('Tout désélectionner');
    fireEvent.click(toggleAllBtn);

    expect(screen.getByText('0 / 2 sélectionnés')).toBeInTheDocument();

    // Re-toggle tout sélectionner
    const selectAllBtn = screen.getByText('Tout sélectionner');
    fireEvent.click(selectAllBtn);

    expect(screen.getByText('2 / 2 sélectionnés')).toBeInTheDocument();
  });

  it('devrait insérer les propositions sélectionnées et fermer le modal', () => {
    const proposals = [
      { title: 'Prop 1', description: 'Desc 1', level: 2 },
      { title: 'Prop 2', description: 'Desc 2', level: 2 },
    ];
    const handleClose = vi.fn();

    (useStore as any).mockReturnValue({
      switchDocument: mockSwitchDocument,
      activeDocumentId: 'doc-other', // Différent de targetDoc.id
      insertSectionsAsChildren: mockInsertSectionsAsChildren,
    });

    render(
      <SyncReviewModal
        targetDoc={targetDoc}
        sourceDocName="Doc Source"
        proposals={proposals}
        onClose={handleClose}
      />
    );

    const insertBtn = screen.getByRole('button', { name: /Insérer 2 entrées/i });
    fireEvent.click(insertBtn);

    expect(mockSwitchDocument).toHaveBeenCalledWith('doc-target');
    expect(mockInsertSectionsAsChildren).toHaveBeenCalledWith('__document_root__', [
      { heading: 'Prop 1', content: 'Desc 1' },
      { heading: 'Prop 2', content: 'Desc 2' },
    ]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
