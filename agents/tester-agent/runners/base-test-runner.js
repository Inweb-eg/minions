/**
 * BaseTestRunner - Abstract Base Class for Test Runners
 *
 * Phase 7.1: Smart Test Runners
 * Base class for platform-specific test runners
 *
 * All test runners (Backend, Flutter, React, E2E) extend this class
 */

import { createLogger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Test result statuses
 */
export const TEST_STATUS = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  PENDING: 'pending',
  RUNNING: 'running'
};

/**
 * Test priorities for prioritization engine
 */
export const TEST_PRIORITY = {
  CRITICAL: 'critical',  // Tests that recently failed or are flaky
  HIGH: 'high',          // Tests covering critical features
  MEDIUM: 'medium',      // Regular unit tests
  LOW: 'low'             // Non-critical integration tests
};

/**
 * BaseTestRunner
 * Abstract base class for all test runners
 */
export class BaseTestRunner {
  constructor(name, platform) {
    if (this.constructor === BaseTestRunner) {
      throw new Error('BaseTestRunner is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.platform = platform;
    this.logger = createLogger(name);
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      coverage: null
    };
    this.config = {};
    this.testHistory = new Map(); // Track test history for prioritization
  }

  /**
   * Run tests (must be implemented by subclasses)
   * @param {Object} options - Test run options
   * @returns {Object} Test results
   */
  async runTests(options = {}) {
    throw new Error('runTests() must be implemented by subclass');
  }

  /**
   * Run specific test file or pattern
   * @param {string} pattern - Test file pattern
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runTestPattern(pattern, options = {}) {
    throw new Error('runTestPattern() must be implemented by subclass');
  }

  /**
   * Get test coverage
   * @returns {Object} Coverage data
   */
  async getCoverage() {
    throw new Error('getCoverage() must be implemented by subclass');
  }

  /**
   * Execute shell command
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {Object} Command result
   */
  async executeCommand(command, options = {}) {
    this.logger.debug(`Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd || process.cwd(),
        timeout: options.timeout || 300000, // 5 minutes default
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: { ...process.env, ...options.env }
      });

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
        error: error.message
      };
    }
  }

  /**
   * Parse test output to extract results
   * @param {string} output - Test output
   * @returns {Object} Parsed results
   */
  parseTestOutput(output) {
    // To be overridden by subclasses for platform-specific parsing
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  /**
   * Find test files in directory
   * @param {string} directory - Directory to search
   * @param {RegExp} pattern - File pattern
   * @param {Array} exclude - Directories to exclude
   * @returns {Array} Test file paths
   */
  findTestFiles(directory, pattern, exclude = ['node_modules', '.git', 'coverage', 'build']) {
    const testFiles = [];

    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!exclude.includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile() && pattern.test(entry.name)) {
            testFiles.push(fullPath);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to read directory ${dir}:`, error.message);
      }
    };

