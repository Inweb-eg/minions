/**
 * SkillABTester - A/B testing framework for skills
 *
 * Part of the Minions Self-Learning System (Phase 3)
 *
 * Features:
 * - Create skill variants (control vs treatment)
 * - Statistical significance testing (z-test for proportions)
 * - Automatic winner selection based on confidence level
 * - Integration with ReinforcementLearner for smart variant selection
 * - Test lifecycle management (start, record, complete, cancel)
 * - Publishes events to EventBus
 *
 * Pattern Compliance:
 * - Singleton pattern with getSkillABTester()
 * - Uses EventBus for pub/sub
 * - Uses KnowledgeBrain for persistence
 * - Integrates with ReinforcementLearner
 *
 * @module foundation/learning/SkillABTester
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain } from '../knowledge-brain/KnowledgeBrain.js';
import { getReinforcementLearner } from './ReinforcementLearner.js';

const logger = createLogger('SkillABTester');

/**
 * Test status constants
 */
export const TEST_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

/**
 * Variant types
 */
export const VARIANT = {
  CONTROL: 'control',
  TREATMENT: 'treatment'
};

/**
 * SkillABTester - A/B testing framework for comparing skill variants
 */
class SkillABTester {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.reinforcementLearner = null;
    this.initialized = false;

    // Configuration
    this.config = {
      minSampleSize: options.minSampleSize || 30,
      confidenceLevel: options.confidenceLevel || 0.95,
      maxTestDuration: options.maxTestDuration || 86400000, // 24 hours
      useRLAfterSamples: options.useRLAfterSamples || 10, // Use RL after this many samples
      enableAutoCompletion: options.enableAutoCompletion ?? true,
      ...options
    };

    // Active tests: Map<testId, Test>
    this.activeTests = new Map();

    // Test history
    this.testHistory = [];

    // Timer references for cleanup
    this.testTimers = new Map();

    // Internal event listeners
    this._eventListeners = new Map();

