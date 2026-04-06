/**
 * Masking Utils Tests
 * Tests KVKK-compliant data masking helpers.
 */
import { describe, test, expect } from 'vitest';
import { maskTC, maskPhone, maskEmail } from '../utils/maskingUtils';

describe('maskTC', () => {
  test('masks middle digits of TC number', () => {
    const result = maskTC('12345678901');
    expect(result).toBe('123****901');
  });

  test('works with numeric input', () => {
    // maskTC converts to string internally
    const result = maskTC(12345678901);
    expect(result).toContain('****');
  });

  test('returns empty string for null/undefined', () => {
    expect(maskTC(null)).toBe('');
    expect(maskTC(undefined)).toBe('');
    expect(maskTC('')).toBe('');
  });
});

describe('maskPhone', () => {
  test('masks middle digits of phone number', () => {
    const result = maskPhone('05321234567');
    expect(result).toBe('053****567');
  });

  test('returns empty string for null/undefined', () => {
    expect(maskPhone(null)).toBe('');
    expect(maskPhone(undefined)).toBe('');
    expect(maskPhone('')).toBe('');
  });
});

describe('maskEmail', () => {
  test('masks local part of email', () => {
    const result = maskEmail('ahmet@example.com');
    expect(result).toBe('ah***@example.com');
  });

  test('handles short local part', () => {
    const result = maskEmail('ab@domain.com');
    expect(result).toBe('ab***@domain.com');
  });

  test('returns empty string for null/undefined', () => {
    expect(maskEmail(null)).toBe('');
    expect(maskEmail(undefined)).toBe('');
    expect(maskEmail('')).toBe('');
  });

  test('handles email without @ sign', () => {
    const result = maskEmail('notanemail');
    expect(result).toBe('***');
  });
});
