/**
 * @deprecated Ce fichier a été remplacé par src/useAuthCompat.ts qui utilise Clerk.
 * Conservé temporairement pour référence — à supprimer après validation complète.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIConfig } from './store';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: number;
  lastActiveAt: number;
  savedApiConfig?: Partial<AIConfig>;
}

interface UserRecord extends UserProfile {
  passwordHash: string;
}

export interface AuthState {
  currentUser: UserProfile | null;
  users: UserRecord[];
  register: (
    email: string,
    name: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateLastActive: () => void;
  saveApiConfig: (config: Partial<AIConfig>) => void;
  getAllUsers: () => UserProfile[];
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],

      register: async (email, name, password) => {
        if (!email.trim() || !name.trim() || !password) {
          return { success: false, error: 'Tous les champs sont obligatoires' };
        }
        if (password.length < 6) {
          return { success: false, error: 'Le mot de passe doit faire au moins 6 caractères' };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { success: false, error: 'Adresse email invalide' };
        }

        const { users } = get();
        if (users.some(u => u.email === email.toLowerCase().trim())) {
          return { success: false, error: 'Cet email est déjà utilisé' };
        }

        const passwordHash = await hashPassword(password);
        const isAdmin = users.length === 0; // first user becomes admin

        const newRecord: UserRecord = {
          id: generateId(),
          email: email.toLowerCase().trim(),
          name: name.trim(),
          passwordHash,
          isAdmin,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        };

        const { passwordHash: _ph, ...publicUser } = newRecord;
        set({ users: [...users, newRecord], currentUser: publicUser });
        return { success: true };
      },

      login: async (email, password) => {
        const { users } = get();
        const record = users.find(u => u.email === email.toLowerCase().trim());
        if (!record) {
          return { success: false, error: 'Email ou mot de passe incorrect' };
        }

        const passwordHash = await hashPassword(password);
        if (passwordHash !== record.passwordHash) {
          return { success: false, error: 'Email ou mot de passe incorrect' };
        }

        const updated: UserRecord = { ...record, lastActiveAt: Date.now() };
        const { passwordHash: _ph, ...publicUser } = updated;
        set({
          users: users.map(u => (u.id === record.id ? updated : u)),
          currentUser: publicUser,
        });
        return { success: true };
      },

      logout: () => {
        set({ currentUser: null });
      },

      updateLastActive: () => {
        const { currentUser, users } = get();
        if (!currentUser) return;
        const now = Date.now();
        set({
          users: users.map(u =>
            u.id === currentUser.id ? { ...u, lastActiveAt: now } : u
          ),
          currentUser: { ...currentUser, lastActiveAt: now },
        });
      },

      saveApiConfig: (config: Partial<AIConfig>) => {
        const { currentUser, users } = get();
        if (!currentUser) return;
        const updatedUser = { ...currentUser, savedApiConfig: { ...currentUser.savedApiConfig, ...config } };
        set({
          users: users.map(u =>
            u.id === currentUser.id ? { ...u, savedApiConfig: updatedUser.savedApiConfig } : u
          ),
          currentUser: updatedUser,
        });
      },

      getAllUsers: () => {
        return get().users.map(({ passwordHash: _ph, ...u }) => u);
      },
    }),
    { name: 'fractalia-auth' }
  )
);