    // Statistics
    this.stats = {
      testsStarted: 0,
      testsCompleted: 0,
      testsCancelled: 0,
      testsExpired: 0,
      totalSamples: 0,
      controlWins: 0,
      treatmentWins: 0
    };
  }

  /**
   * Initialize the A/B tester
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.knowledgeBrain = getKnowledgeBrain();
      this.reinforcementLearner = getReinforcementLearner();

      await this.knowledgeBrain.initialize();
      await this.reinforcementLearner.initialize();

      this.initialized = true;
      this.logger.info('SkillABTester initialized', {
        minSampleSize: this.config.minSampleSize,
        confidenceLevel: this.config.confidenceLevel
      });

    } catch (error) {
      this.logger.error('Failed to initialize SkillABTester:', error);
      throw error;
    }
  }

  /**
   * Ensure the tester is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Listener function
   */
  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(listener);
  }

  /**
   * Emit an event to internal listeners
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Start an A/B test
   * @param {Object} controlSkill - Control (existing/baseline) skill
   * @param {Object} treatmentSkill - Treatment (new/variant) skill
   * @param {Object} options - Test options
   * @param {number} [options.trafficSplit=0.5] - Portion of traffic to treatment (0-1)
   * @param {number} [options.minSampleSize] - Minimum samples per variant
   * @param {number} [options.confidenceLevel] - Required confidence level (0-1)
   * @param {string} [options.hypothesis] - Test hypothesis description
   * @returns {string} Test ID
   */
  async startTest(controlSkill, treatmentSkill, options = {}) {
    await this.ensureInitialized();

    const testId = this._generateTestId();

    const test = {
      id: testId,
      controlSkill,
      treatmentSkill,
      status: TEST_STATUS.RUNNING,
      startTime: Date.now(),
      endTime: null,
      hypothesis: options.hypothesis || `Compare ${controlSkill.name || 'control'} vs ${treatmentSkill.name || 'treatment'}`,
      config: {
        trafficSplit: options.trafficSplit ?? 0.5,
        minSampleSize: options.minSampleSize || this.config.minSampleSize,
        confidenceLevel: options.confidenceLevel || this.config.confidenceLevel
      },
      results: {
        control: {
          activations: 0,
          successes: 0,
          failures: 0,
          totalDuration: 0,
          durations: []
        },
        treatment: {
          activations: 0,
          successes: 0,
          failures: 0,
          totalDuration: 0,
          durations: []
        }
      },
      winner: null,
      significance: null,
      effectSize: null
    };

    this.activeTests.set(testId, test);
    this.stats.testsStarted++;

    // Schedule auto-expiration
    if (this.config.enableAutoCompletion) {
      const timerId = setTimeout(
        () => this._handleTestExpiration(testId),
        this.config.maxTestDuration
      );
      this.testTimers.set(testId, timerId);
    }

    // Publish event
    this.eventBus?.publish(LearningEvents.ABTEST_STARTED, {
      testId,
      controlSkill: controlSkill.name || controlSkill.id,
      treatmentSkill: treatmentSkill.name || treatmentSkill.id,
      trafficSplit: test.config.trafficSplit,
      hypothesis: test.hypothesis
    });

    this.emit('test:started', { testId, test });

    this.logger.info('A/B test started', {
      testId,
      control: controlSkill.name || controlSkill.id,
      treatment: treatmentSkill.name || treatmentSkill.id,
      trafficSplit: test.config.trafficSplit
    });

    return testId;
  }

  /**
   * Select which variant to use for a request
   * @param {string} testId - Test ID
   * @returns {Object|null} Selected skill variant with metadata, or null if test not found
   */
  selectVariant(testId) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) {
      return null;
    }

    const totalActivations = test.results.control.activations + test.results.treatment.activations;
    let selectedVariant;
    let selectionMethod;

    // Use RL for smart selection if we have enough data
    if (totalActivations >= this.config.useRLAfterSamples && this.reinforcementLearner) {
      const { action, isExploration } = this.reinforcementLearner.selectAction(
        `abtest:${testId}`,
        [VARIANT.CONTROL, VARIANT.TREATMENT]
      );
      selectedVariant = action;
      selectionMethod = isExploration ? 'rl_exploration' : 'rl_exploitation';
    } else {
      // Random selection based on traffic split
      selectedVariant = Math.random() < test.config.trafficSplit
        ? VARIANT.TREATMENT
        : VARIANT.CONTROL;
      selectionMethod = 'random';
    }

    const skill = selectedVariant === VARIANT.CONTROL
      ? test.controlSkill
      : test.treatmentSkill;

    return {
      skill,
      variant: selectedVariant,
      testId,
      selectionMethod
    };
  }

  /**
   * Record a test result
   * @param {string} testId - Test ID
   * @param {string} variant - 'control' or 'treatment'
   * @param {boolean} success - Whether the execution was successful
   * @param {number} duration - Execution duration in ms
   * @param {Object} [metadata] - Additional metadata
   */
  async recordResult(testId, variant, success, duration, metadata = {}) {
    await this.ensureInitialized();

    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) {
      this.logger.warn(`Cannot record result for test ${testId}: test not running`);
      return;
    }

    // Validate variant
    if (variant !== VARIANT.CONTROL && variant !== VARIANT.TREATMENT) {
      this.logger.warn(`Invalid variant: ${variant}`);
      return;
    }

    const results = test.results[variant];
    results.activations++;
    results.totalDuration += duration;
    results.durations.push(duration);

    if (success) {
      results.successes++;
    } else {
      results.failures++;
    }

    this.stats.totalSamples++;

    // Update RL with this result
    if (this.reinforcementLearner) {
      const reward = this.reinforcementLearner.calculateReward({
        success,
        metrics: { duration }
      });

      await this.reinforcementLearner.update(
        `abtest:${testId}`,
        variant,
        reward,
        `abtest:${testId}:post`
      );
    }

    this.emit('result:recorded', {
      testId,
      variant,
      success,
      duration,
      metadata
    });

    // Check if we can determine a winner
    if (this.config.enableAutoCompletion) {
      await this._checkTestCompletion(testId);
    }
  }

  /**
   * Check if test can be completed (has statistically significant winner)
   * @param {string} testId - Test ID
   */
  async _checkTestCompletion(testId) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) return;

    const { control, treatment } = test.results;

    // Check minimum sample size for both variants
    if (control.activations < test.config.minSampleSize ||
        treatment.activations < test.config.minSampleSize) {
      return;
    }

    // Calculate success rates
    const controlRate = control.activations > 0
      ? control.successes / control.activations
      : 0;
    const treatmentRate = treatment.activations > 0
      ? treatment.successes / treatment.activations
      : 0;

    // Calculate statistical significance
    const significance = this._calculateSignificance(
      controlRate, control.activations,
      treatmentRate, treatment.activations
    );

    // Calculate effect size (Cohen's h for proportions)
    const effectSize = this._calculateEffectSize(controlRate, treatmentRate);

    // Check if we have statistical significance
    if (significance >= test.config.confidenceLevel) {
      await this._completeTest(testId, {
        controlRate,
        treatmentRate,
        significance,
        effectSize
      });
    }
  }

  /**
   * Complete a test with a winner
   */
  async _completeTest(testId, metrics) {
    const test = this.activeTests.get(testId);
    if (!test) return;

    const { controlRate, treatmentRate, significance, effectSize } = metrics;

    // Determine winner
    test.winner = treatmentRate > controlRate ? VARIANT.TREATMENT : VARIANT.CONTROL;
    test.status = TEST_STATUS.COMPLETED;
    test.endTime = Date.now();
    test.significance = significance;
    test.effectSize = effectSize;
    test.controlRate = controlRate;
    test.treatmentRate = treatmentRate;

    // Update stats
    this.stats.testsCompleted++;
    if (test.winner === VARIANT.CONTROL) {
      this.stats.controlWins++;
    } else {
      this.stats.treatmentWins++;
    }

    // Move to history
    this.testHistory.push({ ...test });
    this.activeTests.delete(testId);

    // Clear timer
    this._clearTestTimer(testId);

    // Store result in KnowledgeBrain
    await this._storeTestResult(test);

    // Publish event
    this.eventBus?.publish(LearningEvents.ABTEST_COMPLETED, {
      testId,
      winner: test.winner,
      controlRate,
      treatmentRate,
      significance,
      effectSize,
      totalSamples: test.results.control.activations + test.results.treatment.activations
    });

    // Publish winner event
    this.eventBus?.publish(LearningEvents.ABTEST_WINNER, {
      testId,
      winner: test.winner,
      winnerSkill: test.winner === VARIANT.CONTROL ? test.controlSkill : test.treatmentSkill,
      improvement: test.winner === VARIANT.TREATMENT
        ? ((treatmentRate - controlRate) / controlRate * 100).toFixed(1) + '%'
        : 'N/A (control won)'
    });

    this.emit('test:completed', { testId, test, winner: test.winner });

    this.logger.info('A/B test completed', {
      testId,
      winner: test.winner,
      controlRate: (controlRate * 100).toFixed(1) + '%',
      treatmentRate: (treatmentRate * 100).toFixed(1) + '%',
      significance: (significance * 100).toFixed(1) + '%',
      effectSize: effectSize.toFixed(3)
    });
  }

  /**
   * Handle test expiration (max duration reached)
   */
  async _handleTestExpiration(testId) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) return;

    const { control, treatment } = test.results;
    const controlRate = control.activations > 0 ? control.successes / control.activations : 0;
    const treatmentRate = treatment.activations > 0 ? treatment.successes / treatment.activations : 0;

    test.status = TEST_STATUS.EXPIRED;
    test.endTime = Date.now();
    test.controlRate = controlRate;
    test.treatmentRate = treatmentRate;

    // Calculate final significance even if not conclusive
    test.significance = this._calculateSignificance(
      controlRate, control.activations,
      treatmentRate, treatment.activations
    );

    this.stats.testsExpired++;

    // Move to history
    this.testHistory.push({ ...test });
    this.activeTests.delete(testId);
    this._clearTestTimer(testId);

    this.emit('test:expired', { testId, test });

    this.logger.warn('A/B test expired without conclusive result', {
      testId,
      controlSamples: control.activations,
      treatmentSamples: treatment.activations,
      significance: (test.significance * 100).toFixed(1) + '%'
    });
  }

  /**
   * Store test result in KnowledgeBrain
   */
  async _storeTestResult(test) {
    if (!this.knowledgeBrain) return;

    try {
      await this.knowledgeBrain.storeTestResult({
        testId: test.id,
        type: 'ab_test',
        controlSkillId: test.controlSkill.id || test.controlSkill.name,
        treatmentSkillId: test.treatmentSkill.id || test.treatmentSkill.name,
        winner: test.winner,
        results: test.results,
        significance: test.significance,
        effectSize: test.effectSize,
        duration: test.endTime - test.startTime,
        hypothesis: test.hypothesis
      });
    } catch (error) {
      this.logger.error('Failed to store test result:', error);
    }
  }

  /**
   * Calculate statistical significance using z-test for proportions
   * @param {number} p1 - Control success rate
   * @param {number} n1 - Control sample size
   * @param {number} p2 - Treatment success rate
   * @param {number} n2 - Treatment sample size
   * @returns {number} Confidence level (1 - p-value)
   */
  _calculateSignificance(p1, n1, p2, n2) {
    // Pooled proportion
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);

    // Standard error
    const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));

    // Handle edge case where se is 0
    if (se === 0) return 0;

    // Z-score
    const z = Math.abs(p1 - p2) / se;

    // Convert to p-value (two-tailed test)
    const pValue = 2 * (1 - this._normalCDF(z));

    // Return confidence level (1 - p-value)
    return 1 - pValue;
  }

  /**
   * Calculate effect size using Cohen's h for proportions
   * @param {number} p1 - Control proportion
   * @param {number} p2 - Treatment proportion
   * @returns {number} Cohen's h effect size
   */
  _calculateEffectSize(p1, p2) {
    // Cohen's h = 2 * arcsin(sqrt(p2)) - 2 * arcsin(sqrt(p1))
    const phi1 = 2 * Math.asin(Math.sqrt(p1));
    const phi2 = 2 * Math.asin(Math.sqrt(p2));
    return Math.abs(phi2 - phi1);
  }

  /**
   * Standard normal CDF approximation (Abramowitz and Stegun)
   * @param {number} x - Z-score
   * @returns {number} Cumulative probability
   */
  _normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Cancel an active test
   * @param {string} testId - Test ID
   * @param {string} [reason] - Cancellation reason
   * @returns {boolean} Whether the test was cancelled
   */
  cancelTest(testId, reason = 'Manual cancellation') {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) {
      return false;
    }

    test.status = TEST_STATUS.CANCELLED;
    test.endTime = Date.now();
    test.cancellationReason = reason;

    this.stats.testsCancelled++;

    // Move to history
    this.testHistory.push({ ...test });
    this.activeTests.delete(testId);
    this._clearTestTimer(testId);

    this.emit('test:cancelled', { testId, test, reason });

    this.logger.info('A/B test cancelled', { testId, reason });

    return true;
  }

  /**
   * Get a specific test by ID
   * @param {string} testId - Test ID
   * @returns {Object|null} Test object or null
   */
  getTest(testId) {
    return this.activeTests.get(testId) ||
           this.testHistory.find(t => t.id === testId) ||
           null;
  }

  /**
   * Get all active tests
   * @returns {Object[]} Array of active tests
   */
  getActiveTests() {
    return Array.from(this.activeTests.values());
  }

  /**
   * Get test history
   * @param {Object} [options] - Query options
   * @param {string} [options.status] - Filter by status
   * @param {number} [options.limit] - Maximum results
   * @returns {Object[]} Array of historical tests
   */
  getTestHistory(options = {}) {
    let history = [...this.testHistory];

    if (options.status) {
      history = history.filter(t => t.status === options.status);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      activeTestCount: this.activeTests.size,
      historyCount: this.testHistory.length,
      winRate: this.stats.testsCompleted > 0
        ? {
            control: (this.stats.controlWins / this.stats.testsCompleted * 100).toFixed(1) + '%',
            treatment: (this.stats.treatmentWins / this.stats.testsCompleted * 100).toFixed(1) + '%'
          }
        : { control: 'N/A', treatment: 'N/A' }
    };
  }

  /**
   * Get current results for a test (without completing it)
   * @param {string} testId - Test ID
   * @returns {Object|null} Current test results
   */
  getCurrentResults(testId) {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    const { control, treatment } = test.results;
    const controlRate = control.activations > 0 ? control.successes / control.activations : 0;
    const treatmentRate = treatment.activations > 0 ? treatment.successes / treatment.activations : 0;

    const significance = this._calculateSignificance(
      controlRate, control.activations,
      treatmentRate, treatment.activations
    );

    return {
      testId,
      status: test.status,
      control: {
        ...control,
        successRate: controlRate,
        avgDuration: control.activations > 0 ? control.totalDuration / control.activations : 0
      },
      treatment: {
        ...treatment,
        successRate: treatmentRate,
        avgDuration: treatment.activations > 0 ? treatment.totalDuration / treatment.activations : 0
      },
      currentSignificance: significance,
      isSignificant: significance >= test.config.confidenceLevel,
      samplesNeeded: Math.max(
        0,
        test.config.minSampleSize - control.activations,
        test.config.minSampleSize - treatment.activations
      )
    };
  }

  /**
   * Clear timer for a test
   */
  _clearTestTimer(testId) {
    const timerId = this.testTimers.get(testId);
    if (timerId) {
      clearTimeout(timerId);
      this.testTimers.delete(testId);
    }
  }

  /**
   * Generate unique test ID
   */
  _generateTestId() {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset the tester state (for testing)
   */
  reset() {
    // Clear all timers
    for (const timerId of this.testTimers.values()) {
      clearTimeout(timerId);
    }
    this.testTimers.clear();

    this.activeTests.clear();
    this.testHistory = [];
    this._eventListeners.clear();

    this.stats = {
      testsStarted: 0,
      testsCompleted: 0,
      testsCancelled: 0,
      testsExpired: 0,
      totalSamples: 0,
      controlWins: 0,
      treatmentWins: 0
    };
  }

  /**
   * Shutdown the tester
   */
  async shutdown() {
    // Clear all timers
    for (const timerId of this.testTimers.values()) {
      clearTimeout(timerId);
    }
    this.testTimers.clear();

    this.initialized = false;
    this.logger.info('SkillABTester shut down');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton SkillABTester instance
 * @param {Object} options - Configuration options
 * @returns {SkillABTester} The singleton instance
 */
export function getSkillABTester(options = {}) {
  if (!instance) {
    instance = new SkillABTester(options);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export function resetSkillABTester() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export { SkillABTester };
export default SkillABTester;
