/**
 * Constants Tests
 * Tests that exported constants have expected values.
 */
import { describe, test, expect } from 'vitest';
import { BREAKPOINTS, PAGINATION } from '../utils/constants';

describe('BREAKPOINTS', () => {
  test('MOBILE is 768', () => {
    expect(BREAKPOINTS.MOBILE).toBe(768);
  });

  test('TABLET is 1024', () => {
    expect(BREAKPOINTS.TABLET).toBe(1024);
  });

  test('DESKTOP is 1280', () => {
    expect(BREAKPOINTS.DESKTOP).toBe(1280);
  });

  test('MOBILE < TABLET < DESKTOP', () => {
    expect(BREAKPOINTS.MOBILE).toBeLessThan(BREAKPOINTS.TABLET);
    expect(BREAKPOINTS.TABLET).toBeLessThan(BREAKPOINTS.DESKTOP);
  });
});

describe('PAGINATION', () => {
  test('DEFAULT_PAGE_SIZE is 25', () => {
    expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(25);
  });

  test('MAX_PAGE_SIZE is 100', () => {
    expect(PAGINATION.MAX_PAGE_SIZE).toBe(100);
  });

  test('DEFAULT_PAGE_SIZE is less than MAX_PAGE_SIZE', () => {
    expect(PAGINATION.DEFAULT_PAGE_SIZE).toBeLessThan(PAGINATION.MAX_PAGE_SIZE);
  });
});
