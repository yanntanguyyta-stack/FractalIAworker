import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminDashboard from '../components/AdminDashboard';
import { useUser } from '@clerk/clerk-react';

vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn(),
}));

describe('AdminDashboard', () => {
  it('ne devrait rien afficher si isOpen est false', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'admin' }, primaryEmailAddress: { emailAddress: 'admin@example.com' } },
    });

    const { container } = render(<AdminDashboard isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('ne devrait rien afficher si l\'utilisateur n\'est pas admin', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'user' }, primaryEmailAddress: { emailAddress: 'user@example.com' } },
    });

    const { container } = render(<AdminDashboard isOpen={true} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('devrait afficher le tableau de bord si admin et isOpen est true', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'admin' }, primaryEmailAddress: { emailAddress: 'admin@example.com' } },
    });

    render(<AdminDashboard isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Tableau de bord Admin')).toBeInTheDocument();
    expect(screen.getByText("Connecté en tant qu'administrateur")).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getAllByText(/Gestion des utilisateurs/i)[0]).toBeInTheDocument();
  });

  it('devrait appeler onClose lorsqu\'on clique sur le bouton fermer', () => {
    const handleClose = vi.fn();
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'admin' }, primaryEmailAddress: { emailAddress: 'admin@example.com' } },
    });

    render(<AdminDashboard isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText('Fermer');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
