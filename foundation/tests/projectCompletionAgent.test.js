/**
 * ProjectCompletionAgent (Lucy) Tests
 */

import {
  ProjectCompletionAgent,
  getCompletionAgent,
  resetCompletionAgent,
  AgentState,
  CompletionEvents
} from '../../agents/project-completion-agent/index.js';

describe('ProjectCompletionAgent (Lucy)', () => {
  let agent;

  beforeEach(() => {
    resetCompletionAgent();
    agent = new ProjectCompletionAgent({
      projectRoot: '/tmp/test-minions',
      targetCompletion: 100,
      maxIterations: 10
    });
  });

  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });

  describe('Constructor', () => {
    test('should create agent with correct name and alias', () => {
      expect(agent.name).toBe('ProjectCompletionAgent');
      expect(agent.alias).toBe('Lucy');
    });

    test('should start in IDLE state', () => {
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('should initialize sub-components', () => {
      expect(agent.gapDetector).toBeDefined();
      expect(agent.completionTracker).toBeDefined();
      expect(agent.loop).toBeDefined();
    });

    test('should initialize gaps as empty array', () => {
      expect(agent.gaps).toEqual([]);
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getCompletionAgent', () => {
      const instance1 = getCompletionAgent();
      const instance2 = getCompletionAgent();
      expect(instance1).toBe(instance2);
    });

    test('should reset instance with resetCompletionAgent', async () => {
      const instance1 = getCompletionAgent();
      resetCompletionAgent();
      const instance2 = getCompletionAgent();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getStatus', () => {
    test('should return current agent status', () => {
      const status = agent.getStatus();

      expect(status).toEqual({
        name: 'ProjectCompletionAgent',
        alias: 'Lucy',
        version: '1.0.0',
        state: AgentState.IDLE,
        currentProject: null,
        metrics: expect.any(Object)
      });
    });
  });

  describe('getMetrics', () => {
    test('should return agent metrics', () => {
      const metrics = agent.getMetrics();

      expect(metrics).toHaveProperty('iterationsCompleted');
      expect(metrics).toHaveProperty('gapsDetected');
      expect(metrics).toHaveProperty('gapsResolved');
      expect(metrics).toHaveProperty('errorsCount');
      expect(metrics).toHaveProperty('gapsRemaining');
    });
  });

  describe('getGaps', () => {
    test('should return empty array initially', () => {
      const gaps = agent.getGaps();
      expect(gaps).toEqual([]);
    });
  });

  describe('getProgress', () => {
    test('should return zero progress initially', async () => {
      const progress = await agent.getProgress();

      expect(progress).toEqual({
        percentage: 0,
        gaps: [],
        project: undefined
      });
    });
  });

  describe('pauseCompletion', () => {
    test('should return success when not running', async () => {
      const result = await agent.pauseCompletion();

      expect(result.success).toBe(true);
    });
  });

  describe('stopCompletion', () => {
    test('should stop and reset state', async () => {
      const result = await agent.stopCompletion();

      expect(result).toEqual({ success: true });
      expect(agent.state).toBe(AgentState.IDLE);
      expect(agent.currentProject).toBeNull();
    });
  });

  describe('Events', () => {
    test('should export event types', () => {
      expect(CompletionEvents.COMPLETION_START).toBe('completion:start');
      expect(CompletionEvents.COMPLETION_STARTED).toBe('completion:started');
      expect(CompletionEvents.GAP_DETECTED).toBe('completion:gap:detected');
      expect(CompletionEvents.PROGRESS_UPDATED).toBe('completion:progress:updated');
    });
  });

  describe('State Transitions', () => {
    test('should have valid agent states', () => {
      expect(AgentState.IDLE).toBe('IDLE');
      expect(AgentState.ANALYZING).toBe('ANALYZING');
      expect(AgentState.BUILDING).toBe('BUILDING');
      expect(AgentState.TESTING).toBe('TESTING');
      expect(AgentState.COMPLETED).toBe('COMPLETED');
      expect(AgentState.PAUSED).toBe('PAUSED');
    });
  });
});
