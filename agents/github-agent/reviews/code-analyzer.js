/**
 * CodeAnalyzer - Analyzes Code for Review
 *
 * Phase 9.2: Code Review Engine
 * Analyzes JavaScript, Dart, and React code for issues
 */

import { BaseReviewer, REVIEW_SEVERITY, REVIEW_EVENT } from './base-reviewer.js';

/**
 * Code languages
 */
export const CODE_LANGUAGE = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  DART: 'dart',
  JSX: 'jsx',
  TSX: 'tsx'
};

/**
 * CodeAnalyzer
 * Analyzes code for review
 */
export class CodeAnalyzer extends BaseReviewer {
  constructor() {
    super('CodeAnalyzer', 'analyzer');
    this.rules = this.initializeRules();
  }

  /**
   * Initialize analysis rules
   * @returns {Array} Analysis rules
   */
  initializeRules() {
    return [
      { id: 'CA001', check: this.checkConsoleStatements.bind(this), name: 'Console statements' },
      { id: 'CA002', check: this.checkTodoComments.bind(this), name: 'TODO comments' },
      { id: 'CA003', check: this.checkDebuggingCode.bind(this), name: 'Debugging code' },
      { id: 'CA004', check: this.checkLargeFiles.bind(this), name: 'Large files' },
      { id: 'CA005', check: this.checkComplexity.bind(this), name: 'Code complexity' },
      { id: 'CA006', check: this.checkSecurityIssues.bind(this), name: 'Security issues' },
      { id: 'CA007', check: this.checkBestPractices.bind(this), name: 'Best practices' },
      { id: 'CA008', check: this.checkNamingConventions.bind(this), name: 'Naming conventions' },
      { id: 'CA009', check: this.checkErrorHandling.bind(this), name: 'Error handling' },
      { id: 'CA010', check: this.checkTypeUsage.bind(this), name: 'Type usage' }
    ];
  }

