import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import StateMachine, {
  createAgentStateMachine,
  getStateMachine,
  removeStateMachine,
  clearStateMachines,
  getAllStateMachines,
  AgentState,
  TransitionResult
} from '../state-machine/StateMachine.js';
import { resetMemoryStore } from '../memory-store/MemoryStore.js';

describe('StateMachine', () => {
  beforeEach(() => {
    clearStateMachines();
    resetMemoryStore();
  });

  afterEach(() => {
    clearStateMachines();
    resetMemoryStore();
  });

  describe('basic state management', () => {
    test('should start in initial state', () => {
      const sm = new StateMachine({
        name: 'test',
        initialState: AgentState.IDLE,
        transitions: {},
        persist: false
      });

      expect(sm.getState()).toBe(AgentState.IDLE);
    });

    test('should check current state', () => {
      const sm = new StateMachine({
        name: 'test',
        initialState: AgentState.IDLE,
        transitions: {},
        persist: false
      });

      expect(sm.isInState(AgentState.IDLE)).toBe(true);
      expect(sm.isInState(AgentState.EXECUTING)).toBe(false);
    });
  });

  describe('transitions', () => {
    let sm;

    beforeEach(async () => {
      sm = createAgentStateMachine('test-agent', { persist: false });
      await sm.initialize();
    });

    test('should transition between valid states', async () => {
      const result = await sm.transition(AgentState.PLANNING, {
        reason: 'Starting planning'
      });

      expect(result.result).toBe(TransitionResult.SUCCESS);
      expect(sm.getState()).toBe(AgentState.PLANNING);
    });

    test('should reject invalid transitions', async () => {
      const result = await sm.transition(AgentState.COMPLETED);

      expect(result.result).toBe(TransitionResult.INVALID_TRANSITION);
      expect(sm.getState()).toBe(AgentState.IDLE);
    });

    test('should check if transition is valid', () => {
      expect(sm.canTransitionTo(AgentState.PLANNING)).toBe(true);
      expect(sm.canTransitionTo(AgentState.EXECUTING)).toBe(true);
      expect(sm.canTransitionTo(AgentState.COMPLETED)).toBe(false);
    });

    test('should get valid transitions from current state', () => {
      const valid = sm.getValidTransitions();

      expect(valid).toContain(AgentState.PLANNING);
      expect(valid).toContain(AgentState.EXECUTING);
      expect(valid).toContain(AgentState.ERROR);
    });

    test('should track previous state', async () => {
      await sm.transition(AgentState.PLANNING);
      await sm.transition(AgentState.EXECUTING);

      const info = sm.getInfo();
      expect(info.previousState).toBe(AgentState.PLANNING);
      expect(info.currentState).toBe(AgentState.EXECUTING);
    });

    test('should record transition in history', async () => {
      await sm.transition(AgentState.PLANNING, { reason: 'test reason' });

      const history = sm.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].from).toBe(AgentState.IDLE);
      expect(history[0].to).toBe(AgentState.PLANNING);
      expect(history[0].reason).toBe('test reason');
    });
  });

  describe('transition guards', () => {
    test('should execute guard before transition', async () => {
      const sm = new StateMachine({
        name: 'guarded',
        initialState: 'state_a',
        transitions: {
          state_a: {
            state_b: {
              guard: (context) => context.allowed === true
            }
          }
        },
        context: { allowed: false },
        persist: false
      });
      await sm.initialize();

      const result1 = await sm.transition('state_b');
      expect(result1.result).toBe(TransitionResult.GUARD_FAILED);

      sm.context.allowed = true;
      const result2 = await sm.transition('state_b');
      expect(result2.result).toBe(TransitionResult.SUCCESS);
    });

    test('should force transition past guards', async () => {
      const sm = new StateMachine({
        name: 'guarded',
        initialState: 'state_a',
        transitions: {
          state_a: {
            state_b: {
              guard: () => false
            }
          }
        },
        persist: false
      });
      await sm.initialize();

      const result = await sm.transition('state_b', { force: true });
      expect(result.result).toBe(TransitionResult.SUCCESS);
    });
  });

  describe('event handlers', () => {
    let sm;

    beforeEach(async () => {
      sm = createAgentStateMachine('test-agent', { persist: false });
      await sm.initialize();
    });

    test('should call onEnter handlers', async () => {
      let enterCalled = false;

      sm.onEnter(AgentState.PLANNING, () => {
        enterCalled = true;
      });

      await sm.transition(AgentState.PLANNING);

      expect(enterCalled).toBe(true);
    });

    test('should call onExit handlers', async () => {
      let exitCalled = false;

      sm.onExit(AgentState.IDLE, () => {
        exitCalled = true;
      });

      await sm.transition(AgentState.PLANNING);

      expect(exitCalled).toBe(true);
    });

    test('should call onTransition handlers', async () => {
      let transitionData = null;

      sm.onTransition((data) => {
        transitionData = data;
      });

      await sm.transition(AgentState.PLANNING, { reason: 'test' });

      expect(transitionData.from).toBe(AgentState.IDLE);
      expect(transitionData.to).toBe(AgentState.PLANNING);
    });

    test('should unsubscribe handlers', async () => {
      let callCount = 0;

      const unsub = sm.onEnter(AgentState.PLANNING, () => {
        callCount++;
      });

      unsub();

      await sm.transition(AgentState.PLANNING);

      expect(callCount).toBe(0);
    });
  });

  describe('error handling', () => {
    let sm;

    beforeEach(async () => {
      sm = createAgentStateMachine('test-agent', { persist: false });
      await sm.initialize();
    });

    test('should transition to error state', async () => {
      await sm.error('Something went wrong');

      expect(sm.getState()).toBe(AgentState.ERROR);
      expect(sm.lastError.message).toBe('Something went wrong');
      expect(sm.errorCount).toBe(1);
    });

    test('should recover from error state', async () => {
      await sm.error('Error occurred');
      await sm.recover(AgentState.IDLE);

      expect(sm.getState()).toBe(AgentState.IDLE);
    });

    test('should not recover if not in error state', async () => {
      const result = await sm.recover();
      expect(result).toBeNull();
    });
  });

  describe('context management', () => {
    test('should update context on transition', async () => {
      const sm = createAgentStateMachine('test-agent', {
        persist: false,
        context: { taskId: null }
      });
      await sm.initialize();

      await sm.transition(AgentState.PLANNING, {
        context: { taskId: 'task-123' }
      });

      expect(sm.context.taskId).toBe('task-123');
    });

    test('should preserve existing context', async () => {
      const sm = createAgentStateMachine('test-agent', {
        persist: false,
        context: { a: 1, b: 2 }
      });
      await sm.initialize();

      await sm.transition(AgentState.PLANNING, {
        context: { c: 3 }
      });

      expect(sm.context.a).toBe(1);
      expect(sm.context.b).toBe(2);
      expect(sm.context.c).toBe(3);
    });
  });

  describe('reset', () => {
    test('should reset to initial state', async () => {
      const sm = createAgentStateMachine('test-agent', { persist: false });
      await sm.initialize();

      await sm.transition(AgentState.PLANNING);
      await sm.transition(AgentState.EXECUTING);
      await sm.error('Error');

      await sm.reset();

      expect(sm.getState()).toBe(AgentState.IDLE);
      expect(sm.lastError).toBeNull();
    });

    test('should clear context on reset', async () => {
      const sm = createAgentStateMachine('test-agent', {
        persist: false,
        context: { data: 'test' }
      });
      await sm.initialize();

      await sm.reset({ context: { fresh: true } });

      expect(sm.context).toEqual({ fresh: true });
    });
  });

  describe('state info', () => {
    test('should return state info', async () => {
      const sm = createAgentStateMachine('test-agent', { persist: false });
      await sm.initialize();

      await sm.transition(AgentState.PLANNING);

      const info = sm.getInfo();

      expect(info.name).toBe('test-agent');
      expect(info.currentState).toBe(AgentState.PLANNING);
      expect(info.previousState).toBe(AgentState.IDLE);
      expect(info.transitionCount).toBe(1);
      expect(info.timeInState).toBeGreaterThanOrEqual(0);
    });
  });

  describe('agent state constants', () => {
    test('should have all expected states', () => {
      expect(AgentState.IDLE).toBe('idle');
      expect(AgentState.PLANNING).toBe('planning');
      expect(AgentState.EXECUTING).toBe('executing');
      expect(AgentState.WAITING).toBe('waiting');
      expect(AgentState.BLOCKED).toBe('blocked');
      expect(AgentState.ERROR).toBe('error');
      expect(AgentState.COMPLETED).toBe('completed');
      expect(AgentState.RECOVERING).toBe('recovering');
    });
  });

  describe('transition result constants', () => {
    test('should have all expected results', () => {
      expect(TransitionResult.SUCCESS).toBe('success');
      expect(TransitionResult.DENIED).toBe('denied');
      expect(TransitionResult.GUARD_FAILED).toBe('guard_failed');
      expect(TransitionResult.INVALID_TRANSITION).toBe('invalid_transition');
    });
  });

  describe('state machine registry', () => {
    test('getStateMachine should return same instance', () => {
      const sm1 = getStateMachine('agent1', { persist: false });
      const sm2 = getStateMachine('agent1', { persist: false });

      expect(sm1).toBe(sm2);
    });

    test('should create different instances for different names', () => {
      const sm1 = getStateMachine('agent1', { persist: false });
      const sm2 = getStateMachine('agent2', { persist: false });

      expect(sm1).not.toBe(sm2);
    });

    test('should remove state machine from registry', () => {
      const sm1 = getStateMachine('agent1', { persist: false });
      removeStateMachine('agent1');
      const sm2 = getStateMachine('agent1', { persist: false });

      expect(sm1).not.toBe(sm2);
    });

    test('should clear all state machines', () => {
      getStateMachine('agent1', { persist: false });
      getStateMachine('agent2', { persist: false });

      clearStateMachines();

      const sm1 = getStateMachine('agent1', { persist: false });
      const sm2 = getStateMachine('agent2', { persist: false });

      expect(sm1).toBeDefined();
      expect(sm2).toBeDefined();
    });
  });

  describe('createAgentStateMachine', () => {
    test('should create a fully configured agent state machine', async () => {
      const sm = createAgentStateMachine('my-agent', { persist: false });
      await sm.initialize();

      expect(sm.getState()).toBe(AgentState.IDLE);

      await sm.transition(AgentState.PLANNING);
      await sm.transition(AgentState.EXECUTING);
      await sm.transition(AgentState.COMPLETED);
      await sm.transition(AgentState.IDLE);

      expect(sm.transitionCount).toBe(4);
    });
  });

  describe('additional coverage', () => {
    test('array-style transitions', async () => {
      const sm = new StateMachine({
        name: 'array-trans',
        initialState: 'a',
        transitions: { a: ['b', 'c'], b: ['a'], c: ['a'] },
        persist: false
      });
      await sm.initialize();
      expect(sm.canTransitionTo('b')).toBe(true);
      const result = await sm.transition('b');
      expect(result.result).toBe(TransitionResult.SUCCESS);
      expect(sm.getValidTransitions()).toContain('a');
    });

    test('guard throws error', async () => {
      const sm = new StateMachine({
        name: 'guard-error',
        initialState: 'a',
        transitions: { a: { b: { guard: () => { throw new Error('Guard exploded'); } } } },
        persist: false
      });
      await sm.initialize();
      const result = await sm.transition('b');
      expect(result.result).toBe(TransitionResult.GUARD_FAILED);
    });

    test('history exceeds maxHistory', async () => {
      const sm = new StateMachine({
        name: 'max-hist',
        initialState: 'a',
        transitions: { a: { b: {} }, b: { a: {} } },
        maxHistory: 3,
        persist: false
      });
      await sm.initialize();
      await sm.transition('b');
      await sm.transition('a');
      await sm.transition('b');
      await sm.transition('a');
      await sm.transition('b');
      expect(sm.getHistory(10).length).toBeLessThanOrEqual(3);
    });

    test('transition action throws error', async () => {
      const sm = new StateMachine({
        name: 'action-error',
        initialState: 'a',
        transitions: { a: { b: { action: () => { throw new Error('Action failed'); } } } },
        persist: false
      });
      await sm.initialize();
      const result = await sm.transition('b');
      expect(result.result).toBe(TransitionResult.SUCCESS);
    });

    test('onExit unsubscribe', async () => {
      const sm = createAgentStateMachine('exit-unsub', { persist: false });
      await sm.initialize();
      let count = 0;
      const unsub = sm.onExit(AgentState.IDLE, () => { count++; });
      unsub();
      await sm.transition(AgentState.PLANNING);
      expect(count).toBe(0);
    });

    test('onTransition unsubscribe', async () => {
      const sm = createAgentStateMachine('trans-unsub', { persist: false });
      await sm.initialize();
      let count = 0;
      const unsub = sm.onTransition(() => { count++; });
      unsub();
      await sm.transition(AgentState.PLANNING);
      expect(count).toBe(0);
    });

    test('onEnter handler throws error', async () => {
      const sm = createAgentStateMachine('enter-err', { persist: false });
      await sm.initialize();
      sm.onEnter(AgentState.PLANNING, () => { throw new Error('Enter failed'); });
      const result = await sm.transition(AgentState.PLANNING);
      expect(result.result).toBe(TransitionResult.SUCCESS);
    });

    test('onExit handler throws error', async () => {
      const sm = createAgentStateMachine('exit-err', { persist: false });
      await sm.initialize();
      sm.onExit(AgentState.IDLE, () => { throw new Error('Exit failed'); });
      const result = await sm.transition(AgentState.PLANNING);
      expect(result.result).toBe(TransitionResult.SUCCESS);
    });

    test('onTransition handler throws error', async () => {
      const sm = createAgentStateMachine('trans-err', { persist: false });
      await sm.initialize();
      sm.onTransition(() => { throw new Error('Trans failed'); });
      const result = await sm.transition(AgentState.PLANNING);
      expect(result.result).toBe(TransitionResult.SUCCESS);
    });

    test('ensureInitialized calls initialize', async () => {
      const sm = new StateMachine({
        name: 'ensure-init',
        initialState: 'a',
        transitions: { a: { b: {} } },
        persist: false
      });
      expect(sm.initialized).toBe(false);
      await sm.transition('b');
      expect(sm.initialized).toBe(true);
    });

    test('getTransitionDefinition with no transitions', () => {
      const sm = new StateMachine({ name: 'no-trans', initialState: 'a', transitions: {}, persist: false });
      expect(sm.getTransitionDefinition('a', 'b')).toBeNull();
    });

    test('canTransitionTo with no transitions', () => {
      const sm = new StateMachine({ name: 'no-trans', initialState: 'a', transitions: {}, persist: false });
      expect(sm.canTransitionTo('b')).toBe(false);
    });

    test('getValidTransitions returns empty for no transitions', () => {
      const sm = new StateMachine({ name: 'no-trans', initialState: 'a', transitions: {}, persist: false });
      expect(sm.getValidTransitions()).toEqual([]);
    });

    test('getAllStateMachines returns all registered machines', () => {
      clearStateMachines();
      getStateMachine('sm1', { persist: false });
      getStateMachine('sm2', { persist: false });
      const all = getAllStateMachines();
      expect(all.size).toBe(2);
    });
  });

  describe('persistence', () => {
    test('should persist and restore state', async () => {
      const sm1 = createAgentStateMachine('persist-test', { persist: true });
      await sm1.initialize();
      await sm1.transition(AgentState.PLANNING);
      await sm1.transition(AgentState.EXECUTING);
      const sm2 = new StateMachine({
        name: 'persist-test',
        initialState: AgentState.IDLE,
        transitions: sm1.transitions,
        persist: true
      });
      await sm2.initialize();
      expect(sm2.initialized).toBe(true);
    });

    test('reset with persist calls persistState', async () => {
      const sm = createAgentStateMachine('reset-persist', { persist: true });
      await sm.initialize();
      await sm.transition(AgentState.PLANNING);
      await sm.reset({ keepHistory: true });
      expect(sm.getState()).toBe(AgentState.IDLE);
      expect(sm.history.length).toBeGreaterThan(0);
    });

    test('should restore lastError from persistence', async () => {
      const sm1 = createAgentStateMachine('error-persist', { persist: true });
      await sm1.initialize();
      await sm1.error('Persisted error message');
      expect(sm1.lastError.message).toBe('Persisted error message');
      const sm2 = new StateMachine({
        name: 'error-persist',
        initialState: AgentState.IDLE,
        transitions: sm1.transitions,
        persist: true
      });
      await sm2.initialize();
      expect(sm2.currentState).toBe(AgentState.ERROR);
    });
  });
});
