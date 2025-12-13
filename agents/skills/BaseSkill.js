/**
 * BaseSkill - Base Class for All Skills
 *
 * Provides common functionality for all skills in the system:
 * - EventBus integration
 * - Initialization lifecycle
 * - Status tracking
 * - Issue management (similar to BaseAnalyzer pattern)
 * - Logging
 *
 * All skills should extend this class for consistency.
 */

import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { createLogger } from '../../foundation/common/logger.js';

/**
 * Skill status constants
 */
export const SKILL_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Issue severity constants (aligned with foundation)
 */
export const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * Issue category constants
 */
export const CATEGORY = {
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  QUALITY: 'quality',
  STYLE: 'style',
  BUG: 'bug',
  TEST: 'test',
  DEPENDENCY: 'dependency'
};

/**
 * BaseSkill - Abstract base class for skills
 */
export class BaseSkill {
  /**
   * @param {string} name - Skill name
   * @param {Object} options - Skill options
   */
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.logger = createLogger(name);

    // EventBus integration
    this.eventBus = null;
    this.EventTypes = EventTypes;
    this.unsubscribers = [];

    // State tracking
    this.initialized = false;
    this.status = SKILL_STATUS.IDLE;
    this.lastRunTime = null;
    this.runCount = 0;

    // Issue tracking (aligned with BaseAnalyzer pattern)
    this.issues = [];
    this.results = [];
  }

  /**
   * Initialize the skill
   * Override in subclasses to add custom initialization
   */
  async initialize() {
    if (this.initialized) return;

    this.logger.info(`Initializing ${this.name} skill...`);

    try {
      this.eventBus = getEventBus();

      if (this.eventBus) {
        this.subscribeToEvents();
      }

      // Call subclass initialization
      await this.onInitialize();

      this.initialized = true;
      this.logger.info(`${this.name} initialized successfully`);

      // Publish ready event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.SKILL_READY, {
          skill: this.name,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Override in subclasses for custom initialization
   */
  async onInitialize() {
    // Subclasses can override this
  }

  /**
   * Subscribe to EventBus events
   * Override in subclasses to add custom subscriptions
   */
  subscribeToEvents() {
    // Subclasses can override this to add event subscriptions
  }

  /**
   * Add an event subscription
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Event handler
   */
  subscribe(eventType, handler) {
    if (!this.eventBus) return;

    const unsubscribe = this.eventBus.subscribe(
      eventType,
      this.name,
      handler.bind(this)
    );
    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Publish an event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  publish(eventType, data) {
    if (this.eventBus) {
      this.eventBus.publish(eventType, {
        ...data,
        source: this.name
      });
    }
  }

  /**
   * Shutdown the skill
   */
  async shutdown() {
    this.logger.info(`Shutting down ${this.name}...`);

    // Unsubscribe from events
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    // Call subclass shutdown
    await this.onShutdown();

    this.initialized = false;
    this.logger.info(`${this.name} shut down`);
  }

  /**
   * Override in subclasses for custom shutdown
   */
  async onShutdown() {
    // Subclasses can override this
  }

  // ==================== Issue Management ====================

  /**
   * Add an issue (aligned with BaseAnalyzer pattern)
   * @param {Object} issue - Issue to add
   */
  addIssue(issue) {
    this.issues.push({
      ...issue,
      skill: this.name,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a standardized issue object
   * @param {Object} params - Issue parameters
   * @returns {Object} Standardized issue
   */
  createIssue({
    type,
    severity = SEVERITY.INFO,
    category = CATEGORY.QUALITY,
    message,
    file = null,
    line = null,
    column = null,
    code = null,
    suggestion = null,
    fixable = false
  }) {
    return {
      type,
      severity,
      category,
      message,
      location: file ? { file, line, column } : null,
      code,
      suggestion,
      fixable
    };
  }

  /**
   * Get all issues
   * @returns {Array} All issues
   */
  getIssues() {
    return this.issues;
  }

  /**
   * Get issues by severity
   * @param {string} severity - Severity level
   * @returns {Array} Filtered issues
   */
  getIssuesBySeverity(severity) {
    return this.issues.filter(i => i.severity === severity);
  }

  /**
   * Get issues by category
   * @param {string} category - Category
   * @returns {Array} Filtered issues
   */
  getIssuesByCategory(category) {
    return this.issues.filter(i => i.category === category);
  }

  /**
   * Get fixable issues
   * @returns {Array} Fixable issues
   */
  getFixableIssues() {
    return this.issues.filter(i => i.fixable);
  }

  /**
   * Clear all issues
   */
  clearIssues() {
    this.issues = [];
  }

  // ==================== Result Management ====================

  /**
   * Add a result
   * @param {Object} result - Result to add
   */
  addResult(result) {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all results
   * @returns {Array} All results
   */
  getResults() {
    return this.results;
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.results = [];
  }

  // ==================== Status & Statistics ====================

  /**
   * Get skill status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.initialized,
      status: this.status,
      lastRunTime: this.lastRunTime,
      runCount: this.runCount,
      issueCount: this.issues.length,
      resultCount: this.results.length
    };
  }

  /**
   * Get skill statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const issuesBySeverity = {};
    Object.values(SEVERITY).forEach(sev => {
      issuesBySeverity[sev] = this.getIssuesBySeverity(sev).length;
    });

    const issuesByCategory = {};
    Object.values(CATEGORY).forEach(cat => {
      issuesByCategory[cat] = this.getIssuesByCategory(cat).length;
    });

    return {
      runCount: this.runCount,
      totalIssues: this.issues.length,
      issuesBySeverity,
      issuesByCategory,
      fixableIssues: this.getFixableIssues().length
    };
  }

  /**
   * Generate summary of issues
   * @returns {Object} Summary
   */
  generateSummary() {
    const counts = {};
    Object.values(SEVERITY).forEach(sev => {
      counts[sev] = this.getIssuesBySeverity(sev).length;
    });

    const parts = [];
    if (counts.critical) parts.push(`${counts.critical} critical`);
    if (counts.high) parts.push(`${counts.high} high`);
    if (counts.medium) parts.push(`${counts.medium} medium`);
    if (counts.low) parts.push(`${counts.low} low`);
    if (counts.info) parts.push(`${counts.info} info`);

    return {
      total: this.issues.length,
      bySeverity: counts,
      summary: parts.length > 0
        ? `Found ${this.issues.length} issue(s): ${parts.join(', ')}`
        : 'No issues found'
    };
  }

  // ==================== Execution Helpers ====================

  /**
   * Mark skill as running
   */
  startRun() {
    this.status = SKILL_STATUS.RUNNING;
    this.lastRunTime = new Date().toISOString();
    this.runCount++;
    this.clearIssues();
    this.clearResults();
  }

  /**
   * Mark skill as completed
   */
  completeRun() {
    this.status = SKILL_STATUS.COMPLETED;
  }

  /**
   * Mark skill as failed
   * @param {Error} error - Error that caused failure
   */
  failRun(error) {
    this.status = SKILL_STATUS.FAILED;
    this.logger.error(`${this.name} run failed:`, error);
  }

  /**
   * Reset skill state
   */
  reset() {
    this.clearIssues();
    this.clearResults();
    this.status = SKILL_STATUS.IDLE;
  }
}

/**
 * Get singleton instance helper
 * @param {Function} SkillClass - Skill class to instantiate
 * @param {Object} options - Options to pass to constructor
 * @returns {Function} Getter function
 */
export function createSkillGetter(SkillClass, options = {}) {
  let instance = null;
  return (instanceOptions = {}) => {
    if (!instance) {
      instance = new SkillClass({ ...options, ...instanceOptions });
    }
    return instance;
  };
}

export default BaseSkill;
