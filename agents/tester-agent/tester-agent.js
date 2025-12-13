/**
 * Tester Agent - Main Test Orchestrator
 *
 * A generic test orchestrator that supports multiple testing frameworks:
 * - Jest (Node.js backend)
 * - Flutter test
 * - Vitest/Jest (React)
 * - Playwright (E2E)
 *
 * Publishes test results to EventBus for autonomous loop integration.
 */

import { getBackendTestRunner } from './runners/backend-test-runner.js';
import { getFlutterTestRunner } from './runners/flutter-test-runner.js';
import { getReactTestRunner } from './runners/react-test-runner.js';
import { getE2ETestRunner } from './runners/e2e-test-runner.js';
import { createLogger } from './utils/logger.js';
import * as path from 'path';

// Event Bus integration
let getEventBus, EventTypes;
try {
  const eventBusModule = await import('../../foundation/event-bus/AgentEventBus.js');
  const eventTypesModule = await import('../../foundation/event-bus/eventTypes.js');
  getEventBus = eventBusModule.getEventBus;
  EventTypes = eventTypesModule.EventTypes;
} catch (error) {
  // Fallback if foundation not available (standalone mode)
  getEventBus = null;
  EventTypes = null;
}

/**
 * TesterAgent - Main orchestrator for all test execution
 *
 * This is a GENERIC implementation. Configure platforms and agent mappings
 * via configure() method.
 */
export class TesterAgent {
  constructor() {
    this.logger = createLogger('TesterAgent');
    this.runners = {
      backend: getBackendTestRunner(),
      flutter: new Map(), // Dynamic Flutter runners per app
      react: getReactTestRunner(),
      e2e: getE2ETestRunner()
    };

    // Initialize EventBus connection if available
    this.eventBus = getEventBus ? getEventBus() : null;
    this.EventTypes = EventTypes;

    // Configurable platform paths
    this.platformPaths = new Map();

    // Configurable platform-to-agent mapping for auto-fix routing
    this.platformAgentMapping = new Map();

    // Project root - defaults to cwd
    this.projectRoot = process.cwd();
  }

  /**
   * Configure the tester agent
   * @param {Object} config - Configuration options
   * @param {string} config.projectRoot - Project root directory
   * @param {Object} config.platforms - Platform name to path mapping
   * @param {Object} config.agentMapping - Platform name to agent name mapping
   */
  configure(config = {}) {
    if (config.projectRoot) {
      this.projectRoot = config.projectRoot;
    }

    if (config.platforms) {
      Object.entries(config.platforms).forEach(([name, pathOrConfig]) => {
        if (typeof pathOrConfig === 'string') {
          this.platformPaths.set(name, { path: pathOrConfig, type: 'auto' });
        } else {
          this.platformPaths.set(name, pathOrConfig);
        }
      });
    }

    if (config.agentMapping) {
      Object.entries(config.agentMapping).forEach(([platform, agent]) => {
        this.platformAgentMapping.set(platform, agent);
      });
    }

    this.logger.info('TesterAgent configured', {
      projectRoot: this.projectRoot,
      platforms: Array.from(this.platformPaths.keys())
    });
  }

  /**
   * Register a platform for testing
   * @param {string} name - Platform name
   * @param {Object} config - Platform configuration
   * @param {string} config.path - Path to the platform
   * @param {string} config.type - Test type: 'jest', 'flutter', 'vitest', 'playwright'
   * @param {string} config.agent - Agent name for auto-fix routing
   */
  registerPlatform(name, config) {
    this.platformPaths.set(name, config);
    if (config.agent) {
      this.platformAgentMapping.set(name, config.agent);
    }
    this.logger.info(`Registered platform: ${name} (${config.type})`);
  }

