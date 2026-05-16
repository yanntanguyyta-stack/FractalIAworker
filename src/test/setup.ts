import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { _resetCachesForTests } from '../documentStore';
import { _resetDBForTests } from '../db';

// ─── Mock @clerk/clerk-react pour les tests ───────────────────────────────────
vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn(() => ({
    user: null,
    isLoaded: true,
  })),
  useAuth: vi.fn(() => ({
    isSignedIn: false,
    isLoaded: true,
  })),
  useClerk: vi.fn(() => ({
    signOut: vi.fn(),
  })),
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock global pour les tests
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Reset mocks entre les tests
beforeEach(async () => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
  _resetCachesForTests();
  // Close any open DB connection so deleteDatabase doesn't block
  await _resetDBForTests();
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('fractalia');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
});
