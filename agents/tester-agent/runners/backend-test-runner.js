/**
 * Backend Test Runner - Jest/Supertest Test Execution
 *
 * Phase 7.1: Smart Test Runners
 * Runs backend tests using Jest and Supertest with parallel execution
 */

import { BaseTestRunner, TEST_STATUS, TEST_PRIORITY } from './base-test-runner.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * BackendTestRunner
 * Runs Node.js/Express backend tests using Jest
 */
export class BackendTestRunner extends BaseTestRunner {
  constructor() {
    super('BackendTestRunner', 'backend');
    this.testPattern = /\.(test|spec)\.(js|ts)$/;
    this.jestConfig = null;
  }

  /**
   * Run backend tests
   * @param {Object} options - Test run options
   * @returns {Object} Test results
   */
  async runTests(options = {}) {
    this.logger.info('Starting backend test execution');
    this.reset();

    const startTime = Date.now();
    const backendPath = options.backendPath || path.join(process.cwd(), 'backend');

    // Load Jest config
    await this.loadJestConfig(backendPath);

    // Find all test files
    const testFiles = this.findTestFiles(backendPath, this.testPattern);
    this.logger.info(`Found ${testFiles.length} test files`);

    if (testFiles.length === 0) {
      this.logger.warn('No test files found');
      return this.results;
    }

    // Load test history for prioritization
    const historyPath = path.join(backendPath, '.test-history.json');
    this.loadTestHistory(historyPath);

    // Prioritize tests
    const prioritizedTests = options.prioritize !== false
      ? this.prioritizeTests(testFiles)
      : testFiles;

    this.logger.info(`Test prioritization: ${prioritizedTests.length} tests ordered`);

    // Run tests
    if (options.parallel !== false) {
      const concurrency = options.concurrency || 4;
      this.results = await this.runParallel(prioritizedTests, concurrency, {
        backendPath,
        coverage: options.coverage !== false
      });
    } else {
      // Sequential execution
      const results = [];
      for (const testFile of prioritizedTests) {
        const result = await this.runTestPattern(testFile, {
          backendPath,
          coverage: options.coverage !== false
        });
        this.updateTestHistory(testFile, result);
        results.push(result);
      }
      this.results = this.aggregateResults(results);
    }

    // Get coverage if enabled
    if (options.coverage !== false) {
      this.results.coverage = await this.getCoverage(backendPath);
    }

    // Save test history
    this.saveTestHistory(historyPath);

    this.results.duration = Date.now() - startTime;
    this.logger.info(`Backend tests completed in ${(this.results.duration / 1000).toFixed(2)}s`);
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
    const backendPath = options.backendPath || path.join(process.cwd(), 'backend');

    // Build Jest command
    const jestCommand = this.buildJestCommand(pattern, {
      coverage: options.coverage !== false,
      backendPath
    });

    // Execute tests
    const result = await this.executeCommand(jestCommand, {
      cwd: backendPath,
      timeout: options.timeout || 120000 // 2 minutes per test file
    });

    // Parse results
    return this.parseJestOutput(result.stdout, pattern);
  }

  /**
   * Build Jest command
   * @param {string} pattern - Test pattern
   * @param {Object} options - Command options
   * @returns {string} Jest command
   */
  buildJestCommand(pattern, options = {}) {
    const parts = ['npx jest'];

    // Add test pattern
    if (pattern) {
      parts.push(`"${pattern}"`);
    }

    // Add options
    if (options.coverage) {
      parts.push('--coverage');
      parts.push('--coverageReporters=json');
      parts.push('--coverageReporters=text');
    }

    // Force exit to prevent hanging
    parts.push('--forceExit');

    // No colors for parsing
    parts.push('--no-colors');

    // JSON output for parsing
    parts.push('--json');

    // Silent mode to reduce noise
    if (options.silent) {
      parts.push('--silent');
    }

    return parts.join(' ');
  }

