/**
 * D'Hondt System Unit Tests
 * Tests the seat allocation algorithm used for election results.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDHondt,
  calculateDHondtDetailed,
  applyThreshold,
  computeAllianceVotes,
  calculateDHondtWithAlliances,
  calculateMunicipalCouncilSeats,
} from '../utils/dhondt';

describe('calculateDHondt', () => {
  it('should distribute seats correctly for a simple case', () => {
    const result = calculateDHondt({ 'A': 100000, 'B': 80000, 'C': 30000 }, 5);
    expect(result['A']).toBe(3);
    expect(result['B']).toBe(2);
    expect(result['C']).toBe(0);
  });

  it('should return empty object for null/invalid input', () => {
    expect(calculateDHondt(null, 5)).toEqual({});
    expect(calculateDHondt({}, 5)).toEqual({});
    expect(calculateDHondt({ 'A': 100 }, 0)).toEqual({});
    expect(calculateDHondt({ 'A': 100 }, -1)).toEqual({});
  });

  it('should handle single party case', () => {
    const result = calculateDHondt({ 'A': 50000 }, 3);
    expect(result['A']).toBe(3);
  });

  it('should handle equal votes correctly', () => {
    const result = calculateDHondt({ 'A': 100, 'B': 100 }, 4);
    // With equal votes, total should be 4
    expect(result['A'] + result['B']).toBe(4);
    // Each should get 2
    expect(result['A']).toBe(2);
    expect(result['B']).toBe(2);
  });

  it('should handle independent candidates', () => {
    const result = calculateDHondt({
      'A': 100000,
      'B': 80000,
      'Bagimsiz Aday 1': 50000
    }, 5);
    expect(result['Bagimsiz Aday 1']).toBe(1);
    // Remaining 4 seats distributed by D'Hondt
    expect(result['A'] + result['B']).toBe(4);
  });

  it('should ignore parties with zero votes', () => {
    const result = calculateDHondt({ 'A': 100, 'B': 0 }, 3);
    expect(result['A']).toBe(3);
  });
});

describe('calculateDHondtDetailed', () => {
  it('should return distribution, details, and chartData', () => {
    const result = calculateDHondtDetailed({ 'A': 100, 'B': 50 }, 3);
    expect(result.distribution).toBeDefined();
    expect(result.details).toBeDefined();
    expect(result.chartData).toBeDefined();
    expect(result.totalSeats).toBe(3);
  });
});

describe('applyThreshold', () => {
  it('should return true when above threshold', () => {
    expect(applyThreshold(8000, 100000, 7.0)).toBe(true);
  });

  it('should return false when below threshold', () => {
    expect(applyThreshold(6000, 100000, 7.0)).toBe(false);
  });

  it('should return false for zero total votes', () => {
    expect(applyThreshold(100, 0, 7.0)).toBe(false);
  });

  it('should return false for invalid threshold values', () => {
    expect(applyThreshold(100, 1000, 0)).toBe(false);
    expect(applyThreshold(100, 1000, -5)).toBe(false);
    expect(applyThreshold(100, 1000, 100)).toBe(false);
  });

  it('should handle exact threshold boundary', () => {
    // 7000 out of 100000 = exactly 7%
    expect(applyThreshold(7000, 100000, 7.0)).toBe(true);
  });
});

describe('computeAllianceVotes', () => {
  it('should sum votes for alliance parties', () => {
    const partyVotes = { 'A': 50000, 'B': 30000, 'C': 20000 };
    const alliances = [{ id: 1, name: 'Ittifak 1', party_ids: ['A', 'B'] }];
    const result = computeAllianceVotes(partyVotes, alliances);
    expect(result[1]).toBe(80000);
  });

  it('should return 0 for alliances with no matching parties', () => {
    const partyVotes = { 'X': 10000 };
    const alliances = [{ id: 1, name: 'Ittifak 1', party_ids: ['A', 'B'] }];
    const result = computeAllianceVotes(partyVotes, alliances);
    expect(result[1]).toBe(0);
  });
});

describe('calculateDHondtWithAlliances', () => {
  it('should handle alliance-based seat distribution', () => {
    const partyVotes = { 'A': 50000, 'B': 30000, 'C': 40000, 'D': 20000 };
    const alliances = [
      { id: 1, name: 'Ittifak 1', party_ids: ['A', 'B'] },
      { id: 2, name: 'Ittifak 2', party_ids: ['C', 'D'] },
    ];
    const result = calculateDHondtWithAlliances(partyVotes, 5, alliances, 7.0);
    expect(result.distribution).toBeDefined();
    expect(result.auditLog).toBeDefined();
    // Total seats should equal 5
    const totalSeats = Object.values(result.distribution).reduce((s, v) => s + v, 0);
    expect(totalSeats).toBe(5);
  });

  it('should return empty for invalid input', () => {
    const result = calculateDHondtWithAlliances(null, 5);
    expect(result.distribution).toEqual({});
  });
});

describe('calculateMunicipalCouncilSeats', () => {
  it('should give quota seats to the winner', () => {
    const result = calculateMunicipalCouncilSeats(
      { 'A': 60000, 'B': 40000 },
      7,
      50000
    );
    expect(result.quotaParty).toBe('A');
    expect(result.quotaSeats).toBe(2); // 10k-100k population = 2 quota seats
    const totalDistributed = Object.values(result.distribution).reduce((s, v) => s + v, 0);
    expect(totalDistributed).toBe(7);
  });

  it('should return empty for invalid input', () => {
    const result = calculateMunicipalCouncilSeats(null, 5);
    expect(result.distribution).toEqual({});
  });
});
