/**
 * BaseValidator - Abstract Base Class for Docker Validators
 *
 * Phase 8.3: Validators
 * Base class for all Docker validation mechanisms
 */

import { createLogger } from '../utils/logger.js';

/**
 * Validation severity levels
 */
export const VALIDATION_SEVERITY = {
  ERROR: 'error',       // Must be fixed
  WARNING: 'warning',   // Should be fixed
  INFO: 'info',         // Nice to have
  SUGGESTION: 'suggestion' // Optional improvement
};

/**
 * Validation status
 */
export const VALIDATION_STATUS = {
  PASSED: 'passed',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

/**
 * BaseValidator
 * Abstract base class for all validators
 */
export class BaseValidator {
  constructor(name, type) {
    if (this.constructor === BaseValidator) {
      throw new Error('BaseValidator is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.validationHistory = [];
  }

  /**
   * Validate (must be implemented by subclasses)
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(options = {}) {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Create validation issue
   * @param {Object} issueData - Issue data
   * @returns {Object} Validation issue
   */
  createIssue(issueData) {
    const {
      severity = VALIDATION_SEVERITY.WARNING,
      message,
      line = null,
      code = null,
      suggestion = null,
      documentation = null
    } = issueData;

    return {
      severity,
      message,
      line,
      code,
      suggestion,
      documentation,
      validator: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create validation result
   * @param {Object} resultData - Result data
   * @returns {Object} Validation result
   */
  createResult(resultData) {
    const {
      valid,
      issues = [],
      warnings = [],
      suggestions = [],
      metadata = {}
    } = resultData;

    const errors = issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR);
    const warningsList = issues.filter(i => i.severity === VALIDATION_SEVERITY.WARNING);
    const infoList = issues.filter(i => i.severity === VALIDATION_SEVERITY.INFO);
    const suggestionsList = issues.filter(i => i.severity === VALIDATION_SEVERITY.SUGGESTION);

    const status = errors.length > 0
      ? VALIDATION_STATUS.FAILED
      : warningsList.length > 0
        ? VALIDATION_STATUS.PARTIAL
        : VALIDATION_STATUS.PASSED;

    return {
      valid,
      status,
      errors,
      warnings: warningsList,
      info: infoList,
      suggestions: suggestionsList,
      allIssues: issues,
      metadata,
      validator: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if validation passed
   * @param {Object} result - Validation result
   * @returns {boolean} Passed
   */
  isPassed(result) {
    return result.status === VALIDATION_STATUS.PASSED;
  }

  /**
   * Check if validation failed
   * @param {Object} result - Validation result
   * @returns {boolean} Failed
   */
  isFailed(result) {
    return result.status === VALIDATION_STATUS.FAILED;
  }

  /**
   * Get errors from result
   * @param {Object} result - Validation result
   * @returns {Array} Errors
   */
  getErrors(result) {
    return result.errors || [];
  }

  /**
   * Get warnings from result
   * @param {Object} result - Validation result
   * @returns {Array} Warnings
   */
  getWarnings(result) {
    return result.warnings || [];
  }

  /**
   * Format validation message
   * @param {Object} issue - Validation issue
   * @returns {string} Formatted message
   */
  formatMessage(issue) {
    let message = `[${issue.severity.toUpperCase()}] ${issue.message}`;

    if (issue.line) {
      message = `Line ${issue.line}: ${message}`;
    }

    if (issue.code) {
      message += ` (${issue.code})`;
    }

    if (issue.suggestion) {
      message += `\n  Suggestion: ${issue.suggestion}`;
    }

    return message;
  }

  /**
   * Format validation result
   * @param {Object} result - Validation result
   * @returns {string} Formatted result
   */
  formatResult(result) {
    const lines = [];

    lines.push(`Validation: ${result.status.toUpperCase()}`);
    lines.push(`Validator: ${result.validator}`);
    lines.push('---');

    if (result.errors.length > 0) {
      lines.push(`Errors: ${result.errors.length}`);
      result.errors.forEach(err => {
        lines.push(`  - ${this.formatMessage(err)}`);
      });
    }

    if (result.warnings.length > 0) {
      lines.push(`Warnings: ${result.warnings.length}`);
      result.warnings.forEach(warn => {
        lines.push(`  - ${this.formatMessage(warn)}`);
      });
    }

    if (result.suggestions.length > 0) {
      lines.push(`Suggestions: ${result.suggestions.length}`);
      result.suggestions.forEach(sugg => {
        lines.push(`  - ${this.formatMessage(sugg)}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Record validation in history
   * @param {Object} result - Validation result
   */
  recordValidation(result) {
    this.validationHistory.push({
      ...result,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 validations
    if (this.validationHistory.length > 100) {
      this.validationHistory = this.validationHistory.slice(-100);
    }
  }

  /**
   * Get validation history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered history
   */
  getHistory(filter = {}) {
    let history = [...this.validationHistory];

    if (filter.status) {
      history = history.filter(v => v.status === filter.status);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(v => new Date(v.timestamp) >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Clear validation history
   */
  clearHistory() {
    this.validationHistory = [];
    this.logger.info('Validation history cleared');
  }

  /**
   * Get validation statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const total = this.validationHistory.length;
    const passed = this.validationHistory.filter(v => v.status === VALIDATION_STATUS.PASSED).length;
    const failed = this.validationHistory.filter(v => v.status === VALIDATION_STATUS.FAILED).length;
    const partial = this.validationHistory.filter(v => v.status === VALIDATION_STATUS.PARTIAL).length;

    return {
      total,
      passed,
      failed,
      partial,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0,
      failRate: total > 0 ? ((failed / total) * 100).toFixed(2) : 0
    };
  }

  /**
   * Validate multiple items
   * @param {Array} items - Items to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Array>} Validation results
   */
  async validateMultiple(items, options = {}) {
    const results = [];

    for (const item of items) {
      try {
        const result = await this.validate({ ...options, item });
        results.push(result);
      } catch (error) {
        this.logger.error(`Validation failed for item: ${error.message}`);
        results.push(this.createResult({
          valid: false,
          issues: [
            this.createIssue({
              severity: VALIDATION_SEVERITY.ERROR,
              message: `Validation error: ${error.message}`
            })
          ]
        }));
      }
    }

    return results;
  }

  /**
   * Aggregate validation results
   * @param {Array} results - Validation results
   * @returns {Object} Aggregated result
   */
  aggregateResults(results) {
    const allIssues = [];
    let overallValid = true;

    results.forEach(result => {
      if (result.allIssues) {
        allIssues.push(...result.allIssues);
      }
      if (!result.valid) {
        overallValid = false;
      }
    });

    return this.createResult({
      valid: overallValid,
      issues: allIssues,
      metadata: {
        totalValidations: results.length,
        passed: results.filter(r => r.status === VALIDATION_STATUS.PASSED).length,
        failed: results.filter(r => r.status === VALIDATION_STATUS.FAILED).length,
        partial: results.filter(r => r.status === VALIDATION_STATUS.PARTIAL).length
      }
    });
  }
}
