/**
 * CircuitBreaker
 * --------------
 * Circuit breaker pattern implementation for protecting against cascading failures.
 * Supports configurable thresholds, timeouts, and automatic recovery.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { InfrastructureEvents } from '../event-bus/eventTypes.js';

const logger = createLogger('CircuitBreaker');

/**
 * Circuit states
 */
export const CircuitState = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Failing, reject requests
  HALF_OPEN: 'half_open' // Testing recovery
};

/**
 * CircuitBreaker class
 */
export class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 30000; // Time before trying again (ms)
    this.resetTimeout = options.resetTimeout || 60000; // Time before full reset

    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttempt = null;

    this.eventBus = null;

    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateChanges: []
    };

    // Half-open test slots
    this.halfOpenSlots = options.halfOpenSlots || 1;
    this.activeHalfOpenCalls = 0;
  }

  /**
   * Initialize the circuit breaker
   */
  async initialize() {
    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available');
    }

    logger.info(`CircuitBreaker "${this.name}" initialized`, {
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      timeout: this.timeout
    });
  }

  /**
   * Execute a function through the circuit breaker
   * @param {Function} fn - The function to execute
   * @param {*} fallback - Fallback value or function if circuit is open
   * @returns {Promise<*>} Result of the function or fallback
   */
  async execute(fn, fallback = null) {
    this.metrics.totalCalls++;

    // Check if circuit allows the call
    if (!this.canExecute()) {
      this.metrics.rejectedCalls++;
      logger.debug(`Circuit "${this.name}" rejected call - state: ${this.state}`);

      if (typeof fallback === 'function') {
        return fallback();
      }

      if (fallback !== null) {
        return fallback;
      }

      throw new CircuitBreakerError(`Circuit "${this.name}" is ${this.state}`, this.state);
    }

    // Track half-open calls
    if (this.state === CircuitState.HALF_OPEN) {
      this.activeHalfOpenCalls++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    } finally {
      if (this.state === CircuitState.HALF_OPEN) {
        this.activeHalfOpenCalls--;
      }
    }
  }

  /**
   * Check if circuit allows execution
   * @returns {boolean}
   */
  canExecute() {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has passed
        if (this.nextAttempt && now >= this.nextAttempt) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited calls in half-open state
        return this.activeHalfOpenCalls < this.halfOpenSlots;

      default:
        return false;
    }
  }

  /**
   * Record a successful call
   */
  recordSuccess() {
    this.metrics.successfulCalls++;
    this.lastSuccessTime = Date.now();
    this.successes++;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    logger.debug(`Circuit "${this.name}" success recorded`, {
      state: this.state,
      successes: this.successes
    });
  }

  /**
   * Record a failed call
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    this.metrics.failedCalls++;
    this.lastFailureTime = Date.now();
    this.failures++;
    this.successes = 0;

    logger.warn(`Circuit "${this.name}" failure recorded`, {
      state: this.state,
      failures: this.failures,
      error: error.message
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Transition to a new state
   * @param {string} newState - The new state
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    const stateChange = {
      from: oldState,
      to: newState,
      timestamp: Date.now()
    };

    this.metrics.stateChanges.push(stateChange);

    // Trim state change history
    if (this.metrics.stateChanges.length > 100) {
      this.metrics.stateChanges = this.metrics.stateChanges.slice(-50);
    }

    logger.info(`Circuit "${this.name}" state change: ${oldState} -> ${newState}`);

    // Reset counters based on new state
    switch (newState) {
      case CircuitState.OPEN:
        this.nextAttempt = Date.now() + this.timeout;
        this.successes = 0;
        this.publishStateChange(InfrastructureEvents.CIRCUIT_OPENED, oldState);
        break;

      case CircuitState.HALF_OPEN:
        this.successes = 0;
        this.failures = 0;
        this.publishStateChange(InfrastructureEvents.CIRCUIT_HALF_OPEN, oldState);
        break;

      case CircuitState.CLOSED:
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = null;
        this.publishStateChange(InfrastructureEvents.CIRCUIT_CLOSED, oldState);
        break;
    }

    this.emit('stateChange', stateChange);
  }

  /**
   * Publish state change event
   */
  publishStateChange(eventType, fromState) {
    if (this.eventBus) {
      this.eventBus.publish(eventType, {
        name: this.name,
        from: fromState,
        to: this.state,
        failures: this.failures,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Force the circuit to a specific state
   * @param {string} state - The state to force
   */
  forceState(state) {
    if (!Object.values(CircuitState).includes(state)) {
      throw new Error(`Invalid state: ${state}`);
    }

    logger.warn(`Circuit "${this.name}" forced to state: ${state}`);
    this.transitionTo(state);
  }

  /**
   * Reset the circuit breaker
   */
  reset() {
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttempt = null;
    this.state = CircuitState.CLOSED;

    logger.info(`Circuit "${this.name}" reset`);
  }

  /**
   * Get current status
   * @returns {object} Circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt,
      canExecute: this.canExecute()
    };
  }

  /**
   * Get metrics
   * @returns {object} Circuit breaker metrics
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      totalCalls: this.metrics.totalCalls,
      successfulCalls: this.metrics.successfulCalls,
      failedCalls: this.metrics.failedCalls,
      rejectedCalls: this.metrics.rejectedCalls,
      successRate: this.metrics.totalCalls > 0
        ? ((this.metrics.successfulCalls / this.metrics.totalCalls) * 100).toFixed(2)
        : 0,
      recentStateChanges: this.metrics.stateChanges.slice(-10)
    };
  }
}

/**
 * Custom error for circuit breaker rejections
 */
export class CircuitBreakerError extends Error {
  constructor(message, state) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
  }
}

/**
 * CircuitBreakerRegistry - Manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
    this.defaultOptions = {};
  }

  /**
   * Set default options for new circuit breakers
   * @param {object} options - Default options
   */
  setDefaults(options) {
    this.defaultOptions = { ...options };
  }

  /**
   * Get or create a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {object} options - Circuit breaker options
   * @returns {CircuitBreaker}
   */
  get(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        ...this.defaultOptions,
        ...options,
        name
      });
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name);
  }

  /**
   * Check if a circuit breaker exists
   * @param {string} name - Circuit breaker name
   * @returns {boolean}
   */
  has(name) {
    return this.breakers.has(name);
  }

  /**
   * Remove a circuit breaker
   * @param {string} name - Circuit breaker name
   */
  remove(name) {
    this.breakers.delete(name);
  }

  /**
   * Get all circuit breakers
   * @returns {Map<string, CircuitBreaker>}
   */
  getAll() {
    return this.breakers;
  }

  /**
   * Get status of all circuit breakers
   * @returns {object[]}
   */
  getAllStatus() {
    return Array.from(this.breakers.values()).map(b => b.getStatus());
  }

  /**
   * Get aggregated metrics
   * @returns {object}
   */
  getAggregatedMetrics() {
    const metrics = {
      totalBreakers: this.breakers.size,
      openBreakers: 0,
      halfOpenBreakers: 0,
      closedBreakers: 0,
      totalCalls: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalRejected: 0,
      breakers: {}
    };

    for (const [name, breaker] of this.breakers) {
      const breakerMetrics = breaker.getMetrics();
      metrics.breakers[name] = breakerMetrics;

      switch (breaker.state) {
        case CircuitState.OPEN:
          metrics.openBreakers++;
          break;
        case CircuitState.HALF_OPEN:
          metrics.halfOpenBreakers++;
          break;
        case CircuitState.CLOSED:
          metrics.closedBreakers++;
          break;
      }

      metrics.totalCalls += breakerMetrics.totalCalls;
      metrics.totalSuccessful += breakerMetrics.successfulCalls;
      metrics.totalFailed += breakerMetrics.failedCalls;
      metrics.totalRejected += breakerMetrics.rejectedCalls;
    }

    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Clear all circuit breakers
   */
  clear() {
    this.breakers.clear();
    logger.info('Circuit breaker registry cleared');
  }
}

// Singleton instances
let registryInstance = null;

/**
 * Get the circuit breaker registry singleton
 * @returns {CircuitBreakerRegistry}
 */
export function getCircuitBreakerRegistry() {
  if (!registryInstance) {
    registryInstance = new CircuitBreakerRegistry();
  }
  return registryInstance;
}

/**
 * Get or create a circuit breaker by name
 * @param {string} name - Circuit breaker name
 * @param {object} options - Circuit breaker options
 * @returns {CircuitBreaker}
 */
export function getCircuitBreaker(name, options = {}) {
  return getCircuitBreakerRegistry().get(name, options);
}

/**
 * Reset the registry singleton (for testing)
 */
export function resetCircuitBreakerRegistry() {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = null;
}

export default CircuitBreaker;
