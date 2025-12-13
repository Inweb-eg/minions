/**
 * Regression Detector - Test Regression Analysis
 *
 * Phase 7.3: Advanced Test Analyzers
 * Detects test regressions by comparing historical results
 */

import { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from './base-analyzer.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Regression types
 */
export const REGRESSION_TYPE = {
  NEWLY_FAILING: 'newly_failing',      // Was passing, now failing
  INTERMITTENT: 'intermittent',        // Alternating pass/fail
  PERFORMANCE: 'performance',          // Performance degradation
  FLAKY_STABLE_FAIL: 'flaky_stable_fail' // Was flaky, now consistently failing
};

/**
 * RegressionDetector
 * Detects test regressions by analyzing test history
 */
export class RegressionDetector extends BaseAnalyzer {
  constructor() {
    super('RegressionDetector', 'regression');
    this.historyPath = '.test-history';
    this.maxHistorySize = 50; // Keep last 50 runs
  }

  /**
   * Analyze test results for regressions
   * @param {Object} input - Current test results
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(input, options = {}) {
    this.startAnalysis();

    try {
      const {
        results,
        runId = this.generateRunId(),
        historyPath = this.historyPath
      } = input;

      this.historyPath = historyPath;

      // Load history
      const history = this.loadHistory();

      // Add current results to history
      const historyEntry = {
        runId,
        timestamp: new Date().toISOString(),
        results: this.normalizeResults(results)
      };

      history.push(historyEntry);

      // Trim history if too large
      if (history.length > this.maxHistorySize) {
        history.shift();
      }

      // Save updated history
      this.saveHistory(history);

      // Detect regressions
      const regressions = this.detectRegressions(history, options);

      // Analyze trends
      const trends = this.analyzeTrends(history);

      const duration = this.endAnalysis();

      return {
        success: true,
        regressions,
        trends,
        history: history.length,
        duration
      };
    } catch (error) {
      this.logger.error(`Regression detection failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate unique run ID
   * @returns {string} Run ID
   */
  generateRunId() {
    return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Normalize test results to common format
   * @param {Array|Object} results - Test results
   * @returns {Array} Normalized results
   */
  normalizeResults(results) {
    // Handle different result formats
    if (Array.isArray(results)) {
      return results.map(r => ({
        name: r.name || r.title || r.test,
        status: r.status || (r.passed ? 'passed' : 'failed'),
        duration: r.duration || r.time || 0,
        error: r.error || r.failureMessage || null
      }));
    } else if (results.tests && Array.isArray(results.tests)) {
      return this.normalizeResults(results.tests);
    }

    // Single result
    return [{
      name: results.name || 'unknown',
      status: results.status || 'unknown',
      duration: results.duration || 0,
      error: results.error || null
    }];
  }

  /**
   * Load test history
   * @returns {Array} History entries
   */
  loadHistory() {
    const historyFile = path.join(this.historyPath, 'test-history.json');

    if (!fs.existsSync(historyFile)) {
      this.logger.info('No test history found, starting fresh');
      return [];
    }

    const history = this.readJSON(historyFile);
    if (!history || !Array.isArray(history)) {
      this.logger.warn('Invalid history format, starting fresh');
      return [];
    }

    this.logger.info(`Loaded ${history.length} historical test runs`);
    return history;
  }

  /**
   * Save test history
   * @param {Array} history - History entries
   * @returns {boolean} Success
   */
  saveHistory(history) {
    const historyFile = path.join(this.historyPath, 'test-history.json');

    // Ensure directory exists
    if (!fs.existsSync(this.historyPath)) {
      fs.mkdirSync(this.historyPath, { recursive: true });
    }

    return this.writeJSON(historyFile, history);
  }

  /**
   * Detect regressions in test history
   * @param {Array} history - Test history
   * @param {Object} options - Detection options
   * @returns {Array} Detected regressions
   */
  detectRegressions(history, options = {}) {
    if (history.length < 2) {
      this.logger.info('Not enough history for regression detection');
      return [];
    }

    const regressions = [];
    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    // Build test status maps
    const currentTests = this.buildTestMap(current.results);
    const previousTests = this.buildTestMap(previous.results);

    // Check each current test
    Object.entries(currentTests).forEach(([testName, currentTest]) => {
      const previousTest = previousTests[testName];

      if (!previousTest) {
        // New test
        return;
      }

      // Check for regression (was passing, now failing)
      if (previousTest.status === 'passed' && currentTest.status === 'failed') {
        const regression = {
          type: REGRESSION_TYPE.NEWLY_FAILING,
          test: testName,
          severity: SEVERITY.HIGH,
          previousStatus: previousTest.status,
          currentStatus: currentTest.status,
          currentError: currentTest.error,
          firstFailedAt: current.timestamp,
          details: {
            previousRun: previous.runId,
            currentRun: current.runId
          }
        };

        regressions.push(regression);

        this.logResult(
          `Regression detected: ${testName} (was passing, now failing)`,
          ANALYSIS_STATUS.FAILURE,
          SEVERITY.HIGH,
          regression
        );
      }

      // Check for performance regression
      if (options.detectPerformance !== false) {
        const perfRegression = this.detectPerformanceRegression(
          testName,
          currentTest,
          previousTest,
          history,
          options
        );

        if (perfRegression) {
          regressions.push(perfRegression);
        }
      }
    });

    // Check for intermittent failures (if enough history)
    if (history.length >= 5) {
      const intermittent = this.detectIntermittentFailures(history);
      regressions.push(...intermittent);
    }

    this.logger.info(`Detected ${regressions.length} regressions`);
    return regressions;
  }

  /**
   * Build test map from results array
   * @param {Array} results - Test results
   * @returns {Object} Test map (name -> result)
   */
  buildTestMap(results) {
    const map = {};
    results.forEach(test => {
      map[test.name] = test;
    });
    return map;
  }

  /**
   * Detect performance regression
   * @param {string} testName - Test name
   * @param {Object} currentTest - Current test result
   * @param {Object} previousTest - Previous test result
   * @param {Array} history - Full history
   * @param {Object} options - Options
   * @returns {Object|null} Performance regression or null
   */
  detectPerformanceRegression(testName, currentTest, previousTest, history, options = {}) {
    const threshold = options.performanceThreshold || 1.5; // 50% slower
    const minDuration = options.minDuration || 100; // ms

    // Only consider tests that take significant time
    if (previousTest.duration < minDuration) {
      return null;
    }

    // Calculate ratio
    const ratio = currentTest.duration / previousTest.duration;

    if (ratio > threshold) {
      // Calculate average duration from history
      const recentRuns = history.slice(-5);
      const avgDuration = this.calculateAverageDuration(testName, recentRuns);

      return {
        type: REGRESSION_TYPE.PERFORMANCE,
        test: testName,
        severity: SEVERITY.MEDIUM,
        previousDuration: previousTest.duration,
        currentDuration: currentTest.duration,
        averageDuration: avgDuration,
        slowdownRatio: ratio,
        details: {
          threshold,
          exceedsThreshold: true
        }
      };
    }

    return null;
  }

  /**
   * Calculate average test duration from history
   * @param {string} testName - Test name
   * @param {Array} history - History entries
   * @returns {number} Average duration
   */
  calculateAverageDuration(testName, history) {
    const durations = [];

    history.forEach(entry => {
      const test = entry.results.find(t => t.name === testName);
      if (test && test.duration) {
        durations.push(test.duration);
      }
    });

    if (durations.length === 0) return 0;

    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  /**
   * Detect intermittent failures
   * @param {Array} history - Test history
   * @returns {Array} Intermittent failures
   */
  detectIntermittentFailures(history) {
    const intermittent = [];
    const testHistory = {};

    // Build per-test history
    history.forEach(entry => {
      entry.results.forEach(test => {
        if (!testHistory[test.name]) {
          testHistory[test.name] = [];
        }
        testHistory[test.name].push({
          status: test.status,
          timestamp: entry.timestamp
        });
      });
    });

    // Analyze each test's history
    Object.entries(testHistory).forEach(([testName, testRuns]) => {
      if (testRuns.length < 5) return;

      // Count alternations
      let alternations = 0;
      for (let i = 1; i < testRuns.length; i++) {
        if (testRuns[i].status !== testRuns[i - 1].status) {
          alternations++;
        }
      }

      // If test alternates frequently, it's intermittent
      const alternationRate = alternations / (testRuns.length - 1);
      if (alternationRate > 0.4) { // More than 40% alternations
        intermittent.push({
          type: REGRESSION_TYPE.INTERMITTENT,
          test: testName,
          severity: SEVERITY.HIGH,
          alternations,
          totalRuns: testRuns.length,
          alternationRate,
          recentStatuses: testRuns.slice(-5).map(r => r.status),
          details: {
            pattern: 'alternating',
            unstable: true
          }
        });

        this.logResult(
          `Intermittent failure detected: ${testName} (${(alternationRate * 100).toFixed(0)}% alternation rate)`,
          ANALYSIS_STATUS.WARNING,
          SEVERITY.HIGH
        );
      }
    });

    return intermittent;
  }

  /**
   * Analyze trends in test results
   * @param {Array} history - Test history
   * @returns {Object} Trend analysis
   */
  analyzeTrends(history) {
    if (history.length < 3) {
      return { insufficient_data: true };
    }

    const trends = {
      totalTests: [],
      passRate: [],
      avgDuration: [],
      newTests: 0,
      removedTests: 0
    };

    // Analyze each run
    history.forEach((entry, index) => {
      const results = entry.results;
      const total = results.length;
      const passed = results.filter(r => r.status === 'passed').length;
      const passRate = (passed / total) * 100;
      const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;

      trends.totalTests.push(total);
      trends.passRate.push(passRate);
      trends.avgDuration.push(avgDuration);

      // Count new/removed tests (compared to first run)
      if (index > 0) {
        const firstRunTests = new Set(history[0].results.map(r => r.name));
        const currentTests = new Set(results.map(r => r.name));

        currentTests.forEach(test => {
          if (!firstRunTests.has(test)) {
            trends.newTests++;
          }
        });
      }
    });

    // Calculate trend directions
    trends.testCountTrend = this.calculateTrend(trends.totalTests);
    trends.passRateTrend = this.calculateTrend(trends.passRate);
    trends.durationTrend = this.calculateTrend(trends.avgDuration);

    return trends;
  }

  /**
   * Calculate trend direction
   * @param {Array} values - Numeric values
   * @returns {string} Trend direction
   */
  calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return 'stable';
    if (change > 0) return 'increasing';
    return 'decreasing';
  }

  /**
   * Get regression summary
   * @param {Array} regressions - Regressions
   * @returns {Object} Summary
   */
  getRegressionSummary(regressions) {
    const summary = {
      total: regressions.length,
      byType: {},
      bySeverity: {},
      critical: []
    };

    // Count by type
    Object.values(REGRESSION_TYPE).forEach(type => {
      summary.byType[type] = regressions.filter(r => r.type === type).length;
    });

    // Count by severity
    Object.values(SEVERITY).forEach(severity => {
      summary.bySeverity[severity] = regressions.filter(r => r.severity === severity).length;
    });

    // Get critical regressions
    summary.critical = regressions.filter(r =>
      r.severity === SEVERITY.CRITICAL || r.severity === SEVERITY.HIGH
    );

    return summary;
  }

  /**
   * Clear history
   */
  clearHistory() {
    const historyFile = path.join(this.historyPath, 'test-history.json');
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
      this.logger.info('Test history cleared');
    }
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getRegressionDetector() {
  if (!analyzerInstance) {
    analyzerInstance = new RegressionDetector();
  }
  return analyzerInstance;
}
