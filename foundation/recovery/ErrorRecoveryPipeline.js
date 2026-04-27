/**
 * ErrorRecoveryPipeline
 * ---------------------
 * Multi-stage error recovery instead of single try/catch.
 * Inspired by Claude Code's staged recovery (compact → collapse → escalate → retry).
 *
 * Stages (attempted in order):
 * 1. RETRY_WITH_BACKOFF - Retry with exponential backoff (uses CircuitBreaker)
 * 2. ROLLBACK_CHECKPOINT - Roll back to last checkpoint, retry once
 * 3. SKIP_AND_CONTINUE - Skip this agent, continue orchestration
 * 4. ABORT_GROUP - Abort all agents in the same parallel group
 * 5. ABORT_EXECUTION - Full system abort
 *
 * Each agent can have a custom recovery strategy.
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

export const RecoveryEvents = {
  RECOVERY_STARTED: 'recovery:started',
  RECOVERY_STAGE_ENTERED: 'recovery:stage:entered',
  RECOVERY_STAGE_COMPLETED: 'recovery:stage:completed',
  RECOVERY_SUCCEEDED: 'recovery:succeeded',
  RECOVERY_FAILED: 'recovery:failed',
  RECOVERY_ESCALATED: 'recovery:escalated'
};

const logger = createLogger('ErrorRecoveryPipeline');

/**
 * Recovery stages, attempted in order
 */
export const RecoveryStage = {
  RETRY_WITH_BACKOFF: 'retry_with_backoff',
  ROLLBACK_CHECKPOINT: 'rollback_checkpoint',
  SKIP_AND_CONTINUE: 'skip_and_continue',
  ABORT_GROUP: 'abort_group',
  ABORT_EXECUTION: 'abort_execution'
};

/**
 * Default recovery strategy
 */
const DEFAULT_STRATEGY = {
  maxRetries: 2,
  backoffBase: 1000,   // 1 second
  backoffMax: 10000,    // 10 seconds
  stages: [
    RecoveryStage.RETRY_WITH_BACKOFF,
    RecoveryStage.ROLLBACK_CHECKPOINT,
    RecoveryStage.SKIP_AND_CONTINUE,
    RecoveryStage.ABORT_GROUP
  ],
  skipable: true        // Can this agent be skipped?
};

/**
 * Critical agent strategy - never skip, fewer retries, escalate fast
 */
export const CRITICAL_STRATEGY = {
  maxRetries: 1,
  backoffBase: 500,
  backoffMax: 5000,
  stages: [
    RecoveryStage.RETRY_WITH_BACKOFF,
    RecoveryStage.ROLLBACK_CHECKPOINT,
    RecoveryStage.ABORT_GROUP,
    RecoveryStage.ABORT_EXECUTION
  ],
  skipable: false
};

class ErrorRecoveryPipeline {
  constructor() {
    this.eventBus = null;
    this.agentStrategies = new Map();  // Map<agentName, RecoveryStrategy>
    this.defaultStrategy = { ...DEFAULT_STRATEGY };

    // External dependencies (set via setters)
    this.circuitBreakerRegistry = null;
    this.rollbackManager = null;
    this.streamingExecutor = null;
    this.decisionLogger = null;

    // Metrics
    this.metrics = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      stageAttempts: {},
      stageSuccesses: {}
    };

