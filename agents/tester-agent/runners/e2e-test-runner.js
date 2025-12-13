/**
 * E2E Test Runner - End-to-End Test Execution
 *
 * Phase 7.1: Smart Test Runners
 * Runs cross-platform E2E tests using Playwright
 */

import { BaseTestRunner, TEST_STATUS, TEST_PRIORITY } from './base-test-runner.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * E2ETestRunner
 * Runs end-to-end tests across all platforms
 */
export class E2ETestRunner extends BaseTestRunner {
  constructor() {
    super('E2ETestRunner', 'e2e');
    this.testPattern = /\.e2e\.(test|spec)\.(js|ts)$/;
  }

  /**
   * Run E2E tests
   * @param {Object} options - Test run options
   * @returns {Object} Test results
   */
  async runTests(options = {}) {
    this.logger.info('Starting E2E test execution');
    this.reset();

    const startTime = Date.now();
    const e2ePath = options.e2ePath || path.join(process.cwd(), 'e2e');

    // Check if E2E directory exists
    if (!fs.existsSync(e2ePath)) {
      this.logger.warn(`E2E directory not found: ${e2ePath}`);
      return this.results;
    }

    // Find all E2E test files
    const testFiles = this.findTestFiles(e2ePath, this.testPattern);
    this.logger.info(`Found ${testFiles.length} E2E test files`);

    if (testFiles.length === 0) {
      this.logger.warn('No E2E test files found');
      return this.results;
    }

    // Load test history
    const historyPath = path.join(e2ePath, '.test-history.json');
    this.loadTestHistory(historyPath);

    // Prioritize tests
    const prioritizedTests = options.prioritize !== false
      ? this.prioritizeTests(testFiles)
      : testFiles;

    // Run tests
    if (options.parallel !== false && testFiles.length > 1) {
      const concurrency = options.concurrency || 2; // Lower for E2E (resource intensive)
      this.results = await this.runParallel(prioritizedTests, concurrency, {
        e2ePath,
        browser: options.browser || 'chromium'
      });
    } else {
      // Sequential execution (safer for E2E)
      const results = [];
      for (const testFile of prioritizedTests) {
        const result = await this.runTestPattern(testFile, {
          e2ePath,
          browser: options.browser || 'chromium'
        });
        this.updateTestHistory(testFile, result);
        results.push(result);
      }
      this.results = this.aggregateResults(results);
    }

    // Save test history
    this.saveTestHistory(historyPath);

    this.results.duration = Date.now() - startTime;
    this.logger.info(`E2E tests completed in ${(this.results.duration / 1000).toFixed(2)}s`);
    this.logger.info(this.formatResults(this.results));

    return this.results;
  }

  /**
   * Run specific test file or pattern
   * @param {string} pattern - Test file pattern
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runTestPattern(pattern, options = {}) {
    const e2ePath = options.e2ePath || path.join(process.cwd(), 'e2e');

    const command = this.buildPlaywrightCommand(pattern, options);

    const result = await this.executeCommand(command, {
      cwd: e2ePath,
      timeout: options.timeout || 600000 // 10 minutes for E2E
    });

    return this.parsePlaywrightOutput(result.stdout, pattern);
  }

  /**
   * Build Playwright command
   * @param {string} pattern - Test pattern
   * @param {Object} options - Command options
   * @returns {string} Playwright command
   */
  buildPlaywrightCommand(pattern, options = {}) {
    const parts = ['npx playwright test'];

    // Add test file
    if (pattern) {
      parts.push(`"${pattern}"`);
    }

    // Browser selection
    if (options.browser) {
      parts.push(`--project=${options.browser}`);
    }

    // Reporter
    parts.push('--reporter=list');

    // Headed mode (for debugging)
    if (options.headed) {
      parts.push('--headed');
    }

    // Debug mode
    if (options.debug) {
      parts.push('--debug');
    }

    // Workers (parallel workers)
    if (options.workers) {
      parts.push(`--workers=${options.workers}`);
    }

    return parts.join(' ');
  }

