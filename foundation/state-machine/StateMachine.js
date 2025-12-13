import { createLogger } from '../common/logger.js';
import { getMemoryStore, MemoryNamespace } from '../memory-store/MemoryStore.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

const logger = createLogger('StateMachine');

/**
 * Standard agent states
 */
export const AgentState = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  WAITING: 'waiting',
  BLOCKED: 'blocked',
  ERROR: 'error',
  COMPLETED: 'completed',
  RECOVERING: 'recovering'
};

/**
 * Transition result
 */
export const TransitionResult = {
  SUCCESS: 'success',
  DENIED: 'denied',
  GUARD_FAILED: 'guard_failed',
  INVALID_TRANSITION: 'invalid_transition'
};

/**
 * State Machine Framework for predictable agent behavior
 * Provides state management, transition guards, and persistence
 */
class StateMachine {
  /**
   * Create a new state machine
   * @param {object} config - State machine configuration
   * @param {string} config.name - Name of the state machine (usually agent name)
   * @param {string} config.initialState - Initial state
   * @param {object} config.states - State definitions
   * @param {object} config.transitions - Transition definitions
   * @param {boolean} config.persist - Whether to persist state
   */
  constructor(config) {
    this.name = config.name;
    this.currentState = config.initialState || AgentState.IDLE;
    this.previousState = null;
    this.states = config.states || {};
    this.transitions = config.transitions || {};
    this.persist = config.persist !== false;

    // Context data that persists across transitions
    this.context = config.context || {};

    // History of state transitions
    this.history = [];
    this.maxHistory = config.maxHistory || 100;

    // Event handlers
    this.onEnterHandlers = new Map();
    this.onExitHandlers = new Map();
    this.onTransitionHandlers = [];

    // Error state tracking
    this.lastError = null;
    this.errorCount = 0;

    // External integrations
    this.memoryStore = null;
    this.eventBus = null;
    this.initialized = false;

    // State metadata
    this.stateEnteredAt = Date.now();
    this.transitionCount = 0;
  }

  /**
   * Initialize the state machine
   */
  async initialize() {
    if (this.initialized) return;

    this.eventBus = getEventBus();

    if (this.persist) {
      this.memoryStore = getMemoryStore();
      await this.memoryStore.initialize();

      // Try to restore previous state
      await this.restoreState();
    }

    this.initialized = true;
    logger.info(`State machine ${this.name} initialized in state: ${this.currentState}`);
  }

  /**
   * Ensure the state machine is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState() {
    return this.currentState;
  }

  /**
   * Check if in a specific state
   * @param {string} state - State to check
   * @returns {boolean} True if in that state
   */
  isInState(state) {
    return this.currentState === state;
  }

  /**
   * Check if a transition is valid
   * @param {string} toState - Target state
   * @returns {boolean} True if transition is valid
   */
  canTransitionTo(toState) {
    // Check if transition is defined
    const allowedTransitions = this.transitions[this.currentState];
    if (!allowedTransitions) return false;

    if (Array.isArray(allowedTransitions)) {
      return allowedTransitions.includes(toState);
    }

    return allowedTransitions[toState] !== undefined;
  }

