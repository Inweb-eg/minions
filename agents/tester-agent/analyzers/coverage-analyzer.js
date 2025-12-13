/**
 * Coverage Analyzer - Test Coverage Analysis
 *
 * Phase 7.3: Advanced Test Analyzers
 * Analyzes test coverage and identifies gaps
 */

import { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from './base-analyzer.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Coverage thresholds
 */
export const COVERAGE_THRESHOLDS = {
  LINES: 80,
  FUNCTIONS: 80,
  BRANCHES: 75,
  STATEMENTS: 80
};

/**
 * Coverage gap types
 */
export const GAP_TYPE = {
  UNCOVERED_FILE: 'uncovered_file',
  LOW_LINE_COVERAGE: 'low_line_coverage',
  LOW_FUNCTION_COVERAGE: 'low_function_coverage',
  LOW_BRANCH_COVERAGE: 'low_branch_coverage',
  UNCOVERED_LINES: 'uncovered_lines',
  UNCOVERED_FUNCTIONS: 'uncovered_functions',
  UNCOVERED_BRANCHES: 'uncovered_branches'
};

/**
 * CoverageAnalyzer
 * Analyzes test coverage and identifies coverage gaps
 */
export class CoverageAnalyzer extends BaseAnalyzer {
  constructor() {
    super('CoverageAnalyzer', 'coverage');
    this.coverageData = null;
    this.gaps = [];
  }

  /**
   * Analyze coverage
   * @param {Object} input - Coverage data or file path
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(input, options = {}) {
    this.startAnalysis();

    try {
      // Load coverage data
      if (typeof input === 'string') {
        // Input is a file path
        this.coverageData = this.loadCoverageReport(input);
      } else {
        // Input is coverage data object
        this.coverageData = input;
      }

      if (!this.coverageData) {
        return {
          success: false,
          error: 'Failed to load coverage data'
        };
      }

      // Set thresholds
      const thresholds = {
        ...COVERAGE_THRESHOLDS,
        ...options.thresholds
      };

      // Analyze coverage
      const summary = this.analyzeCoverageSummary();
      const gaps = this.identifyGaps(thresholds);
      const recommendations = this.generateRecommendations(gaps);

      const duration = this.endAnalysis();

      return {
        success: true,
        summary,
        gaps,
        recommendations,
        thresholds,
        duration
      };
    } catch (error) {
      this.logger.error(`Coverage analysis failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load coverage report from file
   * @param {string} filePath - Path to coverage report (JSON)
   * @returns {Object|null} Coverage data
   */
  loadCoverageReport(filePath) {
    this.logger.info(`Loading coverage report from: ${filePath}`);

    // Try to read coverage-summary.json first
    if (fs.existsSync(filePath)) {
      return this.readJSON(filePath);
    }

    // Try common locations
    const commonPaths = [
      'coverage/coverage-summary.json',
      'coverage/coverage-final.json',
      '.nyc_output/coverage.json'
    ];

    for (const commonPath of commonPaths) {
      const fullPath = path.resolve(commonPath);
      if (fs.existsSync(fullPath)) {
        this.logger.info(`Found coverage report at: ${fullPath}`);
        return this.readJSON(fullPath);
      }
    }

    this.logger.error('No coverage report found');
    return null;
  }

  /**
   * Analyze coverage summary
   * @returns {Object} Coverage summary
   */
  analyzeCoverageSummary() {
    if (!this.coverageData) {
      return null;
    }

    const summary = {
      files: 0,
      lines: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      statements: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 }
    };

    // Handle different coverage report formats
    if (this.coverageData.total) {
      // Istanbul/NYC format with 'total' key
      const total = this.coverageData.total;
      summary.lines = { ...total.lines };
      summary.functions = { ...total.functions };
      summary.statements = { ...total.statements };
      summary.branches = { ...total.branches };
      summary.files = Object.keys(this.coverageData).length - 1; // Exclude 'total'
    } else {
      // Aggregate from individual files
      const files = Object.keys(this.coverageData);
      summary.files = files.length;

      files.forEach(file => {
        const fileCov = this.coverageData[file];
        if (fileCov.lines) {
          summary.lines.total += fileCov.lines.total || 0;
          summary.lines.covered += fileCov.lines.covered || 0;
        }
        if (fileCov.functions) {
          summary.functions.total += fileCov.functions.total || 0;
          summary.functions.covered += fileCov.functions.covered || 0;
        }
        if (fileCov.statements) {
          summary.statements.total += fileCov.statements.total || 0;
          summary.statements.covered += fileCov.statements.covered || 0;
        }
        if (fileCov.branches) {
          summary.branches.total += fileCov.branches.total || 0;
          summary.branches.covered += fileCov.branches.covered || 0;
        }
      });

      // Calculate percentages
      summary.lines.pct = this.calculatePercentage(summary.lines.covered, summary.lines.total);
      summary.functions.pct = this.calculatePercentage(summary.functions.covered, summary.functions.total);
      summary.statements.pct = this.calculatePercentage(summary.statements.covered, summary.statements.total);
      summary.branches.pct = this.calculatePercentage(summary.branches.covered, summary.branches.total);
    }

    this.logger.info(`Coverage Summary:`);
    this.logger.info(`  Files: ${summary.files}`);
    this.logger.info(`  Lines: ${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`);
    this.logger.info(`  Functions: ${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total})`);
    this.logger.info(`  Branches: ${summary.branches.pct}% (${summary.branches.covered}/${summary.branches.total})`);

    return summary;
  }

  /**
   * Identify coverage gaps
   * @param {Object} thresholds - Coverage thresholds
   * @returns {Array} Coverage gaps
   */
  identifyGaps(thresholds) {
    const gaps = [];

    if (!this.coverageData) {
      return gaps;
    }

    // Get file list (exclude 'total' key)
    const files = Object.keys(this.coverageData).filter(key => key !== 'total');

    files.forEach(file => {
      const fileCov = this.coverageData[file];

      // Check line coverage
      if (fileCov.lines && fileCov.lines.pct < thresholds.LINES) {
        const gap = {
          type: GAP_TYPE.LOW_LINE_COVERAGE,
          file,
          severity: this.calculateGapSeverity(fileCov.lines.pct, thresholds.LINES),
          actual: fileCov.lines.pct,
          threshold: thresholds.LINES,
          uncovered: fileCov.lines.total - fileCov.lines.covered,
          details: {
            total: fileCov.lines.total,
            covered: fileCov.lines.covered
          }
        };
        gaps.push(gap);

        this.logResult(
          `Low line coverage in ${file}: ${fileCov.lines.pct}% (threshold: ${thresholds.LINES}%)`,
          ANALYSIS_STATUS.WARNING,
          gap.severity,
          gap
        );
      }

      // Check function coverage
      if (fileCov.functions && fileCov.functions.pct < thresholds.FUNCTIONS) {
        const gap = {
          type: GAP_TYPE.LOW_FUNCTION_COVERAGE,
          file,
          severity: this.calculateGapSeverity(fileCov.functions.pct, thresholds.FUNCTIONS),
          actual: fileCov.functions.pct,
          threshold: thresholds.FUNCTIONS,
          uncovered: fileCov.functions.total - fileCov.functions.covered,
          details: {
            total: fileCov.functions.total,
            covered: fileCov.functions.covered
          }
        };
        gaps.push(gap);

        this.logResult(
          `Low function coverage in ${file}: ${fileCov.functions.pct}% (threshold: ${thresholds.FUNCTIONS}%)`,
          ANALYSIS_STATUS.WARNING,
          gap.severity,
          gap
        );
      }

      // Check branch coverage
      if (fileCov.branches && fileCov.branches.pct < thresholds.BRANCHES) {
        const gap = {
          type: GAP_TYPE.LOW_BRANCH_COVERAGE,
          file,
          severity: this.calculateGapSeverity(fileCov.branches.pct, thresholds.BRANCHES),
          actual: fileCov.branches.pct,
          threshold: thresholds.BRANCHES,
          uncovered: fileCov.branches.total - fileCov.branches.covered,
          details: {
            total: fileCov.branches.total,
            covered: fileCov.branches.covered
          }
        };
        gaps.push(gap);

        this.logResult(
          `Low branch coverage in ${file}: ${fileCov.branches.pct}% (threshold: ${thresholds.BRANCHES}%)`,
          ANALYSIS_STATUS.WARNING,
          gap.severity,
          gap
        );
      }
    });

    this.logger.info(`Found ${gaps.length} coverage gaps`);
    this.gaps = gaps;
    return gaps;
  }

  /**
   * Calculate gap severity based on how far below threshold
   * @param {number} actual - Actual coverage percentage
   * @param {number} threshold - Threshold percentage
   * @returns {string} Severity level
   */
  calculateGapSeverity(actual, threshold) {
    const diff = threshold - actual;

    if (diff > 30) return SEVERITY.CRITICAL;
    if (diff > 20) return SEVERITY.HIGH;
    if (diff > 10) return SEVERITY.MEDIUM;
    return SEVERITY.LOW;
  }

  /**
   * Generate recommendations for coverage gaps
   * @param {Array} gaps - Coverage gaps
   * @returns {Array} Recommendations
   */
  generateRecommendations(gaps) {
    const recommendations = [];

    // Group gaps by file
    const fileGaps = {};
    gaps.forEach(gap => {
      if (!fileGaps[gap.file]) {
        fileGaps[gap.file] = [];
      }
      fileGaps[gap.file].push(gap);
    });

    // Generate recommendations per file
    Object.entries(fileGaps).forEach(([file, fileGapsArray]) => {
      const rec = {
        file,
        priority: this.calculatePriority(fileGapsArray),
        gaps: fileGapsArray.length,
        actions: []
      };

      fileGapsArray.forEach(gap => {
        if (gap.type === GAP_TYPE.LOW_LINE_COVERAGE) {
          rec.actions.push({
            type: 'add_tests',
            description: `Add tests to cover ${gap.uncovered} uncovered lines`,
            priority: gap.severity
          });
        } else if (gap.type === GAP_TYPE.LOW_FUNCTION_COVERAGE) {
          rec.actions.push({
            type: 'add_function_tests',
            description: `Add tests for ${gap.uncovered} uncovered functions`,
            priority: gap.severity
          });
        } else if (gap.type === GAP_TYPE.LOW_BRANCH_COVERAGE) {
          rec.actions.push({
            type: 'add_branch_tests',
            description: `Add tests to cover ${gap.uncovered} uncovered branches (edge cases, error paths)`,
            priority: gap.severity
          });
        }
      });

      recommendations.push(rec);
    });

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return recommendations;
  }

  /**
   * Calculate priority for file recommendations
   * @param {Array} gaps - Gaps for file
   * @returns {string} Priority level
   */
  calculatePriority(gaps) {
    const severities = gaps.map(g => g.severity);

    if (severities.includes(SEVERITY.CRITICAL)) return SEVERITY.CRITICAL;
    if (severities.includes(SEVERITY.HIGH)) return SEVERITY.HIGH;
    if (severities.includes(SEVERITY.MEDIUM)) return SEVERITY.MEDIUM;
    if (severities.includes(SEVERITY.LOW)) return SEVERITY.LOW;
    return SEVERITY.INFO;
  }

  /**
   * Get files with low coverage
   * @param {number} threshold - Coverage threshold
   * @returns {Array} Files with low coverage
   */
  getFilesWithLowCoverage(threshold = 80) {
    const lowCoverageFiles = [];

    if (!this.coverageData) {
      return lowCoverageFiles;
    }

    const files = Object.keys(this.coverageData).filter(key => key !== 'total');

    files.forEach(file => {
      const fileCov = this.coverageData[file];
      if (fileCov.lines && fileCov.lines.pct < threshold) {
        lowCoverageFiles.push({
          file,
          lineCoverage: fileCov.lines.pct,
          functionCoverage: fileCov.functions?.pct || 0,
          branchCoverage: fileCov.branches?.pct || 0
        });
      }
    });

    return lowCoverageFiles.sort((a, b) => a.lineCoverage - b.lineCoverage);
  }

  /**
   * Get completely uncovered files
   * @returns {Array} Uncovered files
   */
  getUncoveredFiles() {
    return this.getFilesWithLowCoverage(1); // Files with < 1% coverage
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getCoverageAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new CoverageAnalyzer();
  }
  return analyzerInstance;
}
