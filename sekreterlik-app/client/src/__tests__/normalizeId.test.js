/**
 * normalizeId Utility Tests
 * Tests ID normalization and comparison across string/number types.
 */
import { describe, it, expect } from 'vitest';
import { normalizeId, compareIds } from '../utils/normalizeId';

describe('normalizeId', () => {
  it('should convert numbers to strings', () => {
    expect(normalizeId(1)).toBe('1');
    expect(normalizeId(42)).toBe('42');
    expect(normalizeId(0)).toBe('0');
  });

  it('should keep strings as-is', () => {
    expect(normalizeId('1')).toBe('1');
    expect(normalizeId('abc')).toBe('abc');
  });

  it('should return null for null/undefined', () => {
    expect(normalizeId(null)).toBe(null);
    expect(normalizeId(undefined)).toBe(null);
  });
});

describe('compareIds', () => {
  it('should match number and string IDs', () => {
    expect(compareIds(1, '1')).toBe(true);
    expect(compareIds('42', 42)).toBe(true);
  });

  it('should not match different IDs', () => {
    expect(compareIds(1, 2)).toBe(false);
    expect(compareIds('1', '2')).toBe(false);
  });

  it('should return false for null values', () => {
    expect(compareIds(null, '1')).toBe(false);
    expect(compareIds('1', null)).toBe(false);
    expect(compareIds(null, null)).toBe(false);
  });

  it('should handle zero correctly', () => {
    expect(compareIds(0, '0')).toBe(true);
    expect(compareIds(0, 0)).toBe(true);
  });
});
