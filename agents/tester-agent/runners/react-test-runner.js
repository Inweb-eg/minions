/**
 * React Test Runner - Vitest/Playwright Test Execution
 *
 * Phase 7.1: Smart Test Runners
 * Runs React tests using Vitest for unit tests and Playwright for E2E
 */

import { BaseTestRunner, TEST_STATUS, TEST_PRIORITY } from './base-test-runner.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * ReactTestRunner
 * Runs React/Vite tests using Vitest
 */
export class ReactTestRunner extends BaseTestRunner {
  constructor() {
    super('ReactTestRunner', 'react');
    this.testPattern = /\.(test|spec)\.(js|jsx|ts|tsx)$/;
  }

  /**
   * Run React tests
   * @param {Object} options - Test run options
   * @returns {Object} Test results
   */
  async runTests(options = {}) {
    this.logger.info('Starting React test execution');
    this.reset();

    const startTime = Date.now();
    const appPath = options.appPath || path.join(process.cwd(), 'admin-dashboard');

    // Find all test files
    const testFiles = this.findTestFiles(appPath, this.testPattern, [
      'node_modules', '.git', 'coverage', 'dist', 'build', 'e2e'
    ]);

    this.logger.info(`Found ${testFiles.length} test files`);

    if (testFiles.length === 0) {
      this.logger.warn('No test files found');
      return this.results;
    }

    // Load test history
    const historyPath = path.join(appPath, '.test-history.json');
    this.loadTestHistory(historyPath);

    // Prioritize tests
    const prioritizedTests = options.prioritize !== false
      ? this.prioritizeTests(testFiles)
      : testFiles;

    // Run tests with Vitest
    if (options.parallel !== false) {
      // Vitest runs tests in parallel by default
      this.results = await this.runVitestTests(appPath, {
        coverage: options.coverage !== false
      });
    } else {
      // Sequential execution
      const results = [];
      for (const testFile of prioritizedTests) {
        const result = await this.runTestPattern(testFile, {
          appPath,
          coverage: false // Coverage only on full run
        });
        this.updateTestHistory(testFile, result);
        results.push(result);
      }
      this.results = this.aggregateResults(results);
    }

    // Get coverage if enabled
    if (options.coverage !== false) {
      this.results.coverage = await this.getCoverage(appPath);
    }

    // Save test history
    this.saveTestHistory(historyPath);

    this.results.duration = Date.now() - startTime;
    this.logger.info(`React tests completed in ${(this.results.duration / 1000).toFixed(2)}s`);
    this.logger.info(this.formatResults(this.results));

    return this.results;
  }

  /**
   * Run all Vitest tests
   * @param {string} appPath - App directory path
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runVitestTests(appPath, options = {}) {
    const command = this.buildVitestCommand(null, options);

    const result = await this.executeCommand(command, {
      cwd: appPath,
      timeout: options.timeout || 180000 // 3 minutes
    });

    return this.parseVitestOutput(result.stdout, appPath);
  }

  /**
   * Run specific test file or pattern
   * @param {string} pattern - Test file pattern
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runTestPattern(pattern, options = {}) {
    const appPath = options.appPath || path.join(process.cwd(), 'admin-dashboard');

    const command = this.buildVitestCommand(pattern, options);

    const result = await this.executeCommand(command, {
      cwd: appPath,
      timeout: options.timeout || 120000 // 2 minutes
    });

    return this.parseVitestOutput(result.stdout, pattern);
  }

  /**
   * Build Vitest command
   * @param {string} pattern - Test pattern
   * @param {Object} options - Command options
   * @returns {string} Vitest command
   */
  buildVitestCommand(pattern, options = {}) {
    const parts = ['npx vitest run'];

    // Add test pattern
    if (pattern) {
      parts.push(`"${pattern}"`);
    }

    // Add coverage
    if (options.coverage) {
      parts.push('--coverage');
    }

    // Reporter
    parts.push('--reporter=verbose');

    // No watch mode
    parts.push('--run');

    return parts.join(' ');
  }

  /**
   * Parse Vitest output
   * @param {string} output - Vitest output
   * @param {string} testFile - Test file path
   * @returns {Object} Parsed results
   */
  parseVitestOutput(output, testFile) {
    const result = {
      file: testFile || 'all',
      status: TEST_STATUS.PASSED,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: []
    };

    const lines = output.split('\n');

    for (const line of lines) {
      // Match test results: "✓ test name (123ms)"
      const passMatch = line.match(/^[\s]*✓\s+(.+?)\s*\((\d+)ms\)/);
      if (passMatch) {
        result.tests.push({
          name: passMatch[1].trim(),
          status: TEST_STATUS.PASSED,
          duration: parseInt(passMatch[2])
        });
        result.passed++;
        result.total++;
      }

      // Match failures: "✕ test name"
      const failMatch = line.match(/^[\s]*✕\s+(.+?)$/);
      if (failMatch) {
        result.tests.push({
          name: failMatch[1].trim(),
          status: TEST_STATUS.FAILED,
          duration: 0
        });
        result.failed++;
        result.total++;
        result.status = TEST_STATUS.FAILED;
      }

      // Match summary: "Test Files  3 passed (3)"
      const filesMatch = line.match(/Test Files\s+(\d+)\s+passed/);
      if (filesMatch) {
        // File count available
      }

      // Match: "Tests  15 passed (15)"
      const testsMatch = line.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/);
      if (testsMatch) {
        result.passed = parseInt(testsMatch[1]);
        result.total = parseInt(testsMatch[2]);
      }

      // Match failures in summary: "Tests  2 failed | 13 passed (15)"
      const failedMatch = line.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/);
      if (failedMatch) {
        result.failed = parseInt(failedMatch[1]);
        result.passed = parseInt(failedMatch[2]);
        result.total = parseInt(failedMatch[3]);
        result.status = TEST_STATUS.FAILED;
      }

