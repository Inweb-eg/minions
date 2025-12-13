/**
 * CodebaseSecurityScanner - Codebase-Level Security Analysis Wrapper
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Wraps foundation SecurityScanner to work with codebase paths
 * instead of single AST/code inputs.
 *
 * This is the adapter that bridges:
 * - codebase-analyzer interface: analyze(codebasePaths, options)
 * - foundation SecurityScanner interface: analyze(ast, code, options)
 */

import { BaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from './base-analyzer.js';
import { SecurityScanner } from '../../../foundation/analyzers/SecurityScanner.js';

/**
 * CodebaseSecurityScanner
 * Iterates over all files in codebases and runs security analysis
 */
export class CodebaseSecurityScanner extends BaseAnalyzer {
  constructor() {
    super('CodebaseSecurityScanner');
    this.foundationScanner = new SecurityScanner();
    // Share the parser with foundation scanner
    this.foundationScanner.setParser(this.parser);
  }

  /**
   * Analyze security across all codebases
   * @param {Object} codebasePaths - Paths to all codebases
   * @param {Object} options - Analysis options
   * @returns {Object} Aggregated analysis results
   */
  async analyze(codebasePaths, options = {}) {
    this.logger.info('Starting codebase-wide security analysis');
    this.clearIssues();
    this.metrics = {};

    const filePatterns = {
      backend: /\.(js|ts|mjs)$/,
      usersApp: /\.(dart)$/,
      driversApp: /\.(dart)$/,
      adminDashboard: /\.(js|jsx|ts|tsx)$/
    };

    let totalFilesScanned = 0;
    const issuesByCodebase = {};

    // Analyze each codebase
    for (const [codebaseKey, codebasePath] of Object.entries(codebasePaths)) {
      if (!codebasePath) continue;

      const codebaseId = this.mapCodebaseKey(codebaseKey);
      this.logger.debug(`Scanning ${codebaseId} for security vulnerabilities`);

      const pattern = filePatterns[codebaseKey] || /\.(js|ts|dart)$/;
      const files = this.findFiles(codebasePath, pattern);

      issuesByCodebase[codebaseId] = [];

      for (const filePath of files) {
        const code = this.readFile(filePath);
        if (!code) continue;

        totalFilesScanned++;

        // Parse code to AST
        const ast = this.parseCode(code, filePath);

        // Run foundation security scanner
        try {
          this.foundationScanner.clearIssues();
          await this.foundationScanner.analyze(ast, code, options);

          // Collect issues and add codebase/file context
          const fileIssues = this.foundationScanner.getIssues();
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
          this.logger.debug(`Error scanning ${filePath}: ${error.message}`);
        }
      }

      this.logger.debug(`${codebaseId}: ${issuesByCodebase[codebaseId].length} security issues found`);
    }

    // Generate metrics
    this.addMetric('totalFilesScanned', totalFilesScanned);
    this.addMetric('issuesByCodebase', Object.fromEntries(
      Object.entries(issuesByCodebase).map(([k, v]) => [k, v.length])
    ));
    this.addMetric('issuesByType', this.groupIssuesByType());

    this.logger.info(`Security scan complete: ${this.issues.length} vulnerabilities found across ${totalFilesScanned} files`);

    return this.formatResults({
      codebasesScanned: Object.keys(codebasePaths).length,
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
      'error': 'critical',
      'warning': 'high',
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
      'hardcoded_secret': 'Exposed credentials can lead to unauthorized access',
      'sql_injection': 'Attackers can read/modify/delete database data',
      'xss_vulnerability': 'Attackers can steal user sessions and data',
      'cors_misconfiguration': 'Cross-origin attacks possible',
      'weak_hashing_algorithm': 'Passwords can be cracked easily',
      'jwt_without_expiration': 'Stolen tokens remain valid indefinitely',
      'missing_rate_limiting': 'Vulnerable to brute force attacks',
      'missing_input_sanitization': 'Various injection attacks possible',
      'weak_password_validation': 'Users can set easily guessable passwords'
    };
    return impacts[type] || 'Security vulnerability detected';
  }

  /**
   * Get category for issue type
   * @param {string} type - Issue type
   * @returns {string} Category
   */
  getCategory(type) {
    return CATEGORY.SECURITY;
  }
}

/**
 * Get singleton instance
 */
let scannerInstance = null;

export function getCodebaseSecurityScanner() {
  if (!scannerInstance) {
    scannerInstance = new CodebaseSecurityScanner();
  }
  return scannerInstance;
}

export default CodebaseSecurityScanner;
