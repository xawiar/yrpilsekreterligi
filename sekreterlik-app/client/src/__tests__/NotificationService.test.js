/**
 * NotificationService Constants Tests
 * Tests notification type definitions and label completeness.
 * Only tests the pure exported constants — no Firebase calls.
 */
import { describe, test, expect } from 'vitest';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  TARGET_TYPES,
} from '../services/NotificationService';

describe('NOTIFICATION_TYPES', () => {
  test('contains all expected notification types', () => {
    expect(NOTIFICATION_TYPES.ANNOUNCEMENT).toBe('announcement');
    expect(NOTIFICATION_TYPES.MEETING_INVITE).toBe('meeting_invite');
    expect(NOTIFICATION_TYPES.EVENT_INVITE).toBe('event_invite');
    expect(NOTIFICATION_TYPES.POLL_INVITE).toBe('poll_invite');
    expect(NOTIFICATION_TYPES.ELECTION_UPDATE).toBe('election_update');
    expect(NOTIFICATION_TYPES.MEETING).toBe('meeting');
    expect(NOTIFICATION_TYPES.MEETING_REMINDER).toBe('meeting_reminder');
    expect(NOTIFICATION_TYPES.EVENT).toBe('event');
    expect(NOTIFICATION_TYPES.EVENT_REMINDER).toBe('event_reminder');
    expect(NOTIFICATION_TYPES.POLL).toBe('poll');
    expect(NOTIFICATION_TYPES.POLL_VOTE).toBe('poll_vote');
    expect(NOTIFICATION_TYPES.MESSAGE).toBe('message');
  });

  test('all values are non-empty strings', () => {
    Object.values(NOTIFICATION_TYPES).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });

  test('all values are unique', () => {
    const values = Object.values(NOTIFICATION_TYPES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('NOTIFICATION_TYPE_LABELS', () => {
  test('every NOTIFICATION_TYPE has a corresponding label', () => {
    Object.values(NOTIFICATION_TYPES).forEach(typeValue => {
      expect(NOTIFICATION_TYPE_LABELS[typeValue]).toBeDefined();
      expect(typeof NOTIFICATION_TYPE_LABELS[typeValue]).toBe('string');
      expect(NOTIFICATION_TYPE_LABELS[typeValue].length).toBeGreaterThan(0);
    });
  });

  test('has no undefined or null values', () => {
    Object.entries(NOTIFICATION_TYPE_LABELS).forEach(([key, value]) => {
      expect(value).not.toBeUndefined();
      expect(value).not.toBeNull();
      expect(typeof value).toBe('string');
    });
  });

  test('label count matches type count', () => {
    const typeCount = Object.keys(NOTIFICATION_TYPES).length;
    const labelCount = Object.keys(NOTIFICATION_TYPE_LABELS).length;
    expect(labelCount).toBe(typeCount);
  });
});

describe('TARGET_TYPES', () => {
  test('contains all expected target types', () => {
    expect(TARGET_TYPES.ALL).toBe('all');
    expect(TARGET_TYPES.REGION).toBe('region');
    expect(TARGET_TYPES.ROLE).toBe('role');
    expect(TARGET_TYPES.SINGLE).toBe('single');
  });

  test('all values are non-empty strings', () => {
    Object.values(TARGET_TYPES).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });
});