  /**
   * Review code
   * @param {Object} options - Review options
   * @returns {Promise<Object>} Review result
   */
  async review(options = {}) {
    this.ensureInitialized();

    const {
      prNumber,
      enabledRules = this.rules.map(r => r.id)
    } = options;

    this.logger.info(`Analyzing code for PR #${prNumber}`);

    try {
      const issues = [];

      // Get PR files
      const files = await this.getPRFiles(prNumber);

      // Analyze each file
      for (const file of files) {
        if (file.status === 'removed') {
          continue; // Skip deleted files
        }

        const fileIssues = await this.analyzeFile(file, enabledRules);
        issues.push(...fileIssues);
      }

      // Create result
      const result = this.createResult({
        issues,
        metadata: {
          prNumber,
          filesAnalyzed: files.length,
          rulesChecked: enabledRules.length
        }
      });

      this.recordReview(result);
      this.logger.info(`Analysis complete: ${issues.length} issues found`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PR files
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} PR files
   */
  async getPRFiles(prNumber) {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return files;
  }

  /**
   * Analyze file
   * @param {Object} file - File data
   * @param {Array} enabledRules - Enabled rule IDs
   * @returns {Promise<Array>} Issues
   */
  async analyzeFile(file, enabledRules) {
    const issues = [];
    const language = this.detectLanguage(file.filename);

    if (!language) {
      return issues; // Skip non-code files
    }

    // Get file content
    const content = file.patch || '';

    // Run enabled rules
    for (const rule of this.rules) {
      if (enabledRules.includes(rule.id)) {
        try {
          const ruleIssues = await rule.check(file, content, language);
          issues.push(...ruleIssues);
        } catch (error) {
          this.logger.error(`Rule ${rule.id} failed: ${error.message}`);
        }
      }
    }

    return issues;
  }

  /**
   * Detect language from filename
   * @param {string} filename - Filename
   * @returns {string|null} Language
   */
  detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();

    const languageMap = {
      'js': CODE_LANGUAGE.JAVASCRIPT,
      'jsx': CODE_LANGUAGE.JSX,
      'ts': CODE_LANGUAGE.TYPESCRIPT,
      'tsx': CODE_LANGUAGE.TSX,
      'dart': CODE_LANGUAGE.DART
    };

    return languageMap[ext] || null;
  }

  /**
   * Check for console statements
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkConsoleStatements(file, content, language) {
    const issues = [];

    if (language !== CODE_LANGUAGE.DART) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('console.log') || line.includes('console.error')) {
          // Check if it's an addition (starts with +)
          if (line.trim().startsWith('+') && !line.includes('// console.log')) {
            issues.push(this.createIssue({
              severity: REVIEW_SEVERITY.MEDIUM,
              message: 'Console statement found - should be removed before merging',
              file: file.filename,
              line: index + 1,
              rule: 'CA001'
            }));
          }
        }
      });
    }

    return issues;
  }

  /**
   * Check for TODO comments
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkTodoComments(file, content, language) {
    const issues = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        if (line.trim().startsWith('+')) {
          issues.push(this.createIssue({
            severity: REVIEW_SEVERITY.LOW,
            message: 'TODO/FIXME comment found - consider creating an issue to track this',
            file: file.filename,
            line: index + 1,
            rule: 'CA002'
          }));
        }
      }
    });

    return issues;
  }

  /**
   * Check for debugging code
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkDebuggingCode(file, content, language) {
    const issues = [];
    const debugPatterns = [
      /debugger;?/,
      /\.only\(/,  // test.only, describe.only
      /\.skip\(/,  // test.skip
      /print\(/    // Dart print statements
    ];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      debugPatterns.forEach(pattern => {
        if (pattern.test(line) && line.trim().startsWith('+')) {
          issues.push(this.createIssue({
            severity: REVIEW_SEVERITY.HIGH,
            message: 'Debugging code found - should be removed before merging',
            file: file.filename,
            line: index + 1,
            rule: 'CA003'
          }));
        }
      });
    });

    return issues;
  }

  /**
   * Check file size
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkLargeFiles(file, content, language) {
    const issues = [];
    const lineCount = content.split('\n').length;

    if (lineCount > 500) {
      issues.push(this.createIssue({
        severity: REVIEW_SEVERITY.MEDIUM,
        message: `Large file detected (${lineCount} lines) - consider breaking into smaller modules`,
        file: file.filename,
        rule: 'CA004'
      }));
    }

    return issues;
  }

  /**
   * Check code complexity
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkComplexity(file, content, language) {
    const issues = [];

    // Simple complexity check: count nested blocks
    const lines = content.split('\n');
    let maxNesting = 0;
    let currentNesting = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Count opening braces
      const opens = (trimmed.match(/{/g) || []).length;
      const closes = (trimmed.match(/}/g) || []).length;

      currentNesting += opens - closes;
      maxNesting = Math.max(maxNesting, currentNesting);
    });

    if (maxNesting > 5) {
      issues.push(this.createIssue({
        severity: REVIEW_SEVERITY.MEDIUM,
        message: `High nesting level detected (${maxNesting}) - consider refactoring to reduce complexity`,
        file: file.filename,
        rule: 'CA005',
        suggestion: 'Extract nested logic into separate functions'
      }));
    }

    return issues;
  }

  /**
   * Check security issues
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkSecurityIssues(file, content, language) {
    const issues = [];

    // Security patterns to check
    const securityPatterns = [
      { pattern: /eval\(/, message: 'Use of eval() is dangerous', severity: REVIEW_SEVERITY.CRITICAL },
      { pattern: /innerHTML\s*=/, message: 'Direct innerHTML assignment can lead to XSS', severity: REVIEW_SEVERITY.HIGH },
      { pattern: /dangerouslySetInnerHTML/, message: 'Using dangerouslySetInnerHTML - ensure content is sanitized', severity: REVIEW_SEVERITY.HIGH },
      { pattern: /password\s*=\s*["'][^"']+["']/, message: 'Hardcoded password detected', severity: REVIEW_SEVERITY.CRITICAL },
      { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/, message: 'Hardcoded API key detected', severity: REVIEW_SEVERITY.CRITICAL }
    ];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      securityPatterns.forEach(({ pattern, message, severity }) => {
        if (pattern.test(line) && line.trim().startsWith('+')) {
          issues.push(this.createIssue({
            severity,
            message,
            file: file.filename,
            line: index + 1,
            rule: 'CA006'
          }));
        }
      });
    });

    return issues;
  }

  /**
   * Check best practices
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkBestPractices(file, content, language) {
    const issues = [];

    if (language === CODE_LANGUAGE.JAVASCRIPT || language === CODE_LANGUAGE.TYPESCRIPT) {
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for var usage
        if (/\bvar\s+/.test(line) && line.trim().startsWith('+')) {
          issues.push(this.createIssue({
            severity: REVIEW_SEVERITY.LOW,
            message: 'Use const or let instead of var',
            file: file.filename,
            line: index + 1,
            rule: 'CA007',
            suggestion: 'Replace var with const or let'
          }));
        }

        // Check for == usage
        if (/[^=!]==[^=]/.test(line) && line.trim().startsWith('+')) {
          issues.push(this.createIssue({
            severity: REVIEW_SEVERITY.LOW,
            message: 'Use === instead of ==',
            file: file.filename,
            line: index + 1,
            rule: 'CA007',
            suggestion: 'Replace == with ==='
          }));
        }
      });
    }

    return issues;
  }

  /**
   * Check naming conventions
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkNamingConventions(file, content, language) {
    const issues = [];

    // Check filename conventions
    const filename = file.filename.split('/').pop();

    if (language === CODE_LANGUAGE.JSX || language === CODE_LANGUAGE.TSX) {
      // React components should be PascalCase
      if (!/^[A-Z]/.test(filename.split('.')[0])) {
        issues.push(this.createIssue({
          severity: REVIEW_SEVERITY.LOW,
          message: 'React component files should use PascalCase naming',
          file: file.filename,
          rule: 'CA008'
        }));
      }
    }

    return issues;
  }

  /**
   * Check error handling
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkErrorHandling(file, content, language) {
    const issues = [];

    // Check for async functions without try-catch
    const lines = content.split('\n');
    let inAsyncFunction = false;
    let hasTryCatch = false;
    let asyncLine = 0;

    lines.forEach((line, index) => {
      if (/async\s+function|\sasync\s*\(/.test(line) && line.trim().startsWith('+')) {
        inAsyncFunction = true;
        hasTryCatch = false;
        asyncLine = index + 1;
      }

      if (inAsyncFunction && /try\s*{/.test(line)) {
        hasTryCatch = true;
      }

      if (inAsyncFunction && /^[+-]?\s*}/.test(line)) {
        if (!hasTryCatch && asyncLine > 0) {
          issues.push(this.createIssue({
            severity: REVIEW_SEVERITY.MEDIUM,
            message: 'Async function without try-catch - consider adding error handling',
            file: file.filename,
            line: asyncLine,
            rule: 'CA009'
          }));
        }
        inAsyncFunction = false;
      }
    });

    return issues;
  }

  /**
   * Check type usage
   * @param {Object} file - File data
   * @param {string} content - File content
   * @param {string} language - Language
   * @returns {Array} Issues
   */
  checkTypeUsage(file, content, language) {
    const issues = [];

    if (language === CODE_LANGUAGE.TYPESCRIPT || language === CODE_LANGUAGE.TSX) {
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for any type usage
        if (/:\s*any\b/.test(line) && line.trim().startsWith('+')) {
          issues.push(this.createIssue({
            severity: REVIEW_SEVERITY.MEDIUM,
            message: 'Avoid using "any" type - use specific types instead',
            file: file.filename,
            line: index + 1,
            rule: 'CA010'
          }));
        }
      });
    }

    return issues;
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getCodeAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new CodeAnalyzer();
  }
  return analyzerInstance;
}
