/**
 * BaseAnalyzer - Abstract Base Class for Code Analyzers
 *
 * Shared foundation module for all agents' analyzers.
 * Provides common interface, AST parsing, and quality scoring framework.
 *
 * All analyzers (Bug, DeadCode, Performance, Security) extend this class.
 */

import { createLogger } from '../common/logger.js';

/**
 * BaseAnalyzer
 * Abstract base class for all code analyzers
 */
export class BaseAnalyzer {
  constructor(name) {
    if (this.constructor === BaseAnalyzer) {
      throw new Error('BaseAnalyzer is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.logger = createLogger(name);
    this.parser = null; // Set by subclass or via setParser()
    this.issues = [];
  }

  /**
   * Set AST parser (dependency injection)
   * @param {Object} parser - AST parser instance
   */
  setParser(parser) {
    this.parser = parser;
  }

  /**
   * Analyze code (must be implemented by subclasses)
   * @param {string} code - Source code to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyze(code, options = {}) {
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * Parse code into AST
   * @param {string} code - Source code
   * @returns {Object} Parse result with AST
   */
  parseCode(code) {
    if (!this.parser) {
      throw new Error('Parser not set. Call setParser() first.');
    }
    return this.parser.parse(code);
  }

  /**
   * Traverse AST with visitors
   * @param {Object} ast - Abstract Syntax Tree
   * @param {Object} visitors - Visitor functions
   */
  traverse(ast, visitors) {
    if (this.parser && typeof this.parser.traverse === 'function') {
      this.parser.traverse(ast, visitors);
    }
  }

  /**
   * Alias for traverse (backwards compatibility)
   */
  traverseAST(ast, visitors) {
    this.traverse(ast, visitors);
  }

  /**
   * Add issue to results
   * @param {Object} issue - Issue details
   */
  addIssue(issue) {
    const fullIssue = {
      analyzer: this.name,
      timestamp: new Date().toISOString(),
      ...issue
    };

    this.issues.push(fullIssue);
  }

  /**
   * Clear all issues
   */
  clearIssues() {
    this.issues = [];
  }

  /**
   * Get all issues
   * @returns {Array} All detected issues
   */
  getIssues() {
    return this.issues;
  }

  /**
   * Get issues by severity
   * @param {string} severity - Severity level (error, warning, info)
   * @returns {Array} Filtered issues
   */
  getIssuesBySeverity(severity) {
    return this.issues.filter(issue => issue.severity === severity);
  }

  /**
   * Get issue count by severity
   * @returns {Object} Count by severity
   */
  getIssueCounts() {
    return {
      error: this.getIssuesBySeverity('error').length,
      warning: this.getIssuesBySeverity('warning').length,
      info: this.getIssuesBySeverity('info').length,
      total: this.issues.length
    };
  }

  /**
   * Format analysis results
   * @param {Object} additionalData - Additional result data
   * @returns {Object} Formatted results
   */
  formatResults(additionalData = {}) {
    const counts = this.getIssueCounts();

    return {
      analyzer: this.name,
      success: true,
      issues: this.issues,
      counts,
      summary: {
        totalIssues: counts.total,
        errors: counts.error,
        warnings: counts.warning,
        info: counts.info
      },
      analyzedAt: new Date().toISOString(),
      ...additionalData
    };
  }

  /**
   * Create issue object
   * @param {Object} params - Issue parameters
   * @returns {Object} Issue object
   */
  createIssue({
    type,
    severity = 'warning',
    message,
    location,
    code,
    category = 'general',
    suggestion = null,
    fixable = false
  }) {
    return {
      type,
      severity,
      message,
      location,
      code,
      category,
      suggestion,
      fixable,
      rule: this.getRule(type)
    };
  }

  /**
   * Get rule details for issue type
   * @param {string} type - Issue type
   * @returns {Object} Rule details
   */
  getRule(type) {
    // Override in subclasses to provide specific rules
    return {
      id: type,
      category: 'general',
      docs: null
    };
  }

  /**
   * Check if code has syntax errors
   * @param {string} code - Source code
   * @returns {Object} Validation result
   */
  validateSyntax(code) {
    const parseResult = this.parseCode(code);

    if (!parseResult.success) {
      return {
        valid: false,
        error: parseResult.error,
        location: parseResult.location
      };
    }

    return {
      valid: true,
      ast: parseResult.ast
    };
  }

  /**
   * Get statistics from analysis
   * @returns {Object} Analysis statistics
   */
  getStatistics() {
    const counts = this.getIssueCounts();

    return {
      analyzer: this.name,
      totalIssues: counts.total,
      byType: this.groupIssuesByType(),
      bySeverity: {
        errors: counts.error,
        warnings: counts.warning,
        info: counts.info
      },
      fixableIssues: this.issues.filter(i => i.fixable).length
    };
  }

  /**
   * Group issues by type
   * @returns {Object} Issues grouped by type
   */
  groupIssuesByType() {
    const grouped = {};

    this.issues.forEach(issue => {
      if (!grouped[issue.type]) {
        grouped[issue.type] = 0;
      }
      grouped[issue.type]++;
    });

    return grouped;
  }

  /**
   * Filter issues by criteria
   * @param {Function} predicate - Filter function
   * @returns {Array} Filtered issues
   */
  filterIssues(predicate) {
    return this.issues.filter(predicate);
  }

  /**
   * Get fixable issues
   * @returns {Array} Issues that can be auto-fixed
   */
  getFixableIssues() {
    return this.filterIssues(issue => issue.fixable === true);
  }

  /**
   * Get critical issues (errors only)
   * @returns {Array} Critical issues
   */
  getCriticalIssues() {
    return this.getIssuesBySeverity('error');
  }

  /**
   * Check if analysis found any issues
   * @returns {boolean} True if issues found
   */
  hasIssues() {
    return this.issues.length > 0;
  }

  /**
   * Check if analysis found critical issues
   * @returns {boolean} True if critical issues found
   */
  hasCriticalIssues() {
    return this.getCriticalIssues().length > 0;
  }

  /**
   * Reset analyzer state
   */
  reset() {
    this.clearIssues();
  }

  /**
   * Find pattern in code
   * @param {string} code - Source code
   * @param {RegExp} pattern - Pattern to find
   * @returns {Array} Matches with line numbers
   */
  findPattern(code, pattern) {
    const matches = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        matches.push({
          line: index + 1,
          column: match.index,
          match: match[0],
          fullLine: line.trim()
        });
      }
    });