      // Match duration: "Duration  2.34s"
      const durationMatch = line.match(/Duration\s+([\d.]+)s/);
      if (durationMatch) {
        result.duration = parseFloat(durationMatch[1]) * 1000;
      }
    }

    return result;
  }

  /**
   * Get test coverage
   * @param {string} appPath - App directory path
   * @returns {Object} Coverage data
   */
  async getCoverage(appPath) {
    const coveragePath = path.join(appPath, 'coverage', 'coverage-summary.json');

    try {
      if (fs.existsSync(coveragePath)) {
        const data = fs.readFileSync(coveragePath, 'utf-8');
        const coverage = JSON.parse(data);

        const total = coverage.total || {};

        return {
          lines: total.lines?.pct || 0,
          branches: total.branches?.pct || 0,
          functions: total.functions?.pct || 0,
          statements: total.statements?.pct || 0
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to read coverage: ${error.message}`);
    }

    return null;
  }

  /**
   * Run component tests only
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runComponentTests(options = {}) {
    this.logger.info('Running component tests only');

    const appPath = options.appPath || path.join(process.cwd(), 'admin-dashboard');
    const componentTestPattern = /\.component\.(test|spec)\.(jsx|tsx)$/;

    const testFiles = this.findTestFiles(appPath, componentTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No component tests found');
      return this.results;
    }

    const results = [];
    for (const testFile of testFiles) {
      const result = await this.runTestPattern(testFile, options);
      results.push(result);
    }

    return this.aggregateResults(results);
  }

  /**
   * Run hook tests only
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runHookTests(options = {}) {
    this.logger.info('Running hook tests only');

    const appPath = options.appPath || path.join(process.cwd(), 'admin-dashboard');
    const hookTestPattern = /\.hook\.(test|spec)\.(js|jsx|ts|tsx)$/;

    const testFiles = this.findTestFiles(appPath, hookTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No hook tests found');
      return this.results;
    }

    const results = [];
    for (const testFile of testFiles) {
      const result = await this.runTestPattern(testFile, options);
      results.push(result);
    }

    return this.aggregateResults(results);
  }

  /**
   * Run Playwright E2E tests
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runPlaywrightTests(options = {}) {
    this.logger.info('Running Playwright E2E tests');

    const appPath = options.appPath || path.join(process.cwd(), 'admin-dashboard');
    const e2eDir = path.join(appPath, 'e2e');

    if (!fs.existsSync(e2eDir)) {
      this.logger.warn('No e2e directory found');
      return this.results;
    }

    const command = 'npx playwright test';

    const result = await this.executeCommand(command, {
      cwd: appPath,
      timeout: 600000 // 10 minutes for E2E
    });

    return this.parsePlaywrightOutput(result.stdout);
  }

  /**
   * Parse Playwright output
   * @param {string} output - Playwright output
   * @returns {Object} Parsed results
   */
  parsePlaywrightOutput(output) {
    const result = {
      file: 'playwright-e2e',
      status: TEST_STATUS.PASSED,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: []
    };

    const lines = output.split('\n');

    for (const line of lines) {
      // Match: "✓ 1 test.spec.ts:5:3 › should login successfully (1.2s)"
      const passMatch = line.match(/✓\s+\d+\s+(.+?)\s+›\s+(.+?)\s+\(([\d.]+)s\)/);
      if (passMatch) {
        result.tests.push({
          name: `${passMatch[1]} › ${passMatch[2]}`,
          status: TEST_STATUS.PASSED,
          duration: parseFloat(passMatch[3]) * 1000
        });
        result.passed++;
        result.total++;
      }

      // Match failures
      const failMatch = line.match(/✕\s+\d+\s+(.+?)\s+›\s+(.+?)$/);
      if (failMatch) {
        result.tests.push({
          name: `${failMatch[1]} › ${failMatch[2]}`,
          status: TEST_STATUS.FAILED,
          duration: 0
        });
        result.failed++;
        result.total++;
        result.status = TEST_STATUS.FAILED;
      }

      // Match summary: "5 passed (12s)"
      const summaryMatch = line.match(/(\d+)\s+passed\s+\(([\d.]+)s\)/);
      if (summaryMatch) {
        result.passed = parseInt(summaryMatch[1]);
        result.total = result.passed;
        result.duration = parseFloat(summaryMatch[2]) * 1000;
      }
    }

    return result;
  }
}

/**
 * Get singleton instance
 */
let runnerInstance = null;

export function getReactTestRunner() {
  if (!runnerInstance) {
    runnerInstance = new ReactTestRunner();
  }
  return runnerInstance;
}
