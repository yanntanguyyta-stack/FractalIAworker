import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';

// Mock crypto.subtle.digest for test environment
const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
Object.defineProperty(global, 'crypto', {
  value: { subtle: { digest: mockDigest } },
  writable: true,
});

// Helper: unique email per test to avoid state bleed
let emailCounter = 0;
function uniqueEmail() {
  return `user${++emailCounter}@test.com`;
}

beforeEach(() => {
  useAuthStore.setState({ currentUser: null, users: [] });
  vi.clearAllMocks();
  // Return a stable hash based on the first byte of the mock data
  mockDigest.mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
});

describe('useAuthStore — register', () => {
  it('devrait créer un compte avec des données valides', async () => {
    const result = await useAuthStore.getState().register(uniqueEmail(), 'Alice', 'password123');
    expect(result.success).toBe(true);
    expect(useAuthStore.getState().currentUser).not.toBeNull();
    expect(useAuthStore.getState().currentUser?.name).toBe('Alice');
  });

  it('devrait définir le premier utilisateur comme admin', async () => {
    await useAuthStore.getState().register(uniqueEmail(), 'Admin', 'password123');
    expect(useAuthStore.getState().currentUser?.isAdmin).toBe(true);
  });

  it('devrait définir les utilisateurs suivants comme non-admin', async () => {
    await useAuthStore.getState().register(uniqueEmail(), 'User1', 'password123');
    await useAuthStore.getState().logout();
    await useAuthStore.getState().register(uniqueEmail(), 'User2', 'password123');
    expect(useAuthStore.getState().currentUser?.isAdmin).toBe(false);
  });

  it('devrait rejeter si le mot de passe est trop court', async () => {
    const result = await useAuthStore.getState().register(uniqueEmail(), 'Alice', '12345');
    expect(result.success).toBe(false);
    expect(result.error).toContain('6 caractères');
  });

  it('devrait rejeter si l\'email est invalide', async () => {
    const result = await useAuthStore.getState().register('not-an-email', 'Alice', 'password123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('devrait rejeter si un champ est manquant', async () => {
    const result = await useAuthStore.getState().register('', 'Alice', 'password123');
    expect(result.success).toBe(false);
  });

  it('devrait rejeter si l\'email est déjà utilisé', async () => {
    const email = uniqueEmail();
    await useAuthStore.getState().register(email, 'Alice', 'password123');
    useAuthStore.setState({ currentUser: null });
    const result = await useAuthStore.getState().register(email, 'Bob', 'password456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('déjà utilisé');
  });

  it('devrait normaliser l\'email en minuscules', async () => {
    await useAuthStore.getState().register('ALICE@TEST.COM', 'Alice', 'password123');
    expect(useAuthStore.getState().currentUser?.email).toBe('alice@test.com');
  });
});

describe('useAuthStore — login', () => {
  it('devrait connecter un utilisateur avec les bons identifiants', async () => {
    const email = uniqueEmail();
    // Use a distinct hash for register vs login by using the same mock
    await useAuthStore.getState().register(email, 'Alice', 'password123');
    useAuthStore.setState({ currentUser: null });

    const result = await useAuthStore.getState().login(email, 'password123');
    expect(result.success).toBe(true);
    expect(useAuthStore.getState().currentUser?.email).toBe(email);
  });

  it('devrait refuser avec un email inconnu', async () => {
    const result = await useAuthStore.getState().login('unknown@test.com', 'password123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('incorrect');
  });

  it('devrait refuser avec un mauvais mot de passe', async () => {
    const email = uniqueEmail();
    // First register with hash 0xab...
    await useAuthStore.getState().register(email, 'Alice', 'password123');
    useAuthStore.setState({ currentUser: null });

    // Login with different hash to simulate wrong password
    mockDigest.mockResolvedValueOnce(new Uint8Array(32).fill(0xcc).buffer);
    const result = await useAuthStore.getState().login(email, 'wrongpassword');
    expect(result.success).toBe(false);
  });

  it('devrait mettre à jour lastActiveAt lors de la connexion', async () => {
    const before = Date.now();
    const email = uniqueEmail();
    await useAuthStore.getState().register(email, 'Alice', 'password123');
    useAuthStore.setState({ currentUser: null });
    await useAuthStore.getState().login(email, 'password123');
    expect(useAuthStore.getState().currentUser?.lastActiveAt).toBeGreaterThanOrEqual(before);
  });
});

describe('useAuthStore — logout', () => {
  it('devrait déconnecter l\'utilisateur', async () => {
    await useAuthStore.getState().register(uniqueEmail(), 'Alice', 'password123');
    expect(useAuthStore.getState().currentUser).not.toBeNull();
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});

describe('useAuthStore — saveApiConfig', () => {
  it('devrait sauvegarder la config API de l\'utilisateur', async () => {
    await useAuthStore.getState().register(uniqueEmail(), 'Alice', 'password123');
    useAuthStore.getState().saveApiConfig({ apiKey: 'my-key', provider: 'openai' });
    expect(useAuthStore.getState().currentUser?.savedApiConfig?.apiKey).toBe('my-key');
    expect(useAuthStore.getState().currentUser?.savedApiConfig?.provider).toBe('openai');
  });

  it('ne devrait pas planter si aucun utilisateur connecté', () => {
    expect(() => {
      useAuthStore.getState().saveApiConfig({ apiKey: 'test' });
    }).not.toThrow();
  });
});

describe('useAuthStore — getAllUsers', () => {
  it('devrait retourner tous les utilisateurs sans les mots de passe', async () => {
    await useAuthStore.getState().register(uniqueEmail(), 'Alice', 'password123');
    const users = useAuthStore.getState().getAllUsers();
    expect(users.length).toBeGreaterThan(0);
    users.forEach(u => {
      expect(u).not.toHaveProperty('passwordHash');
    });
  });
});

describe('useAuthStore — updateLastActive', () => {
  it('devrait mettre à jour lastActiveAt', async () => {
    await useAuthStore.getState().register(uniqueEmail(), 'Alice', 'password123');
    const before = useAuthStore.getState().currentUser!.lastActiveAt;
    await new Promise(r => setTimeout(r, 10));
    useAuthStore.getState().updateLastActive();
    expect(useAuthStore.getState().currentUser!.lastActiveAt).toBeGreaterThanOrEqual(before);
  });

  it('ne devrait pas planter si aucun utilisateur connecté', () => {
    expect(() => {
      useAuthStore.getState().updateLastActive();
    }).not.toThrow();
  });
});
