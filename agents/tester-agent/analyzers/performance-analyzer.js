/**
 * Performance Test Analyzer - Test Performance Analysis
 *
 * Phase 7.3: Advanced Test Analyzers
 * Analyzes test execution performance and identifies bottlenecks
 */

import { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from './base-analyzer.js';

/**
 * Performance issue types
 */
export const PERFORMANCE_ISSUE = {
  SLOW_TEST: 'slow_test',
  SLOW_SUITE: 'slow_suite',
  DEGRADATION: 'degradation',
  OUTLIER: 'outlier'
};

/**
 * Performance thresholds (milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_TEST: 5000,      // 5 seconds
  VERY_SLOW_TEST: 10000, // 10 seconds
  SLOW_SUITE: 30000,    // 30 seconds
  VERY_SLOW_SUITE: 60000 // 1 minute
};

/**
 * PerformanceAnalyzer
 * Analyzes test execution performance
 */
export class PerformanceAnalyzer extends BaseAnalyzer {
  constructor() {
    super('PerformanceAnalyzer', 'performance');
  }

  /**
   * Analyze test performance
   * @param {Object} input - Test results with timing data
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(input, options = {}) {
    this.startAnalysis();

    try {
      const { results, suites = [] } = input;

      // Set thresholds
      const thresholds = {
        ...PERFORMANCE_THRESHOLDS,
        ...options.thresholds
      };

      // Normalize test results
      const tests = this.normalizeTests(results);

      // Analyze test performance
      const slowTests = this.identifySlowTests(tests, thresholds);
      const testStats = this.calculateTestStatistics(tests);

      // Analyze suite performance if available
      let slowSuites = [];
      let suiteStats = null;

      if (suites.length > 0) {
        slowSuites = this.identifySlowSuites(suites, thresholds);
        suiteStats = this.calculateSuiteStatistics(suites);
      }

      // Identify performance outliers
      const outliers = this.identifyOutliers(tests);

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(
        slowTests,
        slowSuites,
        outliers
      );

      const duration = this.endAnalysis();

      return {
        success: true,
        slowTests,
        slowSuites,
        outliers,
        testStats,
        suiteStats,
        recommendations,
        duration
      };
    } catch (error) {
      this.logger.error(`Performance analysis failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Normalize test results
   * @param {Array|Object} results - Test results
   * @returns {Array} Normalized tests
   */
  normalizeTests(results) {
    if (Array.isArray(results)) {
      return results.map(test => ({
        name: test.name || test.title || test.test,
        duration: test.duration || test.time || 0,
        status: test.status || (test.passed ? 'passed' : 'failed')
      }));
    } else if (results.tests && Array.isArray(results.tests)) {
      return this.normalizeTests(results.tests);
    }

    return [];
  }

  /**
   * Identify slow tests
   * @param {Array} tests - Test results
   * @param {Object} thresholds - Thresholds
   * @returns {Array} Slow tests
   */
  identifySlowTests(tests, thresholds) {
    const slowTests = [];

    tests.forEach(test => {
      if (test.duration > thresholds.SLOW_TEST) {
        const severity = test.duration > thresholds.VERY_SLOW_TEST
          ? SEVERITY.HIGH
          : SEVERITY.MEDIUM;

        const slowTest = {
          type: PERFORMANCE_ISSUE.SLOW_TEST,
          test: test.name,
          duration: test.duration,
          threshold: thresholds.SLOW_TEST,
          severity,
          slowdownFactor: test.duration / thresholds.SLOW_TEST
        };

        slowTests.push(slowTest);

        this.logResult(
          `Slow test detected: ${test.name} (${this.formatDuration(test.duration)})`,
          ANALYSIS_STATUS.WARNING,
          severity,
          slowTest
        );
      }
    });

    return slowTests.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Identify slow test suites
   * @param {Array} suites - Test suites
   * @param {Object} thresholds - Thresholds
   * @returns {Array} Slow suites
   */
  identifySlowSuites(suites, thresholds) {
    const slowSuites = [];

    suites.forEach(suite => {
      const duration = suite.duration || suite.totalTime || 0;

      if (duration > thresholds.SLOW_SUITE) {
        const severity = duration > thresholds.VERY_SLOW_SUITE
          ? SEVERITY.HIGH
          : SEVERITY.MEDIUM;

        const slowSuite = {
          type: PERFORMANCE_ISSUE.SLOW_SUITE,
          suite: suite.name || suite.title,
          duration,
          threshold: thresholds.SLOW_SUITE,
          severity,
          testCount: suite.tests ? suite.tests.length : 0
        };

        slowSuites.push(slowSuite);

        this.logResult(
          `Slow suite detected: ${slowSuite.suite} (${this.formatDuration(duration)})`,
          ANALYSIS_STATUS.WARNING,
          severity,
          slowSuite
        );
      }
    });

    return slowSuites.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Calculate test statistics
   * @param {Array} tests - Tests
   * @returns {Object} Statistics
   */
  calculateTestStatistics(tests) {
    if (tests.length === 0) {
      return {
        total: 0,
        totalDuration: 0,
        avgDuration: 0,
        medianDuration: 0,
        minDuration: 0,
        maxDuration: 0
      };
    }

    const durations = tests.map(t => t.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      total: tests.length,
      totalDuration,
      avgDuration: totalDuration / tests.length,
      medianDuration: durations[Math.floor(durations.length / 2)],
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1]
    };
  }

  /**
   * Calculate suite statistics
   * @param {Array} suites - Suites
   * @returns {Object} Statistics
   */
  calculateSuiteStatistics(suites) {
    if (suites.length === 0) {
      return {
        total: 0,
        totalDuration: 0,
        avgDuration: 0
      };
    }

    const totalDuration = suites.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      total: suites.length,
      totalDuration,
      avgDuration: totalDuration / suites.length
    };
  }

  /**
   * Identify performance outliers
   * @param {Array} tests - Tests
   * @returns {Array} Outliers
   */
  identifyOutliers(tests) {
    if (tests.length < 3) {
      return [];
    }

    const stats = this.calculateTestStatistics(tests);
    const durations = tests.map(t => t.duration);

    // Calculate standard deviation
    const variance = durations.reduce((sum, d) => {
      return sum + Math.pow(d - stats.avgDuration, 2);
    }, 0) / durations.length;

    const stdDev = Math.sqrt(variance);

    // Tests more than 2 standard deviations from mean are outliers
    const outliers = [];
    const threshold = stats.avgDuration + (2 * stdDev);

    tests.forEach(test => {
      if (test.duration > threshold) {
        outliers.push({
          type: PERFORMANCE_ISSUE.OUTLIER,
          test: test.name,
          duration: test.duration,
          avgDuration: stats.avgDuration,
          stdDev,
          deviations: (test.duration - stats.avgDuration) / stdDev,
          severity: SEVERITY.MEDIUM
        });
      }
    });

    return outliers.sort((a, b) => b.deviations - a.deviations);
  }

  /**
   * Generate performance recommendations
   * @param {Array} slowTests - Slow tests
   * @param {Array} slowSuites - Slow suites
   * @param {Array} outliers - Outliers
   * @returns {Array} Recommendations
   */
  generatePerformanceRecommendations(slowTests, slowSuites, outliers) {
    const recommendations = [];

    // Recommendations for slow tests
    if (slowTests.length > 0) {
      recommendations.push({
        category: 'slow_tests',
        priority: SEVERITY.HIGH,
        count: slowTests.length,
        actions: [
          'Optimize test setup/teardown',
          'Use mocks instead of real dependencies',
          'Parallelize independent tests',
          'Split slow tests into smaller units'
        ]
      });

      // Top slow tests
      const top5 = slowTests.slice(0, 5);
      recommendations.push({
        category: 'top_slow_tests',
        priority: SEVERITY.HIGH,
        tests: top5.map(t => ({
          name: t.test,
          duration: this.formatDuration(t.duration),
          action: this.getSuggestedAction(t)
        }))
      });
    }

    // Recommendations for slow suites
    if (slowSuites.length > 0) {
      recommendations.push({
        category: 'slow_suites',
        priority: SEVERITY.MEDIUM,
        count: slowSuites.length,
        actions: [
          'Split large test suites',
          'Run suites in parallel',
          'Reduce shared setup overhead'
        ]
      });
    }

    // Recommendations for outliers
    if (outliers.length > 0) {
      recommendations.push({
        category: 'outliers',
        priority: SEVERITY.MEDIUM,
        count: outliers.length,
        actions: [
          'Investigate outlier tests for inefficiencies',
          'Check for unnecessary waits/delays',
          'Profile test execution'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Get suggested action for slow test
   * @param {Object} slowTest - Slow test info
   * @returns {string} Suggested action
   */
  getSuggestedAction(slowTest) {
    if (slowTest.duration > 30000) {
      return 'Consider splitting into multiple tests or using fixtures';
    } else if (slowTest.duration > 10000) {
      return 'Profile execution and optimize hot paths';
    } else {
      return 'Reduce setup time or use mocks';
    }
  }

  /**
   * Compare with historical performance
   * @param {Array} currentTests - Current test results
   * @param {Array} historicalTests - Historical test results
   * @returns {Array} Performance degradations
   */
  comparePerformance(currentTests, historicalTests) {
    const degradations = [];

    const historicalMap = {};
    historicalTests.forEach(test => {
      historicalMap[test.name] = test.duration;
    });

    currentTests.forEach(test => {
      const historicalDuration = historicalMap[test.name];

      if (historicalDuration && test.duration > historicalDuration * 1.5) {
        degradations.push({
          type: PERFORMANCE_ISSUE.DEGRADATION,
          test: test.name,
          currentDuration: test.duration,
          historicalDuration,
          degradationFactor: test.duration / historicalDuration,
          severity: SEVERITY.HIGH
        });
      }
    });

    return degradations;
  }

  /**
   * Get performance summary
   * @param {Object} analysisResult - Analysis result
   * @returns {Object} Summary
   */
  getPerformanceSummary(analysisResult) {
    return {
      slowTestsCount: analysisResult.slowTests.length,
      slowSuitesCount: analysisResult.slowSuites.length,
      outliersCount: analysisResult.outliers.length,
      totalDuration: analysisResult.testStats.totalDuration,
      avgTestDuration: analysisResult.testStats.avgDuration,
      slowestTest: analysisResult.slowTests[0] || null,
      recommendations: analysisResult.recommendations.length
    };
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getPerformanceAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new PerformanceAnalyzer();
  }
  return analyzerInstance;
}
