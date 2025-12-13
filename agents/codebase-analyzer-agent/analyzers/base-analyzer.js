/**
 * BaseAnalyzer - Extended for System-wide Codebase Analysis
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Extends foundation BaseAnalyzer with file system utilities for
 * cross-codebase analysis.
 */

import { BaseAnalyzer as FoundationBaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from '../../../foundation/analyzers/BaseAnalyzer.js';
import { getASTParser } from '../../../foundation/parsers/ASTParser.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BaseAnalyzer for system-wide codebase analysis
 */
export class BaseAnalyzer extends FoundationBaseAnalyzer {
  constructor(name) {
    super(name);
    this.logger = createLogger(name);
    this.parser = getASTParser();
    this.metrics = {};
  }

  /**
   * Parse JavaScript/TypeScript code
   * @param {string} code - Source code
   * @param {string} filePath - File path for error reporting
   * @returns {Object} AST or null if parsing fails
   */
  parseCode(code, filePath = 'unknown') {
    const result = this.parser.parse(code);
    if (!result.success) {
      this.logger.warn(`Failed to parse ${filePath}: ${result.error}`);
      return null;
    }
    return result.ast;
  }

  /**
   * Traverse AST
   * @param {Object} ast - AST to traverse
   * @param {Object} visitors - Visitor functions
   */
  traverse(ast, visitors) {
    if (!ast) return;
    this.parser.traverse(ast, visitors);
  }

  /**
   * Alias for traverse (backwards compatibility)
   */
  traverseAST(ast, visitors) {
    this.traverse(ast, visitors);
  }

  /**
   * Read file content
   * @param {string} filePath - Path to file
   * @returns {string|null} File content or null
   */
  readFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.logger.warn(`Failed to read file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Find files matching pattern
   * @param {string} directory - Directory to search
   * @param {RegExp} pattern - File pattern to match
   * @param {Array} exclude - Directories to exclude
   * @returns {Array} Array of file paths
   */
  findFiles(directory, pattern, exclude = ['node_modules', '.git', 'coverage', 'dist', 'build']) {
    const files = [];

    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!exclude.includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile() && pattern.test(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to read directory ${dir}: ${error.message}`);
      }
    };

    walk(directory);
    return files;
  }

  /**
   * Add metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   */
  addMetric(name, value) {
    this.metrics[name] = value;
  }

  /**
   * Get metrics
   * @returns {Object} All metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Get issue counts (extended for codebase analyzer)
   * @returns {Object} Counts by severity
   */
  getIssueCounts() {
    return {
      critical: this.getIssuesBySeverity('critical').length,
      high: this.getIssuesBySeverity('high').length,
      medium: this.getIssuesBySeverity('medium').length,
      low: this.getIssuesBySeverity('low').length,
      error: this.getIssuesBySeverity('error').length,
      warning: this.getIssuesBySeverity('warning').length,
      info: this.getIssuesBySeverity('info').length,
      total: this.issues.length
    };
  }

  /**
   * Create issue object (extended with codebase field)
   * @param {Object} params - Issue parameters
   * @returns {Object} Issue object
   */
  createIssue({
    type,
    severity = 'medium',
    message,
    location,
    codebase,
    file,
    code,
    suggestion = null,
    fixable = false,
    impact = null
  }) {
    return {
      type,
      severity,
      message,
      location,
      codebase,
      file,
      code,
      suggestion,
      fixable,
      impact,
      category: this.getCategory(type)
    };
  }

  /**
   * Get category for issue type
   * @param {string} type - Issue type
   * @returns {string} Category
   */
  getCategory(type) {
    // Override in subclasses for specific categorization
    return 'general';
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
      metrics: this.metrics,
      summary: {
        totalIssues: counts.total,
        critical: counts.critical,
        high: counts.high,
        medium: counts.medium,
        low: counts.low,
        info: counts.info
      },
      analyzedAt: new Date().toISOString(),
      ...additionalData
    };
  }

  /**
   * Reset analyzer state
   */
  reset() {
    this.clearIssues();
    this.metrics = {};
  }
}

export { SEVERITY, CATEGORY, CODEBASE };
