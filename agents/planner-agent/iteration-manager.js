/**
 * Iteration Manager
 * =================
 * Manages Build → Test → Fix cycles automatically.
 * Handles retry limits, escalation, and cycle state tracking.
 */

import EventEmitter from 'events';

// Iteration phases
export const IterationPhase = {
  BUILD: 'build',
  TEST: 'test',
  FIX: 'fix',
  VERIFY: 'verify',
  COMPLETE: 'complete',
  ESCALATED: 'escalated'
};

// Iteration status
export const IterationStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  RETRYING: 'retrying',
  ESCALATED: 'escalated'
};

// Escalation levels
export const EscalationLevel = {
  NONE: 0,
  LOW: 1,      // Automated retry
  MEDIUM: 2,   // Different strategy
  HIGH: 3,     // Human intervention suggested
  CRITICAL: 4  // Blocking - requires manual resolution
};

export class IterationManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxRetries: config.maxRetries || 3,
      maxFixAttempts: config.maxFixAttempts || 5,
      retryDelayMs: config.retryDelayMs || 1000,
      escalationThreshold: config.escalationThreshold || 3,
      autoEscalate: config.autoEscalate ?? true,
      verifyAfterFix: config.verifyAfterFix ?? true,
      ...config
    };

    // Active iterations
    this.iterations = new Map(); // iterationId -> iteration state

    // Global statistics
    this.stats = {
      totalIterations: 0,
      successfulIterations: 0,
      failedIterations: 0,
      escalatedIterations: 0,
      totalRetries: 0,
      totalFixAttempts: 0
    };
  }

  /**
   * Initialize the iteration manager
   */
  async initialize() {
    return { success: true };
  }

  /**
   * Start a new iteration cycle
   */
  startIteration(planId, options = {}) {
    const iterationId = `iter-${planId}-${Date.now()}`;

    const iteration = {
      id: iterationId,
      planId,
      phase: IterationPhase.BUILD,
      status: IterationStatus.PENDING,
      startTime: Date.now(),
      endTime: null,

      // Retry tracking
      retryCount: 0,
      fixAttempts: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      maxFixAttempts: options.maxFixAttempts || this.config.maxFixAttempts,

      // Escalation
      escalationLevel: EscalationLevel.NONE,
      escalationReason: null,

      // Results tracking
      buildResult: null,
      testResults: [],
      fixResults: [],
      verifyResults: [],

      // Error tracking
      errors: [],
      failedTests: [],

      // Metadata
      metadata: {
        source: options.source || 'manual',
        triggeredBy: options.triggeredBy || null
      }
    };

    this.iterations.set(iterationId, iteration);
    this.stats.totalIterations++;

    this.emit('iteration:started', {
      iterationId,
      planId,
      phase: iteration.phase
    });

    return iteration;
  }

  /**
   * Run the Build phase
   */
  async runBuildPhase(iterationId, buildFn) {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      throw new Error(`Iteration ${iterationId} not found`);
    }

    iteration.phase = IterationPhase.BUILD;
    iteration.status = IterationStatus.RUNNING;

    this.emit('phase:started', {
      iterationId,
      phase: IterationPhase.BUILD
    });

    try {
      const result = await buildFn();
      iteration.buildResult = result;

      if (result.success) {
        this.emit('phase:completed', {
          iterationId,
          phase: IterationPhase.BUILD,
          success: true
        });
        return { success: true, result };
      } else {
        iteration.errors.push({
          phase: IterationPhase.BUILD,
          error: result.error || 'Build failed',
          timestamp: Date.now()
        });

        return this._handlePhaseFailure(iterationId, IterationPhase.BUILD, result.error);
      }
    } catch (error) {
      iteration.errors.push({
        phase: IterationPhase.BUILD,
        error: error.message,
        timestamp: Date.now()
      });

      return this._handlePhaseFailure(iterationId, IterationPhase.BUILD, error);
    }
  }

  /**
   * Run the Test phase
   */
  async runTestPhase(iterationId, testFn) {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      throw new Error(`Iteration ${iterationId} not found`);
    }

    iteration.phase = IterationPhase.TEST;
    iteration.status = IterationStatus.RUNNING;

    this.emit('phase:started', {
      iterationId,
      phase: IterationPhase.TEST
    });

    try {
      const result = await testFn();
      iteration.testResults.push({
        attempt: iteration.retryCount + 1,
        result,
        timestamp: Date.now()
      });

      if (result.success || result.passed) {
        this.emit('phase:completed', {
          iterationId,
          phase: IterationPhase.TEST,
          success: true,
          result
        });

        return { success: true, result };
      } else {
        // Track failed tests
        if (result.failures) {
          iteration.failedTests = result.failures;
        }

        return this._handlePhaseFailure(iterationId, IterationPhase.TEST, result);
      }
    } catch (error) {
      iteration.errors.push({
        phase: IterationPhase.TEST,
        error: error.message,
        timestamp: Date.now()
      });

      return this._handlePhaseFailure(iterationId, IterationPhase.TEST, error);
    }
  }

  /**
   * Run the Fix phase
   */
  async runFixPhase(iterationId, fixFn, failures = null) {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      throw new Error(`Iteration ${iterationId} not found`);
    }

    // Check fix attempt limit
    if (iteration.fixAttempts >= iteration.maxFixAttempts) {
      return this._escalate(iterationId, 'Maximum fix attempts exceeded');
    }

    iteration.phase = IterationPhase.FIX;
    iteration.status = IterationStatus.RUNNING;
    iteration.fixAttempts++;
    this.stats.totalFixAttempts++;

    this.emit('phase:started', {
      iterationId,
      phase: IterationPhase.FIX,
      attempt: iteration.fixAttempts
    });

    try {
      const failuresToFix = failures || iteration.failedTests;
      const result = await fixFn(failuresToFix);

      iteration.fixResults.push({
        attempt: iteration.fixAttempts,
        result,
        timestamp: Date.now()
      });

      if (result.success) {
        this.emit('phase:completed', {
          iterationId,
          phase: IterationPhase.FIX,
          success: true
        });

        // Optionally verify fix
        if (this.config.verifyAfterFix) {
          iteration.phase = IterationPhase.VERIFY;
        }

        return { success: true, result, needsVerification: this.config.verifyAfterFix };
      } else {
        return this._handlePhaseFailure(iterationId, IterationPhase.FIX, result.error);
      }
    } catch (error) {
      iteration.errors.push({
        phase: IterationPhase.FIX,
        error: error.message,
        timestamp: Date.now()
      });

      return this._handlePhaseFailure(iterationId, IterationPhase.FIX, error);
    }
  }

  /**
   * Run the Verify phase (re-run tests after fix)
   */
  async runVerifyPhase(iterationId, verifyFn) {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      throw new Error(`Iteration ${iterationId} not found`);
    }

    iteration.phase = IterationPhase.VERIFY;
    iteration.status = IterationStatus.RUNNING;

    this.emit('phase:started', {
      iterationId,
      phase: IterationPhase.VERIFY
    });

    try {
      const result = await verifyFn();
      iteration.verifyResults.push({
        attempt: iteration.fixAttempts,
        result,
        timestamp: Date.now()
      });

      if (result.success || result.passed) {
        // Fix worked - iteration complete
        return this._completeIteration(iterationId, true);
      } else {
        // Fix didn't work - need another fix cycle
        iteration.failedTests = result.failures || iteration.failedTests;

        this.emit('verify:failed', {
          iterationId,
          failures: iteration.failedTests
        });

        // Check if we should retry or escalate
        if (iteration.fixAttempts >= iteration.maxFixAttempts) {
          return this._escalate(iterationId, 'Verification failed after max fix attempts');
        }

        return {
          success: false,
          needsAnotherFix: true,
          failures: iteration.failedTests
        };
      }
    } catch (error) {
      iteration.errors.push({
        phase: IterationPhase.VERIFY,
        error: error.message,
        timestamp: Date.now()
      });

      return this._handlePhaseFailure(iterationId, IterationPhase.VERIFY, error);
    }
  }

  /**
   * Run a complete Build → Test → Fix cycle
   */
  async runFullCycle(iterationId, { buildFn, testFn, fixFn }) {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      throw new Error(`Iteration ${iterationId} not found`);
    }

    // Build phase
    const buildResult = await this.runBuildPhase(iterationId, buildFn);
    if (!buildResult.success) {
      return buildResult;
    }

    // Test phase
    const testResult = await this.runTestPhase(iterationId, testFn);
    if (testResult.success) {
      return this._completeIteration(iterationId, true);
    }

    // Fix cycle
    while (iteration.fixAttempts < iteration.maxFixAttempts) {
      const fixResult = await this.runFixPhase(iterationId, fixFn);
      if (!fixResult.success) {
        if (fixResult.escalated) {
          return fixResult;
        }
        continue;
      }

      // Verify the fix
      const verifyResult = await this.runVerifyPhase(iterationId, testFn);
      if (verifyResult.success) {
        return verifyResult;
      }

      if (verifyResult.escalated) {
        return verifyResult;
      }
    }

    // Exhausted fix attempts
    return this._escalate(iterationId, 'Exhausted all fix attempts');
  }

  /**
   * Retry the current phase
   */
  async retry(iterationId, retryFn) {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      throw new Error(`Iteration ${iterationId} not found`);
    }

    if (iteration.retryCount >= iteration.maxRetries) {
      return this._escalate(iterationId, 'Maximum retries exceeded');
    }

    iteration.retryCount++;
    iteration.status = IterationStatus.RETRYING;
    this.stats.totalRetries++;

    this.emit('iteration:retrying', {
      iterationId,
      phase: iteration.phase,
      attempt: iteration.retryCount
    });

    // Wait before retry
    await this._delay(this.config.retryDelayMs * iteration.retryCount);

    try {
      const result = await retryFn();
      return result;
    } catch (error) {
      iteration.errors.push({
        phase: iteration.phase,
        error: error.message,
        retryAttempt: iteration.retryCount,
        timestamp: Date.now()
      });

      if (iteration.retryCount >= iteration.maxRetries) {
        return this._escalate(iterationId, `Retry failed: ${error.message}`);
      }

      return { success: false, error, canRetry: true };
    }
  }

  /**
   * Handle phase failure
   */
  _handlePhaseFailure(iterationId, phase, error) {
    const iteration = this.iterations.get(iterationId);
    iteration.status = IterationStatus.FAILED;

    this.emit('phase:failed', {
      iterationId,
      phase,
      error: error?.message || error,
      retryCount: iteration.retryCount
    });

    // Check if we should auto-escalate
    if (this.config.autoEscalate && iteration.retryCount >= this.config.escalationThreshold) {
      return this._escalate(iterationId, `${phase} failed after ${iteration.retryCount} retries`);
    }

    return {
      success: false,
      phase,
      error,
      canRetry: iteration.retryCount < iteration.maxRetries,
      retriesRemaining: iteration.maxRetries - iteration.retryCount
    };
  }

  /**
   * Escalate the iteration
   */
  _escalate(iterationId, reason) {
    const iteration = this.iterations.get(iterationId);

    // Determine escalation level
    let level = EscalationLevel.HIGH;
    if (iteration.errors.length > 5) {
      level = EscalationLevel.CRITICAL;
    } else if (iteration.retryCount < 2) {
      level = EscalationLevel.MEDIUM;
    }

    iteration.status = IterationStatus.ESCALATED;
    iteration.phase = IterationPhase.ESCALATED;
    iteration.escalationLevel = level;
    iteration.escalationReason = reason;
    iteration.endTime = Date.now();

    this.stats.escalatedIterations++;

    this.emit('iteration:escalated', {
      iterationId,
      planId: iteration.planId,
      level,
      reason,
      errors: iteration.errors,
      failedTests: iteration.failedTests
    });

    return {
      success: false,
      escalated: true,
      level,
      reason,
      iterationId
    };
  }

  /**
   * Complete the iteration
   */
  _completeIteration(iterationId, success) {
    const iteration = this.iterations.get(iterationId);

    iteration.phase = IterationPhase.COMPLETE;
    iteration.status = success ? IterationStatus.PASSED : IterationStatus.FAILED;
    iteration.endTime = Date.now();

    if (success) {
      this.stats.successfulIterations++;
    } else {
      this.stats.failedIterations++;
    }

    this.emit('iteration:completed', {
      iterationId,
      planId: iteration.planId,
      success,
      duration: iteration.endTime - iteration.startTime,
      retryCount: iteration.retryCount,
      fixAttempts: iteration.fixAttempts
    });

    return {
      success,
      iterationId,
      duration: iteration.endTime - iteration.startTime
    };
  }

  /**
   * Get iteration state
   */
  getIteration(iterationId) {
    return this.iterations.get(iterationId);
  }

  /**
   * Get active iterations for a plan
   */
  getActiveIterations(planId) {
    return Array.from(this.iterations.values())
      .filter(i => i.planId === planId && i.status === IterationStatus.RUNNING);
  }

  /**
   * Get iteration history for a plan
   */
  getIterationHistory(planId) {
    return Array.from(this.iterations.values())
      .filter(i => i.planId === planId)
      .sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get detailed report
   */
  getReport() {
    const successRate = this.stats.totalIterations > 0
      ? (this.stats.successfulIterations / this.stats.totalIterations * 100).toFixed(2)
      : 0;

    const escalationRate = this.stats.totalIterations > 0
      ? (this.stats.escalatedIterations / this.stats.totalIterations * 100).toFixed(2)
      : 0;

    return {
      summary: {
        total: this.stats.totalIterations,
        successful: this.stats.successfulIterations,
        failed: this.stats.failedIterations,
        escalated: this.stats.escalatedIterations,
        successRate: `${successRate}%`,
        escalationRate: `${escalationRate}%`
      },
      retries: {
        total: this.stats.totalRetries,
        averagePerIteration: this.stats.totalIterations > 0
          ? (this.stats.totalRetries / this.stats.totalIterations).toFixed(2)
          : 0
      },
      fixes: {
        total: this.stats.totalFixAttempts,
        averagePerIteration: this.stats.totalIterations > 0
          ? (this.stats.totalFixAttempts / this.stats.totalIterations).toFixed(2)
          : 0
      },
      activeIterations: Array.from(this.iterations.values())
        .filter(i => i.status === IterationStatus.RUNNING).length
    };
  }

  /**
   * Cancel an iteration
   */
  cancelIteration(iterationId, reason = 'Cancelled by user') {
    const iteration = this.iterations.get(iterationId);
    if (!iteration) {
      return { success: false, error: 'Iteration not found' };
    }

    iteration.status = IterationStatus.FAILED;
    iteration.endTime = Date.now();
    iteration.errors.push({
      phase: iteration.phase,
      error: reason,
      timestamp: Date.now()
    });

    this.stats.failedIterations++;

    this.emit('iteration:cancelled', {
      iterationId,
      reason
    });

    return { success: true };
  }

  /**
   * Reset the manager
   */
  reset() {
    this.iterations.clear();
    this.stats = {
      totalIterations: 0,
      successfulIterations: 0,
      failedIterations: 0,
      escalatedIterations: 0,
      totalRetries: 0,
      totalFixAttempts: 0
    };
  }

  /**
   * Shutdown the iteration manager
   */
  async shutdown() {
    // Cancel all active iterations
    for (const [iterationId, iteration] of this.iterations) {
      if (iteration.status === IterationStatus.RUNNING) {
        this.cancelIteration(iterationId, 'Manager shutdown');
      }
    }

    this.removeAllListeners();
    return { success: true };
  }

  /**
   * Helper: Delay execution
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default IterationManager;
