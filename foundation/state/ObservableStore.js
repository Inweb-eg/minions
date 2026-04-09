/**
 * ObservableStore
 * ---------------
 * Minimal reactive state store inspired by Claude Code's 35-line pattern.
 * Single source of truth with subscriber notifications and onChange hook.
 *
 * Core API: getState(), setState(updater), subscribe(listener)
 * Bailout: Object.is() prevents spurious notifications.
 * Side effects: Single onChange callback fires before listeners.
 */

import { createLogger } from '../common/logger.js';

const logger = createLogger('ObservableStore');

/**
 * Create a reactive store with minimal API
 * @param {*} initialState - The initial state
 * @param {Function} onChange - Optional callback({ newState, oldState }) for side effects
 * @returns {{ getState, setState, subscribe }}
 */
export function createStore(initialState, onChange) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,

    setState: (updater) => {
      const prev = state;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Object.is(next, prev)) return; // Bailout: no change
      state = next;
      if (onChange) onChange({ newState: next, oldState: prev });
      for (const listener of listeners) {
        try {
          listener(next, prev);
        } catch (e) {
          logger.error('Store listener error:', e);
        }
      }
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener); // Unsubscribe
    }
  };
}

/**
 * Create a selector that derives computed state from a store
 * @param {object} store - A store created by createStore
 * @param {Function} selectorFn - (state) => derivedValue
 * @returns {Function} () => derivedValue
 */
export function createSelector(store, selectorFn) {
  return () => selectorFn(store.getState());
}

/**
 * MinionsAppState - The application-wide state shape
 * Used by Orchestrator, BrainController, Gru, etc.
 */
export function createDefaultAppState() {
  return {
    // System
    mode: 'idle',              // idle | executing | paused | error
    startTime: null,

    // Orchestrator
    isExecuting: false,
    currentlyRunning: [],
    executionResults: {},
    registeredAgents: [],

    // Agent progress (from StreamingExecutor)
    agentProgress: {},         // { agentName: { status, percent, message } }

    // Permission mode
    permissionMode: 'autonomous',

    // Connected projects (Silas)
    projects: {},

    // Configuration
    config: {},

    // Metrics summary
    metrics: {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: 0
    }
  };
}

// Singleton app store
let appStore = null;

/**
 * Get or create the global app store
 * @param {Function} onChange - Optional onChange handler
 * @returns {object} The store { getState, setState, subscribe }
 */
export function getAppStore(onChange) {
  if (!appStore) {
    appStore = createStore(createDefaultAppState(), onChange || defaultOnChange);
  }
  return appStore;
}

/**
 * Default onChange handler - publishes state changes to EventBus
 */
function defaultOnChange({ newState, oldState }) {
  // Lazy import to avoid circular dependency
  try {
    if (newState.isExecuting !== oldState.isExecuting) {
      logger.info(`Execution state: ${oldState.isExecuting} → ${newState.isExecuting}`);
    }
    if (newState.permissionMode !== oldState.permissionMode) {
      logger.info(`Permission mode: ${oldState.permissionMode} → ${newState.permissionMode}`);
    }
  } catch (e) {
    // Non-critical
  }
}

/**
 * Reset (for testing)
 */
export function resetAppStore() {
  appStore = null;
}

export default createStore;
