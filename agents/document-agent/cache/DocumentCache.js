import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('DocumentCache');

/**
 * Document cache system for incremental parsing
 * Caches parsed documents and detects changes
 */
class DocumentCache {
  constructor(cacheDir = './.cache/documents') {
    this.cacheDir = cacheDir;
    this.cache = new Map(); // In-memory cache
    this.initialized = false;
  }

  /**
   * Initialize the cache system
   */
  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadCacheIndex();
      this.initialized = true;
      logger.info(`Document cache initialized: ${this.cacheDir}`);
    } catch (error) {
      logger.error('Failed to initialize document cache:', error);
      throw error;
    }
  }

  /**
   * Load cache index from disk
   */
  async loadCacheIndex() {
    const indexPath = path.join(this.cacheDir, 'index.json');

    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);

      for (const [key, value] of Object.entries(index)) {
        this.cache.set(key, value);
      }

      logger.debug(`Loaded cache index: ${this.cache.size} entries`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load cache index:', error.message);
      }
      // Index doesn't exist yet, start fresh
    }
  }

  /**
   * Save cache index to disk
   */
  async saveCacheIndex() {
    const indexPath = path.join(this.cacheDir, 'index.json');
    const index = Object.fromEntries(this.cache);

    try {
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      logger.debug('Cache index saved');
    } catch (error) {
      logger.error('Failed to save cache index:', error);
    }
  }

  /**
   * Calculate file hash
   */
  async calculateHash(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      logger.error(`Failed to calculate hash for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if document has changed
   */
  async hasChanged(filePath) {
    const currentHash = await this.calculateHash(filePath);
    if (!currentHash) return true; // Assume changed if can't calculate hash

    const cached = this.cache.get(filePath);
    if (!cached) return true; // Not in cache, so it's new

    return cached.hash !== currentHash;
  }

  /**
   * Get cached document
   */
  async get(filePath) {
    const cached = this.cache.get(filePath);
    if (!cached) return null;

    // Check if file has changed
    if (await this.hasChanged(filePath)) {
      logger.debug(`Cache miss: ${filePath} (file changed)`);
      return null;
    }

    // Load cached content from disk
    try {
      const cacheFilePath = path.join(this.cacheDir, `${cached.hash}.json`);
      const data = await fs.readFile(cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      logger.debug(`Cache hit: ${filePath}`);

      return {
        ...parsed,
        cached: true,
        cacheTime: cached.timestamp
      };
    } catch (error) {
      logger.warn(`Cache file missing for ${filePath}, will reparse`);
      return null;
    }
  }

  /**
   * Set cached document
   */
  async set(filePath, parsedData) {
    const hash = await this.calculateHash(filePath);
    if (!hash) {
      logger.error(`Cannot cache ${filePath}: hash calculation failed`);
      return false;
    }

    // Save parsed data to disk
    const cacheFilePath = path.join(this.cacheDir, `${hash}.json`);

    try {
      await fs.writeFile(cacheFilePath, JSON.stringify(parsedData, null, 2));

      // Update cache index
      this.cache.set(filePath, {
        hash,
        timestamp: Date.now(),
        size: JSON.stringify(parsedData).length
      });

      await this.saveCacheIndex();

      logger.debug(`Cached: ${filePath} (${hash.slice(0, 8)}...)`);
      return true;
    } catch (error) {
      logger.error(`Failed to cache ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Clear cache for specific file
   */
  async clear(filePath) {
    const cached = this.cache.get(filePath);
    if (cached) {
      const cacheFilePath = path.join(this.cacheDir, `${cached.hash}.json`);

      try {
        await fs.unlink(cacheFilePath);
        this.cache.delete(filePath);
        await this.saveCacheIndex();
        logger.debug(`Cleared cache: ${filePath}`);
      } catch (error) {
        logger.warn(`Failed to clear cache for ${filePath}:`, error);
      }
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    try {
      // Remove all cache files
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }

      this.cache.clear();
      await this.saveCacheIndex();

      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Failed to clear all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.size || 0;
    }

    return {
      entries: this.cache.size,
      totalSizeBytes: totalSize,
      cacheDir: this.cacheDir
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateHitRate(hits, total) {
    if (total === 0) return 0;
    return ((hits / total) * 100).toFixed(2);
  }
}

// Singleton instance
let instance = null;

export function getDocumentCache() {
  if (!instance) {
    instance = new DocumentCache();
  }
  return instance;
}

export { DocumentCache };
export default DocumentCache;