  /**
   * Run all tests across all registered platforms
   * @param {Object} options - Test run options
   * @returns {Object} Aggregated test results
   */
  async runAllTests(options = {}) {
    this.logger.info('Starting comprehensive test execution across all platforms');

    // Publish TESTS_STARTED event
    if (this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.TESTS_STARTED, {
        agent: 'tester-agent',
        timestamp: Date.now(),
        options
      });
    }

    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      platforms: {},
      summary: {},
      duration: 0
    };

    try {
      // Get all registered platforms or use defaults
      const platforms = this.platformPaths.size > 0
        ? Array.from(this.platformPaths.entries())
        : this.getDefaultPlatforms(options);

      // Run tests
      if (options.parallel !== false) {
        // Parallel execution
        const platformPromises = platforms.map(async ([name, config]) => {
          try {
            const result = await this.runPlatformTestsByConfig(name, config, options);
            return [name, result];
          } catch (err) {
            return [name, { error: err.message }];
          }
        });

        const platformResults = await Promise.all(platformPromises);
        platformResults.forEach(([name, result]) => {
          results.platforms[name] = result;
        });
      } else {
        // Sequential execution
        for (const [name, config] of platforms) {
          try {
            results.platforms[name] = await this.runPlatformTestsByConfig(name, config, options);
          } catch (err) {
            results.platforms[name] = { error: err.message };
          }
        }
      }

      // Generate summary
      results.summary = this.generateSummary(results.platforms);
      results.duration = Date.now() - startTime;

      this.logger.info(`All tests completed in ${(results.duration / 1000).toFixed(2)}s`);
      this.logger.info(this.formatSummary(results.summary));

      // Publish test completion event
      if (this.eventBus && this.EventTypes) {
        const hasFailures = results.summary.totalFailed > 0;
        const eventType = hasFailures ? this.EventTypes.TESTS_FAILED : this.EventTypes.TESTS_COMPLETED;

        this.eventBus.publish(eventType, {
          agent: 'tester-agent',
          timestamp: Date.now(),
          results,
          failures: this.extractFailures(results),
          summary: results.summary,
          duration: results.duration,
          autoFixable: this.identifyAutoFixableFailures(results)
        });
      }

      return results;

    } catch (error) {
      this.logger.error('Test execution failed:', error);

      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.ERROR_OCCURRED, {
          agent: 'tester-agent',
          error: error.message,
          stack: error.stack,
          timestamp: Date.now()
        });
      }

      throw error;
    }
  }

  /**
   * Get default platform configuration
   * @param {Object} options - Options with optional basePath
   * @returns {Array} Platform entries
   */
  getDefaultPlatforms(options = {}) {
    const basePath = options.basePath || this.projectRoot;
    return [
      ['backend', { path: path.join(basePath, 'backend'), type: 'jest' }]
    ];
  }

  /**
   * Run tests for a platform by configuration
   * @param {string} name - Platform name
   * @param {Object} config - Platform configuration
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runPlatformTestsByConfig(name, config, options = {}) {
    const testType = config.type || this.detectTestType(config.path);

    switch (testType) {
      case 'jest':
      case 'backend':
        return await this.runners.backend.runTests({
          backendPath: config.path,
          parallel: options.parallel,
          coverage: options.coverage !== false,
          concurrency: options.concurrency || 4
        });

      case 'flutter':
        let runner = this.runners.flutter.get(name);
        if (!runner) {
          runner = getFlutterTestRunner();
          this.runners.flutter.set(name, runner);
        }
        return await runner.runTests({
          appPath: config.path,
          parallel: options.parallel,
          coverage: options.coverage !== false,
          concurrency: options.concurrency || 2
        });

      case 'vitest':
      case 'react':
        return await this.runners.react.runTests({
          appPath: config.path,
          parallel: options.parallel,
          coverage: options.coverage !== false
        });

      case 'playwright':
      case 'e2e':
        return await this.runners.e2e.runTests({
          e2ePath: config.path,
          parallel: options.parallel,
          concurrency: options.concurrency || 2,
          browser: options.browser || 'chromium'
        });

      default:
        throw new Error(`Unknown test type: ${testType} for platform ${name}`);
    }
  }

  /**
   * Detect test type from path
   * @param {string} platformPath - Platform path
   * @returns {string} Detected test type
   */
  detectTestType(platformPath) {
    // Simple heuristics based on path
    if (platformPath.includes('backend') || platformPath.includes('api') || platformPath.includes('server')) {
      return 'jest';
    }
    if (platformPath.includes('flutter') || platformPath.includes('-app')) {
      return 'flutter';
    }
    if (platformPath.includes('react') || platformPath.includes('dashboard') || platformPath.includes('admin')) {
      return 'vitest';
    }
    if (platformPath.includes('e2e') || platformPath.includes('playwright')) {
      return 'playwright';
    }
    return 'jest'; // Default
  }

  /**
   * Run tests for specific platform by name
   * @param {string} platform - Platform name
   * @param {Object} options - Run options
   * @returns {Object} Test results
   */
  async runPlatformTests(platform, options = {}) {
    this.logger.info(`Running tests for platform: ${platform}`);

    const config = this.platformPaths.get(platform);
    if (!config) {
      throw new Error(`Platform not registered: ${platform}. Use registerPlatform() first.`);
    }

    return await this.runPlatformTestsByConfig(platform, config, options);
  }

  /**
   * Generate test summary
   * @param {Object} platforms - Platform test results
   * @returns {Object} Summary
   */
  generateSummary(platforms) {
    const summary = {
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      totalDuration: 0,
      platformCount: 0,
      passRate: 0,
      status: 'passed'
    };

    Object.entries(platforms).forEach(([platform, result]) => {
      if (result && !result.error) {
        summary.totalTests += result.total || 0;
        summary.totalPassed += result.passed || 0;
        summary.totalFailed += result.failed || 0;
        summary.totalSkipped += result.skipped || 0;
        summary.totalDuration += result.duration || 0;
        summary.platformCount++;

        if (result.failed > 0) {
          summary.status = 'failed';
        }
      }
    });

    summary.passRate = summary.totalTests > 0
      ? ((summary.totalPassed / summary.totalTests) * 100).toFixed(2)
      : 0;

    return summary;
  }

  /**
   * Format summary for display
   * @param {Object} summary - Test summary
   * @returns {string} Formatted summary
   */
  formatSummary(summary) {
    const lines = [];
    lines.push('\n=== TEST SUMMARY ===');
    lines.push(`Status: ${summary.status === 'passed' ? 'PASSED' : 'FAILED'}`);
    lines.push(`\nPlatforms: ${summary.platformCount}`);
    lines.push(`Total Tests: ${summary.totalTests}`);
    lines.push(`  Passed:  ${summary.totalPassed}`);
    lines.push(`  Failed:  ${summary.totalFailed}`);
    lines.push(`  Skipped: ${summary.totalSkipped}`);
    lines.push(`\nPass Rate: ${summary.passRate}%`);
    lines.push(`Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);

    return lines.join('\n');
  }

  /**
   * Extract detailed failure information from test results
   * @param {Object} results - Test results
   * @returns {Array} Detailed failure information
   */
  extractFailures(results) {
    const failures = [];

    Object.entries(results.platforms).forEach(([platform, platformResult]) => {
      if (!platformResult || platformResult.error) {
        failures.push({
          platform,
          type: 'platform_error',
          severity: 'high',
          error: platformResult?.error || 'Unknown error',
          autoFixable: false
        });
        return;
      }

      if (platformResult.tests) {
        platformResult.tests.forEach(test => {
          if (test.status === 'failed') {
            failures.push({
              platform,
              type: 'test_failure',
              severity: this.determineFailureSeverity(test),
              testName: test.name,
              testFile: test.file || platformResult.file,
              error: test.error,
              stackTrace: test.stack,
              autoFixable: this.isTestAutoFixable(test, platform)
            });
          }
        });
      }
    });

    return failures;
  }

  /**
   * Identify which failures can be auto-fixed by agents
   * @param {Object} results - Test results
   * @returns {Object} Auto-fixable failures grouped by agent
   */
  identifyAutoFixableFailures(results) {
    const failures = this.extractFailures(results);
    const autoFixable = {};

    failures.forEach(failure => {
      if (!failure.autoFixable) return;

      // Get agent from mapping or use default
      const agent = this.platformAgentMapping.get(failure.platform) || 'default-agent';

      if (!autoFixable[agent]) {
        autoFixable[agent] = [];
      }

      autoFixable[agent].push({
        test: failure.testName,
        file: failure.testFile,
        error: failure.error,
        suggestedFix: this.suggestFix(failure)
      });
    });

    return autoFixable;
  }

  /**
   * Determine if a test failure can be auto-fixed
   * @param {Object} test - Test information
   * @param {string} platform - Platform name
   * @returns {boolean} Whether test is auto-fixable
   */
  isTestAutoFixable(test, platform) {
    const error = test.error || '';

    const autoFixablePatterns = [
      /cannot find module/i,
      /is not defined/i,
      /undefined is not a function/i,
      /is not a function/i,
      /expected.*to be/i,
      /404.*not found/i,
      /expected.*got 404/i,
      /route.*not found/i,
      /validation.*failed/i,
      /widget.*not found/i,
      /component.*not found/i,
      /TypeError:.*null/i,
      /missing required.*prop/i,
      /cannot read.*property.*undefined/i
    ];

    return autoFixablePatterns.some(pattern => pattern.test(error));
  }

  /**
   * Determine failure severity
   * @param {Object} test - Test information
   * @returns {string} Severity level
   */
  determineFailureSeverity(test) {
    const error = test.error || '';
    const name = test.name || '';

    if (/security|auth|payment|transaction/i.test(name + error)) {
      return 'critical';
    }
    if (/core|main|primary|data.*integrity/i.test(name + error)) {
      return 'high';
    }
    if (/feature|component|widget|screen/i.test(name + error)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Suggest a fix for a test failure
   * @param {Object} failure - Failure information
   * @returns {string} Suggested fix description
   */
  suggestFix(failure) {
    const error = failure.error || '';

    if (/cannot find module/i.test(error)) {
      const match = error.match(/cannot find module ['"](.+)['"]/i);
      return match ? `Add missing import: ${match[1]}` : 'Add missing import';
    }

    if (/is not defined/i.test(error)) {
      const match = error.match(/(\w+) is not defined/i);
      return match ? `Define missing ${match[1]}` : 'Define missing variable/function';
    }

    if (/404.*not found/i.test(error)) {
      return 'Generate missing API endpoint';
    }

    if (/validation.*failed/i.test(error)) {
      return 'Add missing validation logic';
    }

    if (/widget.*not found/i.test(error)) {
      return 'Generate missing widget';
    }

    if (/component.*not found/i.test(error)) {
      return 'Generate missing component';
    }

    if (/TypeError:.*null/i.test(error)) {
      return 'Add null/undefined check';
    }

    if (/missing required.*prop/i.test(error)) {
      return 'Add required props';
    }

    return 'Review and fix test failure';
  }

  /**
   * Generate report for Manager-Agent
   * @param {Object} results - Test results
   * @returns {Object} Manager-compatible report
   */
  generateManagerReport(results) {
    return {
      agentName: 'tester-agent',
      status: results.summary.status === 'passed' ? 'success' : 'failure',
      summary: {
        totalTests: results.summary.totalTests,
        passed: results.summary.totalPassed,
        failed: results.summary.totalFailed,
        passRate: results.summary.passRate,
        duration: results.summary.totalDuration
      },
      platforms: Object.keys(results.platforms),
      timestamp: results.timestamp,
      failedTests: this.extractFailedTests(results.platforms)
    };
  }

  /**
   * Extract failed tests from results
   * @param {Object} platforms - Platform results
   * @returns {Array} Failed tests
   */
  extractFailedTests(platforms) {
    const failed = [];

    Object.entries(platforms).forEach(([platform, result]) => {
      if (result && result.tests) {
        result.tests.forEach(test => {
          if (test.status === 'failed') {
            failed.push({
              platform,
              name: test.name,
              error: test.error,
              file: result.file
            });
          }
        });
      }
    });

    return failed;
  }
}

// Singleton instance
let agentInstance = null;

export function getTesterAgent() {
  if (!agentInstance) {
    agentInstance = new TesterAgent();
  }
  return agentInstance;
}

/**
 * CLI entry point
 */
export async function main() {
  const agent = getTesterAgent();

  const args = process.argv.slice(2);

  const flags = {
    command: 'all',
    reportFormat: 'console',
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const flagName = arg.substring(2);
      if (flagName === 'run-all') {
        flags.command = 'all';
      } else if (flagName === 'report-format' && i + 1 < args.length) {
        flags.reportFormat = args[++i];
      } else if (flagName === 'output' && i + 1 < args.length) {
        flags.output = args[++i];
      }
    } else if (!arg.startsWith('-')) {
      flags.command = arg;
    }
  }

  try {
    let results;

    switch (flags.command) {
      case 'all':
        results = await agent.runAllTests();
        break;

      default:
        // Try to run as platform name
        try {
          results = await agent.runPlatformTests(flags.command);
        } catch (e) {
          console.error(`Unknown command or platform: ${flags.command}`);
          console.log('Usage: node tester-agent.js [all|<platform>] [--report-format json|console]');
          process.exit(1);
        }
    }

    if (flags.reportFormat === 'json') {
      const jsonReport = {
        status: results.summary?.status || 'unknown',
        passed: results.summary?.totalPassed || 0,
        failures: results.summary?.totalFailed || 0,
        total: results.summary?.totalTests || 0,
        timestamp: new Date().toISOString(),
        results: results
      };
      console.log(JSON.stringify(jsonReport, null, 2));
    }

    if (results.summary && results.summary.status === 'failed') {
      process.exit(1);
    }

  } catch (error) {
    if (flags.reportFormat === 'json') {
      console.log(JSON.stringify({
        status: 'error',
        passed: 0,
        failures: 1,
        total: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      console.error('Test execution failed:', error.message);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
