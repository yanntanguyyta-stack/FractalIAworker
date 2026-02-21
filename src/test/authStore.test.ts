import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests pour le hook useAuthCompat qui bridge Clerk vers l'interface historique.
 * On ne teste pas la logique Clerk elle-même (c'est leur responsabilité).
 * On vérifie que le mapping des données Clerk vers UserProfile est correct.
 */

// Setup mocks for Clerk hooks
const mockUserUpdate = vi.fn().mockResolvedValue({});
const mockSignOut = vi.fn();

let mockUser: Record<string, unknown> | null = null;
let mockIsSignedIn = false;

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: mockUser,
    isLoaded: true,
  }),
  useAuth: () => ({
    isSignedIn: mockIsSignedIn,
    isLoaded: true,
  }),
  useClerk: () => ({
    signOut: mockSignOut,
  }),
}));

// We need renderHook from testing-library
import { renderHook, act } from '@testing-library/react';
import { useAuthCompat } from '../useAuthCompat';

beforeEach(() => {
  mockUser = null;
  mockIsSignedIn = false;
  vi.clearAllMocks();
});

describe('useAuthCompat — currentUser mapping', () => {
  it('devrait retourner null quand l\'utilisateur n\'est pas connecté', () => {
    const { result } = renderHook(() => useAuthCompat());
    expect(result.current.currentUser).toBeNull();
  });

  it('devrait mapper un utilisateur Clerk vers UserProfile', () => {
    mockIsSignedIn = true;
    mockUser = {
      id: 'user_123',
      primaryEmailAddress: { emailAddress: 'alice@test.com' },
      fullName: 'Alice Martin',
      firstName: 'Alice',
      publicMetadata: { role: 'admin' },
      unsafeMetadata: { aiConfig: { apiKey: 'test-key', provider: 'openai' } },
      createdAt: new Date('2025-01-01').toISOString(),
      lastActiveAt: new Date('2025-06-15').toISOString(),
      update: mockUserUpdate,
    };

    const { result } = renderHook(() => useAuthCompat());
    const user = result.current.currentUser;
    expect(user).not.toBeNull();
    expect(user!.id).toBe('user_123');
    expect(user!.email).toBe('alice@test.com');
    expect(user!.name).toBe('Alice Martin');
    expect(user!.isAdmin).toBe(true);
    expect(user!.savedApiConfig?.apiKey).toBe('test-key');
  });

  it('devrait retourner isAdmin false si le rôle n\'est pas admin', () => {
    mockIsSignedIn = true;
    mockUser = {
      id: 'user_456',
      primaryEmailAddress: { emailAddress: 'bob@test.com' },
      fullName: 'Bob',
      firstName: 'Bob',
      publicMetadata: {},
      unsafeMetadata: {},
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      update: mockUserUpdate,
    };

    const { result } = renderHook(() => useAuthCompat());
    expect(result.current.currentUser!.isAdmin).toBe(false);
  });

  it('devrait utiliser firstName si fullName est absent', () => {
    mockIsSignedIn = true;
    mockUser = {
      id: 'user_789',
      primaryEmailAddress: { emailAddress: 'charlie@test.com' },
      fullName: null,
      firstName: 'Charlie',
      publicMetadata: {},
      unsafeMetadata: {},
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      update: mockUserUpdate,
    };

    const { result } = renderHook(() => useAuthCompat());
    expect(result.current.currentUser!.name).toBe('Charlie');
  });
});

describe('useAuthCompat — logout', () => {
  it('devrait appeler clerk.signOut()', () => {
    mockIsSignedIn = true;
    mockUser = {
      id: 'user_123',
      primaryEmailAddress: { emailAddress: 'alice@test.com' },
      fullName: 'Alice',
      firstName: 'Alice',
      publicMetadata: {},
      unsafeMetadata: {},
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      update: mockUserUpdate,
    };

    const { result } = renderHook(() => useAuthCompat());
    result.current.logout();
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('useAuthCompat — saveApiConfig', () => {
  it('devrait appeler user.update avec unsafeMetadata', async () => {
    mockIsSignedIn = true;
    mockUser = {
      id: 'user_123',
      primaryEmailAddress: { emailAddress: 'alice@test.com' },
      fullName: 'Alice',
      firstName: 'Alice',
      publicMetadata: {},
      unsafeMetadata: { aiConfig: { provider: 'gemini' } },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      update: mockUserUpdate,
    };

    const { result } = renderHook(() => useAuthCompat());
    await act(async () => {
      await result.current.saveApiConfig({ apiKey: 'new-key', model: 'gpt-4o' });
    });

    expect(mockUserUpdate).toHaveBeenCalledWith({
      unsafeMetadata: {
        aiConfig: { provider: 'gemini', apiKey: 'new-key', model: 'gpt-4o' },
      },
    });
  });

  it('ne devrait pas planter si aucun utilisateur connecté', async () => {
    const { result } = renderHook(() => useAuthCompat());
    await expect(
      act(async () => {
        await result.current.saveApiConfig({ apiKey: 'test' });
      })
    ).resolves.not.toThrow();
  });
});

describe('useAuthCompat — updateLastActive', () => {
  it('devrait être un no-op sans erreur', () => {
    const { result } = renderHook(() => useAuthCompat());
    expect(() => result.current.updateLastActive()).not.toThrow();
  });
});

describe('useAuthCompat — isLoaded', () => {
  it('devrait exposer isLoaded', () => {
    const { result } = renderHook(() => useAuthCompat());
    expect(result.current.isLoaded).toBe(true);
  });
});