  /**
   * Parse Jest JSON output
   * @param {string} output - Jest output
   * @param {string} testFile - Test file path
   * @returns {Object} Parsed results
   */
  parseJestOutput(output, testFile) {
    try {
      // Extract JSON from output (may have other text)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Failed to parse Jest JSON output');
        return {
          file: testFile,
          status: TEST_STATUS.FAILED,
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          tests: []
        };
      }

      const jestOutput = JSON.parse(jsonMatch[0]);

      const result = {
        file: testFile,
        status: jestOutput.success ? TEST_STATUS.PASSED : TEST_STATUS.FAILED,
        total: jestOutput.numTotalTests || 0,
        passed: jestOutput.numPassedTests || 0,
        failed: jestOutput.numFailedTests || 0,
        skipped: jestOutput.numPendingTests || 0,
        duration: jestOutput.testResults?.[0]?.perfStats?.runtime || 0,
        tests: []
      };

      // Extract individual test results
      if (jestOutput.testResults && jestOutput.testResults[0]) {
        const fileResult = jestOutput.testResults[0];

        fileResult.assertionResults?.forEach(test => {
          result.tests.push({
            name: test.title || test.fullName,
            status: test.status === 'passed' ? TEST_STATUS.PASSED : TEST_STATUS.FAILED,
            duration: test.duration || 0,
            error: test.failureMessages?.join('\n') || null
          });
        });
      }

      return result;

    } catch (error) {
      this.logger.error(`Failed to parse Jest output: ${error.message}`);
      return {
        file: testFile,
        status: TEST_STATUS.FAILED,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        error: error.message
      };
    }
  }

  /**
   * Get test coverage
   * @param {string} backendPath - Backend directory path
   * @returns {Object} Coverage data
   */
  async getCoverage(backendPath) {
    const coveragePath = path.join(backendPath, 'coverage', 'coverage-summary.json');

    try {
      if (fs.existsSync(coveragePath)) {
        const data = fs.readFileSync(coveragePath, 'utf-8');
        const coverage = JSON.parse(data);

        // Extract total coverage
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
   * Load Jest configuration
   * @param {string} backendPath - Backend directory path
   */
  async loadJestConfig(backendPath) {
    const jestConfigPath = path.join(backendPath, 'jest.config.js');
    const packageJsonPath = path.join(backendPath, 'package.json');

    try {
      // Check for jest.config.js
      if (fs.existsSync(jestConfigPath)) {
        this.logger.debug('Found jest.config.js');
        // Note: Can't import dynamically in all cases, but we know it exists
        this.jestConfig = { type: 'file', path: jestConfigPath };
        return;
      }

      // Check for jest config in package.json
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.jest) {
          this.logger.debug('Found Jest config in package.json');
          this.jestConfig = packageJson.jest;
          return;
        }
      }

      this.logger.debug('No Jest config found, using defaults');
    } catch (error) {
      this.logger.warn(`Failed to load Jest config: ${error.message}`);
    }
  }

  /**
   * Run tests for specific feature
   * @param {string} featureName - Feature name
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runFeatureTests(featureName, options = {}) {
    this.logger.info(`Running tests for feature: ${featureName}`);

    const backendPath = options.backendPath || path.join(process.cwd(), 'backend');
    const pattern = path.join(backendPath, '**', `*${featureName}*.test.js`);

    return await this.runTestPattern(pattern, options);
  }

  /**
   * Run unit tests only
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runUnitTests(options = {}) {
    this.logger.info('Running unit tests only');

    const backendPath = options.backendPath || path.join(process.cwd(), 'backend');
    const unitTestPattern = /\.unit\.(test|spec)\.(js|ts)$/;

    const testFiles = this.findTestFiles(backendPath, unitTestPattern);

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
   * Run integration tests only
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runIntegrationTests(options = {}) {
    this.logger.info('Running integration tests only');

    const backendPath = options.backendPath || path.join(process.cwd(), 'backend');
    const integrationTestPattern = /\.(integration|int)\.(test|spec)\.(js|ts)$/;

    const testFiles = this.findTestFiles(backendPath, integrationTestPattern);

    if (testFiles.length === 0) {
      this.logger.warn('No integration tests found');
      return this.results;
    }

    const results = [];
    for (const testFile of testFiles) {
      const result = await this.runTestPattern(testFile, options);
      results.push(result);
    }

    return this.aggregateResults(results);
  }
}

/**
 * Get singleton instance
 */
let runnerInstance = null;

export function getBackendTestRunner() {
  if (!runnerInstance) {
    runnerInstance = new BackendTestRunner();
  }
  return runnerInstance;
}
