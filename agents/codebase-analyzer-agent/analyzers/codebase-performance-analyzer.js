/**
 * CodebasePerformanceAnalyzer - Codebase-Level Performance Analysis Wrapper
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Wraps foundation PerformanceAnalyzer to work with codebase paths
 * instead of single code inputs.
 *
 * This is the adapter that bridges:
 * - codebase-analyzer interface: analyze(codebasePaths, options)
 * - foundation PerformanceAnalyzer interface: analyze(code, options)
 */

import { BaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from './base-analyzer.js';
import { PerformanceAnalyzer } from '../../../foundation/analyzers/PerformanceAnalyzer.js';

/**
 * CodebasePerformanceAnalyzer
 * Iterates over all files in codebases and runs performance analysis
 */
export class CodebasePerformanceAnalyzer extends BaseAnalyzer {
  constructor() {
    super('CodebasePerformanceAnalyzer');
    this.foundationAnalyzer = new PerformanceAnalyzer();
    // Share the parser with foundation analyzer
    this.foundationAnalyzer.setParser(this.parser);
  }

  /**
   * Analyze performance across all codebases
   * @param {Object} codebasePaths - Paths to all codebases
   * @param {Object} options - Analysis options
   * @returns {Object} Aggregated analysis results
   */
  async analyze(codebasePaths, options = {}) {
    this.logger.info('Starting codebase-wide performance analysis');
    this.clearIssues();
    this.metrics = {};

    // Only analyze JavaScript/TypeScript files for performance
    // (The foundation PerformanceAnalyzer is designed for Node.js code)
    const filePatterns = {
      backend: /\.(js|ts|mjs)$/,
      adminDashboard: /\.(js|jsx|ts|tsx)$/
    };

    let totalFilesScanned = 0;
    const issuesByCodebase = {};

    // Analyze each JavaScript/TypeScript codebase
    for (const [codebaseKey, codebasePath] of Object.entries(codebasePaths)) {
      if (!codebasePath) continue;

      // Skip Flutter apps - foundation PerformanceAnalyzer is for JS/TS
      if (codebaseKey === 'usersApp' || codebaseKey === 'driversApp') {
        this.logger.debug(`Skipping ${codebaseKey} - Flutter performance analysis not supported by this analyzer`);
        continue;
      }

      const codebaseId = this.mapCodebaseKey(codebaseKey);
      this.logger.debug(`Scanning ${codebaseId} for performance issues`);

      const pattern = filePatterns[codebaseKey] || /\.(js|ts)$/;
      const files = this.findFiles(codebasePath, pattern);

      issuesByCodebase[codebaseId] = [];

      for (const filePath of files) {
        const code = this.readFile(filePath);
        if (!code) continue;

        totalFilesScanned++;

        // Run foundation performance analyzer
        try {
          this.foundationAnalyzer.clearIssues();
          await this.foundationAnalyzer.analyze(code, options);

          // Collect issues and add codebase/file context
          const fileIssues = this.foundationAnalyzer.getIssues();
          for (const issue of fileIssues) {
            const enrichedIssue = this.createIssue({
              type: issue.type,
              severity: this.mapSeverity(issue.severity),
              message: issue.message,
              location: issue.location,
              codebase: codebaseId,
              file: filePath,
              code: issue.code,
              suggestion: issue.suggestion,
              fixable: issue.fixable,
              impact: this.getImpact(issue.type)
            });

            this.addIssue(enrichedIssue);
            issuesByCodebase[codebaseId].push(enrichedIssue);
          }
        } catch (error) {
          this.logger.debug(`Error analyzing ${filePath}: ${error.message}`);
        }
      }

      this.logger.debug(`${codebaseId}: ${issuesByCodebase[codebaseId].length} performance issues found`);
    }

    // Generate metrics
    this.addMetric('totalFilesScanned', totalFilesScanned);
    this.addMetric('issuesByCodebase', Object.fromEntries(
      Object.entries(issuesByCodebase).map(([k, v]) => [k, v.length])
    ));
    this.addMetric('issuesByType', this.groupIssuesByType());

    this.logger.info(`Performance analysis complete: ${this.issues.length} issues found across ${totalFilesScanned} files`);

    return this.formatResults({
      codebasesScanned: Object.keys(issuesByCodebase).length,
      filesScanned: totalFilesScanned
    });
  }

  /**
   * Map codebase key to standard CODEBASE identifier
   * @param {string} key - Codebase key from paths object
   * @returns {string} Standard codebase identifier
   */
  mapCodebaseKey(key) {
    const mapping = {
      backend: CODEBASE.BACKEND,
      usersApp: CODEBASE.USERS_APP,
      driversApp: CODEBASE.DRIVERS_APP,
      adminDashboard: CODEBASE.ADMIN_DASHBOARD
    };
    return mapping[key] || key;
  }

  /**
   * Map foundation severity to codebase-analyzer severity
   * @param {string} severity - Foundation severity
   * @returns {string} Mapped severity
   */
  mapSeverity(severity) {
    const mapping = {
      'error': 'high',
      'warning': 'medium',
      'info': 'low'
    };
    return mapping[severity] || severity;
  }

  /**
   * Get impact description for issue type
   * @param {string} type - Issue type
   * @returns {string} Impact description
   */
  getImpact(type) {
    const impacts = {
      'n_plus_one_query': 'Database bottleneck - exponential query growth',
      'missing_index': 'Slow queries on large datasets',
      'join_without_index': 'Slow JOIN operations',
      'select_all': 'Unnecessary data transfer',
      'query_without_limit': 'Memory exhaustion on large tables',
      'repeated_query': 'Unnecessary database load',
      'synchronous_operation': 'Blocks event loop - degrades responsiveness',
      'syntax_error': 'Code cannot be parsed'
    };
    return impacts[type] || 'Performance issue detected';
  }

  /**
   * Get category for issue type
   * @param {string} type - Issue type
   * @returns {string} Category
   */
  getCategory(type) {
    return CATEGORY.PERFORMANCE;
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getCodebasePerformanceAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new CodebasePerformanceAnalyzer();
  }
  return analyzerInstance;
}

export default CodebasePerformanceAnalyzer;
