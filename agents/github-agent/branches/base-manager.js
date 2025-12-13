/**
 * BaseManager - Abstract Base Class for GitHub Managers
 *
 * Phase 9.1: Branch & PR Management
 * Base class for all GitHub management components
 */

import { createLogger } from '../utils/logger.js';
import { Octokit } from '@octokit/rest';

/**
 * Operation status
 */
export const OPERATION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  SKIPPED: 'skipped'
};

/**
 * BaseManager
 * Abstract base class for all GitHub managers
 */
export class BaseManager {
  constructor(name, type) {
    if (this.constructor === BaseManager) {
      throw new Error('BaseManager is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.octokit = null;
    this.operationHistory = [];
  }

  /**
   * Initialize GitHub client
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const {
      auth = process.env.GITHUB_TOKEN,
      owner = process.env.GITHUB_OWNER,
      repo = process.env.GITHUB_REPO
    } = options;

    if (!auth) {
      throw new Error('GitHub token is required');
    }

    this.octokit = new Octokit({ auth });
    this.owner = owner;
    this.repo = repo;

    this.logger.info(`Initialized ${this.name} for ${owner}/${repo}`);
  }

  /**
   * Create operation result
   * @param {Object} resultData - Result data
   * @returns {Object} Operation result
   */
  createResult(resultData) {
    const {
      success,
      status = success ? OPERATION_STATUS.SUCCESS : OPERATION_STATUS.FAILED,
      data = null,
      error = null,
      metadata = {}
    } = resultData;

    return {
      success,
      status,
      data,
      error,
      metadata,
      manager: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Record operation in history
   * @param {Object} result - Operation result
   */
  recordOperation(result) {
    this.operationHistory.push({
      ...result,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 operations
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-100);
    }
  }

  /**
   * Get operation history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered history
   */
  getHistory(filter = {}) {
    let history = [...this.operationHistory];

    if (filter.status) {
      history = history.filter(op => op.status === filter.status);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(op => new Date(op.timestamp) >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Clear operation history
   */
  clearHistory() {
    this.operationHistory = [];
    this.logger.info('Operation history cleared');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const total = this.operationHistory.length;
    const successful = this.operationHistory.filter(op => op.status === OPERATION_STATUS.SUCCESS).length;
    const failed = this.operationHistory.filter(op => op.status === OPERATION_STATUS.FAILED).length;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0
    };
  }

  /**
   * Check if initialized
   * @returns {boolean} Is initialized
   */
  isInitialized() {
    return this.octokit !== null;
  }

  /**
   * Ensure initialized
   * @throws {Error} If not initialized
   */
  ensureInitialized() {
    if (!this.isInitialized()) {
      throw new Error(`${this.name} is not initialized. Call initialize() first.`);
    }
  }

  /**
   * Get repository details
   * @returns {Promise<Object>} Repository details
   */
  async getRepository() {
    this.ensureInitialized();

    const { data } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo
    });

    return data;
  }

  /**
   * Get default branch
   * @returns {Promise<string>} Default branch name
   */
  async getDefaultBranch() {
    const repo = await this.getRepository();
    return repo.default_branch;
  }
}
