/**
 * AutoFixer - Main orchestrator for automatic test fixing
 *
 * Integrates:
 * - TestFailureAnalyzer - Parse test output
 * - FixGenerator - Generate code fixes
 * - FixApplier - Apply and verify fixes
 * - EventBus - Inter-agent communication
 *
 * Workflow:
 * 1. Receive TESTS_FAILED event
 * 2. Analyze failures
 * 3. Generate fixes
 * 4. Apply fixes
 * 5. Re-run tests
 * 6. If still failing, iterate (max 5 times)
 * 7. Publish result event
 */

import { getEventBus } from '../../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';
import { createLogger } from '../../../foundation/common/logger.js';
import { TestFailureAnalyzer, getTestFailureAnalyzer } from './TestFailureAnalyzer.js';
import { FixGenerator, getFixGenerator } from './FixGenerator.js';
import { FixApplier, getFixApplier } from './FixApplier.js';
import { spawn } from 'child_process';

const logger = createLogger('AutoFixer');

export class AutoFixer {
  constructor(options = {}) {
    this.options = {
      maxIterations: 5,
      testTimeout: 120000,
      enabled: true,
      autoSubscribe: true,
      projectRoot: process.cwd(),
      platforms: {
        backend: {
          testCommand: 'npm test',
          testDir: 'backend',
          framework: 'jest'
        },
        admin: {
          testCommand: 'npm test',
          testDir: 'admin-dashboard',
          framework: 'jest'
        },
        users: {
          testCommand: 'flutter test',
          testDir: 'users-app',
          framework: 'flutter'
        },
        drivers: {
          testCommand: 'flutter test',
          testDir: 'drivers-app',
          framework: 'flutter'
        }
      },
      ...options
    };

    this.eventBus = null;
    this.analyzer = getTestFailureAnalyzer();
    this.generator = getFixGenerator({ enableAIFallback: true });
    this.applier = getFixApplier({
      createBackups: true,
      verifyFixes: true,
      testTimeout: this.options.testTimeout,
      projectRoot: this.options.projectRoot
    });

    this.activeSessions = new Map();
    this.history = [];
    this.initialized = false;
  }

