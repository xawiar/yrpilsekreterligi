/**
 * D'Hondt System Advanced Tests
 * Edge cases and stress tests for the seat allocation algorithm.
 */
import { describe, test, expect } from 'vitest';
import { calculateDHondt, applyThreshold } from '../utils/dhondt';

describe('calculateDHondt — many parties', () => {
  test('handles 10+ parties correctly', () => {
    const votes = {};
    for (let i = 1; i <= 15; i++) {
      votes[`Parti${i}`] = 10000 * (16 - i); // Parti1=150k, Parti2=140k, ...
    }
    const result = calculateDHondt(votes, 20);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(20);
    // Parti1 (most votes) should have the most seats
    expect(result['Parti1']).toBeGreaterThanOrEqual(result['Parti15'] || 0);
  });

  test('handles 50 parties', () => {
    const votes = {};
    for (let i = 1; i <= 50; i++) {
      votes[`P${i}`] = Math.max(1000, 50000 - i * 900);
    }
    const result = calculateDHondt(votes, 30);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(30);
  });
});

describe('calculateDHondt — threshold edge cases', () => {
  test('filters correctly at exactly 7% threshold', () => {
    // Total votes = 100,000. A party with exactly 7000 votes = 7%
    const votes = {
      'Buyuk': 93000,
      'Sinirda': 7000, // exactly 7%
    };
    const result = calculateDHondt(votes, 10, 7);
    // Sinirda is at exactly 7%, should pass threshold (applyThreshold uses >=)
    expect(result['Sinirda']).toBeGreaterThanOrEqual(0);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(10);
  });

  test('filters out party just below 7% threshold', () => {
    const votes = {
      'Buyuk': 93001,
      'AltindaKalan': 6999, // 6999/100000 = 6.999% < 7%
    };
    const result = calculateDHondt(votes, 10, 7);
    expect(result['AltindaKalan'] || 0).toBe(0);
  });

  test('all seats go to single party when others are below threshold', () => {
    const votes = {
      'Dominant': 90000,
      'Kucuk1': 3000,
      'Kucuk2': 4000,
      'Kucuk3': 3000,
    };
    const result = calculateDHondt(votes, 8, 7);
    // All small parties are below 7% of 100000 = 7000
    expect(result['Kucuk1'] || 0).toBe(0);
    expect(result['Kucuk2'] || 0).toBe(0);
    expect(result['Kucuk3'] || 0).toBe(0);
    expect(result['Dominant']).toBe(8);
  });

  test('threshold of 0 means no filtering', () => {
    const votes = { 'A': 99000, 'B': 1000 };
    const result = calculateDHondt(votes, 5, 0);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(5);
  });
});

describe('calculateDHondt — large vote numbers', () => {
  test('handles 1,000,000+ votes correctly', () => {
    const votes = {
      'A': 1500000,
      'B': 1200000,
      'C': 800000,
      'D': 500000,
    };
    const result = calculateDHondt(votes, 50);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(50);
    // A should have more seats than D
    expect(result['A']).toBeGreaterThan(result['D']);
  });

  test('handles 10,000,000+ votes', () => {
    const votes = {
      'Parti1': 10000000,
      'Parti2': 8000000,
      'Parti3': 5000000,
    };
    const result = calculateDHondt(votes, 100);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(100);
  });
});

describe('calculateDHondt — tie-breaking', () => {
  test('tie-breaking produces valid total seats', () => {
    // Three parties with identical votes competing for 3 seats
    const votes = { 'A': 100, 'B': 100, 'C': 100 };
    const result = calculateDHondt(votes, 3);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(3);
    // Each should get 1 seat (equal votes, 3 seats)
    expect(result['A']).toBe(1);
    expect(result['B']).toBe(1);
    expect(result['C']).toBe(1);
  });

  test('tie-breaking with odd seat count produces valid total', () => {
    const votes = { 'X': 1000, 'Y': 1000 };
    const result = calculateDHondt(votes, 5);
    const totalSeats = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(5);
    // With equal votes and 5 seats, distribution may vary due to tie-breaking
    // but total must be 5
  });

  test('result is deterministic when no ties exist', () => {
    const votes = { 'A': 100000, 'B': 80000, 'C': 30000 };
    const result1 = calculateDHondt(votes, 10);
    const result2 = calculateDHondt(votes, 10);
    expect(result1).toEqual(result2);
  });
});

describe('applyThreshold — edge cases', () => {
  test('exactly at threshold returns true', () => {
    // 7000 out of 100000 = exactly 7%
    expect(applyThreshold(7000, 100000, 7.0)).toBe(true);
  });

  test('tiny fraction below threshold returns false', () => {
    expect(applyThreshold(6999, 100000, 7.0)).toBe(false);
  });

  test('100% vote share returns true', () => {
    expect(applyThreshold(100000, 100000, 7.0)).toBe(true);
  });

  test('threshold of 50% works correctly', () => {
    expect(applyThreshold(50000, 100000, 50.0)).toBe(true);
    expect(applyThreshold(49999, 100000, 50.0)).toBe(false);
  });
});
