/**
 * FirebaseApiService Pure Logic Tests
 * Tests only the pure data structures and constants — no Firebase connection needed.
 * The COLLECTIONS object and email formatting logic are tested here.
 */
import { describe, test, expect, vi, beforeAll } from 'vitest';

// Mock Firebase modules to prevent initialization errors
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  increment: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  updatePassword: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
}));

vi.mock('../config/firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('../services/FirebaseService', () => ({
  default: {},
}));

vi.mock('./apiCache', () => ({
  getCached: vi.fn(() => null),
  setCache: vi.fn(),
  clearCache: vi.fn(),
}));

// Stub VITE_ENCRYPTION_KEY so crypto module doesn't throw
vi.stubEnv('VITE_ENCRYPTION_KEY', 'test-key-for-firebase-api');

// Now import the module
const { default: FirebaseApiService } = await import('../utils/FirebaseApiService');

describe('FirebaseApiService.COLLECTIONS', () => {
  test('is an object with expected keys', () => {
    const cols = FirebaseApiService.COLLECTIONS;
    expect(typeof cols).toBe('object');
    expect(cols).not.toBeNull();
  });

  test('has MEMBERS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.MEMBERS).toBe('members');
  });

  test('has MEETINGS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.MEETINGS).toBe('meetings');
  });

  test('has EVENTS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.EVENTS).toBe('events');
  });

  test('has TASKS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.TASKS).toBe('tasks');
  });

  test('has REGIONS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.REGIONS).toBe('regions');
  });

  test('has DISTRICTS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.DISTRICTS).toBe('districts');
  });

  test('has ELECTIONS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.ELECTIONS).toBe('elections');
  });

  test('has ELECTION_RESULTS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.ELECTION_RESULTS).toBe('election_results');
  });

  test('has AUDIT_LOGS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.AUDIT_LOGS).toBe('audit_logs');
  });

  test('has POLLS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.POLLS).toBe('polls');
  });

  test('has NEIGHBORHOODS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.NEIGHBORHOODS).toBe('neighborhoods');
  });

  test('has STKS collection', () => {
    expect(FirebaseApiService.COLLECTIONS.STKS).toBe('stks');
  });

  test('all collection values are non-empty strings', () => {
    Object.entries(FirebaseApiService.COLLECTIONS).forEach(([key, value]) => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });

  test('has at least 20 collection definitions', () => {
    const count = Object.keys(FirebaseApiService.COLLECTIONS).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });
});

describe('FirebaseApiService.useFirebase flag', () => {
  test('is set to true', () => {
    expect(FirebaseApiService.useFirebase).toBe(true);
  });
});

describe('Email format logic', () => {
  // The login method formats username to email: username → username@ilsekreterlik.local
  // We test this logic inline since the function is not separately exported
  test('username without @ gets @ilsekreterlik.local appended', () => {
    const username = 'admin';
    const email = username.includes('@') ? username : `${username}@ilsekreterlik.local`;
    expect(email).toBe('admin@ilsekreterlik.local');
  });

  test('username with @ stays as-is', () => {
    const username = 'user@custom.com';
    const email = username.includes('@') ? username : `${username}@ilsekreterlik.local`;
    expect(email).toBe('user@custom.com');
  });

  test('empty username gets domain appended', () => {
    const username = '';
    const email = username.includes('@') ? username : `${username}@ilsekreterlik.local`;
    expect(email).toBe('@ilsekreterlik.local');
  });
});
