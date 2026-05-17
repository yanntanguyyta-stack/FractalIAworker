import React from 'react';
import { X, Users, Shield, ExternalLink } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const { user } = useUser();

  const isAdmin = (user?.publicMetadata as Record<string, unknown>)?.role === 'admin';

  if (!isOpen || !isAdmin) return null;

  return (
    <div className="modal-backdrop">
      <div className="glass-card w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-glow-accent">
              <Shield size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold accent-text-gradient tracking-tight">Tableau de bord Admin</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="accent-gradient-soft border border-accent-200/50 rounded-2xl p-4 flex items-center gap-4">
            <Users size={24} className="text-accent-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Connecté en tant qu'administrateur
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>

          <div className="glass border-white/60 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Gestion des utilisateurs</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              La gestion des utilisateurs est disponible dans le{' '}
              <a
                href="https://dashboard.clerk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline inline-flex items-center gap-1 font-medium"
              >
                tableau de bord Clerk <ExternalLink size={11} />
              </a>
              . Vous y trouverez la liste complète des utilisateurs, les statistiques
              d'authentification et les logs de sécurité.
            </p>
          </div>

          <div className="glass border-white/60 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Analytiques Vercel</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Le suivi de trafic est disponible dans votre{' '}
              <a
                href="https://vercel.com/analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline inline-flex items-center gap-1 font-medium"
              >
                tableau de bord Vercel Analytics <ExternalLink size={11} />
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
