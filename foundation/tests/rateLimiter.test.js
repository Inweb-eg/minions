/**
 * RateLimiter Tests
 * ==================
 * Tests for the token bucket rate limiter.
 */

import { jest } from '@jest/globals';
import {
  RateLimiter,
  getRateLimiter,
  resetRateLimiter
} from '../resilience/RateLimiter.js';

describe('RateLimiter', () => {
  let limiter;

  beforeEach(async () => {
    resetRateLimiter();
    limiter = new RateLimiter({
      defaultLimit: 10,
      defaultWindow: 1000 // 1 second
    });
    await limiter.initialize();
  });

  afterEach(async () => {
    await limiter.shutdown();
    resetRateLimiter();
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultLimiter = new RateLimiter();

      expect(defaultLimiter.defaultLimit).toBe(100);
      expect(defaultLimiter.defaultWindow).toBe(60000);
    });

    test('creates with custom configuration', () => {
      expect(limiter.defaultLimit).toBe(10);
      expect(limiter.defaultWindow).toBe(1000);
    });

    test('initialize sets up cleanup interval', async () => {
      const newLimiter = new RateLimiter();
      await newLimiter.initialize();

      expect(newLimiter.cleanupInterval).toBeDefined();

      await newLimiter.shutdown();
    });
  });

  describe('Basic Rate Limiting', () => {
    test('allows requests within limit', () => {
      const result = limiter.check('test-key');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(10);
      expect(result.retryAfter).toBe(0);
    });

    test('denies requests exceeding limit', () => {
      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        limiter.check('test-key');
      }

      const result = limiter.check('test-key');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('tracks metrics for allowed requests', () => {
      limiter.check('test-key');

      expect(limiter.metrics.totalRequests).toBe(1);
      expect(limiter.metrics.allowedRequests).toBe(1);
    });

    test('tracks metrics for denied requests', () => {
      // Exhaust tokens
      for (let i = 0; i < 11; i++) {
        limiter.check('test-key');
      }

      expect(limiter.metrics.deniedRequests).toBe(1);
    });
  });

  describe('Custom Key Configuration', () => {
    test('configure sets custom limits', () => {
      limiter.configure('api:users', {
        limit: 5,
        window: 500
      });

      // Use 5 tokens
      for (let i = 0; i < 5; i++) {
        expect(limiter.check('api:users').allowed).toBe(true);
      }

      // Should be denied
      expect(limiter.check('api:users').allowed).toBe(false);
    });

    test('different keys have independent limits', () => {
      limiter.configure('key1', { limit: 2 });
      limiter.configure('key2', { limit: 2 });

      // Use up key1
      limiter.check('key1');
      limiter.check('key1');

      // key2 should still work
      expect(limiter.check('key2').allowed).toBe(true);
    });
  });

  describe('Token Refill', () => {
    test('tokens refill over time', async () => {
      limiter.configure('refill-test', {
        limit: 10,
        refillRate: 100 // 100 tokens per second
      });

      // Use all tokens
      for (let i = 0; i < 10; i++) {
        limiter.check('refill-test');
      }

      expect(limiter.check('refill-test').allowed).toBe(false);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have tokens again
      expect(limiter.check('refill-test').allowed).toBe(true);
    });
  });

  describe('Acquire Method', () => {
    test('acquire returns true when tokens available', async () => {
      const result = await limiter.acquire('test-key');

      expect(result).toBe(true);
    });

    test('acquire waits for tokens', async () => {
      limiter.configure('wait-test', {
        limit: 1,
        refillRate: 20 // 20 tokens per second = 1 token every 50ms
      });

      // Use the one token
      limiter.check('wait-test');

      const start = Date.now();
      const result = await limiter.acquire('wait-test', 1, 200);
      const elapsed = Date.now() - start;

      expect(result).toBe(true);
      expect(elapsed).toBeGreaterThan(30); // Should have waited for refill
    });

    test('acquire returns false if wait exceeds maxWait', async () => {
      limiter.configure('timeout-test', {
        limit: 1,
        refillRate: 1 // 1 token per second
      });

      // Use the token
      limiter.check('timeout-test');

      const result = await limiter.acquire('timeout-test', 1, 10);

      expect(result).toBe(false);
    });
  });

  describe('Status', () => {
    test('getStatus returns limit info for key', () => {
      limiter.configure('status-test', { limit: 50, window: 30000 });
      limiter.check('status-test');

      const status = limiter.getStatus('status-test');

      expect(status.key).toBe('status-test');
      expect(status.limit).toBe(50);
      expect(status.window).toBe(30000);
      expect(status.remaining).toBeLessThan(50);
    });

    test('getStatus returns defaults for unknown key', () => {
      const status = limiter.getStatus('unknown-key');

      expect(status.remaining).toBe(10); // default limit
      expect(status.limit).toBe(10);
    });
  });

  describe('Reset', () => {
    test('reset refills tokens for key', () => {
      limiter.configure('reset-test', { limit: 5 });

      // Use all tokens
      for (let i = 0; i < 5; i++) {
        limiter.check('reset-test');
      }

      expect(limiter.check('reset-test').allowed).toBe(false);

      limiter.reset('reset-test');

      expect(limiter.check('reset-test').allowed).toBe(true);
    });
  });

  describe('Metrics', () => {
    test('getMetrics returns overall statistics', () => {
      limiter.check('key1');
      limiter.check('key2');
      limiter.check('key1');

      const metrics = limiter.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.allowedRequests).toBe(3);
      expect(metrics.activeKeys).toBe(2);
    });

    test('tracks per-key metrics', () => {
      limiter.configure('per-key', { limit: 2 });

      limiter.check('per-key');
      limiter.check('per-key');
      limiter.check('per-key'); // denied

      const metrics = limiter.getMetrics();

      expect(metrics.byKey['per-key'].allowed).toBe(2);
      expect(metrics.byKey['per-key'].denied).toBe(1);
    });

    test('calculates denial rate', () => {
      limiter.configure('rate-test', { limit: 1 });

      limiter.check('rate-test');
      limiter.check('rate-test'); // denied

      const metrics = limiter.getMetrics();

      expect(parseFloat(metrics.denialRate)).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    test('cleanup removes stale buckets', async () => {
      limiter.check('cleanup-test');

      // Manually set lastRefill to be old
      const bucket = limiter.buckets.get('cleanup-test');
      bucket.lastRefill = Date.now() - 700000; // 11+ minutes ago
      bucket.tokens = bucket.capacity; // Full bucket

      limiter.cleanup();

      expect(limiter.buckets.has('cleanup-test')).toBe(false);
    });
  });

  describe('Shutdown', () => {
    test('shutdown clears buckets and intervals', async () => {
      limiter.check('test');

      await limiter.shutdown();

      expect(limiter.buckets.size).toBe(0);
    });
  });

  describe('Multiple Tokens', () => {
    test('can consume multiple tokens at once', () => {
      limiter.configure('multi-token', { limit: 10 });

      const result = limiter.check('multi-token', 5);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(5);
    });

    test('denies if not enough tokens for request', () => {
      limiter.configure('multi-deny', { limit: 3 });

      limiter.check('multi-deny', 2); // Use 2

      const result = limiter.check('multi-deny', 5); // Request 5

      expect(result.allowed).toBe(false);
    });
  });
});

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  afterEach(async () => {
    resetRateLimiter();
  });

  test('getRateLimiter returns singleton', async () => {
    const l1 = getRateLimiter();
    const l2 = getRateLimiter();

    expect(l1).toBe(l2);
  });

  test('getRateLimiter accepts options on first call', () => {
    const limiter = getRateLimiter({ defaultLimit: 50 });

    expect(limiter.defaultLimit).toBe(50);
  });

  test('resetRateLimiter clears singleton', async () => {
    const l1 = getRateLimiter();
    resetRateLimiter();
    const l2 = getRateLimiter();

    expect(l1).not.toBe(l2);
  });
});
