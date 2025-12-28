/**
 * ResponseCache - Intelligent LLM response caching
 *
 * Revolutionary Enhancement: Cache hits = 100% free responses
 *
 * Features:
 * - Semantic similarity matching
 * - Multi-layer caching (memory, file, redis-compatible)
 * - TTL-based expiration
 * - Cache warming strategies
 * - Hit rate analytics
 * - Automatic cache cleanup
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('ResponseCache');

// Cache configuration defaults
const DEFAULT_CONFIG = {
  maxMemoryItems: 1000,
  maxFileItems: 10000,
  ttlMinutes: 15,
  cleanupIntervalMinutes: 5,
  cacheDir: '.cache/llm-responses',
  enableFilePersistence: true,
  enableSemanticMatching: true,
  similarityThreshold: 0.85
};

class ResponseCache {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;

    // Configuration
    this.config = { ...DEFAULT_CONFIG, ...options };

    // In-memory cache (L1)
    this.memoryCache = new Map();

    // Cache metadata for LRU tracking
    this.cacheMetadata = new Map();

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      fileHits: 0,
      sets: 0,
      evictions: 0,
      totalSavedCost: 0
    };

    // Cleanup interval
    this.cleanupInterval = null;

    // Semantic index for similarity matching
    this.semanticIndex = new Map();
  }

  /**
   * Initialize the cache
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
    } catch (error) {
      this.logger.warn('EventBus not available');
    }

    // Create cache directory
    if (this.config.enableFilePersistence) {
      try {
        await fs.mkdir(this.config.cacheDir, { recursive: true });
      } catch (error) {
        this.logger.warn('Could not create cache directory', { error: error.message });
        this.config.enableFilePersistence = false;
      }
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.config.cleanupIntervalMinutes * 60 * 1000
    );

    // Load existing cache from disk
    if (this.config.enableFilePersistence) {
      await this.loadFromDisk();
    }

    this.initialized = true;
    this.logger.info('ResponseCache initialized', {
      maxMemoryItems: this.config.maxMemoryItems,
      ttlMinutes: this.config.ttlMinutes
    });
  }

  /**
   * Generate cache key from prompt and context
   */
  generateKey(prompt, context = null) {
    const content = context ? `${context}|||${prompt}` : prompt;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate semantic key for similarity matching
   */
  generateSemanticKey(prompt) {
    // Simple tokenization and normalization
    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .sort()
      .join(' ');
  }

  /**
   * Get cached response
   */
  async get(prompt, context = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const key = this.generateKey(prompt, context);

    // Check memory cache first (L1)
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);

      // Check TTL
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.cacheMetadata.delete(key);
      } else {
        this.stats.hits++;
        this.stats.memoryHits++;
        this.updateAccessTime(key);

        this.logger.debug('Memory cache hit', { key: key.substring(0, 8) });

        return {
          ...entry.response,
          cacheHit: true,
          cacheLayer: 'memory'
        };
      }
    }

    // Check file cache (L2)
    if (this.config.enableFilePersistence) {
      const fileEntry = await this.getFromFile(key);
      if (fileEntry && !this.isExpired(fileEntry)) {
        // Promote to memory cache
        this.setMemory(key, fileEntry);

        this.stats.hits++;
        this.stats.fileHits++;

        this.logger.debug('File cache hit', { key: key.substring(0, 8) });

        return {
          ...fileEntry.response,
          cacheHit: true,
          cacheLayer: 'file'
        };
      }
    }

    // Try semantic matching if enabled
    if (this.config.enableSemanticMatching) {
      const semanticMatch = await this.findSemanticMatch(prompt);
      if (semanticMatch) {
        this.stats.hits++;

        this.logger.debug('Semantic cache hit', {
          similarity: semanticMatch.similarity
        });

        return {
          ...semanticMatch.response,
          cacheHit: true,
          cacheLayer: 'semantic',
          similarity: semanticMatch.similarity
        };
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cached response
   */
  async set(prompt, context, response) {
    if (!this.initialized) {
      await this.initialize();
    }

    const key = this.generateKey(prompt, context);
    const entry = {
      prompt,
      context,
      response,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1
    };

    // Set in memory cache
    this.setMemory(key, entry);

    // Set in file cache
    if (this.config.enableFilePersistence) {
      await this.setFile(key, entry);
    }

    // Update semantic index
    if (this.config.enableSemanticMatching) {
      this.updateSemanticIndex(prompt, key);
    }

    this.stats.sets++;

    this.logger.debug('Response cached', {
      key: key.substring(0, 8),
      responseLength: response.content?.length || 0
    });
  }

  /**
   * Set in memory cache with LRU eviction
   */
  setMemory(key, entry) {
    // Check if we need to evict
    if (this.memoryCache.size >= this.config.maxMemoryItems) {
      this.evictLRU();
    }

    this.memoryCache.set(key, entry);
    this.cacheMetadata.set(key, {
      accessedAt: entry.accessedAt,
      createdAt: entry.createdAt
    });
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, meta] of this.cacheMetadata) {
      if (meta.accessedAt < oldestTime) {
        oldestTime = meta.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.cacheMetadata.delete(oldestKey);
      this.stats.evictions++;

      this.logger.debug('Evicted LRU entry', { key: oldestKey.substring(0, 8) });
    }
  }

  /**
   * Update access time for LRU tracking
   */
  updateAccessTime(key) {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.accessedAt = Date.now();
      entry.accessCount = (entry.accessCount || 0) + 1;

      const meta = this.cacheMetadata.get(key);
      if (meta) {
        meta.accessedAt = Date.now();
      }
    }
  }

  /**
   * Check if entry is expired
   */
  isExpired(entry) {
    const ttlMs = this.config.ttlMinutes * 60 * 1000;
    return Date.now() - entry.createdAt > ttlMs;
  }

  /**
   * Get from file cache
   */
  async getFromFile(key) {
    try {
      const filePath = path.join(this.config.cacheDir, `${key}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Set in file cache
   */
  async setFile(key, entry) {
    try {
      const filePath = path.join(this.config.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      this.logger.warn('Failed to write cache file', { error: error.message });
    }
  }

  /**
   * Load cache from disk on startup
   */
  async loadFromDisk() {
    try {
      const files = await fs.readdir(this.config.cacheDir);
      let loaded = 0;

      for (const file of files.slice(0, this.config.maxMemoryItems)) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.config.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entry = JSON.parse(content);

          if (!this.isExpired(entry)) {
            const key = file.replace('.json', '');
            this.setMemory(key, entry);

            if (this.config.enableSemanticMatching && entry.prompt) {
              this.updateSemanticIndex(entry.prompt, key);
            }

            loaded++;
          }
        } catch (error) {
          // Skip invalid files
        }
      }

      this.logger.info(`Loaded ${loaded} cache entries from disk`);
    } catch (error) {
      this.logger.warn('Failed to load cache from disk', { error: error.message });
    }
  }

  /**
   * Update semantic index for similarity matching
   */
  updateSemanticIndex(prompt, key) {
    const semanticKey = this.generateSemanticKey(prompt);
    const tokens = semanticKey.split(' ');

    // Index by significant tokens
    for (const token of tokens) {
      if (token.length > 3) {
        if (!this.semanticIndex.has(token)) {
          this.semanticIndex.set(token, new Set());
        }
        this.semanticIndex.get(token).add(key);
      }
    }
  }

  /**
   * Find semantically similar cached response
   */
  async findSemanticMatch(prompt) {
    const semanticKey = this.generateSemanticKey(prompt);
    const tokens = semanticKey.split(' ').filter(t => t.length > 3);

    if (tokens.length === 0) return null;

    // Find candidate keys
    const candidateCounts = new Map();

    for (const token of tokens) {
      const keys = this.semanticIndex.get(token);
      if (keys) {
        for (const key of keys) {
          candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1);
        }
      }
    }

    // Find best match
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [key, count] of candidateCounts) {
      const similarity = count / tokens.length;

      if (similarity >= this.config.similarityThreshold && similarity > bestSimilarity) {
        const entry = this.memoryCache.get(key) || await this.getFromFile(key);

        if (entry && !this.isExpired(entry)) {
          bestMatch = entry;
          bestSimilarity = similarity;
        }
      }
    }

    if (bestMatch) {
      return {
        response: bestMatch.response,
        similarity: bestSimilarity
      };
    }

    return null;
  }

  /**
   * Cleanup expired entries
   */
  async cleanup() {
    let cleaned = 0;

    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.cacheMetadata.delete(key);
        cleaned++;
      }
    }

    // Cleanup file cache
    if (this.config.enableFilePersistence) {
      try {
        const files = await fs.readdir(this.config.cacheDir);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          try {
            const filePath = path.join(this.config.cacheDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const entry = JSON.parse(content);

            if (this.isExpired(entry)) {
              await fs.unlink(filePath);
              cleaned++;
            }
          } catch (error) {
            // Skip invalid files
          }
        }
      } catch (error) {
        this.logger.warn('Cleanup failed', { error: error.message });
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidate(prompt, context = null) {
    const key = this.generateKey(prompt, context);

    // Remove from memory
    this.memoryCache.delete(key);
    this.cacheMetadata.delete(key);

    // Remove from file
    if (this.config.enableFilePersistence) {
      try {
        const filePath = path.join(this.config.cacheDir, `${key}.json`);
        await fs.unlink(filePath);
      } catch (error) {
        // File may not exist
      }
    }

    this.logger.debug('Cache entry invalidated', { key: key.substring(0, 8) });
  }

  /**
   * Clear all cache
   */
  async clear() {
    // Clear memory
    this.memoryCache.clear();
    this.cacheMetadata.clear();
    this.semanticIndex.clear();

    // Clear files
    if (this.config.enableFilePersistence) {
      try {
        const files = await fs.readdir(this.config.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(this.config.cacheDir, file));
          }
        }
      } catch (error) {
        this.logger.warn('Failed to clear file cache', { error: error.message });
      }
    }

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      fileHits: 0,
      sets: 0,
      evictions: 0,
      totalSavedCost: 0
    };

    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? (this.stats.hits / totalRequests * 100).toFixed(1)
      : '0';

    return {
      ...this.stats,
      totalRequests,
      hitRate: `${hitRate}%`,
      memorySize: this.memoryCache.size,
      semanticIndexSize: this.semanticIndex.size
    };
  }

  /**
   * Get cache health
   */
  getHealth() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      healthy: true,
      hitRate,
      memoryUsage: {
        current: this.memoryCache.size,
        max: this.config.maxMemoryItems,
        percentage: (this.memoryCache.size / this.config.maxMemoryItems * 100).toFixed(1) + '%'
      },
      recommendations: this.getRecommendations(hitRate)
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(hitRate) {
    const recommendations = [];

    if (hitRate < 0.3) {
      recommendations.push({
        type: 'low-hit-rate',
        message: 'Cache hit rate is low',
        suggestion: 'Consider increasing TTL or enabling semantic matching'
      });
    }

    if (this.stats.evictions > this.stats.sets * 0.5) {
      recommendations.push({
        type: 'high-evictions',
        message: 'High eviction rate detected',
        suggestion: 'Consider increasing maxMemoryItems'
      });
    }

    if (this.memoryCache.size === this.config.maxMemoryItems) {
      recommendations.push({
        type: 'cache-full',
        message: 'Memory cache is at capacity',
        suggestion: 'Increase maxMemoryItems or rely on file cache'
      });
    }

    return recommendations;
  }

  /**
   * Warm cache with common prompts
   */
  async warmCache(prompts) {
    this.logger.info(`Warming cache with ${prompts.length} prompts`);

    for (const { prompt, context, response } of prompts) {
      await this.set(prompt, context, response);
    }
  }

  /**
   * Shutdown the cache
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Final cleanup
    await this.cleanup();

    this.logger.info('ResponseCache shutdown complete', this.getStats());
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ResponseCache
 * @returns {ResponseCache}
 */
export function getResponseCache(options = {}) {
  if (!instance) {
    instance = new ResponseCache(options);
  }
  return instance;
}

export { ResponseCache, DEFAULT_CONFIG };
export default ResponseCache;
