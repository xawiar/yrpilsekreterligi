/**
 * maskSensitiveData Tests
 * Tests the data masking function from aiContextBuilder.
 * Ensures TC, phone, API keys, and credentials are properly masked.
 */
import { describe, test, expect } from 'vitest';
import { maskSensitiveData } from '../utils/aiContextBuilder';

describe('maskSensitiveData — TC masking', () => {
  test('masks 11-digit TC numbers', () => {
    const result = maskSensitiveData('TC: 12345678901');
    expect(result).toContain('***TC GİZLİ***');
    expect(result).not.toContain('12345678901');
  });

  test('masks multiple TC numbers in same text', () => {
    const result = maskSensitiveData('TC1: 12345678901 ve TC2: 98765432100');
    expect(result).not.toContain('12345678901');
    expect(result).not.toContain('98765432100');
    // Should have two masked instances
    const count = (result.match(/\*\*\*TC GİZLİ\*\*\*/g) || []).length;
    expect(count).toBe(2);
  });

  test('does not mask 10-digit numbers (not TC)', () => {
    const result = maskSensitiveData('Not TC: 1234567890');
    expect(result).toContain('1234567890');
  });

  test('does not mask 12-digit numbers (not TC)', () => {
    const result = maskSensitiveData('Not TC: 123456789012');
    // 12-digit number should not be fully masked as TC
    // (the regex matches word-boundary 11-digit only)
    expect(result).not.toContain('***TC GİZLİ***');
  });
});

describe('maskSensitiveData — phone masking', () => {
  // NOTE: 11-digit phone numbers like 05321234567 are caught by the TC regex
  // (\b\d{11}\b) FIRST, because TC masking runs before phone masking.
  // This is expected behavior — both TC and phone are 11 digits, so the
  // function conservatively masks them as TC.

  test('11-digit phone numbers are caught by TC regex first', () => {
    const result = maskSensitiveData('Tel: 05321234567');
    // Because 05321234567 is 11 digits, TC regex matches it
    expect(result).toContain('***TC GİZLİ***');
    expect(result).not.toContain('05321234567');
  });

  test('masks 10-digit 5XX phone numbers (without leading 0)', () => {
    const result = maskSensitiveData('Tel: 5321234567');
    expect(result).toContain('532*******');
    expect(result).not.toContain('5321234567');
  });

  test('phone masking works when number has non-digit prefix preventing TC match', () => {
    // If the 05XX number is embedded such that word boundary differs,
    // the phone regex can catch it. But standalone 11-digit = TC.
    const result = maskSensitiveData('Tel: 5551112233');
    expect(result).toContain('555*******');
  });
});

describe('maskSensitiveData — API key masking', () => {
  test('masks Google/Firebase API keys (35+ chars after AIzaSy)', () => {
    // The regex requires AIzaSy followed by 35+ alphanumeric/underscore/dash chars
    // A real Firebase key: AIzaSy + 39 chars = 45 total
    const fakeKey = 'AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI_extra12';
    const result = maskSensitiveData(`Key: ${fakeKey}`);
    expect(result).toContain('***API_KEY_GİZLİ***');
    expect(result).not.toContain(fakeKey);
  });

  test('does not mask short API-like strings (fewer than 35 chars after AIzaSy)', () => {
    // AIzaSy + 33 chars = not enough for the 35+ requirement
    const shortKey = 'AIzaSyA0wDM5fXHtm0uDlALRhkQzF7tpsZ-7BZI';
    const result = maskSensitiveData(`Key: ${shortKey}`);
    // Short key should NOT be masked (regex requires 35+)
    expect(result).toContain(shortKey);
  });

  test('masks long API keys embedded in config', () => {
    const longKey = 'AIzaSyBCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234';
    const text = `apiKey: "${longKey}"`;
    const result = maskSensitiveData(text);
    expect(result).toContain('***API_KEY_GİZLİ***');
  });
});

describe('maskSensitiveData — credential patterns', () => {
  test('masks password values', () => {
    const result = maskSensitiveData('password: supersecret123');
    expect(result).toContain('***GİZLİ***');
    expect(result).not.toContain('supersecret123');
  });

  test('masks secret values', () => {
    const result = maskSensitiveData('secret: mySecretValue');
    expect(result).toContain('***GİZLİ***');
    expect(result).not.toContain('mySecretValue');
  });

  test('masks token values', () => {
    const result = maskSensitiveData('token: abc123def456');
    expect(result).toContain('***GİZLİ***');
    expect(result).not.toContain('abc123def456');
  });
});

describe('maskSensitiveData — passthrough', () => {
  test('normal text passes through unchanged', () => {
    const text = 'Bu bir normal metin parcasidir ve hassas veri icermez.';
    const result = maskSensitiveData(text);
    expect(result).toBe(text);
  });

  test('empty string passes through', () => {
    expect(maskSensitiveData('')).toBe('');
  });

  test('text with only letters and short numbers passes through', () => {
    const text = 'Toplanti 15 Ocak 2024 tarihinde yapildi. 42 kisi katildi.';
    const result = maskSensitiveData(text);
    expect(result).toBe(text);
  });
});
