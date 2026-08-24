import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SyncRuleModal from '../components/SyncRuleModal';
import { useStore, ProjectDocument } from '../store';

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store')>();
  return {
    ...actual,
    useStore: vi.fn(),
  };
});

describe('SyncRuleModal', () => {
  const mockSetSyncRule = vi.fn();
  const currentDoc: ProjectDocument = {
    id: 'doc-tool',
    name: 'Document Outil',
    tree: [],
    markdown: '',
    history: [],
    future: [],
    contextDocIds: [],
    type: 'tool',
  };

  const otherDoc: ProjectDocument = {
    id: 'doc-main',
    name: 'Document Principal',
    tree: [],
    markdown: '',
    history: [],
    future: [],
    contextDocIds: [],
    type: 'main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('devrait affichant un message s\'il n\'y a pas d\'autre document disponible', () => {
    (useStore as any).mockReturnValue({
      documents: [currentDoc],
      setSyncRule: mockSetSyncRule,
    });

    render(<SyncRuleModal doc={currentDoc} onClose={vi.fn()} />);
    expect(screen.getByText(/Aucun autre document disponible comme source/i)).toBeInTheDocument();
  });

  it('devrait permettre de créer et enregistrer une règle de synchro', () => {
    const handleClose = vi.fn();
    (useStore as any).mockReturnValue({
      documents: [currentDoc, otherDoc],
      setSyncRule: mockSetSyncRule,
    });

    render(<SyncRuleModal doc={currentDoc} onClose={handleClose} />);

    const textarea = screen.getByPlaceholderText(/Ex. : "Liste les personnages/i);
    fireEvent.change(textarea, { target: { value: 'Extraire les éléments clés' } });

    const saveBtn = screen.getByRole('button', { name: 'Enregistrer' });
    fireEvent.click(saveBtn);

    expect(mockSetSyncRule).toHaveBeenCalledWith('doc-tool', {
      sourceDocId: 'doc-main',
      instruction: 'Extraire les éléments clés',
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('devrait permettre de supprimer une règle de synchro existante', () => {
    const docWithRule: ProjectDocument = {
      ...currentDoc,
      syncRule: { sourceDocId: 'doc-main', instruction: 'Extraire tout' },
    };
    const handleClose = vi.fn();

    (useStore as any).mockReturnValue({
      documents: [docWithRule, otherDoc],
      setSyncRule: mockSetSyncRule,
    });

    render(<SyncRuleModal doc={docWithRule} onClose={handleClose} />);

    const removeBtn = screen.getByRole('button', { name: 'Retirer la règle' });
    fireEvent.click(removeBtn);

    expect(mockSetSyncRule).toHaveBeenCalledWith('doc-tool', null);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
