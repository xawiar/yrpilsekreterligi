/**
 * Permission System Tests
 * Tests the centralized hasPermission utility.
 */
import { describe, it, expect } from 'vitest';
import { hasPermission } from '../utils/permissions';

describe('hasPermission', () => {
  it('should always return true for admin users', () => {
    expect(hasPermission('admin', true, [], false)).toBe(true);
    expect(hasPermission('authorization', true, [], false)).toBe(true);
    expect(hasPermission('firebase-config', true, [], false)).toBe(true);
    expect(hasPermission('data-retention', true, [], false)).toBe(true);
  });

  it('should return false when permissions are loading', () => {
    expect(hasPermission('admin', false, [], true)).toBe(false);
    expect(hasPermission('regions', false, ['add_region'], true)).toBe(false);
  });

  it('should allow "admin" tab for all users (alwaysAllow)', () => {
    expect(hasPermission('admin', false, [], false)).toBe(true);
  });

  it('should allow "push-notifications" for all users (alwaysAllow)', () => {
    expect(hasPermission('push-notifications', false, [], false)).toBe(true);
  });

  it('should deny admin-only tabs for non-admin users', () => {
    expect(hasPermission('authorization', false, [], false)).toBe(false);
    expect(hasPermission('firebase-config', false, [], false)).toBe(false);
    expect(hasPermission('gemini-api', false, [], false)).toBe(false);
    expect(hasPermission('data-retention', false, [], false)).toBe(false);
  });

  it('should check specific permission for standard tabs', () => {
    expect(hasPermission('regions', false, ['add_region'], false)).toBe(true);
    expect(hasPermission('regions', false, [], false)).toBe(false);
    expect(hasPermission('districts', false, ['add_district'], false)).toBe(true);
    expect(hasPermission('districts', false, ['add_region'], false)).toBe(false);
  });

  it('should handle multi-permission tabs (stks requires manage_stk OR add_stk)', () => {
    expect(hasPermission('stks', false, ['manage_stk'], false)).toBe(true);
    expect(hasPermission('stks', false, ['add_stk'], false)).toBe(true);
    expect(hasPermission('stks', false, [], false)).toBe(false);
  });

  it('should return false for unknown tab names', () => {
    expect(hasPermission('nonexistent-tab', false, [], false)).toBe(false);
    expect(hasPermission('nonexistent-tab', true, [], false)).toBe(true); // admin always true
  });
});
