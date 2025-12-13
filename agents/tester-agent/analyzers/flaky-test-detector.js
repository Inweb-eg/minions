/**
 * Flaky Test Detector - Detect and Retry Flaky Tests
 *
 * Phase 7.3: Advanced Test Analyzers
 * Detects flaky tests and automatically retries them
 */

import { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from './base-analyzer.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Flakiness patterns
 */
export const FLAKINESS_PATTERN = {
  TIMING: 'timing',              // Race conditions, timeouts
  ENVIRONMENT: 'environment',    // Environment-dependent
  ORDER: 'order',                // Execution order dependent
  EXTERNAL: 'external',          // External dependency issues
  RANDOM: 'random'               // Random failures
};

/**
 * FlakyTestDetector
 * Detects and retries flaky tests
 */
export class FlakyTestDetector extends BaseAnalyzer {
  constructor() {
    super('FlakyTestDetector', 'flakiness');
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }

  /**
   * Analyze test results for flakiness
   * @param {Object} input - Test results and configuration
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(input, options = {}) {
    this.startAnalysis();

    try {
      const {
        results,
        failedTests = [],
        testCommand,
        retries = this.maxRetries
      } = input;

      this.maxRetries = retries;

      // Identify initially failed tests
      const failed = failedTests.length > 0
        ? failedTests
        : this.extractFailedTests(results);

      this.logger.info(`Found ${failed.length} failed tests to analyze`);

      if (failed.length === 0) {
        return {
          success: true,
          flakyTests: [],
          stableFailures: [],
          message: 'No failed tests to analyze'
        };
      }

      // Retry failed tests
      const retryResults = await this.retryTests(failed, testCommand, options);

      // Classify tests as flaky or stable failures
      const classification = this.classifyTests(retryResults);

      // Calculate flakiness scores
      const flakyWithScores = classification.flaky.map(test => ({
        ...test,
        flakinessScore: this.calculateFlakinessScore(test),
        pattern: this.identifyPattern(test),
        recommendation: this.generateRecommendation(test)
      }));

      const duration = this.endAnalysis();

      return {
        success: true,
        flakyTests: flakyWithScores,
        stableFailures: classification.stable,
        totalAnalyzed: failed.length,
        duration
      };
    } catch (error) {
      this.logger.error(`Flaky test detection failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract failed tests from results
   * @param {Array|Object} results - Test results
   * @returns {Array} Failed test names
   */
  extractFailedTests(results) {
    const failed = [];

    if (Array.isArray(results)) {
      results.forEach(test => {
        if (test.status === 'failed' || test.failed) {
          failed.push(test.name || test.title);
        }
      });
    } else if (results.tests && Array.isArray(results.tests)) {
      return this.extractFailedTests(results.tests);
    }

    return failed;
  }

  /**
   * Retry tests multiple times
   * @param {Array} failedTests - Failed test names
   * @param {string} testCommand - Command to run tests
   * @param {Object} options - Options
   * @returns {Promise<Object>} Retry results
   */
  async retryTests(failedTests, testCommand, options = {}) {
    const retryResults = {};

    for (const testName of failedTests) {
      this.logger.info(`Retrying test: ${testName}`);

      const attempts = [];
      let passCount = 0;
      let failCount = 0;

      // Initial failure counts as first attempt
      attempts.push({ status: 'failed', attempt: 0 });
      failCount++;

      // Retry the test
      for (let i = 1; i <= this.maxRetries; i++) {
        this.logger.info(`  Attempt ${i}/${this.maxRetries}...`);

        // Wait before retry
        if (this.retryDelay > 0) {
          await this.sleep(this.retryDelay);
        }

        // Run the test
        const result = await this.runSingleTest(testName, testCommand, options);

        attempts.push({
          status: result.success ? 'passed' : 'failed',
          attempt: i,
          duration: result.duration,
          error: result.error
        });

        if (result.success) {
          passCount++;
        } else {
          failCount++;
        }
      }

      retryResults[testName] = {
        attempts,
        passCount,
        failCount,
        totalAttempts: attempts.length,
        initialStatus: 'failed'
      };

      this.logger.info(`  Results: ${passCount} passed, ${failCount} failed`);
    }

    return retryResults;
  }

  /**
   * Run a single test
   * @param {string} testName - Test name
   * @param {string} testCommand - Base test command
   * @param {Object} options - Options
   * @returns {Promise<Object>} Test result
   */
  async runSingleTest(testName, testCommand, options = {}) {
    if (!testCommand) {
      // No command provided, can't retry
      return { success: false, error: 'No test command provided' };
    }

    const startTime = Date.now();

    try {
      // Build command to run single test
      const command = this.buildTestCommand(testCommand, testName, options);

      this.logger.debug(`Running: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: options.timeout || 30000,
        cwd: options.cwd || process.cwd()
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        stdout,
        stderr
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        duration,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }

  /**
   * Build test command for single test
   * @param {string} baseCommand - Base test command
   * @param {string} testName - Test name
   * @param {Object} options - Options
   * @returns {string} Full command
   */
  buildTestCommand(baseCommand, testName, options = {}) {
    // Escape test name for command line
    const escapedName = testName.replace(/['"]/g, '\\$&');

    // Handle different test frameworks
    if (baseCommand.includes('jest')) {
      return `${baseCommand} -t "${escapedName}"`;
    } else if (baseCommand.includes('vitest')) {
      return `${baseCommand} -t "${escapedName}"`;
    } else if (baseCommand.includes('mocha')) {
      return `${baseCommand} --grep "${escapedName}"`;
    } else if (baseCommand.includes('flutter test')) {
      return `${baseCommand} --name "${escapedName}"`;
    }

    // Default: append test name
    return `${baseCommand} "${escapedName}"`;
  }

  /**
   * Classify tests as flaky or stable failures
   * @param {Object} retryResults - Retry results
   * @returns {Object} Classification
   */
  classifyTests(retryResults) {
    const flaky = [];
    const stable = [];

    Object.entries(retryResults).forEach(([testName, result]) => {
      const { passCount, failCount, attempts, totalAttempts } = result;

      // If test passed at least once after initial failure, it's flaky
      if (passCount > 0) {
        flaky.push({
          test: testName,
          passCount,
          failCount,
          totalAttempts,
          attempts,
          stability: passCount / totalAttempts
        });

        this.logResult(
          `Flaky test detected: ${testName} (${passCount}/${totalAttempts} passed)`,
          ANALYSIS_STATUS.WARNING,
          this.severityFromStability(passCount / totalAttempts),
          { test: testName, passCount, failCount }
        );
      } else {
        // Test failed consistently
        stable.push({
          test: testName,
          passCount: 0,
          failCount,
          totalAttempts,
          attempts
        });

        this.logResult(
          `Stable failure: ${testName} (consistently failing)`,
          ANALYSIS_STATUS.FAILURE,
          SEVERITY.HIGH,
          { test: testName, failCount }
        );
      }
    });

    return { flaky, stable };
  }

  /**
   * Calculate flakiness score (0-100)
   * @param {Object} test - Test result
   * @returns {number} Flakiness score
   */
  calculateFlakinessScore(test) {
    // Score based on pass/fail ratio
    // 50% pass = highest flakiness (score 100)
    // 100% or 0% pass = lowest flakiness (score 0)
    const passRatio = test.passCount / test.totalAttempts;
    const deviationFrom50 = Math.abs(passRatio - 0.5);
    const score = (0.5 - deviationFrom50) / 0.5 * 100;

    return Math.round(score);
  }

  /**
   * Determine severity from stability score
   * @param {number} stability - Stability (0-1)
   * @returns {string} Severity
   */
  severityFromStability(stability) {
    if (stability < 0.3) return SEVERITY.CRITICAL;
    if (stability < 0.5) return SEVERITY.HIGH;
    if (stability < 0.7) return SEVERITY.MEDIUM;
    return SEVERITY.LOW;
  }

  /**
   * Identify flakiness pattern
   * @param {Object} test - Test result
   * @returns {string} Pattern type
   */
  identifyPattern(test) {
    const { attempts } = test;

    // Analyze attempt patterns
    const statuses = attempts.map(a => a.status);

    // Check for alternating pattern
    let alternations = 0;
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i] !== statuses[i - 1]) {
        alternations++;
      }
    }

    const alternationRate = alternations / (statuses.length - 1);

    if (alternationRate > 0.6) {
      return FLAKINESS_PATTERN.TIMING; // Likely timing/race condition
    }

    // Check for initial failures then passes
    const initialFail = statuses.slice(0, 2).every(s => s === 'failed');
    const laterPass = statuses.slice(2).some(s => s === 'passed');

    if (initialFail && laterPass) {
      return FLAKINESS_PATTERN.ENVIRONMENT; // Environment warm-up needed
    }

    // Random pattern
    return FLAKINESS_PATTERN.RANDOM;
  }

  /**
   * Generate recommendation for flaky test
   * @param {Object} test - Test result
   * @returns {string} Recommendation
   */
  generateRecommendation(test) {
    const recommendations = [];

    switch (test.pattern) {
      case FLAKINESS_PATTERN.TIMING:
        recommendations.push('Add proper waits/timeouts');
        recommendations.push('Use explicit synchronization');
        recommendations.push('Avoid hard-coded delays');
        break;

      case FLAKINESS_PATTERN.ENVIRONMENT:
        recommendations.push('Ensure proper test setup/teardown');
        recommendations.push('Check for shared state between tests');
        recommendations.push('Add environment initialization');
        break;

      case FLAKINESS_PATTERN.ORDER:
        recommendations.push('Ensure test isolation');
        recommendations.push('Remove dependencies between tests');
        recommendations.push('Reset state before each test');
        break;

      case FLAKINESS_PATTERN.EXTERNAL:
        recommendations.push('Mock external dependencies');
        recommendations.push('Add retry logic for external calls');
        recommendations.push('Use test doubles instead of real services');
        break;

      default:
        recommendations.push('Investigate test for non-determinism');
        recommendations.push('Check for race conditions');
        recommendations.push('Review test assertions');
    }

    return recommendations.join('; ');
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get flakiness summary
   * @param {Array} flakyTests - Flaky tests
   * @returns {Object} Summary
   */
  getFlakinessSummary(flakyTests) {
    return {
      total: flakyTests.length,
      byPattern: this.countByPattern(flakyTests),
      averageFlakinessScore: this.calculateAverageScore(flakyTests),
      mostFlaky: this.getMostFlaky(flakyTests, 5)
    };
  }

  /**
   * Count tests by pattern
   * @param {Array} tests - Tests
   * @returns {Object} Count by pattern
   */
  countByPattern(tests) {
    const counts = {};
    Object.values(FLAKINESS_PATTERN).forEach(pattern => {
      counts[pattern] = tests.filter(t => t.pattern === pattern).length;
    });
    return counts;
  }

  /**
   * Calculate average flakiness score
   * @param {Array} tests - Tests
   * @returns {number} Average score
   */
  calculateAverageScore(tests) {
    if (tests.length === 0) return 0;
    const sum = tests.reduce((acc, t) => acc + t.flakinessScore, 0);
    return Math.round(sum / tests.length);
  }

  /**
   * Get most flaky tests
   * @param {Array} tests - Tests
   * @param {number} limit - Number to return
   * @returns {Array} Most flaky tests
   */
  getMostFlaky(tests, limit = 5) {
    return tests
      .sort((a, b) => b.flakinessScore - a.flakinessScore)
      .slice(0, limit);
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getFlakyTestDetector() {
  if (!analyzerInstance) {
    analyzerInstance = new FlakyTestDetector();
  }
  return analyzerInstance;
}
