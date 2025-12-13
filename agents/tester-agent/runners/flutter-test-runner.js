/**
 * Flutter Test Runner - Flutter/Dart Test Execution
 *
 * Phase 7.1: Smart Test Runners
 * Runs Flutter tests with parallel execution support
 */

import { BaseTestRunner, TEST_STATUS, TEST_PRIORITY } from './base-test-runner.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * FlutterTestRunner
 * Runs Flutter/Dart tests
 */
export class FlutterTestRunner extends BaseTestRunner {
  constructor() {
    super('FlutterTestRunner', 'flutter');
    this.testPattern = /_test\.dart$/;
  }

  /**
   * Run Flutter tests
   * @param {Object} options - Test run options
   * @returns {Object} Test results
   */
  async runTests(options = {}) {
    this.logger.info('Starting Flutter test execution');
    this.reset();

    const startTime = Date.now();
    const appPath = options.appPath || process.cwd();

    // Verify Flutter installation
    if (!await this.verifyFlutterInstalled()) {
      this.logger.error('Flutter is not installed or not in PATH');
      return this.results;
    }

    // Find all test files
    const testDir = path.join(appPath, 'test');
    if (!fs.existsSync(testDir)) {
      this.logger.warn(`Test directory not found: ${testDir}`);
      return this.results;
    }

    const testFiles = this.findTestFiles(testDir, this.testPattern);
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

    // Run tests
    if (options.parallel !== false && testFiles.length > 1) {
      const concurrency = options.concurrency || 2; // Lower concurrency for Flutter
      this.results = await this.runParallel(prioritizedTests, concurrency, {
        appPath,
        coverage: options.coverage !== false
      });
    } else {
      // Run all tests together (Flutter's default)
      this.results = await this.runAllFlutterTests(appPath, {
        coverage: options.coverage !== false
      });
    }

    // Save test history
    this.saveTestHistory(historyPath);

    this.results.duration = Date.now() - startTime;
    this.logger.info(`Flutter tests completed in ${(this.results.duration / 1000).toFixed(2)}s`);
    this.logger.info(this.formatResults(this.results));

    return this.results;
  }

  /**
   * Run all Flutter tests together
   * @param {string} appPath - App directory path
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runAllFlutterTests(appPath, options = {}) {
    const command = this.buildFlutterTestCommand(null, options);

    const result = await this.executeCommand(command, {
      cwd: appPath,
      timeout: options.timeout || 300000 // 5 minutes
    });

    return this.parseFlutterOutput(result.stdout, appPath);
  }

  /**
   * Run specific test file or pattern
   * @param {string} pattern - Test file pattern
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runTestPattern(pattern, options = {}) {
    const appPath = options.appPath || process.cwd();

    // Flutter test command with specific file
    const command = this.buildFlutterTestCommand(pattern, options);

    const result = await this.executeCommand(command, {
      cwd: appPath,
      timeout: options.timeout || 120000 // 2 minutes
    });

    return this.parseFlutterOutput(result.stdout, pattern);
  }

  /**
   * Build Flutter test command
   * @param {string} pattern - Test pattern (file path)
   * @param {Object} options - Command options
   * @returns {string} Flutter test command
   */
  buildFlutterTestCommand(pattern, options = {}) {
    const parts = ['flutter test'];

    // Add test file if specified
    if (pattern) {
      parts.push(`"${pattern}"`);
    }

    // Add coverage flag
    if (options.coverage) {
      parts.push('--coverage');
    }

    // Add reporter
    parts.push('--reporter=expanded');

    // Disable animations for faster tests
    parts.push('--no-sound-null-safety'); // Temporary for compatibility

    return parts.join(' ');
  }

  /**
   * Parse Flutter test output
   * @param {string} output - Flutter test output
   * @param {string} testFile - Test file path
   * @returns {Object} Parsed results
   */
  parseFlutterOutput(output, testFile) {
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

    // Parse output line by line
    const lines = output.split('\n');

    for (const line of lines) {
      // Match test results: "00:01 +1: test name"
      const testMatch = line.match(/^\d{2}:\d{2} \+(\d+)(?:-(\d+))?: (.+)$/);
      if (testMatch) {
        const [, passed, failed, name] = testMatch;

        result.tests.push({
          name: name.trim(),
          status: failed ? TEST_STATUS.FAILED : TEST_STATUS.PASSED,
          duration: 0
        });

        result.total++;
        if (failed) {
          result.failed++;
          result.status = TEST_STATUS.FAILED;
        } else {
          result.passed++;
        }
      }

      // Match final summary: "All tests passed!"
      if (line.includes('All tests passed!')) {
        result.status = TEST_STATUS.PASSED;
      }

      // Match failures: "Some tests failed."
      if (line.includes('Some tests failed')) {
        result.status = TEST_STATUS.FAILED;
      }

      // Match duration: "Ran 15 tests in 2.5s"
      const durationMatch = line.match(/Ran \d+ tests? in ([\d.]+)s/);
      if (durationMatch) {
        result.duration = parseFloat(durationMatch[1]) * 1000;
      }

      // Parse test count from summary line
      // Example: "All 15 tests passed!"
      const countMatch = line.match(/All (\d+) tests? passed!/);
      if (countMatch) {
        result.total = parseInt(countMatch[1]);
        result.passed = result.total;
      }
    }

    return result;
  }

