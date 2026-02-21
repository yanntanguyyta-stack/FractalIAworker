import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import type { AIConfig } from './store';

/**
 * Profil utilisateur compatible avec l'ancien authStore.
 * Les champs Clerk sont mappés vers l'interface que les composants consomment.
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: number;
  lastActiveAt: number;
  savedApiConfig?: Partial<AIConfig>;
}

/**
 * Hook de compatibilité qui expose la même interface que l'ancien useAuthStore
 * mais s'appuie entièrement sur Clerk.
 *
 * Mapping :
 *  - currentUser        → useUser().user  (transformé en UserProfile)
 *  - logout             → useClerk().signOut()
 *  - saveApiConfig      → user.unsafeMetadata (persisté côté Clerk)
 *  - updateLastActive   → no-op (géré nativement par Clerk via les sessions)
 *  - isAdmin            → user.publicMetadata.role === 'admin'
 */
export function useAuthCompat() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const clerk = useClerk();

  const isLoaded = isUserLoaded && isAuthLoaded;

  const currentUser: UserProfile | null =
    isLoaded && isSignedIn && user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
          name: user.fullName ?? user.firstName ?? 'Utilisateur',
          isAdmin: (user.publicMetadata as Record<string, unknown>)?.role === 'admin',
          createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now(),
          lastActiveAt: user.lastSignInAt ? new Date(user.lastSignInAt).getTime() : Date.now(),
          savedApiConfig: (user.unsafeMetadata as Record<string, unknown>)?.aiConfig as
            | Partial<AIConfig>
            | undefined,
        }
      : null;

  const logout = () => clerk.signOut();

  /**
   * Persiste la configuration IA dans unsafeMetadata de l'utilisateur Clerk.
   * unsafeMetadata est modifiable côté client et idéal pour les préférences.
   */
  const saveApiConfig = async (config: Partial<AIConfig>) => {
    if (!user) return;
    const existing = (user.unsafeMetadata as Record<string, unknown>)?.aiConfig as
      | Partial<AIConfig>
      | undefined;
    await user.update({
      unsafeMetadata: {
        ...user.unsafeMetadata,
        aiConfig: { ...existing, ...config },
      },
    });
  };

  /** No-op : Clerk gère lastActiveAt via les sessions automatiquement. */
  const updateLastActive = () => {};

  return {
    currentUser,
    isLoaded,
    logout,
    saveApiConfig,
    updateLastActive,
  };
}
