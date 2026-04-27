/**
 * ResultManager
 * -------------
 * Captures and manages agent execution results with size-aware storage.
 * Inspired by Claude Code's tool result persistence pattern.
 *
 * Small results (<= threshold): kept in memory
 * Large results (> threshold): persisted to disk with 2KB preview
 *
 * Features:
 * - Per-agent result storage with metadata
 * - Automatic disk persistence for large results
 * - Preview generation for oversized results
 * - Result retrieval API for Gru web UI
 */

import { createLogger } from '../common/logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('ResultManager');

const DEFAULT_SIZE_THRESHOLD = 50_000;  // 50KB - results larger than this go to disk
const PREVIEW_SIZE = 2_000;             // 2KB preview for large results
const RESULTS_DIR = 'foundation/data/results';

class ResultManager {
  constructor(options = {}) {
    this.sizeThreshold = options.sizeThreshold || DEFAULT_SIZE_THRESHOLD;
    this.resultsDir = options.resultsDir || RESULTS_DIR;
    this.results = new Map();  // agentName → ResultEntry[]
    this.initialized = false;

    // Metrics
    this.metrics = {
      totalCaptured: 0,
      inMemory: 0,
      onDisk: 0,
      totalBytes: 0
    };
  }

  /**
   * Initialize - create results directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.resultsDir, { recursive: true });
      this.initialized = true;
      logger.info(`ResultManager initialized (threshold: ${this.sizeThreshold} chars, dir: ${this.resultsDir})`);
    } catch (error) {
      logger.warn(`Could not create results dir: ${error.message}`);
      this.initialized = true; // Still work with in-memory only
    }
  }

  /**
   * Capture a result from an agent execution
   * @param {string} agentName
   * @param {*} result - The agent's return value
   * @param {object} metadata - { executionId, duration, timestamp }
   * @returns {ResultEntry}
   */
  async capture(agentName, result, metadata = {}) {
    if (result === undefined || result === null) return null;

    const serialized = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    const size = serialized.length;
    const timestamp = metadata.timestamp || Date.now();
    const executionId = metadata.executionId || `${agentName}-${timestamp}`;

    this.metrics.totalCaptured++;
    this.metrics.totalBytes += size;

    let entry;

    if (size <= this.sizeThreshold) {
      // Small result: keep in memory
      entry = {
        id: executionId,
        agentName,
        timestamp,
        size,
        storage: 'memory',
        data: result,
        preview: serialized.substring(0, PREVIEW_SIZE),
        hasMore: size > PREVIEW_SIZE,
        metadata
      };
      this.metrics.inMemory++;
    } else {
      // Large result: persist to disk
      entry = await this._persistToDisk(executionId, agentName, serialized, result, metadata);
      this.metrics.onDisk++;
    }

    // Store in results map (keep last 10 per agent)
    if (!this.results.has(agentName)) {
      this.results.set(agentName, []);
    }
    const agentResults = this.results.get(agentName);
    agentResults.push(entry);
    if (agentResults.length > 10) {
      agentResults.shift(); // Remove oldest
    }

    logger.debug(`Result captured: ${agentName} (${size} chars, ${entry.storage})`);
    return entry;
  }

  /**
   * Persist a large result to disk
   */
  async _persistToDisk(executionId, agentName, serialized, originalResult, metadata) {
    const filename = `${executionId}.json`;
    const filePath = path.join(this.resultsDir, filename);
    const preview = serialized.substring(0, PREVIEW_SIZE);

    try {
      const payload = {
        id: executionId,
        agentName,
        timestamp: metadata.timestamp || Date.now(),
        metadata,
        result: originalResult
      };

      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf-8' });

      return {
        id: executionId,
        agentName,
        timestamp: metadata.timestamp || Date.now(),
        size: serialized.length,
        storage: 'disk',
        filePath,
        data: null,  // Not kept in memory
        preview,
        hasMore: true,
        metadata
      };
    } catch (error) {
      logger.warn(`Failed to persist result to disk: ${error.message}`);
      // Fallback: keep preview in memory
      return {
        id: executionId,
        agentName,
        timestamp: metadata.timestamp || Date.now(),
        size: serialized.length,
        storage: 'memory-preview',
        data: null,
        preview,
        hasMore: true,
        metadata
      };
    }
  }

  /**
   * Get results for an agent
   * @param {string} agentName
   * @param {object} options - { limit, includeData }
   * @returns {ResultEntry[]}
   */
  getResults(agentName, options = {}) {
    const { limit = 10, includeData = false } = options;
    const results = this.results.get(agentName) || [];

    if (includeData) {
      return results.slice(-limit);
    }

    // Strip large data for listing
    return results.slice(-limit).map(r => ({
      id: r.id,
      agentName: r.agentName,
      timestamp: r.timestamp,
      size: r.size,
      storage: r.storage,
      preview: r.preview,
      hasMore: r.hasMore,
      metadata: r.metadata
    }));
  }

  /**
   * Get a specific result by ID (loads from disk if needed)
   * @param {string} resultId
   * @returns {Promise<*>} The full result data
   */
  async getFullResult(resultId) {
    // Search in memory
    for (const results of this.results.values()) {
      const entry = results.find(r => r.id === resultId);
      if (entry) {
        if (entry.data !== null) return entry.data;

        // Load from disk
        if (entry.filePath) {
          try {
            const content = await fs.readFile(entry.filePath, 'utf-8');
            const parsed = JSON.parse(content);
            return parsed.result;
          } catch (error) {
            logger.warn(`Failed to load result from disk: ${error.message}`);
            return entry.preview;
          }
        }

        return entry.preview;
      }
    }

    return null;
  }

  /**
   * Get all results (for API)
   * @returns {object} { agentName: ResultEntry[] }
   */
  getAllResults() {
    const all = {};
    for (const [name, results] of this.results) {
      all[name] = results.map(r => ({
        id: r.id,
        agentName: r.agentName,
        timestamp: r.timestamp,
        size: r.size,
        storage: r.storage,
        hasMore: r.hasMore,
        preview: r.preview?.substring(0, 200) // Truncate preview for listing
      }));
    }
    return all;
  }

  /**
   * Clear results for an agent or all agents
   */
  async clear(agentName) {
    if (agentName) {
      this.results.delete(agentName);
    } else {
      this.results.clear();
    }
  }

  /**
   * Clean up old result files from disk
   * @param {number} maxAge - Max age in ms (default 24h)
   */
  async cleanup(maxAge = 86_400_000) {
    try {
      const files = await fs.readdir(this.resultsDir);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.resultsDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (now - stat.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch (e) {
          // Skip files we can't stat
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} old result files`);
      }
    } catch (error) {
      logger.debug(`Cleanup skipped: ${error.message}`);
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.results.clear();
    this.metrics = {
      totalCaptured: 0,
      inMemory: 0,
      onDisk: 0,
      totalBytes: 0
    };
  }
}

// Singleton
let instance = null;

export function getResultManager() {
  if (!instance) {
    instance = new ResultManager();
  }
  return instance;
}

export function resetResultManager() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default ResultManager;