  /**
   * Parse Playwright output
   * @param {string} output - Playwright output
   * @param {string} testFile - Test file path
   * @returns {Object} Parsed results
   */
  parsePlaywrightOutput(output, testFile) {
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
      // Match passed tests: "✓ [chromium] › test.spec.ts:10:1 › should work"
      const passMatch = line.match(/✓\s+\[(\w+)\]\s+›\s+(.+?)\s+›\s+(.+?)(?:\s+\(([\d.]+)(ms|s)\))?$/);
      if (passMatch) {
        const [, browser, file, testName, duration, unit] = passMatch;
        const durationMs = duration
          ? (unit === 's' ? parseFloat(duration) * 1000 : parseFloat(duration))
          : 0;

        result.tests.push({
          name: `[${browser}] ${testName}`,
          status: TEST_STATUS.PASSED,
          duration: durationMs,
          browser
        });
        result.passed++;
        result.total++;
      }

      // Match failed tests: "✕ [chromium] › test.spec.ts:10:1 › should fail"
      const failMatch = line.match(/✕\s+\[(\w+)\]\s+›\s+(.+?)\s+›\s+(.+?)$/);
      if (failMatch) {
        const [, browser, file, testName] = failMatch;

        result.tests.push({
          name: `[${browser}] ${testName}`,
          status: TEST_STATUS.FAILED,
          duration: 0,
          browser
        });
        result.failed++;
        result.total++;
        result.status = TEST_STATUS.FAILED;
      }

      // Match skipped tests: "- [chromium] › test.spec.ts:10:1 › should skip"
      const skipMatch = line.match(/-\s+\[(\w+)\]\s+›\s+(.+?)\s+›\s+(.+?)$/);
      if (skipMatch) {
        const [, browser, file, testName] = skipMatch;

        result.tests.push({
          name: `[${browser}] ${testName}`,
          status: TEST_STATUS.SKIPPED,
          duration: 0,
          browser
        });
        result.skipped++;
        result.total++;
      }

      // Match summary: "5 passed (12.5s)"
      const summaryMatch = line.match(/(\d+)\s+passed\s+\(([\d.]+)(ms|s)\)/);
      if (summaryMatch) {
        result.passed = parseInt(summaryMatch[1]);
        result.total = result.passed + result.failed + result.skipped;
        const duration = parseFloat(summaryMatch[2]);
        result.duration = summaryMatch[3] === 's' ? duration * 1000 : duration;
      }

      // Match with failures: "2 failed | 3 passed (15.2s)"
      const failSummaryMatch = line.match(/(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\(([\d.]+)(ms|s)\)/);
      if (failSummaryMatch) {
        result.failed = parseInt(failSummaryMatch[1]);
        result.passed = parseInt(failSummaryMatch[2]);
        result.total = result.failed + result.passed + result.skipped;
        const duration = parseFloat(failSummaryMatch[3]);
        result.duration = failSummaryMatch[4] === 's' ? duration * 1000 : duration;
        result.status = TEST_STATUS.FAILED;
      }
    }

    return result;
  }

  /**
   * Run tests on specific browser
   * @param {string} browser - Browser name (chromium, firefox, webkit)
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runOnBrowser(browser, options = {}) {
    this.logger.info(`Running E2E tests on ${browser}`);

    return await this.runTests({
      ...options,
      browser
    });
  }

  /**
   * Run tests on all browsers
   * @param {Object} options - Run options
   * @returns {Object} Aggregated results
   */
  async runOnAllBrowsers(options = {}) {
    this.logger.info('Running E2E tests on all browsers');

    const browsers = ['chromium', 'firefox', 'webkit'];
    const results = [];

    for (const browser of browsers) {
      this.logger.info(`Testing on ${browser}...`);
      const result = await this.runOnBrowser(browser, {
        ...options,
        prioritize: false // Already prioritized
      });
      results.push(result);
    }

    return this.aggregateResults(results);
  }

  /**
   * Run smoke tests (quick critical path tests)
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runSmokeTests(options = {}) {
    this.logger.info('Running smoke tests');

    const e2ePath = options.e2ePath || path.join(process.cwd(), 'e2e');
    const smokeTestPattern = /\.smoke\.(test|spec)\.(js|ts)$/;

    const testFiles = this.findTestFiles(e2ePath, smokeTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No smoke tests found');
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
   * Run regression tests
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runRegressionTests(options = {}) {
    this.logger.info('Running regression tests');

    const e2ePath = options.e2ePath || path.join(process.cwd(), 'e2e');
    const regressionTestPattern = /\.regression\.(test|spec)\.(js|ts)$/;

    const testFiles = this.findTestFiles(e2ePath, regressionTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No regression tests found');
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
   * Run visual regression tests
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runVisualTests(options = {}) {
    this.logger.info('Running visual regression tests');

    const e2ePath = options.e2ePath || path.join(process.cwd(), 'e2e');

    // Run with screenshot comparison
    const command = 'npx playwright test --update-snapshots';

    const result = await this.executeCommand(command, {
      cwd: e2ePath,
      timeout: 600000 // 10 minutes
    });

    return this.parsePlaywrightOutput(result.stdout, 'visual-tests');
  }

  /**
   * Generate Playwright report
   * @param {string} e2ePath - E2E directory path
   * @returns {string} Report path
   */
  async generateReport(e2ePath) {
    this.logger.info('Generating Playwright report');

    const command = 'npx playwright show-report';

    await this.executeCommand(command, {
      cwd: e2ePath,
      timeout: 30000
    });

    return path.join(e2ePath, 'playwright-report');
  }
}

/**
 * Get singleton instance
 */
let runnerInstance = null;

export function getE2ETestRunner() {
  if (!runnerInstance) {
    runnerInstance = new E2ETestRunner();
  }
  return runnerInstance;
}