    // Initialize stage counters
    for (const stage of Object.values(RecoveryStage)) {
      this.metrics.stageAttempts[stage] = 0;
      this.metrics.stageSuccesses[stage] = 0;
    }
  }

  /**
   * Initialize with optional dependencies
   */
  initialize(deps = {}) {
    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available');
    }

    if (deps.circuitBreakerRegistry) this.circuitBreakerRegistry = deps.circuitBreakerRegistry;
    if (deps.rollbackManager) this.rollbackManager = deps.rollbackManager;
    if (deps.streamingExecutor) this.streamingExecutor = deps.streamingExecutor;
    if (deps.decisionLogger) this.decisionLogger = deps.decisionLogger;

    logger.info('ErrorRecoveryPipeline initialized');
  }

  /**
   * Set recovery strategy for a specific agent
   * @param {string} agentName
   * @param {object} strategy - Partial strategy, merged with defaults
   */
  setStrategy(agentName, strategy) {
    this.agentStrategies.set(agentName, {
      ...this.defaultStrategy,
      ...strategy
    });
    logger.info(`Recovery strategy set for ${agentName}`);
  }

  /**
   * Get the recovery strategy for an agent
   * @param {string} agentName
   * @returns {object}
   */
  getStrategy(agentName) {
    return this.agentStrategies.get(agentName) || this.defaultStrategy;
  }

  /**
   * Set the default strategy for agents without a custom one
   * @param {object} strategy
   */
  setDefaultStrategy(strategy) {
    this.defaultStrategy = { ...DEFAULT_STRATEGY, ...strategy };
  }

  /**
   * Main recovery method - walks through stages until one succeeds
   * @param {string} agentName - The agent that failed
   * @param {Error} error - The error that occurred
   * @param {object} context - { groupId, checkpointId, retryFn, signal }
   * @returns {Promise<RecoveryResult>}
   */
  async recover(agentName, error, context = {}) {
    this.metrics.totalRecoveries++;
    const strategy = this.getStrategy(agentName);
    const startTime = Date.now();

    if (this.eventBus) {
      this.eventBus.publish(RecoveryEvents.RECOVERY_STARTED, {
        agentName, error: error.message, strategy: strategy.stages, timestamp: startTime
      });
    }

    this._logDecision(agentName, 'recovery_started', `Starting recovery for ${agentName}: ${error.message}`);
    logger.info(`Recovery started for ${agentName}: ${error.message}`);

    // Walk through stages in order
    for (let i = 0; i < strategy.stages.length; i++) {
      const stage = strategy.stages[i];

      if (this.eventBus) {
        this.eventBus.publish(RecoveryEvents.RECOVERY_STAGE_ENTERED, {
          agentName, stage, stageIndex: i, totalStages: strategy.stages.length
        });
      }

      logger.info(`Recovery stage ${i + 1}/${strategy.stages.length}: ${stage} for ${agentName}`);

      try {
        const stageResult = await this._executeStage(stage, agentName, error, context, strategy);

        if (this.eventBus) {
          this.eventBus.publish(RecoveryEvents.RECOVERY_STAGE_COMPLETED, {
            agentName, stage, success: stageResult.success, details: stageResult.details
          });
        }

        if (stageResult.success) {
          this.metrics.successfulRecoveries++;
          const duration = Date.now() - startTime;

          this._logDecision(agentName, 'recovery_succeeded',
            `Recovery succeeded at stage ${stage} after ${duration}ms`);

          if (this.eventBus) {
            this.eventBus.publish(RecoveryEvents.RECOVERY_SUCCEEDED, {
              agentName, stage, duration, stageIndex: i
            });
          }

          logger.info(`Recovery succeeded for ${agentName} at stage: ${stage} (${duration}ms)`);

          return {
            recovered: true,
            stage,
            action: stageResult.action || 'retried',
            details: stageResult.details || {},
            duration
          };
        }

        // Stage failed, escalate
        if (i < strategy.stages.length - 1) {
          if (this.eventBus) {
            this.eventBus.publish(RecoveryEvents.RECOVERY_ESCALATED, {
              agentName, fromStage: stage, toStage: strategy.stages[i + 1],
              reason: stageResult.reason
            });
          }
          logger.info(`Escalating from ${stage} to ${strategy.stages[i + 1]} for ${agentName}`);
        }

      } catch (stageError) {
        logger.error(`Recovery stage ${stage} threw for ${agentName}:`, stageError);
        // Continue to next stage
      }
    }

    // All stages exhausted
    this.metrics.failedRecoveries++;
    const duration = Date.now() - startTime;

    this._logDecision(agentName, 'recovery_failed',
      `All recovery stages exhausted for ${agentName} after ${duration}ms`);

    if (this.eventBus) {
      this.eventBus.publish(RecoveryEvents.RECOVERY_FAILED, {
        agentName, error: error.message, stagesAttempted: strategy.stages.length, duration
      });
    }

    logger.error(`Recovery failed for ${agentName}: all ${strategy.stages.length} stages exhausted`);

    return {
      recovered: false,
      stage: null,
      action: 'exhausted',
      details: { error: error.message, stagesAttempted: strategy.stages },
      duration
    };
  }

  /**
   * Execute a single recovery stage
   * @returns {Promise<{ success, action?, reason?, details? }>}
   */
  async _executeStage(stage, agentName, error, context, strategy) {
    this.metrics.stageAttempts[stage]++;

    switch (stage) {
      case RecoveryStage.RETRY_WITH_BACKOFF:
        return this._stageRetryWithBackoff(agentName, error, context, strategy);

      case RecoveryStage.ROLLBACK_CHECKPOINT:
        return this._stageRollbackCheckpoint(agentName, error, context);

      case RecoveryStage.SKIP_AND_CONTINUE:
        return this._stageSkipAndContinue(agentName, error, context, strategy);

      case RecoveryStage.ABORT_GROUP:
        return this._stageAbortGroup(agentName, error, context);

      case RecoveryStage.ABORT_EXECUTION:
        return this._stageAbortExecution(agentName, error, context);

      default:
        return { success: false, reason: `Unknown stage: ${stage}` };
    }
  }

  /**
   * Stage 1: Retry with exponential backoff
   */
  async _stageRetryWithBackoff(agentName, error, context, strategy) {
    if (!context.retryFn) {
      return { success: false, reason: 'No retry function provided' };
    }

    // Check circuit breaker if available
    if (this.circuitBreakerRegistry) {
      const breaker = this.circuitBreakerRegistry.get(agentName);
      if (breaker && !breaker.canExecute()) {
        return { success: false, reason: `CircuitBreaker open for ${agentName}` };
      }
    }

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      const delay = Math.min(
        strategy.backoffBase * Math.pow(2, attempt),
        strategy.backoffMax
      );

      logger.info(`Retry ${attempt + 1}/${strategy.maxRetries} for ${agentName} after ${delay}ms`);
      await this._sleep(delay);

      // Check if aborted during sleep
      if (context.signal?.aborted) {
        return { success: false, reason: 'Aborted during retry backoff' };
      }

      try {
        await context.retryFn();
        this.metrics.stageSuccesses[RecoveryStage.RETRY_WITH_BACKOFF]++;
        return {
          success: true,
          action: 'retried',
          details: { attempt: attempt + 1, delay }
        };
      } catch (retryError) {
        logger.warn(`Retry ${attempt + 1} failed for ${agentName}: ${retryError.message}`);

        // Record failure in circuit breaker
        if (this.circuitBreakerRegistry) {
          const breaker = this.circuitBreakerRegistry.get(agentName);
          if (breaker) {
            breaker.recordFailure(retryError);
            if (!breaker.canExecute()) {
              return { success: false, reason: 'CircuitBreaker opened during retries' };
            }
          }
        }
      }
    }

    return { success: false, reason: `All ${strategy.maxRetries} retries exhausted` };
  }

  /**
   * Stage 2: Rollback to checkpoint and retry once
   */
  async _stageRollbackCheckpoint(agentName, error, context) {
    if (!this.rollbackManager || !context.checkpointId) {
      return { success: false, reason: 'No rollback manager or checkpoint available' };
    }

    try {
      const checkpoint = this.rollbackManager.getCheckpoint(context.checkpointId);
      if (!checkpoint || checkpoint.status !== 'active') {
        return { success: false, reason: 'Checkpoint not active' };
      }

      await this.rollbackManager.rollback(context.checkpointId, `Recovery for ${agentName}: ${error.message}`);
      logger.info(`Rolled back to checkpoint: ${context.checkpointId}`);

      // Retry once after rollback
      if (context.retryFn) {
        try {
          await context.retryFn();
          this.metrics.stageSuccesses[RecoveryStage.ROLLBACK_CHECKPOINT]++;
          return {
            success: true,
            action: 'rolled_back_and_retried',
            details: { checkpointId: context.checkpointId }
          };
        } catch (retryError) {
          return { success: false, reason: `Retry after rollback failed: ${retryError.message}` };
        }
      }

      // Rollback without retry = success (state restored)
      this.metrics.stageSuccesses[RecoveryStage.ROLLBACK_CHECKPOINT]++;
      return {
        success: true,
        action: 'rolled_back',
        details: { checkpointId: context.checkpointId }
      };

    } catch (rollbackError) {
      return { success: false, reason: `Rollback failed: ${rollbackError.message}` };
    }
  }

  /**
   * Stage 3: Skip the agent and continue orchestration
   */
  async _stageSkipAndContinue(agentName, error, context, strategy) {
    if (!strategy.skipable) {
      return { success: false, reason: `Agent ${agentName} is not skipable` };
    }

    this.metrics.stageSuccesses[RecoveryStage.SKIP_AND_CONTINUE]++;

    logger.warn(`Skipping agent ${agentName}: ${error.message}`);

    return {
      success: true,
      action: 'skipped',
      details: {
        agentName,
        error: error.message,
        note: 'Downstream agents may receive null input'
      }
    };
  }

  /**
   * Stage 4: Abort the entire parallel group
   */
  async _stageAbortGroup(agentName, error, context) {
    if (!this.streamingExecutor || !context.groupId) {
      return { success: false, reason: 'No streaming executor or groupId available' };
    }

    this.streamingExecutor.abortGroup(context.groupId, `Recovery escalation from ${agentName}`, {
      cascade: true,
      sourceAgent: agentName
    });

    this.metrics.stageSuccesses[RecoveryStage.ABORT_GROUP]++;

    return {
      success: true,
      action: 'group_aborted',
      details: { groupId: context.groupId, sourceAgent: agentName }
    };
  }

  /**
   * Stage 5: Abort the entire execution
   */
  async _stageAbortExecution(agentName, error, context) {
    if (!this.streamingExecutor) {
      return { success: false, reason: 'No streaming executor available' };
    }

    this.streamingExecutor.abortSystem(`Fatal: ${agentName} - ${error.message}`);
    this.metrics.stageSuccesses[RecoveryStage.ABORT_EXECUTION]++;

    return {
      success: true,
      action: 'execution_aborted',
      details: { agentName, error: error.message }
    };
  }

  /**
   * Log a recovery decision via DecisionLogger
   */
  _logDecision(agentName, type, reasoning) {
    if (!this.decisionLogger) return;

    try {
      this.decisionLogger.logDecision({
        agent: agentName,
        type: 'error_recovery',
        decision: type,
        reasoning,
        timestamp: Date.now()
      });
    } catch (e) {
      // Non-critical, don't let logging fail recovery
    }
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.agentStrategies.clear();
    this.defaultStrategy = { ...DEFAULT_STRATEGY };
    this.circuitBreakerRegistry = null;
    this.rollbackManager = null;
    this.streamingExecutor = null;
    this.decisionLogger = null;

    this.metrics = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      stageAttempts: {},
      stageSuccesses: {}
    };

    for (const stage of Object.values(RecoveryStage)) {
      this.metrics.stageAttempts[stage] = 0;
      this.metrics.stageSuccesses[stage] = 0;
    }
  }
}

// Singleton
let instance = null;

export function getErrorRecoveryPipeline() {
  if (!instance) {
    instance = new ErrorRecoveryPipeline();
  }
  return instance;
}

export function resetErrorRecoveryPipeline() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default ErrorRecoveryPipeline;