  /**
   * Transition to a new state
   * @param {string} toState - Target state
   * @param {object} options - Transition options
   * @param {object} options.context - Additional context data
   * @param {string} options.reason - Reason for transition
   * @param {boolean} options.force - Force transition even if guards fail
   * @returns {object} Transition result
   */
  async transition(toState, options = {}) {
    await this.ensureInitialized();

    const fromState = this.currentState;

    // Check if transition is valid
    if (!this.canTransitionTo(toState)) {
      logger.warn(`Invalid transition: ${fromState} -> ${toState}`);
      return {
        result: TransitionResult.INVALID_TRANSITION,
        from: fromState,
        to: toState,
        message: `Transition from ${fromState} to ${toState} is not allowed`
      };
    }

    // Get transition definition
    const transitionDef = this.getTransitionDefinition(fromState, toState);

    // Execute guards
    if (transitionDef?.guard && !options.force) {
      try {
        const guardResult = await transitionDef.guard(this.context, options.context);
        if (!guardResult) {
          logger.warn(`Transition guard failed: ${fromState} -> ${toState}`);
          return {
            result: TransitionResult.GUARD_FAILED,
            from: fromState,
            to: toState,
            message: 'Transition guard returned false'
          };
        }
      } catch (error) {
        logger.error(`Transition guard error: ${error.message}`);
        return {
          result: TransitionResult.GUARD_FAILED,
          from: fromState,
          to: toState,
          message: error.message
        };
      }
    }

    // Execute onExit handlers for current state
    await this.executeExitHandlers(fromState, toState, options);

    // Update state
    this.previousState = this.currentState;
    this.currentState = toState;
    this.stateEnteredAt = Date.now();
    this.transitionCount++;

    // Update context
    if (options.context) {
      this.context = { ...this.context, ...options.context };
    }

    // Record in history
    const historyEntry = {
      from: fromState,
      to: toState,
      timestamp: Date.now(),
      reason: options.reason,
      context: options.context
    };
    this.history.push(historyEntry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Execute onEnter handlers for new state
    await this.executeEnterHandlers(toState, fromState, options);

    // Execute transition action if defined
    if (transitionDef?.action) {
      try {
        await transitionDef.action(this.context, options.context);
      } catch (error) {
        logger.error(`Transition action error: ${error.message}`);
      }
    }

    // Execute global transition handlers
    await this.executeTransitionHandlers(fromState, toState, options);

    // Persist state
    if (this.persist) {
      await this.persistState();
    }

    // Publish state change event
    this.eventBus.publish('STATE_CHANGED', {
      agent: this.name,
      from: fromState,
      to: toState,
      reason: options.reason,
      timestamp: Date.now()
    });

    logger.debug(`${this.name}: ${fromState} -> ${toState}${options.reason ? ` (${options.reason})` : ''}`);

    return {
      result: TransitionResult.SUCCESS,
      from: fromState,
      to: toState,
      timestamp: Date.now()
    };
  }

  /**
   * Get transition definition
   */
  getTransitionDefinition(fromState, toState) {
    const transitions = this.transitions[fromState];
    if (!transitions) return null;

    if (Array.isArray(transitions)) {
      return transitions.includes(toState) ? {} : null;
    }

    return transitions[toState];
  }

  /**
   * Register an onEnter handler for a state
   * @param {string} state - State to handle
   * @param {function} handler - Handler function
   * @returns {function} Unsubscribe function
   */
  onEnter(state, handler) {
    if (!this.onEnterHandlers.has(state)) {
      this.onEnterHandlers.set(state, []);
    }
    this.onEnterHandlers.get(state).push(handler);

    return () => {
      const handlers = this.onEnterHandlers.get(state);
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    };
  }

  /**
   * Register an onExit handler for a state
   * @param {string} state - State to handle
   * @param {function} handler - Handler function
   * @returns {function} Unsubscribe function
   */
  onExit(state, handler) {
    if (!this.onExitHandlers.has(state)) {
      this.onExitHandlers.set(state, []);
    }
    this.onExitHandlers.get(state).push(handler);

    return () => {
      const handlers = this.onExitHandlers.get(state);
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    };
  }

  /**
   * Register a global transition handler
   * @param {function} handler - Handler function
   * @returns {function} Unsubscribe function
   */
  onTransition(handler) {
    this.onTransitionHandlers.push(handler);
    return () => {
      const index = this.onTransitionHandlers.indexOf(handler);
      if (index > -1) this.onTransitionHandlers.splice(index, 1);
    };
  }

  /**
   * Execute enter handlers
   */
  async executeEnterHandlers(state, fromState, options) {
    const handlers = this.onEnterHandlers.get(state) || [];
    for (const handler of handlers) {
      try {
        await handler({ state, fromState, context: this.context, options });
      } catch (error) {
        logger.error(`Error in onEnter handler for ${state}:`, error);
      }
    }
  }

  /**
   * Execute exit handlers
   */
  async executeExitHandlers(state, toState, options) {
    const handlers = this.onExitHandlers.get(state) || [];
    for (const handler of handlers) {
      try {
        await handler({ state, toState, context: this.context, options });
      } catch (error) {
        logger.error(`Error in onExit handler for ${state}:`, error);
      }
    }
  }

  /**
   * Execute transition handlers
   */
  async executeTransitionHandlers(fromState, toState, options) {
    for (const handler of this.onTransitionHandlers) {
      try {
        await handler({ from: fromState, to: toState, context: this.context, options });
      } catch (error) {
        logger.error('Error in transition handler:', error);
      }
    }
  }

  /**
   * Transition to error state
   * @param {Error|string} error - Error that occurred
   * @param {object} options - Additional options
   */
  async error(error, options = {}) {
    this.lastError = error instanceof Error ? error : new Error(error);
    this.errorCount++;

    return this.transition(AgentState.ERROR, {
      ...options,
      reason: `Error: ${this.lastError.message}`,
      context: {
        ...options.context,
        error: this.lastError.message,
        errorStack: this.lastError.stack
      }
    });
  }

  /**
   * Recover from error state
   * @param {string} targetState - State to recover to
   * @param {object} options - Additional options
   */
  async recover(targetState = AgentState.IDLE, options = {}) {
    if (this.currentState !== AgentState.ERROR) {
      logger.warn('Cannot recover: not in error state');
      return null;
    }

    // First transition to recovering
    await this.transition(AgentState.RECOVERING, {
      reason: 'Starting recovery',
      context: { targetState }
    });

    // Then to target state
    return this.transition(targetState, {
      ...options,
      reason: 'Recovered from error'
    });
  }

  /**
   * Reset to initial state
   * @param {object} options - Reset options
   */
  async reset(options = {}) {
    const initialState = options.initialState || AgentState.IDLE;

    this.previousState = this.currentState;
    this.currentState = initialState;
    this.context = options.context || {};
    this.lastError = null;
    this.stateEnteredAt = Date.now();

    if (!options.keepHistory) {
      this.history = [];
    }

    if (this.persist) {
      await this.persistState();
    }

    this.eventBus?.publish('STATE_RESET', {
      agent: this.name,
      state: initialState
    });

    logger.info(`${this.name} reset to ${initialState}`);
  }

  // ==================== Persistence ====================

  /**
   * Persist current state
   */
  async persistState() {
    if (!this.memoryStore) return;

    const stateData = {
      currentState: this.currentState,
      previousState: this.previousState,
      context: this.context,
      lastError: this.lastError?.message,
      errorCount: this.errorCount,
      stateEnteredAt: this.stateEnteredAt,
      transitionCount: this.transitionCount,
      savedAt: Date.now()
    };

    await this.memoryStore.set(
      MemoryNamespace.AGENT_STATE,
      `state_machine:${this.name}`,
      stateData
    );
  }

  /**
   * Restore state from persistence
   */
  async restoreState() {
    if (!this.memoryStore) return;

    const stateData = await this.memoryStore.get(
      MemoryNamespace.AGENT_STATE,
      `state_machine:${this.name}`
    );

    if (stateData) {
      this.currentState = stateData.currentState;
      this.previousState = stateData.previousState;
      this.context = stateData.context || {};
      this.errorCount = stateData.errorCount || 0;
      this.stateEnteredAt = stateData.stateEnteredAt || Date.now();
      this.transitionCount = stateData.transitionCount || 0;

      if (stateData.lastError) {
        this.lastError = new Error(stateData.lastError);
      }

      logger.info(`${this.name} restored to state: ${this.currentState}`);
    }
  }

  // ==================== Queries ====================

  /**
   * Get state machine info
   * @returns {object} State machine information
   */
  getInfo() {
    return {
      name: this.name,
      currentState: this.currentState,
      previousState: this.previousState,
      stateEnteredAt: this.stateEnteredAt,
      timeInState: Date.now() - this.stateEnteredAt,
      transitionCount: this.transitionCount,
      errorCount: this.errorCount,
      lastError: this.lastError?.message,
      context: this.context
    };
  }

  /**
   * Get transition history
   * @param {number} limit - Maximum entries
   * @returns {object[]} History entries
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Get all valid transitions from current state
   * @returns {string[]} Valid target states
   */
  getValidTransitions() {
    const transitions = this.transitions[this.currentState];
    if (!transitions) return [];

    if (Array.isArray(transitions)) {
      return transitions;
    }

    return Object.keys(transitions);
  }
}

/**
 * Create an agent state machine with standard configuration
 * @param {string} name - Agent name
 * @param {object} options - Additional options
 * @returns {StateMachine} Configured state machine
 */
export function createAgentStateMachine(name, options = {}) {
  return new StateMachine({
    name,
    initialState: AgentState.IDLE,
    transitions: {
      [AgentState.IDLE]: {
        [AgentState.PLANNING]: {},
        [AgentState.EXECUTING]: {},
        [AgentState.ERROR]: {}
      },
      [AgentState.PLANNING]: {
        [AgentState.EXECUTING]: {},
        [AgentState.WAITING]: {},
        [AgentState.BLOCKED]: {},
        [AgentState.ERROR]: {},
        [AgentState.IDLE]: {}
      },
      [AgentState.EXECUTING]: {
        [AgentState.COMPLETED]: {},
        [AgentState.WAITING]: {},
        [AgentState.BLOCKED]: {},
        [AgentState.ERROR]: {},
        [AgentState.IDLE]: {}
      },
      [AgentState.WAITING]: {
        [AgentState.EXECUTING]: {},
        [AgentState.PLANNING]: {},
        [AgentState.BLOCKED]: {},
        [AgentState.ERROR]: {},
        [AgentState.IDLE]: {}
      },
      [AgentState.BLOCKED]: {
        [AgentState.WAITING]: {},
        [AgentState.PLANNING]: {},
        [AgentState.ERROR]: {},
        [AgentState.IDLE]: {}
      },
      [AgentState.ERROR]: {
        [AgentState.RECOVERING]: {},
        [AgentState.IDLE]: {}
      },
      [AgentState.RECOVERING]: {
        [AgentState.IDLE]: {},
        [AgentState.PLANNING]: {},
        [AgentState.ERROR]: {}
      },
      [AgentState.COMPLETED]: {
        [AgentState.IDLE]: {},
        [AgentState.PLANNING]: {}
      }
    },
    persist: options.persist !== false,
    context: options.context || {},
    ...options
  });
}

// State machine registry for managing multiple machines
const stateMachines = new Map();

/**
 * Get or create a state machine by name
 * @param {string} name - State machine name
 * @param {object} options - Options for creation
 * @returns {StateMachine} The state machine
 */
export function getStateMachine(name, options = {}) {
  if (!stateMachines.has(name)) {
    const machine = createAgentStateMachine(name, options);
    stateMachines.set(name, machine);
  }
  return stateMachines.get(name);
}

/**
 * Remove a state machine from the registry
 * @param {string} name - State machine name
 */
export function removeStateMachine(name) {
  stateMachines.delete(name);
}

/**
 * Get all registered state machines
 * @returns {Map} Map of state machines
 */
export function getAllStateMachines() {
  return new Map(stateMachines);
}

/**
 * Clear all state machines (for testing)
 */
export function clearStateMachines() {
  stateMachines.clear();
}

export default StateMachine;