    return matches;
  }

  /**
   * Count occurrences of pattern
   * @param {string} code - Source code
   * @param {RegExp} pattern - Pattern to count
   * @returns {number} Count
   */
  countPattern(code, pattern) {
    const matches = code.match(pattern);
    return matches ? matches.length : 0;
  }
}

/**
 * Analyzer severity levels (standard)
 */
export const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  // Extended severity levels for comprehensive analysis
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Issue categories
 */
export const CATEGORY = {
  BUG: 'bug',
  DEAD_CODE: 'dead-code',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  ARCHITECTURE: 'architecture',
  COMPLEXITY: 'complexity',
  STYLE: 'style',
  NULL_SAFETY: 'null-safety',
  TECHNICAL_DEBT: 'technical-debt',
  DEPENDENCY: 'dependency',
  API_CONTRACT: 'api-contract'
};

/**
 * Codebase identifiers
 */
export const CODEBASE = {
  BACKEND: 'backend',
  USERS_APP: 'users-app',
  DRIVERS_APP: 'drivers-app',
  ADMIN_DASHBOARD: 'admin-dashboard'
};

/**
 * Get BaseAnalyzer class (for extension)
 */
export function getBaseAnalyzer() {
  return BaseAnalyzer;
}

export default BaseAnalyzer;
