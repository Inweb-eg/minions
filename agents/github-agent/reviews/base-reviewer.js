/**
 * BaseReviewer - Abstract Base Class for Code Reviewers
 *
 * Phase 9.2: Code Review Engine
 * Base class for all code review components
 */

import { createLogger } from '../utils/logger.js';
import { Octokit } from '@octokit/rest';

/**
 * Review severity levels
 */
export const REVIEW_SEVERITY = {
  CRITICAL: 'critical',      // Must be fixed
  HIGH: 'high',              // Should be fixed
  MEDIUM: 'medium',          // Nice to fix
  LOW: 'low',                // Optional
  INFO: 'info'               // Informational
};

/**
 * Review event
 */
export const REVIEW_EVENT = {
  APPROVE: 'APPROVE',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  COMMENT: 'COMMENT'
};

/**
 * BaseReviewer
 * Abstract base class for all reviewers
 */
export class BaseReviewer {
  constructor(name, type) {
    if (this.constructor === BaseReviewer) {
      throw new Error('BaseReviewer is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.octokit = null;
    this.reviewHistory = [];
  }

  /**
   * Initialize
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
   * Review code (must be implemented by subclasses)
   * @param {Object} options - Review options
   * @returns {Promise<Object>} Review result
   */
  async review(options = {}) {
    throw new Error('review() must be implemented by subclass');
  }

  /**
   * Create review issue
   * @param {Object} issueData - Issue data
   * @returns {Object} Review issue
   */
  createIssue(issueData) {
    const {
      severity = REVIEW_SEVERITY.MEDIUM,
      message,
      file = null,
      line = null,
      suggestion = null,
      rule = null
    } = issueData;

    return {
      severity,
      message,
      file,
      line,
      suggestion,
      rule,
      reviewer: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create review result
   * @param {Object} resultData - Result data
   * @returns {Object} Review result
   */
  createResult(resultData) {
    const {
      issues = [],
      approved = false,
      event = REVIEW_EVENT.COMMENT,
      summary = null,
      metadata = {}
    } = resultData;

    const critical = issues.filter(i => i.severity === REVIEW_SEVERITY.CRITICAL).length;
    const high = issues.filter(i => i.severity === REVIEW_SEVERITY.HIGH).length;

    // Auto-determine event if not specified
    let finalEvent = event;
    if (!event) {
      if (critical > 0 || high > 0) {
        finalEvent = REVIEW_EVENT.REQUEST_CHANGES;
      } else if (issues.length === 0) {
        finalEvent = REVIEW_EVENT.APPROVE;
      } else {
        finalEvent = REVIEW_EVENT.COMMENT;
      }
    }

    return {
      approved,
      event: finalEvent,
      issues,
      summary,
      metadata,
      reviewer: this.name,
      timestamp: new Date().toISOString(),
      counts: {
        total: issues.length,
        critical,
        high,
        medium: issues.filter(i => i.severity === REVIEW_SEVERITY.MEDIUM).length,
        low: issues.filter(i => i.severity === REVIEW_SEVERITY.LOW).length,
        info: issues.filter(i => i.severity === REVIEW_SEVERITY.INFO).length
      }
    };
  }

  /**
   * Record review in history
   * @param {Object} result - Review result
   */
  recordReview(result) {
    this.reviewHistory.push({
      ...result,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 reviews
    if (this.reviewHistory.length > 100) {
      this.reviewHistory = this.reviewHistory.slice(-100);
    }
  }

  /**
   * Get review history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered history
   */
  getHistory(filter = {}) {
    let history = [...this.reviewHistory];

    if (filter.event) {
      history = history.filter(r => r.event === filter.event);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(r => new Date(r.timestamp) >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Clear review history
   */
  clearHistory() {
    this.reviewHistory = [];
    this.logger.info('Review history cleared');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const total = this.reviewHistory.length;
    const approved = this.reviewHistory.filter(r => r.event === REVIEW_EVENT.APPROVE).length;
    const changesRequested = this.reviewHistory.filter(r => r.event === REVIEW_EVENT.REQUEST_CHANGES).length;

    const totalIssues = this.reviewHistory.reduce((sum, r) => sum + r.issues.length, 0);
    const avgIssues = total > 0 ? (totalIssues / total).toFixed(2) : 0;

    return {
      total,
      approved,
      changesRequested,
      comments: total - approved - changesRequested,
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(2) : 0,
      totalIssues,
      avgIssuesPerReview: avgIssues
    };
  }

  /**
   * Format review comment
   * @param {Object} issue - Review issue
   * @returns {string} Formatted comment
   */
  formatComment(issue) {
    const severityEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '💡',
      low: 'ℹ️',
      info: '📝'
    };

    const emoji = severityEmoji[issue.severity] || '•';
    let comment = `${emoji} **[${issue.severity.toUpperCase()}]** ${issue.message}`;

    if (issue.suggestion) {
      comment += `\n\n**Suggestion:**\n\`\`\`\n${issue.suggestion}\n\`\`\``;
    }

    if (issue.rule) {
      comment += `\n\n*Rule: ${issue.rule}*`;
    }

    return comment;
  }

  /**
   * Format review summary
   * @param {Object} result - Review result
   * @returns {string} Formatted summary
   */
  formatSummary(result) {
    const lines = [];

    lines.push(`## Code Review Summary - ${this.name}`);
    lines.push('');

    if (result.issues.length === 0) {
      lines.push('✅ No issues found. Code looks good!');
    } else {
      lines.push(`Found ${result.issues.length} issue(s):`);
      lines.push('');

      Object.entries(result.counts).forEach(([severity, count]) => {
        if (count > 0 && severity !== 'total') {
          lines.push(`- ${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${count}`);
        }
      });

      lines.push('');
      lines.push('### Issues:');
      lines.push('');

      result.issues.forEach((issue, index) => {
        const location = issue.file && issue.line
          ? ` (${issue.file}:${issue.line})`
          : issue.file
            ? ` (${issue.file})`
            : '';

        lines.push(`${index + 1}. ${this.formatComment(issue)}${location}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
    lines.push('🤖 Automated review by [Claude Code](https://claude.com/claude-code)');

    return lines.join('\n');
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
}
