/**
 * SessionMemory Tests
 * ====================
 * Tests for the short-term memory layer.
 */

import { jest } from '@jest/globals';
import {
  SessionMemory,
  getSessionMemory,
  resetSessionMemory,
  MemoryType,
  SolutionOutcome
} from '../memory-store/SessionMemory.js';

describe('SessionMemory', () => {
  let memory;

  beforeEach(async () => {
    await resetSessionMemory();
    memory = new SessionMemory({ persistToStore: false });
    await memory.initialize();
  });

  afterEach(async () => {
    if (memory) {
      await memory.shutdown();
    }
    await resetSessionMemory();
  });

  describe('Session Management', () => {
    test('creates new session on first access', () => {
      const session = memory.getSession('session-1');

      expect(session.id).toBe('session-1');
      expect(session.createdAt).toBeDefined();
      expect(session.context).toEqual({});
    });

    test('returns existing session on subsequent access', () => {
      const session1 = memory.getSession('session-1');
      session1.context.foo = 'bar';

      const session2 = memory.getSession('session-1');

      expect(session2.context.foo).toBe('bar');
    });

    test('setSessionContext stores context value', () => {
      memory.setSessionContext('session-1', 'project', 'my-project');
      memory.setSessionContext('session-1', 'user', 'john');

      const context = memory.getSessionContext('session-1');

      expect(context.project).toBe('my-project');
      expect(context.user).toBe('john');
    });

    test('getSessionContext returns specific key', () => {
      memory.setSessionContext('session-1', 'project', 'my-project');

      const project = memory.getSessionContext('session-1', 'project');

      expect(project).toBe('my-project');
    });

    test('getSessionContext returns null for missing key', () => {
      const value = memory.getSessionContext('session-1', 'nonexistent');

      expect(value).toBeNull();
    });

    test('closeSession removes session', async () => {
      memory.getSession('session-1');
      memory.setSessionContext('session-1', 'foo', 'bar');

      await memory.closeSession('session-1');

      const context = memory.getSessionContext('session-1');
      expect(context).toEqual({});
    });
  });

  describe('Working Memory', () => {
    test('setWorkingState stores task state', () => {
      memory.setWorkingState('task-1', { phase: 'building', progress: 50 });

      const state = memory.getWorkingState('task-1');

      expect(state.phase).toBe('building');
      expect(state.progress).toBe(50);
      expect(state.taskId).toBe('task-1');
    });

    test('updateWorkingState merges updates', () => {
      memory.setWorkingState('task-1', { phase: 'building', progress: 50 });
      memory.updateWorkingState('task-1', { progress: 75 });

      const state = memory.getWorkingState('task-1');

      expect(state.phase).toBe('building');
      expect(state.progress).toBe(75);
    });

    test('clearWorkingState removes task state', () => {
      memory.setWorkingState('task-1', { phase: 'building' });
      memory.clearWorkingState('task-1');

      const state = memory.getWorkingState('task-1');

      expect(state).toBeNull();
    });

    test('getAllWorkingStates returns all active states', () => {
      memory.setWorkingState('task-1', { phase: 'building' });
      memory.setWorkingState('task-2', { phase: 'testing' });

      const states = memory.getAllWorkingStates();

      expect(states.length).toBe(2);
    });

    test('getWorkingState returns null for unknown task', () => {
      const state = memory.getWorkingState('unknown-task');

      expect(state).toBeNull();
    });
  });

  describe('Conversation History', () => {
    test('addConversationMessage stores message', () => {
      memory.addConversationMessage('session-1', {
        role: 'user',
        content: 'Hello'
      });

      const history = memory.getConversationHistory('session-1');

      expect(history.length).toBe(1);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
    });

    test('maintains conversation order', () => {
      memory.addConversationMessage('session-1', { role: 'user', content: 'Hi' });
      memory.addConversationMessage('session-1', { role: 'assistant', content: 'Hello!' });
      memory.addConversationMessage('session-1', { role: 'user', content: 'How are you?' });

      const history = memory.getConversationHistory('session-1');

      expect(history[0].content).toBe('Hi');
      expect(history[1].content).toBe('Hello!');
      expect(history[2].content).toBe('How are you?');
    });

    test('getConversationHistory respects limit', () => {
      for (let i = 0; i < 10; i++) {
        memory.addConversationMessage('session-1', {
          role: 'user',
          content: `Message ${i}`
        });
      }

      const history = memory.getConversationHistory('session-1', 3);

      expect(history.length).toBe(3);
      expect(history[0].content).toBe('Message 7');
      expect(history[2].content).toBe('Message 9');
    });

    test('getConversationContext returns formatted messages', () => {
      memory.addConversationMessage('session-1', { role: 'user', content: 'Hi' });
      memory.addConversationMessage('session-1', { role: 'assistant', content: 'Hello!' });

      const context = memory.getConversationContext('session-1', 10);

      expect(context.length).toBe(2);
      expect(context[0]).toEqual({ role: 'user', content: 'Hi' });
      expect(context[1]).toEqual({ role: 'assistant', content: 'Hello!' });
    });
  });

  describe('Solution Registry', () => {
    test('registerSolution stores successful solution', () => {
      const id = memory.registerSolution({
        context: 'fix authentication bug',
        approach: 'Add token refresh logic',
        outcome: SolutionOutcome.SUCCESS
      });

      expect(id).toBeDefined();

      const stats = memory.getStats();
      expect(stats.solutions.successful).toBe(1);
    });

    test('registerSolution stores failed solution', () => {
      memory.registerSolution({
        context: 'fix authentication bug',
        approach: 'Clear all cookies',
        outcome: SolutionOutcome.FAILED,
        details: { failureReason: 'Broke session persistence' }
      });

      const stats = memory.getStats();
      expect(stats.solutions.failed).toBe(1);
    });

    test('querySolutions finds related solutions', () => {
      memory.registerSolution({
        context: 'authentication bug in login',
        approach: 'Fix token handling',
        outcome: SolutionOutcome.SUCCESS
      });

      memory.registerSolution({
        context: 'authentication timeout issue',
        approach: 'Increase token expiry',
        outcome: SolutionOutcome.FAILED
      });

      const results = memory.querySolutions('authentication');

      expect(results.relatedSuccesses.length).toBe(1);
      expect(results.relatedFailures.length).toBe(1);
    });

    test('getSuccessfulApproaches returns matching approaches', () => {
      memory.registerSolution({
        context: 'performance optimization',
        approach: 'Add caching layer',
        outcome: SolutionOutcome.SUCCESS
      });

      memory.registerSolution({
        context: 'performance bottleneck',
        approach: 'Optimize database queries',
        outcome: SolutionOutcome.SUCCESS
      });

      const approaches = memory.getSuccessfulApproaches('performance');

      expect(approaches.length).toBe(2);
    });

    test('getApproachesToAvoid returns failed approaches', () => {
      memory.registerSolution({
        context: 'database migration',
        approach: 'Run without backup',
        outcome: SolutionOutcome.FAILED,
        details: { failureReason: 'Data loss' }
      });

      const toAvoid = memory.getApproachesToAvoid('database');

      expect(toAvoid.length).toBe(1);
      expect(toAvoid[0].reason).toBe('Data loss');
    });

    test('generates recommendation based on history', () => {
      memory.registerSolution({
        context: 'caching issue',
        approach: 'Use Redis',
        outcome: SolutionOutcome.SUCCESS
      });

      const results = memory.querySolutions('caching');

      expect(results.recommendation).toContain('Recommended');
    });
  });

  describe('Statistics', () => {
    test('getStats returns memory statistics', () => {
      memory.getSession('session-1');
      memory.addConversationMessage('session-1', { role: 'user', content: 'Hi' });
      memory.setWorkingState('task-1', { phase: 'building' });
      memory.registerSolution({ context: 'test', approach: 'test', outcome: SolutionOutcome.SUCCESS });

      const stats = memory.getStats();

      expect(stats.sessions.active).toBe(1);
      expect(stats.sessions.totalConversations).toBe(1);
      expect(stats.working.activeTasks).toBe(1);
      expect(stats.solutions.successful).toBe(1);
    });

    test('getSessionSummary returns session info', () => {
      memory.getSession('session-1');
      memory.setSessionContext('session-1', 'project', 'test');
      memory.addConversationMessage('session-1', { role: 'user', content: 'Hi' });

      const summary = memory.getSessionSummary('session-1');

      expect(summary.id).toBe('session-1');
      expect(summary.messageCount).toBe(1);
      expect(summary.contextKeys).toContain('project');
    });

    test('getSessionSummary returns null for unknown session', () => {
      const summary = memory.getSessionSummary('unknown');

      expect(summary).toBeNull();
    });

    test('calculates success rate correctly', () => {
      memory.registerSolution({ context: 'a', approach: 'a', outcome: SolutionOutcome.SUCCESS });
      memory.registerSolution({ context: 'b', approach: 'b', outcome: SolutionOutcome.SUCCESS });
      memory.registerSolution({ context: 'c', approach: 'c', outcome: SolutionOutcome.FAILED });

      const stats = memory.getStats();

      expect(stats.solutions.successRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('Singleton Pattern', () => {
    test('getSessionMemory returns same instance', async () => {
      await resetSessionMemory();

      const instance1 = getSessionMemory();
      const instance2 = getSessionMemory();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Events', () => {
    test('emits session:created event', () => {
      const handler = jest.fn();
      memory.on('session:created', handler);

      memory.getSession('new-session');

      expect(handler).toHaveBeenCalledWith({ sessionId: 'new-session' });
    });

    test('emits working:updated event', () => {
      const handler = jest.fn();
      memory.on('working:updated', handler);

      memory.setWorkingState('task-1', { phase: 'building' });

      expect(handler).toHaveBeenCalled();
    });

    test('emits solution:registered event', () => {
      const handler = jest.fn();
      memory.on('solution:registered', handler);

      memory.registerSolution({
        context: 'test',
        approach: 'test',
        outcome: SolutionOutcome.SUCCESS
      });

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].outcome).toBe(SolutionOutcome.SUCCESS);
    });
  });

  describe('Reset and Shutdown', () => {
    test('reset clears all memory', () => {
      memory.getSession('session-1');
      memory.setWorkingState('task-1', { phase: 'building' });
      memory.registerSolution({ context: 'test', approach: 'test', outcome: SolutionOutcome.SUCCESS });

      memory.reset();

      const stats = memory.getStats();
      expect(stats.sessions.active).toBe(0);
      expect(stats.working.activeTasks).toBe(0);
      expect(stats.solutions.successful).toBe(0);
    });
  });
});
