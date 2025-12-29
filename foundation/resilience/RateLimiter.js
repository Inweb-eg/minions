/**
 * RateLimiter
 * -----------
 * Token bucket rate limiter for controlling request rates.
 * Supports per-key rate limiting with configurable limits.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { InfrastructureEvents } from '../event-bus/eventTypes.js';

const logger = createLogger('RateLimiter');

/**
 * Token bucket implementation for rate limiting
 */
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  consume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getTokens() {
    this.refill();
    return this.tokens;
  }

  getWaitTime(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      return 0;
    }
    const tokensNeeded = tokens - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000);
  }
}

/**
 * RateLimiter class with multiple strategies
 */
export class RateLimiter {
  constructor(options = {}) {
    this.defaultLimit = options.defaultLimit || 100; // requests per window
    this.defaultWindow = options.defaultWindow || 60000; // 1 minute
    this.defaultRefillRate = options.defaultRefillRate || (this.defaultLimit / (this.defaultWindow / 1000));

    this.buckets = new Map(); // key -> TokenBucket
    this.keyLimits = new Map(); // key -> { limit, window, refillRate }
    this.eventBus = null;
    this.warningThreshold = options.warningThreshold || 0.2; // 20% remaining

    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      byKey: new Map()
    };

    // Cleanup interval
    this.cleanupInterval = null;
  }

  /**
   * Initialize the rate limiter
   */
  async initialize() {
    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available');
    }

    // Start cleanup interval to remove stale buckets
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // Every 5 minutes

    logger.info('RateLimiter initialized', {
      defaultLimit: this.defaultLimit,
      defaultWindow: this.defaultWindow
    });
  }

  /**
   * Configure rate limit for a specific key
   * @param {string} key - The key to configure (e.g., 'api:users', 'agent:tom')
   * @param {object} config - Rate limit configuration
   */
  configure(key, config = {}) {
    const limit = config.limit || this.defaultLimit;
    const window = config.window || this.defaultWindow;
    const refillRate = config.refillRate || (limit / (window / 1000));

    this.keyLimits.set(key, { limit, window, refillRate });

    // Create or update bucket
    this.buckets.set(key, new TokenBucket(limit, refillRate));

    logger.debug(`Rate limit configured for ${key}`, { limit, window });
  }

  /**
   * Check if a request is allowed
   * @param {string} key - The rate limit key
   * @param {number} tokens - Number of tokens to consume (default: 1)
   * @returns {object} { allowed, remaining, retryAfter }
   */
  check(key, tokens = 1) {
    this.metrics.totalRequests++;

    let bucket = this.buckets.get(key);

    if (!bucket) {
      // Create default bucket
      const config = this.keyLimits.get(key) || {
        limit: this.defaultLimit,
        refillRate: this.defaultRefillRate
      };
      bucket = new TokenBucket(config.limit, config.refillRate);
      this.buckets.set(key, bucket);
    }

    const remaining = bucket.getTokens();
    const allowed = bucket.consume(tokens);

    // Update metrics
    this.updateMetrics(key, allowed);

    if (allowed) {
      this.metrics.allowedRequests++;

      // Check warning threshold
      const newRemaining = bucket.getTokens();
      const config = this.keyLimits.get(key) || { limit: this.defaultLimit };
      if (newRemaining / config.limit <= this.warningThreshold) {
        this.publishWarning(key, newRemaining, config.limit);
      }

      return {
        allowed: true,
        remaining: Math.floor(newRemaining),
        retryAfter: 0
      };
    } else {
      this.metrics.deniedRequests++;
      const retryAfter = bucket.getWaitTime(tokens);

      this.publishExceeded(key, retryAfter);

      return {
        allowed: false,
        remaining: 0,
        retryAfter
      };
    }
  }

  /**
   * Acquire tokens, waiting if necessary
   * @param {string} key - The rate limit key
   * @param {number} tokens - Number of tokens to consume
   * @param {number} maxWait - Maximum wait time in ms (default: 30000)
   * @returns {Promise<boolean>} Whether tokens were acquired
   */
  async acquire(key, tokens = 1, maxWait = 30000) {
    const result = this.check(key, tokens);

    if (result.allowed) {
      return true;
    }

    if (result.retryAfter > maxWait) {
      return false;
    }

    // Wait and retry
    await this.sleep(result.retryAfter);
    return this.check(key, tokens).allowed;
  }

  /**
   * Get current status for a key
   * @param {string} key - The rate limit key
   * @returns {object} Rate limit status
   */
  getStatus(key) {
    const bucket = this.buckets.get(key);
    const config = this.keyLimits.get(key) || {
      limit: this.defaultLimit,
      window: this.defaultWindow
    };

    if (!bucket) {
      return {
        key,
        remaining: config.limit,
        limit: config.limit,
        window: config.window,
        resetIn: 0
      };
    }

    const remaining = bucket.getTokens();
    return {
      key,
      remaining: Math.floor(remaining),
      limit: config.limit,
      window: config.window,
      resetIn: bucket.getWaitTime(config.limit - remaining)
    };
  }

  /**
   * Reset rate limit for a key
   * @param {string} key - The rate limit key
   */
  reset(key) {
    const config = this.keyLimits.get(key) || {
      limit: this.defaultLimit,
      refillRate: this.defaultRefillRate
    };
    this.buckets.set(key, new TokenBucket(config.limit, config.refillRate));
    logger.debug(`Rate limit reset for ${key}`);
  }

  /**
   * Get metrics
   * @returns {object} Rate limiter metrics
   */
  getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      allowedRequests: this.metrics.allowedRequests,
      deniedRequests: this.metrics.deniedRequests,
      denialRate: this.metrics.totalRequests > 0
        ? (this.metrics.deniedRequests / this.metrics.totalRequests * 100).toFixed(2)
        : 0,
      activeKeys: this.buckets.size,
      byKey: Object.fromEntries(this.metrics.byKey)
    };
  }

  /**
   * Update per-key metrics
   */
  updateMetrics(key, allowed) {
    if (!this.metrics.byKey.has(key)) {
      this.metrics.byKey.set(key, { allowed: 0, denied: 0 });
    }
    const keyMetrics = this.metrics.byKey.get(key);
    if (allowed) {
      keyMetrics.allowed++;
    } else {
      keyMetrics.denied++;
    }
  }

  /**
   * Publish rate limit exceeded event
   */
  publishExceeded(key, retryAfter) {
    if (this.eventBus) {
      this.eventBus.publish(InfrastructureEvents.RATE_LIMIT_EXCEEDED, {
        key,
        retryAfter,
        timestamp: Date.now()
      });
    }
    logger.warn(`Rate limit exceeded for ${key}`, { retryAfter });
  }

  /**
   * Publish rate limit warning event
   */
  publishWarning(key, remaining, limit) {
    if (this.eventBus) {
      this.eventBus.publish(InfrastructureEvents.RATE_LIMIT_WARNING, {
        key,
        remaining,
        limit,
        timestamp: Date.now()
      });
    }
    logger.debug(`Rate limit warning for ${key}`, { remaining, limit });
  }

  /**
   * Cleanup stale buckets
   */
  cleanup() {
    const now = Date.now();
    const staleThreshold = 600000; // 10 minutes

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > staleThreshold && bucket.tokens >= bucket.capacity) {
        this.buckets.delete(key);
        logger.debug(`Cleaned up stale bucket: ${key}`);
      }
    }
  }

  /**
   * Shutdown the rate limiter
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
    logger.info('RateLimiter shutdown');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let instance = null;

export function getRateLimiter(options) {
  if (!instance) {
    instance = new RateLimiter(options);
  }
  return instance;
}

export function resetRateLimiter() {
  if (instance) {
    instance.shutdown();
  }
  instance = null;
}

export default RateLimiter;
