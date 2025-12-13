/**
 * BaseAnalyzer - Re-exports from foundation with test-specific extensions
 *
 * Phase 7.3: Advanced Test Analyzers
 * Extends foundation BaseAnalyzer with test-specific utilities.
 * All analyzers should import from here for consistency.
 */

import { BaseAnalyzer as FoundationBaseAnalyzer, SEVERITY, CATEGORY } from '../../../foundation/analyzers/BaseAnalyzer.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Analysis result status (test-specific)
 */
export const ANALYSIS_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * BaseAnalyzer for test analysis
 * Extends foundation with test-specific utilities
 */
export class BaseAnalyzer extends FoundationBaseAnalyzer {
  /**
   * @param {string} name - Analyzer name
   * @param {string} type - Analysis type
   */
  constructor(name, type = 'test') {
    super(name);
    this.type = type;
    this.logger = createLogger(name);
    this.analysisResults = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Start analysis timer
   */
  startAnalysis() {
    this.startTime = Date.now();
    this.logger.info(`Starting ${this.type} analysis...`);
  }

  /**
   * End analysis timer and log duration
   * @returns {number} Duration in milliseconds
   */
  endAnalysis() {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;
    this.logger.info(`${this.type} analysis completed in ${duration}ms`);
    return duration;
  }

  /**
   * Add analysis result (test-specific)
   * @param {Object} result - Result to add
   */
  addResult(result) {
    this.analysisResults.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all results
   * @returns {Array} All results
   */
  getResults() {
    return this.analysisResults;
  }

  /**
   * Get results by status
   * @param {string} status - Status to filter by
   * @returns {Array} Filtered results
   */
  getResultsByStatus(status) {
    return this.analysisResults.filter(r => r.status === status);
  }

  /**
   * Get results by severity
   * @param {string} severity - Severity to filter by
   * @returns {Array} Filtered results
   */
  getResultsBySeverity(severity) {
    return this.analysisResults.filter(r => r.severity === severity);
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.analysisResults = [];
  }

  /**
   * Generate summary statistics
   * @returns {Object} Summary stats
   */
  generateSummary() {
    const summary = {
      total: this.analysisResults.length,
      byStatus: {},
      bySeverity: {},
      duration: this.endTime && this.startTime ? this.endTime - this.startTime : 0
    };

    // Count by status
    Object.values(ANALYSIS_STATUS).forEach(status => {
      summary.byStatus[status] = this.getResultsByStatus(status).length;
    });

    // Count by severity using foundation SEVERITY
    Object.values(SEVERITY).forEach(severity => {
      summary.bySeverity[severity] = this.getResultsBySeverity(severity).length;
    });

    return summary;
  }

  /**
   * Read file
   * @param {string} filePath - File path
   * @returns {string|null} File content or null
   */
  readFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`File not found: ${filePath}`);
        return null;
      }

      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to read file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Write file
   * @param {string} filePath - File path
   * @param {string} content - Content to write
   * @returns {boolean} Success
   */
  writeFile(filePath, content) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Read JSON file
   * @param {string} filePath - File path
   * @returns {Object|null} Parsed JSON or null
   */
  readJSON(filePath) {
    const content = this.readFile(filePath);
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to parse JSON from ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Write JSON file
   * @param {string} filePath - File path
   * @param {Object} data - Data to write
   * @returns {boolean} Success
   */
  writeJSON(filePath, data) {
    try {
      const content = JSON.stringify(data, null, 2);
      return this.writeFile(filePath, content);
    } catch (error) {
      this.logger.error(`Failed to write JSON to ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Find files by pattern
   * @param {string} dir - Directory to search
   * @param {RegExp} pattern - File pattern
   * @param {boolean} recursive - Search recursively
   * @returns {Array<string>} Matched files
   */
  findFiles(dir, pattern, recursive = true) {
    const results = [];

    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && recursive) {
        // Skip common excluded directories
        if (!['node_modules', '.git', 'coverage', 'dist', 'build'].includes(entry.name)) {
          results.push(...this.findFiles(fullPath, pattern, recursive));
        }
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Calculate percentage
   * @param {number} part - Part value
   * @param {number} total - Total value
   * @returns {number} Percentage (0-100)
   */
  calculatePercentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100 * 100) / 100; // Round to 2 decimals
  }

  /**
   * Format duration in milliseconds to human-readable
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  /**
   * Export results to file
   * @param {string} filePath - Output file path
   * @param {string} format - Output format (json, txt)
   * @returns {boolean} Success
   */
  exportResults(filePath, format = 'json') {
    const summary = this.generateSummary();
    const data = {
      analyzer: this.name,
      type: this.type,
      summary,
      results: this.analysisResults,
      issues: this.issues, // Include foundation issues
      timestamp: new Date().toISOString()
    };

    if (format === 'json') {
      return this.writeJSON(filePath, data);
    } else if (format === 'txt') {
      const lines = [
        `${this.name} Analysis Report`,
        '='.repeat(50),
        `Type: ${this.type}`,
        `Duration: ${this.formatDuration(summary.duration)}`,
        `Total Results: ${summary.total}`,
        '',
        'By Status:',
        ...Object.entries(summary.byStatus).map(([status, count]) => `  ${status}: ${count}`),
        '',
        'By Severity:',
        ...Object.entries(summary.bySeverity).map(([severity, count]) => `  ${severity}: ${count}`),
        '',
        'Results:',
        ...this.analysisResults.map((result, i) => [
          `${i + 1}. ${result.message || 'No message'}`,
          `   Status: ${result.status}`,
          `   Severity: ${result.severity || 'N/A'}`,
          ''
        ].join('\n'))
      ];

      return this.writeFile(filePath, lines.join('\n'));
    }

    return false;
  }

  /**
   * Validate input
   * @param {Object} input - Input to validate
   * @param {Array<string>} requiredFields - Required fields
   * @returns {Object} Validation result
   */
  validateInput(input, requiredFields = []) {
    const errors = [];

    if (!input) {
      return { valid: false, errors: ['Input is required'] };
    }

    for (const field of requiredFields) {
      if (!(field in input) || input[field] === undefined || input[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Log analysis result
   * @param {string} message - Message
   * @param {string} status - Status
   * @param {string} severity - Severity
   * @param {Object} details - Additional details
   */
  logResult(message, status = ANALYSIS_STATUS.INFO, severity = SEVERITY.INFO, details = {}) {
    const result = {
      message,
      status,
      severity,
      ...details
    };

    this.addResult(result);

    // Log based on severity
    if (severity === SEVERITY.CRITICAL || severity === SEVERITY.HIGH || severity === SEVERITY.ERROR) {
      this.logger.error(message);
    } else if (severity === SEVERITY.MEDIUM || severity === SEVERITY.WARNING) {
      this.logger.warn(message);
    } else {
      this.logger.info(message);
    }

    return result;
  }

  /**
   * Reset analyzer state (override to also clear results)
   */
  reset() {
    super.reset();
    this.clearResults();
    this.startTime = null;
    this.endTime = null;
  }
}

// Re-export foundation constants for consistency
export { SEVERITY, CATEGORY };