  /**
   * Get test coverage
   * @returns {Object} Coverage data
   */
  async getCoverage(appPath) {
    const coveragePath = path.join(appPath, 'coverage', 'lcov.info');

    try {
      if (fs.existsSync(coveragePath)) {
        const lcov = fs.readFileSync(coveragePath, 'utf-8');
        return this.parseLcov(lcov);
      }
    } catch (error) {
      this.logger.warn(`Failed to read coverage: ${error.message}`);
    }

    return null;
  }

  /**
   * Parse LCOV coverage data
   * @param {string} lcov - LCOV data
   * @returns {Object} Coverage summary
   */
  parseLcov(lcov) {
    let linesFound = 0;
    let linesHit = 0;
    let branchesFound = 0;
    let branchesHit = 0;
    let functionsFound = 0;
    let functionsHit = 0;

    const lines = lcov.split('\n');

    for (const line of lines) {
      if (line.startsWith('LF:')) {
        linesFound += parseInt(line.substring(3));
      } else if (line.startsWith('LH:')) {
        linesHit += parseInt(line.substring(3));
      } else if (line.startsWith('BRF:')) {
        branchesFound += parseInt(line.substring(4));
      } else if (line.startsWith('BRH:')) {
        branchesHit += parseInt(line.substring(4));
      } else if (line.startsWith('FNF:')) {
        functionsFound += parseInt(line.substring(4));
      } else if (line.startsWith('FNH:')) {
        functionsHit += parseInt(line.substring(4));
      }
    }

    return {
      lines: linesFound > 0 ? ((linesHit / linesFound) * 100).toFixed(2) : 0,
      branches: branchesFound > 0 ? ((branchesHit / branchesFound) * 100).toFixed(2) : 0,
      functions: functionsFound > 0 ? ((functionsHit / functionsFound) * 100).toFixed(2) : 0,
      statements: linesFound > 0 ? ((linesHit / linesFound) * 100).toFixed(2) : 0
    };
  }

  /**
   * Verify Flutter is installed
   * @returns {boolean} True if Flutter is installed
   */
  async verifyFlutterInstalled() {
    try {
      const result = await this.executeCommand('flutter --version', {
        timeout: 10000
      });
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run widget tests only
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runWidgetTests(options = {}) {
    this.logger.info('Running widget tests only');

    const appPath = options.appPath || process.cwd();
    const widgetTestPattern = /_widget_test\.dart$/;

    const testDir = path.join(appPath, 'test');
    const testFiles = this.findTestFiles(testDir, widgetTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No widget tests found');
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
   * Run unit tests only
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runUnitTests(options = {}) {
    this.logger.info('Running unit tests only');

    const appPath = options.appPath || process.cwd();
    const unitTestPattern = /_unit_test\.dart$/;

    const testDir = path.join(appPath, 'test');
    const testFiles = this.findTestFiles(testDir, unitTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No unit tests found');
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
   * Run integration tests
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runIntegrationTests(options = {}) {
    this.logger.info('Running Flutter integration tests');

    const appPath = options.appPath || process.cwd();
    const integrationTestDir = path.join(appPath, 'integration_test');

    if (!fs.existsSync(integrationTestDir)) {
      this.logger.warn('No integration_test directory found');
      return this.results;
    }

    const command = 'flutter test integration_test';

    const result = await this.executeCommand(command, {
      cwd: appPath,
      timeout: 600000 // 10 minutes for integration tests
    });

    return this.parseFlutterOutput(result.stdout, 'integration_test');
  }
}

/**
 * Get singleton instance
 */
let runnerInstance = null;

export function getFlutterTestRunner() {
  if (!runnerInstance) {
    runnerInstance = new FlutterTestRunner();
  }
  return runnerInstance;
}