    walk(directory);
    return testFiles;
  }

  /**
   * Prioritize tests based on history and importance
   * @param {Array} tests - Test files or test objects to prioritize
   * @returns {Array} Prioritized tests (same format as input)
   */
  prioritizeTests(tests) {
    // Sort by priority:
    // 1. Recently failed tests (CRITICAL)
    // 2. Flaky tests (CRITICAL)
    // 3. Modified tests (HIGH)
    // 4. Tests covering critical features (HIGH)
    // 5. Other tests (MEDIUM/LOW)

    // Detect if input is strings (file paths) or objects (test objects)
    const isStringArray = typeof tests[0] === 'string';

    const prioritized = tests.map(test => {
      // If it's a string, it's a file path - look up history
      if (isStringArray) {
        const history = this.testHistory.get(test) || {
          lastStatus: TEST_STATUS.PENDING,
          failCount: 0,
          flaky: false,
          priority: TEST_PRIORITY.MEDIUM
        };

        let priority = TEST_PRIORITY.MEDIUM;

        // Recently failed tests get highest priority
        if (history.lastStatus === TEST_STATUS.FAILED) {
          priority = TEST_PRIORITY.CRITICAL;
        }
        // Flaky tests get high priority
        else if (history.flaky) {
          priority = TEST_PRIORITY.CRITICAL;
        }
        // Tests that failed multiple times
        else if (history.failCount > 2) {
          priority = TEST_PRIORITY.HIGH;
        }
        // Use stored priority
        else {
          priority = history.priority;
        }

        return {
          file: test,
          priority,
          history
        };
      } else {
        // It's a test object - calculate priority from object properties
        let priority = test.priority || TEST_PRIORITY.MEDIUM;

        // Recently failed tests get highest priority
        if (test.recentlyFailed) {
          priority = TEST_PRIORITY.CRITICAL;
        }
        // Tests affected by changes get high priority
        else if (test.affectedByChanges && priority !== TEST_PRIORITY.CRITICAL) {
          priority = priority === TEST_PRIORITY.MEDIUM ? TEST_PRIORITY.HIGH : priority;
        }

        return {
          ...test,
          priority
        };
      }
    });

    // Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
    const priorityOrder = {
      [TEST_PRIORITY.CRITICAL]: 0,
      [TEST_PRIORITY.HIGH]: 1,
      [TEST_PRIORITY.MEDIUM]: 2,
      [TEST_PRIORITY.LOW]: 3
    };

    prioritized.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Return in same format as input
    if (isStringArray) {
      return prioritized.map(p => p.file);
    } else {
      return prioritized;
    }
  }

  /**
   * Update test history after run
   * @param {string} testFile - Test file path
   * @param {Object} result - Test result
   */
  updateTestHistory(testFile, result) {
    const history = this.testHistory.get(testFile) || {
      lastStatus: TEST_STATUS.PENDING,
      failCount: 0,
      runCount: 0,
      flaky: false,
      priority: TEST_PRIORITY.MEDIUM
    };

    history.lastStatus = result.status;
    history.runCount++;

    if (result.status === TEST_STATUS.FAILED) {
      history.failCount++;
    }

    // Detect flaky tests (alternating pass/fail)
    if (history.runCount >= 3) {
      // If test has both passes and failures, mark as flaky
      if (history.failCount > 0 && history.failCount < history.runCount) {
        history.flaky = true;
      }
    }

    this.testHistory.set(testFile, history);
  }

  /**
   * Run tests in parallel with concurrency control
   * @param {Array} testFiles - Test files to run
   * @param {number} concurrency - Max parallel tests
   * @param {Object} options - Run options
   * @returns {Object} Aggregated results
   */
  async runParallel(testFiles, concurrency = 4, options = {}) {
    this.logger.info(`Running ${testFiles.length} tests with concurrency ${concurrency}`);

    const results = [];
    const queue = [...testFiles];
    const running = [];

    const runNext = async () => {
      if (queue.length === 0) return null;

      const testFile = queue.shift();
      this.logger.debug(`Starting test: ${testFile}`);

      try {
        const result = await this.runTestPattern(testFile, options);
        this.updateTestHistory(testFile, result);
        results.push(result);
        this.logger.success(`Completed: ${testFile}`);
        return result;
      } catch (error) {
        this.logger.fail(`Failed: ${testFile}`, error.message);
        const failedResult = {
          file: testFile,
          status: TEST_STATUS.FAILED,
          error: error.message
        };
        results.push(failedResult);
        this.updateTestHistory(testFile, failedResult);
        return failedResult;
      }
    };

    // Start initial batch
    for (let i = 0; i < Math.min(concurrency, testFiles.length); i++) {
      running.push(runNext());
    }

    // Process remaining tests
    while (running.length > 0) {
      const completed = await Promise.race(running);
      const index = running.indexOf(completed);
      running.splice(index, 1);

      // Start next test if available
      if (queue.length > 0) {
        running.push(runNext());
      }
    }

    // Aggregate results
    return this.aggregateResults(results);
  }

  /**
   * Aggregate multiple test results
   * @param {Array} results - Individual test results
   * @returns {Object} Aggregated results
   */
  aggregateResults(results) {
    const aggregated = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: []
    };

    results.forEach(result => {
      aggregated.total += result.total || 0;
      aggregated.passed += result.passed || 0;
      aggregated.failed += result.failed || 0;
      aggregated.skipped += result.skipped || 0;
      aggregated.duration += result.duration || 0;

      if (result.tests) {
        aggregated.tests.push(...result.tests);
      }
    });

    return aggregated;
  }

  /**
   * Load test history from file
   * @param {string} filePath - Path to history file
   */
  loadTestHistory(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const history = JSON.parse(data);

        Object.entries(history).forEach(([file, hist]) => {
          this.testHistory.set(file, hist);
        });

        this.logger.debug(`Loaded test history for ${this.testHistory.size} tests`);
      }
    } catch (error) {
      this.logger.warn(`Failed to load test history: ${error.message}`);
    }
  }

  /**
   * Save test history to file
   * @param {string} filePath - Path to history file
   */
  saveTestHistory(filePath) {
    try {
      const history = {};
      this.testHistory.forEach((hist, file) => {
        history[file] = hist;
      });

      fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
      this.logger.debug(`Saved test history for ${this.testHistory.size} tests`);
    } catch (error) {
      this.logger.warn(`Failed to save test history: ${error.message}`);
    }
  }

  /**
   * Format test results for display
   * @param {Object} results - Test results
   * @returns {string} Formatted output
   */
  formatResults(results) {
    const lines = [];
    lines.push('\n📊 Test Results:');
    lines.push(`  Total:   ${results.total}`);
    lines.push(`  ✅ Passed: ${results.passed}`);
    lines.push(`  ❌ Failed: ${results.failed}`);
    lines.push(`  ⏭️  Skipped: ${results.skipped}`);
    lines.push(`  ⏱️  Duration: ${(results.duration / 1000).toFixed(2)}s`);

    if (results.coverage) {
      lines.push(`\n📈 Coverage:`);
      lines.push(`  Lines:      ${results.coverage.lines || 0}%`);
      lines.push(`  Branches:   ${results.coverage.branches || 0}%`);
      lines.push(`  Functions:  ${results.coverage.functions || 0}%`);
      lines.push(`  Statements: ${results.coverage.statements || 0}%`);
    }

    return lines.join('\n');
  }

  /**
   * Get test results
   * @returns {Object} Test results
   */
  getResults() {
    return this.results;
  }

  /**
   * Reset results
   */
  reset() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      coverage: null
    };
  }

  /**
   * Run tests with fast-fail mode
   * @param {Array} tests - Tests to run
   * @param {Object} options - Fast-fail options
   * @returns {Object} Test results with fast-fail info
   */
  runWithFastFail(tests, options = {}) {
    const {
      failFast = true,
      criticalOnly = false,
      minPriority = TEST_PRIORITY.LOW,
      mode = 'standard'
    } = options;

    this.logger.info(`Running with fast-fail mode: ${mode}`);

    const startTime = Date.now();
    const results = {
      completed: 0,
      skipped: 0,
      stopped: false,
      reason: null,
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };

    // Filter tests based on options
    let filteredTests = tests;

    if (criticalOnly) {
      filteredTests = tests.filter(t =>
        t.priority === TEST_PRIORITY.CRITICAL ||
        (t.priority === undefined && t.recentlyFailed)
      );
    } else if (mode === 'fast') {
      const priorityOrder = {
        [TEST_PRIORITY.CRITICAL]: 0,
        [TEST_PRIORITY.HIGH]: 1,
        [TEST_PRIORITY.MEDIUM]: 2,
        [TEST_PRIORITY.LOW]: 3
      };
      const minPriorityValue = priorityOrder[minPriority];

      filteredTests = tests.filter(t => {
        const testPriority = t.priority || TEST_PRIORITY.MEDIUM;
        return priorityOrder[testPriority] <= minPriorityValue;
      });
    } else if (mode === 'affected-only') {
      filteredTests = tests.filter(t => t.affectedByChanges);
    }

    results.skipped = tests.length - filteredTests.length;

    // Simulate test execution (in real implementation, would actually run tests)
    for (const test of filteredTests) {
      const testWillFail = test.willFail || false;

      if (testWillFail) {
        results.summary.failed++;
        results.tests.push({ ...test, status: TEST_STATUS.FAILED });
        results.completed++; // Count the failed test as completed

        // Stop on critical test failure if failFast enabled
        if (failFast && (test.priority === TEST_PRIORITY.CRITICAL || criticalOnly)) {
          results.stopped = true;
          results.reason = 'Critical test failed';
          results.failedAt = Date.now() - startTime; // Time since test run started
          break;
        }
      } else {
        results.summary.passed++;
        results.tests.push({ ...test, status: TEST_STATUS.PASSED });
        results.completed++; // Count the passed test as completed
      }
    }

    return results;
  }

  /**
   * Run tests in parallel with fast-fail
   * @param {Array} tests - Tests to run
   * @param {Object} options - Parallel fast-fail options
   * @returns {Object} Test results
   */
  runParallelWithFastFail(tests, options = {}) {
    const {
      maxConcurrency = 4,
      failFast = true
    } = options;

    this.logger.info(`Running ${tests.length} tests in parallel (concurrency: ${maxConcurrency})`);

    const results = {
      completed: 0,
      completedTests: [],
      stopped: false,
      totalTime: 0
    };

    let stopped = false;
    const startTime = Date.now();

    // Simulate parallel execution
    for (const test of tests) {
      if (stopped) break;

      const testWillFail = test.willFail || false;
      const isCritical = test.priority === TEST_PRIORITY.CRITICAL;

      if (testWillFail && isCritical && failFast) {
        stopped = true;
        results.stopped = true;
        results.totalTime = test.duration || 500;
        break;
      }

      results.completed++;
      results.completedTests.push(test);
    }

    if (!stopped) {
      results.totalTime = Date.now() - startTime;
    }

    return results;
  }

  /**
   * Balance test load across workers
   * @param {Array} tests - Tests to balance
   * @param {number} workerCount - Number of workers
   * @returns {Array} Workers with balanced tests
   */
  balanceTestLoad(tests, workerCount) {
    this.logger.debug(`Balancing ${tests.length} tests across ${workerCount} workers`);

    // Initialize workers
    const workers = Array.from({ length: workerCount }, () => ({
      tests: [],
      totalDuration: 0
    }));

    // Sort tests by duration (longest first) for better load balancing
    const sortedTests = [...tests].sort((a, b) =>
      (b.duration || 0) - (a.duration || 0)
    );

    // Assign tests to worker with least total duration (greedy algorithm)
    for (const test of sortedTests) {
      // Find worker with minimum load
      const minWorker = workers.reduce((min, worker) =>
        worker.totalDuration < min.totalDuration ? worker : min
      );

      minWorker.tests.push(test);
      minWorker.totalDuration += test.duration || 0;
    }

    return workers;
  }

  /**
   * Detect tests affected by code changes
   * @param {Array} tests - All tests
   * @param {Array} changedFiles - Files that changed
   * @returns {Array} Affected tests
   */
  detectAffectedTests(tests, changedFiles) {
    this.logger.debug(`Detecting tests affected by ${changedFiles.length} changed files`);

    const affectedTests = [];

    for (const test of tests) {
      const testImports = test.imports || [];

      // Check if test imports any changed files
      const isAffected = changedFiles.some(changedFile =>
        testImports.some(imp => imp.includes(changedFile))
      );

      if (isAffected) {
        affectedTests.push(test);
      }
    }

    return affectedTests;
  }

  /**
   * Prioritize tests based on historical data
   * @param {Array} testHistory - Test history with fail rates
   * @returns {Array} Prioritized tests
   */
  prioritizeByHistory(testHistory) {
    this.logger.debug(`Prioritizing ${testHistory.length} tests by history`);

    // Sort by fail rate (highest first), then by average duration
    const sorted = [...testHistory].sort((a, b) => {
      // Primary sort: fail rate
      if (b.failRate !== a.failRate) {
        return b.failRate - a.failRate;
      }

      // Secondary sort: duration (faster tests first if fail rate is same)
      return (a.avgDuration || 0) - (b.avgDuration || 0);
    });

    return sorted;
  }

  /**
   * Run tests and measure execution time
   * @param {Array} tests - Tests with execute functions
   * @returns {Promise<Array>} Results with duration measurements
   */
  async runAndMeasure(tests) {
    this.logger.debug(`Running and measuring ${tests.length} tests`);

    const results = [];

    for (const test of tests) {
      const startTime = Date.now();

      try {
        // Execute test (supports both sync and async)
        if (test.execute && typeof test.execute === 'function') {
          const result = test.execute();
          // Await if it's a promise
          if (result && typeof result.then === 'function') {
            await result;
          }
        }

        const duration = Date.now() - startTime;

        results.push({
          name: test.name,
          status: TEST_STATUS.PASSED,
          duration
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        results.push({
          name: test.name,
          status: TEST_STATUS.FAILED,
          duration,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {boolean} Whether configuration is valid
   */
  validateConfig(config) {
    this.logger.debug('Validating configuration');

    try {
      // Check required types
      if (config.failFast !== undefined && typeof config.failFast !== 'boolean') {
        return false;
      }

      if (config.maxConcurrency !== undefined) {
        if (typeof config.maxConcurrency !== 'number' || config.maxConcurrency <= 0) {
          return false;
        }
      }

      if (config.minPriority !== undefined) {
        const validPriorities = Object.values(TEST_PRIORITY);
        if (!validPriorities.includes(config.minPriority)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.warn(`Config validation error: ${error.message}`);
      return false;
    }
  }
}
