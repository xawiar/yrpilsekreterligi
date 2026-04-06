/**
 * AI Tools Tests
 * Tests tool declarations, permission checks, and tool execution logic.
 */
import { describe, test, expect } from 'vitest';
import { TOOL_DECLARATIONS, executeToolCall } from '../utils/aiTools';

describe('TOOL_DECLARATIONS', () => {
  test('is a non-empty array of tool definitions', () => {
    expect(Array.isArray(TOOL_DECLARATIONS)).toBe(true);
    expect(TOOL_DECLARATIONS.length).toBeGreaterThan(0);
  });

  test('every tool has a name, description, and parameters', () => {
    TOOL_DECLARATIONS.forEach(tool => {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
    });
  });

  test('contains hesaplaDHondt tool', () => {
    const dhondtTool = TOOL_DECLARATIONS.find(t => t.name === 'hesaplaDHondt');
    expect(dhondtTool).toBeDefined();
    expect(dhondtTool.parameters.required).toContain('partyVotes');
    expect(dhondtTool.parameters.required).toContain('totalSeats');
  });

  test('contains araUye tool', () => {
    const araUyeTool = TOOL_DECLARATIONS.find(t => t.name === 'araUye');
    expect(araUyeTool).toBeDefined();
    expect(araUyeTool.parameters.required).toContain('query');
  });

  test('contains all expected tool names', () => {
    const toolNames = TOOL_DECLARATIONS.map(t => t.name);
    expect(toolNames).toContain('hesaplaDHondt');
    expect(toolNames).toContain('araUye');
    expect(toolNames).toContain('getirSecimSonuclari');
    expect(toolNames).toContain('karsilastirSecimler');
    expect(toolNames).toContain('analizEtBolge');
    expect(toolNames).toContain('olusturRapor');
  });
});

describe('executeToolCall — permission checks', () => {
  test('returns error for unauthorized role on araUye (admin-only)', async () => {
    const result = await executeToolCall('araUye', { query: 'test' }, {}, 'member');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('yetki');
  });

  test('returns error for unauthorized role on analizEtBolge (admin-only)', async () => {
    const result = await executeToolCall('analizEtBolge', { bolgeAdi: 'merkez' }, {}, 'coordinator');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  });

  test('returns error for unauthorized role on olusturRapor (admin-only)', async () => {
    const result = await executeToolCall('olusturRapor', { startDate: '2024-01-01', endDate: '2024-12-31' }, {}, 'member');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  });

  test('returns error for unknown tool', async () => {
    const result = await executeToolCall('nonExistentTool', {}, {}, 'admin');
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('Bilinmeyen');
  });
});

describe('executeToolCall — hesaplaDHondt', () => {
  test('returns valid D\'Hondt result for admin', async () => {
    const result = await executeToolCall('hesaplaDHondt', {
      partyVotes: { 'A': 100000, 'B': 80000, 'C': 30000 },
      totalSeats: 5
    }, {}, 'admin');
    const parsed = JSON.parse(result);
    expect(parsed.distribution).toBeDefined();
    expect(parsed.totalSeats).toBe(5);
  });

  test('returns valid D\'Hondt result for member (allowed role)', async () => {
    const result = await executeToolCall('hesaplaDHondt', {
      partyVotes: { 'X': 50000, 'Y': 30000 },
      totalSeats: 3
    }, {}, 'member');
    const parsed = JSON.parse(result);
    expect(parsed.distribution).toBeDefined();
  });
});

describe('executeToolCall — araUye', () => {
  test('returns filtered results from mock siteData for admin', async () => {
    const siteData = {
      members: [
        { name: 'Ali Yilmaz', region: 'Merkez', position: 'Baskan', manual_stars: 5, attendanceRate: 90 },
        { name: 'Veli Kaya', region: 'Sivrice', position: 'Uye', manual_stars: 3, attendanceRate: 75 },
        { name: 'Ayse Demir', region: 'Merkez', position: 'Koordinator', manual_stars: 4, attendanceRate: 85 },
      ]
    };

    const result = await executeToolCall('araUye', { query: 'Ali' }, siteData, 'admin');
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Ali Yilmaz');
  });

  test('araUye searches by region', async () => {
    const siteData = {
      members: [
        { name: 'Ali Yilmaz', region: 'Merkez', position: 'Baskan' },
        { name: 'Veli Kaya', region: 'Sivrice', position: 'Uye' },
        { name: 'Ayse Demir', region: 'Merkez', position: 'Koordinator' },
      ]
    };

    const result = await executeToolCall('araUye', { query: 'merkez' }, siteData, 'admin');
    const parsed = JSON.parse(result);
    expect(parsed.length).toBe(2);
  });

  test('araUye returns empty array for no match', async () => {
    const siteData = {
      members: [
        { name: 'Ali Yilmaz', region: 'Merkez', position: 'Baskan' },
      ]
    };

    const result = await executeToolCall('araUye', { query: 'nonexistent' }, siteData, 'admin');
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([]);
  });

  test('araUye limits results to 10', async () => {
    const members = Array.from({ length: 20 }, (_, i) => ({
      name: `Uye ${i}`, region: 'Merkez', position: 'Uye'
    }));
    const siteData = { members };

    const result = await executeToolCall('araUye', { query: 'Uye' }, siteData, 'admin');
    const parsed = JSON.parse(result);
    expect(parsed.length).toBeLessThanOrEqual(10);
  });
});

describe('executeToolCall — analizEtBolge', () => {
  test('returns region analysis for admin', async () => {
    const siteData = {
      members: [
        { name: 'Ali', region: 'Merkez', district: '' },
        { name: 'Veli', region: 'Merkez', district: '' },
        { name: 'Hasan', region: 'Sivrice', district: '' },
      ],
      neighborhoods: [
        { name: 'Merkez Mahallesi', representative_name: 'Ali', visit_count: 2 },
        { name: 'Merkez Yeni', representative_name: '', visit_count: 0 },
      ]
    };

    const result = await executeToolCall('analizEtBolge', { bolgeAdi: 'Merkez' }, siteData, 'admin');
    const parsed = JSON.parse(result);
    expect(parsed.uyeSayisi).toBe(2);
    expect(parsed.mahalleSayisi).toBe(2);
    expect(parsed.temsilciAtanmis).toBe(1);
    expect(parsed.ziyaretYapilmis).toBe(1);
  });
});
