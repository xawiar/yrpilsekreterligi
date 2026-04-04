/**
 * Health Endpoint Tests
 * Basic smoke tests for the /api/health endpoint.
 * Run with: node --test server/__tests__/health.test.js
 * (Uses Node.js built-in test runner, no external dependencies needed)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

describe('GET /api/health', () => {
  it('should return 200 with server status', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.message, 'Response should have a message field');
      assert.ok(typeof data.uptimeSec === 'number', 'Response should have uptimeSec');
      assert.ok(typeof data.rssMB === 'number', 'Response should have rssMB');
      assert.ok(['ok', 'error'].includes(data.db), 'db should be ok or error');
    } catch (err) {
      if (err.cause?.code === 'ECONNREFUSED') {
        console.warn('Server not running, skipping health test');
        return;
      }
      throw err;
    }
  });
});

describe('GET /', () => {
  it('should return API info', async () => {
    try {
      const res = await fetch(`${BASE_URL}/`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.endpoints, 'Should list endpoints');
      assert.ok(data.endpoints.health, 'Should include health endpoint');
    } catch (err) {
      if (err.cause?.code === 'ECONNREFUSED') {
        console.warn('Server not running, skipping root test');
        return;
      }
      throw err;
    }
  });
});
