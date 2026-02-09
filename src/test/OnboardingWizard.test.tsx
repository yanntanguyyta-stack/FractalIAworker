import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingWizard from '../components/OnboardingWizard';

describe('OnboardingWizard', () => {
  const mockOnClose = vi.fn();
  const mockOnOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendu et visibilité', () => {
    it('ne rend rien quand isOpen est false', () => {
      const { container } = render(
        <OnboardingWizard isOpen={false} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('affiche le wizard quand isOpen est true', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      expect(screen.getByText(/Bienvenue sur FractalIA/)).toBeInTheDocument();
    });

    it('affiche le titre de la première étape', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      expect(screen.getByText('Étape 1 sur 5')).toBeInTheDocument();
    });
  });

  describe('Navigation entre les étapes', () => {
    it('avance à l\'étape suivante avec le bouton Suivant', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // D'abord vérifier qu'on est à l'étape 1
      expect(screen.getByText('Étape 1 sur 5')).toBeInTheDocument();
      
      // Cliquer sur Suivant
      fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      
      // Vérifier qu'on est passé à l'étape 2
      expect(screen.getByText('Étape 2 sur 5')).toBeInTheDocument();
      expect(screen.getByText('Structure en Arborescence')).toBeInTheDocument();
    });

    it('revient à l\'étape précédente avec le bouton Précédent', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Aller à l'étape 2
      fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      expect(screen.getByText('Étape 2 sur 5')).toBeInTheDocument();
      
      // Revenir à l'étape 1
      fireEvent.click(screen.getByRole('button', { name: /précédent/i }));
      expect(screen.getByText('Étape 1 sur 5')).toBeInTheDocument();
    });

    it('n\'affiche pas le bouton Précédent à la première étape', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      expect(screen.queryByRole('button', { name: /précédent/i })).not.toBeInTheDocument();
    });

    it('permet de naviguer via les indicateurs de progression', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Trouver tous les boutons de progression (les points)
      const dots = screen.getAllByRole('button').filter(btn => 
        btn.className.includes('rounded-full') && btn.className.includes('w-2')
      );
      
      // Cliquer sur le 3ème point (index 2 = étape 3)
      if (dots.length >= 3) {
        fireEvent.click(dots[2]);
        expect(screen.getByText('Étape 3 sur 5')).toBeInTheDocument();
      }
    });
  });

  describe('Fermeture du wizard', () => {
    it('appelle onClose quand on clique sur le bouton fermer (X)', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Trouver le bouton X (passer l'introduction)
      const closeButton = screen.getByTitle("Passer l'introduction");
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('appelle onClose quand on termine toutes les étapes', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Naviguer jusqu'à la dernière étape
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      }
      
      // À la dernière étape, le bouton devient "Commencer"
      expect(screen.getByText('Étape 5 sur 5')).toBeInTheDocument();
      expect(screen.getByText(/Vous êtes prêt/)).toBeInTheDocument();
      
      // Cliquer sur Commencer
      fireEvent.click(screen.getByRole('button', { name: /commencer/i }));
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Étape Configuration API', () => {
    it('affiche le bouton de configuration API à l\'étape 4', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Naviguer jusqu'à l'étape 4 (Configuration API)
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      }
      
      expect(screen.getByText('Étape 4 sur 5')).toBeInTheDocument();
      expect(screen.getByText('Configurer votre Clé API')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /configurer ma clé api/i })).toBeInTheDocument();
    });

    it('appelle onClose et onOpenSettings quand on clique sur le bouton configurer API', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Naviguer jusqu'à l'étape 4
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      }
      
      // Cliquer sur "Configurer ma clé API"
      fireEvent.click(screen.getByRole('button', { name: /configurer ma clé api/i }));
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contenu des étapes', () => {
    it('affiche les informations de bienvenue à l\'étape 1', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      expect(screen.getByText(/éditeur de documents intelligent/i)).toBeInTheDocument();
      expect(screen.getByText(/ce que vous pouvez faire/i)).toBeInTheDocument();
    });

    it('affiche les informations sur l\'arborescence à l\'étape 2', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      
      expect(screen.getByText(/nœuds hiérarchiques/i)).toBeInTheDocument();
      expect(screen.getByText(/Mon Projet/)).toBeInTheDocument();
    });

    it('affiche les informations sur l\'assistant IA à l\'étape 3', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Aller à l'étape 3
      fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      
      expect(screen.getByText('Assistant IA Intégré')).toBeInTheDocument();
      expect(screen.getByText(/Mode Discussion/i)).toBeInTheDocument();
      expect(screen.getByText(/Mode Structuration/i)).toBeInTheDocument();
    });

    it('affiche les instructions pour obtenir une clé API à l\'étape 4', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Aller à l'étape 4
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      }
      
      // Vérifier que les éléments Google Gemini sont présents (il y en a plusieurs)
      const geminiElements = screen.getAllByText(/Google Gemini/i);
      expect(geminiElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/OpenAI ChatGPT/i)).toBeInTheDocument();
      expect(screen.getByText(/clé API gratuite/i)).toBeInTheDocument();
    });

    it('affiche le récapitulatif à l\'étape 5', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Aller à l'étape 5
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      }
      
      expect(screen.getByText(/Récapitulatif/i)).toBeInTheDocument();
      expect(screen.getByText(/Explorez la structure/i)).toBeInTheDocument();
    });
  });

  describe('Barre de progression', () => {
    it('affiche correctement la progression', () => {
      const { container } = render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Vérifier que la barre de progression existe
      const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-500.to-purple-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('met à jour le style de la barre de progression lors de la navigation', () => {
      const { container } = render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-500.to-purple-500');
      
      // À l'étape 1, la largeur devrait être 20%
      expect(progressBar).toHaveStyle({ width: '20%' });
      
      // Avancer à l'étape 2
      fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      
      // À l'étape 2, la largeur devrait être 40%
      expect(progressBar).toHaveStyle({ width: '40%' });
    });
  });

  describe('Accessibilité', () => {
    it('a des boutons avec des titres accessibles', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      expect(screen.getByTitle("Passer l'introduction")).toBeInTheDocument();
    });

    it('affiche les liens externes avec les bons attributs', () => {
      render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      // Aller à l'étape 4 pour voir les liens
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
      }
      
      const aiStudioLink = screen.getByText('Google AI Studio');
      expect(aiStudioLink).toHaveAttribute('target', '_blank');
      expect(aiStudioLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Animation et style', () => {
    it('a un fond avec effet de flou', () => {
      const { container } = render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();
    });

    it('a un header avec dégradé', () => {
      const { container } = render(
        <OnboardingWizard isOpen={true} onClose={mockOnClose} onOpenSettings={mockOnOpenSettings} />
      );
      
      const header = container.querySelector('.bg-gradient-to-r.from-blue-600');
      expect(header).toBeInTheDocument();
    });
  });
});
