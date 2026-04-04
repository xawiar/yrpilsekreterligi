/**
 * Authentication Endpoint Tests
 * Basic tests for login success/failure scenarios.
 * Run with: node --test server/__tests__/auth.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

describe('POST /api/auth/login', () => {
  it('should reject login with missing credentials', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
    } catch (err) {
      if (err.cause?.code === 'ECONNREFUSED') {
        console.warn('Server not running, skipping auth test');
        return;
      }
      throw err;
    }
  });

  it('should reject login with wrong credentials', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nonexistent_user_xyz', password: 'wrongpass123' }),
      });
      // Should return 401 or 200 with success=false depending on implementation
      const data = await res.json();
      if (res.status === 401 || data.success === false) {
        assert.ok(true);
      } else {
        assert.fail('Expected login to fail with invalid credentials');
      }
    } catch (err) {
      if (err.cause?.code === 'ECONNREFUSED') {
        console.warn('Server not running, skipping auth test');
        return;
      }
      throw err;
    }
  });

  it('should reject login with missing password', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin' }),
      });
      assert.equal(res.status, 400);
    } catch (err) {
      if (err.cause?.code === 'ECONNREFUSED') {
        console.warn('Server not running, skipping auth test');
        return;
      }
      throw err;
    }
  });
});
