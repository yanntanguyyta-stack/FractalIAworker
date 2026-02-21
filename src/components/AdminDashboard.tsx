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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-indigo-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={22} />
            <h2 className="text-xl font-bold">Tableau de bord Admin</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Info admin */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-4">
            <Users size={28} className="text-indigo-600" />
            <div>
              <p className="text-sm font-medium text-indigo-800">
                Connecté en tant qu'administrateur
              </p>
              <p className="text-xs text-indigo-600">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>

          {/* Clerk Dashboard link */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 mb-1">
              👤 Gestion des utilisateurs
            </p>
            <p className="text-xs text-slate-500">
              La gestion des utilisateurs (création, suppression, rôles, sessions actives) est
              disponible dans le{' '}
              <a
                href="https://dashboard.clerk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                tableau de bord Clerk <ExternalLink size={12} />
              </a>
              . Vous y trouverez la liste complète des utilisateurs, les statistiques
              d'authentification et les logs de sécurité.
            </p>
          </div>

          {/* Analytics link */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-1">📊 Analytiques Vercel</p>
            <p className="text-xs text-slate-500">
              Le suivi de trafic (pages vues, visiteurs uniques, géolocalisation) est disponible
              dans votre{' '}
              <a
                href="https://vercel.com/analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                tableau de bord Vercel Analytics <ExternalLink size={12} />
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
