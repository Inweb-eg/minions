/**
 * CircuitBreaker Tests
 * ====================
 * Tests for the circuit breaker resilience pattern.
 */

import { jest } from '@jest/globals';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  getCircuitBreakerRegistry,
  getCircuitBreaker,
  resetCircuitBreakerRegistry
} from '../resilience/CircuitBreaker.js';

describe('CircuitBreaker', () => {
  let breaker;

  beforeEach(() => {
    resetCircuitBreakerRegistry();
    breaker = new CircuitBreaker({
      name: 'test-circuit',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100
    });
  });

  afterEach(() => {
    resetCircuitBreakerRegistry();
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultBreaker = new CircuitBreaker();

      expect(defaultBreaker.name).toBe('default');
      expect(defaultBreaker.failureThreshold).toBe(5);
      expect(defaultBreaker.successThreshold).toBe(3);
      expect(defaultBreaker.state).toBe(CircuitState.CLOSED);
    });

    test('creates with custom configuration', () => {
      expect(breaker.name).toBe('test-circuit');
      expect(breaker.failureThreshold).toBe(3);
      expect(breaker.successThreshold).toBe(2);
    });

    test('starts in closed state', () => {
      expect(breaker.state).toBe(CircuitState.CLOSED);
      expect(breaker.canExecute()).toBe(true);
    });

    test('initialize sets up event bus', async () => {
      await breaker.initialize();
      // Should not throw
    });
  });

  describe('Execution', () => {
    test('executes function in closed state', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const result = await breaker.execute(fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });

    test('tracks successful calls', async () => {
      await breaker.execute(() => 'success');

      expect(breaker.metrics.successfulCalls).toBe(1);
      expect(breaker.metrics.totalCalls).toBe(1);
    });

    test('tracks failed calls', async () => {
      const fn = () => { throw new Error('failure'); };

      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      expect(breaker.metrics.failedCalls).toBe(1);
    });
  });

  describe('Circuit Opening', () => {
    test('opens after failure threshold', async () => {
      const fn = () => { throw new Error('failure'); };

      // Fail up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      expect(breaker.state).toBe(CircuitState.OPEN);
    });

    test('rejects calls when open', async () => {
      breaker.forceState(CircuitState.OPEN);

      await expect(breaker.execute(() => 'test'))
        .rejects.toThrow(CircuitBreakerError);
    });

    test('tracks rejected calls', async () => {
      breaker.forceState(CircuitState.OPEN);

      await expect(breaker.execute(() => 'test')).rejects.toThrow();

      expect(breaker.metrics.rejectedCalls).toBe(1);
    });

    test('uses fallback value when open', async () => {
      breaker.forceState(CircuitState.OPEN);

      const result = await breaker.execute(() => 'test', 'fallback');

      expect(result).toBe('fallback');
    });

    test('uses fallback function when open', async () => {
      breaker.forceState(CircuitState.OPEN);

      const result = await breaker.execute(() => 'test', () => 'fallback-fn');

      expect(result).toBe('fallback-fn');
    });
  });

  describe('Half-Open State', () => {
    test('transitions to half-open after timeout', async () => {
      breaker.forceState(CircuitState.OPEN);
      breaker.nextAttempt = Date.now() - 1; // Past timeout

      expect(breaker.canExecute()).toBe(true);
      expect(breaker.state).toBe(CircuitState.HALF_OPEN);
    });

    test('limits concurrent calls in half-open', async () => {
      breaker.forceState(CircuitState.HALF_OPEN);
      breaker.halfOpenSlots = 1;
      breaker.activeHalfOpenCalls = 1;

      expect(breaker.canExecute()).toBe(false);
    });

    test('closes after success threshold in half-open', async () => {
      breaker.forceState(CircuitState.HALF_OPEN);

      // Meet success threshold
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => 'success');
      }

      expect(breaker.state).toBe(CircuitState.CLOSED);
    });

    test('opens immediately on failure in half-open', async () => {
      breaker.forceState(CircuitState.HALF_OPEN);

      await expect(breaker.execute(() => { throw new Error('fail'); }))
        .rejects.toThrow();

      expect(breaker.state).toBe(CircuitState.OPEN);
    });
  });

  describe('State Transitions', () => {
    test('emits stateChange event', async () => {
      const handler = jest.fn();
      breaker.on('stateChange', handler);

      breaker.forceState(CircuitState.OPEN);

      expect(handler).toHaveBeenCalledWith({
        from: CircuitState.CLOSED,
        to: CircuitState.OPEN,
        timestamp: expect.any(Number)
      });
    });

    test('tracks state changes in metrics', () => {
      breaker.forceState(CircuitState.OPEN);
      breaker.forceState(CircuitState.HALF_OPEN);
      breaker.forceState(CircuitState.CLOSED);

      expect(breaker.metrics.stateChanges.length).toBe(3);
    });

    test('trims state change history', () => {
      for (let i = 0; i < 150; i++) {
        breaker.transitionTo(i % 2 === 0 ? CircuitState.OPEN : CircuitState.CLOSED);
      }

      expect(breaker.metrics.stateChanges.length).toBeLessThanOrEqual(100);
    });

    test('forceState validates state', () => {
      expect(() => breaker.forceState('invalid'))
        .toThrow('Invalid state');
    });
  });

  describe('Reset', () => {
    test('reset returns to initial state', async () => {
      breaker.forceState(CircuitState.OPEN);
      breaker.failures = 5;
      breaker.successes = 2;

      breaker.reset();

      expect(breaker.state).toBe(CircuitState.CLOSED);
      expect(breaker.failures).toBe(0);
      expect(breaker.successes).toBe(0);
    });
  });

  describe('Status & Metrics', () => {
    test('getStatus returns current state', async () => {
      await breaker.execute(() => 'test');

      const status = breaker.getStatus();

      expect(status.name).toBe('test-circuit');
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.canExecute).toBe(true);
    });

    test('getMetrics returns call statistics', async () => {
      await breaker.execute(() => 'test');
      await expect(breaker.execute(() => { throw new Error(); })).rejects.toThrow();

      const metrics = breaker.getMetrics();

      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.successRate).toBe('50.00');
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry;

  beforeEach(() => {
    resetCircuitBreakerRegistry();
    registry = new CircuitBreakerRegistry();
  });

  afterEach(() => {
    resetCircuitBreakerRegistry();
  });

  test('creates and stores circuit breakers', () => {
    const breaker = registry.get('test');

    expect(breaker).toBeInstanceOf(CircuitBreaker);
    expect(breaker.name).toBe('test');
  });

  test('returns same instance on subsequent calls', () => {
    const breaker1 = registry.get('test');
    const breaker2 = registry.get('test');

    expect(breaker1).toBe(breaker2);
  });

  test('applies default options', () => {
    registry.setDefaults({ failureThreshold: 10 });

    const breaker = registry.get('test');

    expect(breaker.failureThreshold).toBe(10);
  });

  test('has checks for existence', () => {
    expect(registry.has('test')).toBe(false);

    registry.get('test');

    expect(registry.has('test')).toBe(true);
  });

  test('remove deletes circuit breaker', () => {
    registry.get('test');
    registry.remove('test');

    expect(registry.has('test')).toBe(false);
  });

  test('getAll returns all breakers', () => {
    registry.get('test1');
    registry.get('test2');

    const all = registry.getAll();

    expect(all.size).toBe(2);
  });

  test('getAllStatus returns status array', () => {
    registry.get('test1');
    registry.get('test2');

    const statuses = registry.getAllStatus();

    expect(statuses.length).toBe(2);
    expect(statuses[0]).toHaveProperty('name');
    expect(statuses[0]).toHaveProperty('state');
  });

  test('getAggregatedMetrics summarizes all breakers', async () => {
    const b1 = registry.get('test1');
    const b2 = registry.get('test2');

    await b1.execute(() => 'test');
    await b2.execute(() => 'test');

    const metrics = registry.getAggregatedMetrics();

    expect(metrics.totalBreakers).toBe(2);
    expect(metrics.totalCalls).toBe(2);
    expect(metrics.totalSuccessful).toBe(2);
  });

  test('resetAll resets all breakers', async () => {
    const b1 = registry.get('test1');
    const b2 = registry.get('test2');

    b1.forceState(CircuitState.OPEN);
    b2.forceState(CircuitState.OPEN);

    registry.resetAll();

    expect(b1.state).toBe(CircuitState.CLOSED);
    expect(b2.state).toBe(CircuitState.CLOSED);
  });

  test('clear removes all breakers', () => {
    registry.get('test1');
    registry.get('test2');

    registry.clear();

    expect(registry.getAll().size).toBe(0);
  });
});

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetCircuitBreakerRegistry();
  });

  afterEach(() => {
    resetCircuitBreakerRegistry();
  });

  test('getCircuitBreakerRegistry returns singleton', () => {
    const r1 = getCircuitBreakerRegistry();
    const r2 = getCircuitBreakerRegistry();

    expect(r1).toBe(r2);
  });

  test('getCircuitBreaker creates via registry', () => {
    const breaker = getCircuitBreaker('test', { failureThreshold: 10 });

    expect(breaker.name).toBe('test');
    expect(breaker.failureThreshold).toBe(10);
  });

  test('resetCircuitBreakerRegistry clears everything', () => {
    getCircuitBreaker('test');
    resetCircuitBreakerRegistry();

    const registry = getCircuitBreakerRegistry();
    expect(registry.getAll().size).toBe(0);
  });
});

describe('CircuitBreakerError', () => {
  test('has correct properties', () => {
    const error = new CircuitBreakerError('Circuit is open', CircuitState.OPEN);

    expect(error.message).toBe('Circuit is open');
    expect(error.name).toBe('CircuitBreakerError');
    expect(error.state).toBe(CircuitState.OPEN);
  });
});

describe('CircuitState', () => {
  test('has all states', () => {
    expect(CircuitState.CLOSED).toBe('closed');
    expect(CircuitState.OPEN).toBe('open');
    expect(CircuitState.HALF_OPEN).toBe('half_open');
  });
});
