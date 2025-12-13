/**
 * BaseDetector - Abstract Base Class for Change Detectors
 *
 * Phase 8.1: Change Detectors
 * Base class for all change detection mechanisms
 */

import { createLogger } from '../utils/logger.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Change types
 */
export const CHANGE_TYPE = {
  DEPENDENCY: 'dependency',
  FILE: 'file',
  CONFIG: 'config',
  DOCKERFILE: 'dockerfile',
  COMPOSE: 'compose'
};

/**
 * Change severity levels
 */
export const CHANGE_SEVERITY = {
  CRITICAL: 'critical',  // Requires immediate rebuild
  HIGH: 'high',          // Rebuild recommended
  MEDIUM: 'medium',      // Rebuild optional
  LOW: 'low'             // No rebuild needed
};

/**
 * BaseDetector
 * Abstract base class for all change detectors
 */
export class BaseDetector {
  constructor(name, type) {
    if (this.constructor === BaseDetector) {
      throw new Error('BaseDetector is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.changeHistory = [];
    this.lastChecked = null;
  }

  /**
   * Detect changes (must be implemented by subclasses)
   * @param {Object} options - Detection options
   * @returns {Promise<Array>} Detected changes
   */
  async detect(options = {}) {
    throw new Error('detect() must be implemented by subclass');
  }

  /**
   * Get file hash for change detection
   * @param {string} filePath - Path to file
   * @returns {string} File hash
   */
  getFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      this.logger.warn(`Failed to hash file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get directory hash for change detection
   * @param {string} dirPath - Path to directory
   * @param {Array} excludes - Patterns to exclude
   * @returns {string} Directory hash
   */
  getDirectoryHash(dirPath, excludes = ['node_modules', '.git', 'dist', 'build']) {
    try {
      const files = this.getAllFiles(dirPath, excludes);
      const hashes = files.map(file => this.getFileHash(file)).filter(Boolean);

      const combined = hashes.join('');
      return crypto.createHash('sha256').update(combined).digest('hex');
    } catch (error) {
      this.logger.warn(`Failed to hash directory ${dirPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all files in directory recursively
   * @param {string} dirPath - Directory path
   * @param {Array} excludes - Patterns to exclude
   * @returns {Array} File paths
   */
  getAllFiles(dirPath, excludes = []) {
    const files = [];

    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Check if should be excluded
          if (excludes.some(pattern => fullPath.includes(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to read directory ${dir}: ${error.message}`);
      }
    };

    walk(dirPath);
    return files;
  }

  /**
   * Compare two objects for changes
   * @param {Object} oldObj - Old object
   * @param {Object} newObj - New object
   * @returns {Array} Changes detected
   */
  compareObjects(oldObj, newObj) {
    const changes = [];

    // Check for added/modified keys
    for (const key of Object.keys(newObj)) {
      if (!(key in oldObj)) {
        changes.push({
          type: 'added',
          key,
          value: newObj[key]
        });
      } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        changes.push({
          type: 'modified',
          key,
          oldValue: oldObj[key],
          newValue: newObj[key]
        });
      }
    }

    // Check for removed keys
    for (const key of Object.keys(oldObj)) {
      if (!(key in newObj)) {
        changes.push({
          type: 'removed',
          key,
          value: oldObj[key]
        });
      }
    }

    return changes;
  }

  /**
   * Categorize change severity
   * @param {Object} change - Change object
   * @returns {string} Severity level
   */
  categorizeSeverity(change) {
    // Default implementation - override in subclasses
    if (change.type === 'removed') {
      return CHANGE_SEVERITY.HIGH;
    } else if (change.type === 'added') {
      return CHANGE_SEVERITY.MEDIUM;
    } else {
      return CHANGE_SEVERITY.LOW;
    }
  }

  /**
   * Record change in history
   * @param {Object} change - Change to record
   */
  recordChange(change) {
    this.changeHistory.push({
      ...change,
      timestamp: new Date().toISOString(),
      detector: this.name
    });

    // Keep only last 100 changes
    if (this.changeHistory.length > 100) {
      this.changeHistory = this.changeHistory.slice(-100);
    }
  }

  /**
   * Get change history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered change history
   */
  getHistory(filter = {}) {
    let history = [...this.changeHistory];

    if (filter.severity) {
      history = history.filter(c => c.severity === filter.severity);
    }

    if (filter.type) {
      history = history.filter(c => c.type === filter.type);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(c => new Date(c.timestamp) >= since);
    }

    return history;
  }

  /**
   * Clear change history
   */
  clearHistory() {
    this.changeHistory = [];
    this.logger.info('Change history cleared');
  }

  /**
   * Check if rebuild is required
   * @param {Array} changes - Detected changes
   * @returns {boolean} Whether rebuild is required
   */
  requiresRebuild(changes) {
    return changes.some(change =>
      change.severity === CHANGE_SEVERITY.CRITICAL ||
      change.severity === CHANGE_SEVERITY.HIGH
    );
  }
}
