import React from 'react';
import { X, Users, Activity, Clock, Shield } from 'lucide-react';
import { useAuthStore } from '../authStore';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const { getAllUsers, currentUser } = useAuthStore();

  if (!isOpen || !currentUser?.isAdmin) return null;

  const users = getAllUsers();
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const WEEK = 7 * DAY;

  const activeToday = users.filter(u => now - u.lastActiveAt < DAY).length;
  const activeThisWeek = users.filter(u => now - u.lastActiveAt < WEEK).length;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
              <Users size={24} className="text-indigo-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-indigo-700">{users.length}</p>
              <p className="text-sm text-indigo-600">Utilisateurs total</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <Activity size={24} className="text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-700">{activeToday}</p>
              <p className="text-sm text-green-600">Actifs aujourd'hui</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
              <Clock size={24} className="text-purple-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-purple-700">{activeThisWeek}</p>
              <p className="text-sm text-purple-600">Actifs cette semaine</p>
            </div>
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
                className="text-indigo-600 hover:underline"
              >
                tableau de bord Vercel Analytics
              </a>
              .
            </p>
          </div>

          {/* Users table */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Liste des utilisateurs</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Nom</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Rôle</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                      Dernière activité
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{user.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{user.email}</td>
                      <td className="px-4 py-2.5">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            <Shield size={10} />
                            Admin
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            Utilisateur
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatDate(user.lastActiveAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
