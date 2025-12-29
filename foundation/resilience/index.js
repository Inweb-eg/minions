/**
 * Resilience Module
 * -----------------
 * Exports for resilience patterns: rate limiting and circuit breakers.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

export {
  RateLimiter,
  getRateLimiter,
  resetRateLimiter
} from './RateLimiter.js';

export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  CircuitState,
  getCircuitBreaker,
  getCircuitBreakerRegistry,
  resetCircuitBreakerRegistry
} from './CircuitBreaker.js';