  /**
   * Initialize the AutoFixer
   */
  async initialize() {
    if (this.initialized) return;

    logger.info('Initializing AutoFixer skill...');

    try {
      this.eventBus = getEventBus();

      if (this.options.autoSubscribe && this.eventBus) {
        this.subscribeToEvents();
      }

      this.initialized = true;
      logger.info('AutoFixer initialized successfully');

      // Publish ready event
      if (this.eventBus) {
        this.eventBus.publish('SKILL_READY', {
          skill: 'auto-fixer',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to initialize AutoFixer:', error);
      throw error;
    }
  }

  /**
   * Subscribe to EventBus events
   *
   * NOTE: AutoFixer does NOT subscribe to TESTS_FAILED directly.
   * The AutonomousLoopManager is the single coordinator that:
   * 1. Receives TESTS_FAILED events
   * 2. Calls AutoFixer.handleTestFailure() directly for pattern-based fixes
   * 3. Dispatches to platform agents for domain-specific fixes
   * This prevents duplicate fix attempts and race conditions.
   */
  subscribeToEvents() {
    logger.info('Subscribing to EventBus events...');

    // Listen for manual fix requests (direct API calls)
    this.eventBus.subscribe('FIX_REQUESTED', 'auto-fixer', async (data) => {
      try {
        await this.handleFixRequest(data);
      } catch (error) {
        logger.error('Error handling FIX_REQUESTED:', error);
      }
    });

    logger.info('AutoFixer subscribed to: FIX_REQUESTED (TESTS_FAILED handled by AutonomousLoopManager)');
  }

  /**
   * Handle test failure event
   */
  async handleTestFailure(data) {
    const sessionId = `fix-${Date.now()}`;

    logger.info(`[${sessionId}] Handling test failure from ${data.platform || 'unknown'}`);

    const session = {
      id: sessionId,
      startTime: Date.now(),
      platform: data.platform,
      iterations: 0,
      status: 'running',
      failures: [],
      fixes: [],
      results: []
    };

    this.activeSessions.set(sessionId, session);

    try {
      const result = await this.runFixLoop(data, session);

      session.status = result.success ? 'completed' : 'failed';
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;

      this.history.push({ ...session });
      this.activeSessions.delete(sessionId);

      // Publish result
      if (this.eventBus) {
        this.eventBus.publish(result.success ? 'FIX_COMPLETED' : 'FIX_FAILED', {
          sessionId,
          ...result,
          platform: data.platform
        });
      }

      return result;

    } catch (error) {
      logger.error(`[${sessionId}] Fix loop failed:`, error);

      session.status = 'error';
      session.error = error.message;
      this.activeSessions.delete(sessionId);

      if (this.eventBus) {
        this.eventBus.publish('FIX_FAILED', {
          sessionId,
          error: error.message,
          platform: data.platform
        });
      }

      throw error;
    }
  }

  /**
   * Run the fix loop
   */
  async runFixLoop(data, session) {
    const { testOutput, platform, failedTests } = data;

    let iteration = 0;
    let currentOutput = testOutput;
    let allFixed = false;

    while (iteration < this.options.maxIterations && !allFixed) {
      iteration++;
      session.iterations = iteration;

      logger.info(`[${session.id}] === Iteration ${iteration}/${this.options.maxIterations} ===`);

      // Step 1: Analyze failures
      const platformConfig = this.options.platforms[platform] || {};
      const analysis = this.analyzer.analyze(currentOutput, platformConfig.framework || 'auto');

      if (analysis.totalFailures === 0) {
        logger.info(`[${session.id}] No failures detected - tests may be passing`);
        allFixed = true;
        break;
      }

      logger.info(`[${session.id}] Found ${analysis.totalFailures} failure(s)`);
      session.failures = analysis.failures;

      // Step 2: Generate fixes for each failure
      // Increased limit from 3 to 10 per iteration for larger test suites
      const fixes = [];
      const maxFailuresPerIteration = this.options.maxFailuresPerIteration || 10;
      for (const failure of analysis.failures.slice(0, maxFailuresPerIteration)) {
        logger.info(`[${session.id}] Generating fix for: ${failure.testName}`);

        const fix = await this.generator.generateFix(failure);
        fixes.push({ failure, fix });

        if (fix.success) {
          logger.info(`[${session.id}] Fix generated: ${fix.pattern} (confidence: ${fix.confidence})`);
        }
      }

      session.fixes.push(...fixes);

      // Step 3: Apply high-confidence fixes
      const applicableFixes = fixes.filter(f =>
        f.fix.success &&
        f.fix.confidence !== 'none' &&
        f.fix.changes.some(c => c.fixed || c.command)
      );

      if (applicableFixes.length === 0) {
        logger.warn(`[${session.id}] No applicable fixes generated. Manual intervention required.`);

        // Return suggestions
        return {
          success: false,
          iterations: iteration,
          message: 'No automatic fixes available. See suggestions below.',
          suggestions: fixes.map(f => ({
            test: f.failure.testName,
            pattern: f.fix.pattern,
            message: f.fix.message,
            changes: f.fix.changes
          }))
        };
      }

      // Apply fixes
      for (const { failure, fix } of applicableFixes) {
        logger.info(`[${session.id}] Applying fix for: ${failure.testName}`);

        // Handle command-type fixes (e.g., npm install)
        const commandChange = fix.changes.find(c => c.command);
        if (commandChange) {
          await this.runCommand(commandChange.command, platformConfig.testDir);
        }

        // Apply code changes
        const result = await this.applier.applyFix(fix);
        session.results.push({
          iteration,
          failure: failure.testName,
          fix: fix.pattern,
          result
        });
      }

      // Step 4: Re-run tests
      logger.info(`[${session.id}] Re-running tests to verify fixes...`);

      const testResult = await this.runTests(platform);
      currentOutput = testResult.output;

      if (testResult.success) {
        logger.info(`[${session.id}] Tests passing after ${iteration} iteration(s)!`);
        allFixed = true;
      } else {
        logger.info(`[${session.id}] Tests still failing, continuing to next iteration...`);
      }
    }

    // Final result
    if (allFixed) {
      return {
        success: true,
        iterations: iteration,
        message: `All tests fixed after ${iteration} iteration(s)`,
        fixes: session.fixes.map(f => ({
          test: f.failure.testName,
          pattern: f.fix.pattern
        }))
      };
    } else {
      // Rollback changes
      logger.warn(`[${session.id}] Max iterations reached. Rolling back all changes.`);
      await this.applier.rollbackAll();

      return {
        success: false,
        iterations: iteration,
        message: `Could not fix all tests after ${iteration} iterations. Changes rolled back.`,
        remainingFailures: session.failures.map(f => f.testName)
      };
    }
  }

  /**
   * Run tests for a platform
   */
  async runTests(platform) {
    const config = this.options.platforms[platform];
    if (!config) {
      return { success: false, output: 'Unknown platform' };
    }

    return new Promise((resolve) => {
      const cwd = config.testDir
        ? `${this.options.projectRoot}/${config.testDir}`
        : this.options.projectRoot;

      const parts = config.testCommand.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      logger.info(`Running: ${config.testCommand} in ${cwd}`);

      const proc = spawn(command, args, {
        cwd,
        shell: true,
        timeout: this.options.testTimeout
      });

      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output
        });
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          output
        });
      });
    });
  }

  /**
   * Run a shell command
   */
  async runCommand(command, cwd = null) {
    return new Promise((resolve) => {
      logger.info(`Running command: ${command}`);

      const proc = spawn(command, [], {
        cwd: cwd ? `${this.options.projectRoot}/${cwd}` : this.options.projectRoot,
        shell: true,
        timeout: 60000
      });

      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ success: code === 0, output });
      });

      proc.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Handle manual fix request
   */
  async handleFixRequest(data) {
    const { testOutput, platform, file } = data;

    logger.info('Handling manual fix request');

    // Analyze
    const analysis = this.analyzer.analyze(testOutput, 'auto');

    // Filter to specific file if provided
    let failures = analysis.failures;
    if (file) {
      failures = failures.filter(f => f.file === file || f.file.includes(file));
    }

    // Generate fixes
    const fixes = [];
    for (const failure of failures) {
      const fix = await this.generator.generateFix(failure);
      fixes.push({ failure, fix });
    }

    return {
      analysis,
      fixes,
      summary: `Generated ${fixes.length} fix suggestion(s) for ${failures.length} failure(s)`
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.options.enabled,
      activeSessions: this.activeSessions.size,
      sessions: Array.from(this.activeSessions.values()).map(s => ({
        id: s.id,
        status: s.status,
        iterations: s.iterations,
        platform: s.platform
      })),
      historyCount: this.history.length,
      recentHistory: this.history.slice(-5).map(s => ({
        id: s.id,
        status: s.status,
        duration: s.duration,
        platform: s.platform
      }))
    };
  }

  /**
   * Enable/disable the auto-fixer
   */
  setEnabled(enabled) {
    this.options.enabled = enabled;
    logger.info(`AutoFixer ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get statistics
   */
  getStats() {
    const completed = this.history.filter(s => s.status === 'completed').length;
    const failed = this.history.filter(s => s.status === 'failed').length;

    return {
      totalSessions: this.history.length,
      completed,
      failed,
      successRate: this.history.length > 0
        ? ((completed / this.history.length) * 100).toFixed(1) + '%'
        : 'N/A',
      averageIterations: this.history.length > 0
        ? (this.history.reduce((sum, s) => sum + s.iterations, 0) / this.history.length).toFixed(1)
        : 'N/A',
      averageDuration: this.history.length > 0
        ? Math.round(this.history.reduce((sum, s) => sum + (s.duration || 0), 0) / this.history.length) + 'ms'
        : 'N/A'
    };
  }
}

// Singleton instance
let instance = null;

export function getAutoFixer(options) {
  if (!instance) {
    instance = new AutoFixer(options);
  }
  return instance;
}

export default AutoFixer;
