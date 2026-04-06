/**
 * Crypto Utility Tests
 * Tests encrypt/decrypt functions from crypto.js
 *
 * Note: crypto.js reads VITE_ENCRYPTION_KEY from import.meta.env at module level.
 * We must mock import.meta.env BEFORE importing the module.
 */
import { describe, test, expect, vi, beforeAll } from 'vitest';

// Set the env variable before importing crypto module
const TEST_KEY = 'test-encryption-key-12345';

// We need to mock import.meta.env before the module loads
vi.stubEnv('VITE_ENCRYPTION_KEY', TEST_KEY);

// Dynamic import after env is set — vitest module cache means the stub
// must be in place before the first import in this file.
const { encryptData, decryptData, encryptObject, decryptObject, SENSITIVE_FIELDS } = await import('../utils/crypto');

describe('encryptData', () => {
  test('returns encrypted string that starts with U2FsdGVkX1', () => {
    const encrypted = encryptData('hello world');
    expect(typeof encrypted).toBe('string');
    expect(encrypted.startsWith('U2FsdGVkX1')).toBe(true);
  });

  test('returns null for null input', () => {
    expect(encryptData(null)).toBe(null);
  });

  test('returns null for undefined input', () => {
    expect(encryptData(undefined)).toBe(null);
  });

  test('encrypts objects by stringifying them', () => {
    const data = { name: 'test', value: 42 };
    const encrypted = encryptData(data);
    expect(typeof encrypted).toBe('string');
    expect(encrypted.startsWith('U2FsdGVkX1')).toBe(true);
  });

  test('encrypts numbers correctly', () => {
    const encrypted = encryptData(12345);
    expect(typeof encrypted).toBe('string');
    expect(encrypted.startsWith('U2FsdGVkX1')).toBe(true);
  });

  test('produces different ciphertext for different inputs', () => {
    const enc1 = encryptData('data1');
    const enc2 = encryptData('data2');
    expect(enc1).not.toBe(enc2);
  });
});

describe('decryptData', () => {
  test('reverses encryptData for strings', () => {
    const original = 'merhaba dunya';
    const encrypted = encryptData(original);
    const decrypted = decryptData(encrypted);
    expect(decrypted).toBe(original);
  });

  test('reverses encryptData for objects', () => {
    const original = { name: 'Ali', age: 30 };
    const encrypted = encryptData(original);
    const decrypted = decryptData(encrypted);
    expect(decrypted).toEqual(original);
  });

  test('returns null for null input', () => {
    expect(decryptData(null)).toBe(null);
  });

  test('returns null for undefined input', () => {
    expect(decryptData(undefined)).toBe(null);
  });

  test('returns null for empty string', () => {
    expect(decryptData('')).toBe(null);
  });

  test('returns short strings as-is (not encrypted)', () => {
    expect(decryptData('hello')).toBe('hello');
  });

  test('returns numeric strings as-is (TC/phone patterns)', () => {
    expect(decryptData('12345678901')).toBe('12345678901');
  });

  test('returns non-string values as-is', () => {
    expect(decryptData(42)).toBe(42);
    expect(decryptData(true)).toBe(true);
  });
});

describe('encryptObject / decryptObject', () => {
  test('encrypts specified fields in an object', () => {
    const obj = { name: 'Ali', tc: '12345678901', phone: '05321234567', city: 'Elazig' };
    const encrypted = encryptObject(obj, ['tc', 'phone']);

    expect(encrypted.name).toBe('Ali');
    expect(encrypted.city).toBe('Elazig');
    expect(encrypted.tc).not.toBe('12345678901');
    expect(encrypted.tc.startsWith('U2FsdGVkX1')).toBe(true);
    expect(encrypted.phone).not.toBe('05321234567');
    expect(encrypted.phone.startsWith('U2FsdGVkX1')).toBe(true);
  });

  test('decryptObject reverses encryptObject', () => {
    const obj = { name: 'Ali', tc: '12345678901', phone: '05321234567' };
    const encrypted = encryptObject(obj, ['tc', 'phone']);
    const decrypted = decryptObject(encrypted, ['tc', 'phone']);

    expect(decrypted.tc).toBe('12345678901');
    expect(decrypted.phone).toBe('05321234567');
    expect(decrypted.name).toBe('Ali');
  });

  test('handles null/undefined objects gracefully', () => {
    expect(encryptObject(null, ['tc'])).toBe(null);
    expect(encryptObject(undefined, ['tc'])).toBe(undefined);
    expect(decryptObject(null, ['tc'])).toBe(null);
    expect(decryptObject(undefined, ['tc'])).toBe(undefined);
  });

  test('skips null/undefined fields', () => {
    const obj = { name: 'Ali', tc: null, phone: undefined };
    const encrypted = encryptObject(obj, ['tc', 'phone']);
    expect(encrypted.tc).toBe(null);
    expect(encrypted.phone).toBe(undefined);
  });
});

describe('SENSITIVE_FIELDS constant', () => {
  test('contains expected sensitive field names', () => {
    expect(SENSITIVE_FIELDS).toContain('password');
    expect(SENSITIVE_FIELDS).toContain('phone');
    expect(SENSITIVE_FIELDS).toContain('email');
    expect(SENSITIVE_FIELDS).toContain('tc');
    expect(SENSITIVE_FIELDS).toContain('tcNo');
    expect(SENSITIVE_FIELDS).toContain('address');
  });

  test('is a non-empty array', () => {
    expect(Array.isArray(SENSITIVE_FIELDS)).toBe(true);
    expect(SENSITIVE_FIELDS.length).toBeGreaterThan(0);
  });
});
