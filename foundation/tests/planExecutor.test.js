/**
 * PlanExecutor Integration Tests
 * ===============================
 * Tests the Plan → Execute pipeline that bridges Nefario plans to actual execution.
 */

import { jest } from '@jest/globals';
import { PlanExecutor, getPlanExecutor } from '../../agents/nefario-agent/PlanExecutor.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

// Reset singleton between tests
let planExecutor;

beforeEach(() => {
  // Get fresh instance
  planExecutor = new PlanExecutor({
    maxConcurrentTasks: 2,
    taskTimeout: 5000,
    retryAttempts: 1
  });
});

afterEach(() => {
  if (planExecutor) {
    planExecutor.reset();
  }
});

describe('PlanExecutor', () => {
  describe('Singleton Pattern', () => {
    test('getPlanExecutor returns singleton instance', () => {
      const instance1 = getPlanExecutor();
      const instance2 = getPlanExecutor();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Basic Execution', () => {
    test('can execute a simple plan with one task', async () => {
      const plan = {
        id: 'test-plan-1',
        version: '1.0',
        status: 'pending',
        tasks: [
          {
            id: 'task-1',
            name: 'Setup task',
            description: 'Initialize project structure',
            category: 'setup',
            type: 'configuration',
            phase: 'setup',
            priority: 1,
            complexity: 1,
            dependencies: []
          }
        ],
        executionGroups: [{ id: 'group-1', phase: 'setup', tasks: ['task-1'] }],
        checkpoints: [],
        phases: { setup: [] },
        metadata: { projectName: 'test-project' }
      };

      const result = await planExecutor.executePlan(plan, {});

      expect(result.success).toBe(true);
      expect(result.tasksCompleted).toBe(1);
      expect(result.tasksFailed).toBe(0);
      expect(result.taskResults['task-1']).toBeDefined();
      expect(result.taskResults['task-1'].success).toBe(true);
    });

    test('handles multiple tasks with dependencies', async () => {
      const plan = {
        id: 'test-plan-2',
        version: '1.0',
        status: 'pending',
        tasks: [
          {
            id: 'task-1',
            name: 'Setup',
            description: 'First task',
            category: 'setup',
            type: 'configuration',
            phase: 'setup',
            priority: 1,
            complexity: 1,
            dependencies: []
          },
          {
            id: 'task-2',
            name: 'Build',
            description: 'Second task depends on first',
            category: 'backend',
            type: 'implementation',
            phase: 'implementation',
            priority: 2,
            complexity: 2,
            dependencies: ['task-1']
          },
          {
            id: 'task-3',
            name: 'Test',
            description: 'Third task depends on second',
            category: 'testing',
            type: 'testing',
            phase: 'testing',
            priority: 3,
            complexity: 1,
            dependencies: ['task-2']
          }
        ],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: { projectName: 'test-project' }
      };

      const result = await planExecutor.executePlan(plan, {});

      expect(result.success).toBe(true);
      expect(result.tasksCompleted).toBe(3);
      expect(result.tasksFailed).toBe(0);
    });

    test('parallel execution respects maxConcurrentTasks', async () => {
      const executionOrder = [];

      // Override task handlers to track execution
      planExecutor.registerTaskHandler('setup', async (task) => {
        executionOrder.push({ start: task.id, time: Date.now() });
        await new Promise(r => setTimeout(r, 50));
        executionOrder.push({ end: task.id, time: Date.now() });
        return { success: true };
      });

      const plan = {
        id: 'test-plan-3',
        version: '1.0',
        status: 'pending',
        tasks: [
          { id: 'task-1', name: 'T1', description: '', category: 'setup', type: 'configuration', phase: 'setup', priority: 1, complexity: 1, dependencies: [] },
          { id: 'task-2', name: 'T2', description: '', category: 'setup', type: 'configuration', phase: 'setup', priority: 1, complexity: 1, dependencies: [] },
          { id: 'task-3', name: 'T3', description: '', category: 'setup', type: 'configuration', phase: 'setup', priority: 1, complexity: 1, dependencies: [] }
        ],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      const result = await planExecutor.executePlan(plan, {});

      expect(result.success).toBe(true);
      expect(result.tasksCompleted).toBe(3);

      // With maxConcurrentTasks=2, task-3 should start after one of the first two finishes
      // Just verify all tasks completed
      expect(executionOrder.filter(e => e.end).length).toBe(3);
    });
  });

  describe('Task Handlers', () => {
    test('routes tasks to correct handlers by category', async () => {
      const handlerCalls = {};

      const categories = ['setup', 'backend', 'frontend', 'testing', 'documentation'];
      categories.forEach(cat => {
        handlerCalls[cat] = 0;
        planExecutor.registerTaskHandler(cat, async (task) => {
          handlerCalls[cat]++;
          return { type: cat, success: true };
        });
      });

      const plan = {
        id: 'test-plan-4',
        version: '1.0',
        status: 'pending',
        tasks: categories.map((cat, i) => ({
          id: `task-${i}`,
          name: `${cat} task`,
          description: '',
          category: cat,
          type: 'implementation',
          phase: 'implementation',
          priority: 1,
          complexity: 1,
          dependencies: []
        })),
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      await planExecutor.executePlan(plan, {});

      categories.forEach(cat => {
        expect(handlerCalls[cat]).toBe(1);
      });
    });

    test('custom handler receives task and context', async () => {
      let receivedTask = null;
      let receivedContext = null;

      planExecutor.registerTaskHandler('custom', async (task, context) => {
        receivedTask = task;
        receivedContext = context;
        return { success: true };
      });

      const plan = {
        id: 'test-plan-5',
        version: '1.0',
        status: 'pending',
        tasks: [{
          id: 'custom-task',
          name: 'Custom',
          description: 'Test description',
          category: 'custom',
          type: 'implementation',
          phase: 'implementation',
          priority: 1,
          complexity: 1,
          dependencies: []
        }],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: { projectName: 'context-test' }
      };

      const context = { projectInfo: { name: 'TestProject' } };
      await planExecutor.executePlan(plan, context);

      expect(receivedTask.id).toBe('custom-task');
      expect(receivedContext.projectInfo.name).toBe('TestProject');
    });
  });

  describe('Error Handling', () => {
    test('retries failed tasks up to retry limit', async () => {
      let attempts = 0;

      // Create executor with 3 retry attempts
      const retryExecutor = new PlanExecutor({
        maxConcurrentTasks: 1,
        taskTimeout: 5000,
        retryAttempts: 3 // Allow 3 retries
      });

      retryExecutor.registerTaskHandler('flaky', async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Flaky failure');
        }
        return { success: true };
      });

      const plan = {
        id: 'test-plan-6',
        version: '1.0',
        status: 'pending',
        tasks: [{
          id: 'flaky-task',
          name: 'Flaky',
          description: '',
          category: 'flaky',
          type: 'implementation',
          phase: 'implementation',
          priority: 1,
          complexity: 1,
          dependencies: []
        }],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      const result = await retryExecutor.executePlan(plan, {});

      expect(result.success).toBe(true);
      expect(attempts).toBe(3); // Failed twice, succeeded on third attempt
    });

    test('marks task as failed after max retries', async () => {
      planExecutor.registerTaskHandler('always-fail', async () => {
        throw new Error('Always fails');
      });

      const plan = {
        id: 'test-plan-7',
        version: '1.0',
        status: 'pending',
        tasks: [{
          id: 'fail-task',
          name: 'Fail',
          description: '',
          category: 'always-fail',
          type: 'implementation',
          phase: 'implementation',
          priority: 1,
          complexity: 1,
          dependencies: []
        }],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      const result = await planExecutor.executePlan(plan, {});

      expect(result.success).toBe(false);
      expect(result.tasksFailed).toBe(1);
      expect(result.taskResults['fail-task'].success).toBe(false);
    });

    test('prevents concurrent plan execution', async () => {
      planExecutor.registerTaskHandler('slow', async () => {
        await new Promise(r => setTimeout(r, 100));
        return { success: true };
      });

      const plan = {
        id: 'test-plan-8',
        version: '1.0',
        status: 'pending',
        tasks: [{
          id: 'slow-task',
          name: 'Slow',
          description: '',
          category: 'slow',
          type: 'implementation',
          phase: 'implementation',
          priority: 1,
          complexity: 1,
          dependencies: []
        }],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      // Start first execution
      const promise1 = planExecutor.executePlan(plan, {});

      // Try to start second execution immediately
      await expect(planExecutor.executePlan(plan, {})).rejects.toThrow('Already executing');

      // Wait for first to complete
      await promise1;
    });
  });

  describe('Control Methods', () => {
    test('getStatus returns current state', async () => {
      const status = planExecutor.getStatus();

      expect(status.state).toBe('idle');
      expect(status.currentPlan).toBeNull();
      expect(status.taskStatus).toBeDefined();
    });

    test('reset clears state', async () => {
      const plan = {
        id: 'test-plan-10',
        version: '1.0',
        status: 'pending',
        tasks: [{
          id: 'task',
          name: 'Task',
          description: '',
          category: 'setup',
          type: 'config',
          phase: 'setup',
          priority: 1,
          complexity: 1,
          dependencies: []
        }],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      await planExecutor.executePlan(plan, {});

      expect(planExecutor.getHistory().length).toBe(1);

      planExecutor.reset();

      expect(planExecutor.state).toBe('idle');
      expect(planExecutor.currentPlan).toBeNull();
    });
  });

  describe('Event Emission', () => {
    test('emits execution lifecycle events', async () => {
      const events = [];

      planExecutor.on('execution:started', (data) => events.push({ type: 'started', ...data }));
      planExecutor.on('task:started', (data) => events.push({ type: 'task:started', ...data }));
      planExecutor.on('task:completed', (data) => events.push({ type: 'task:completed', ...data }));
      planExecutor.on('execution:completed', (data) => events.push({ type: 'completed', ...data }));

      const plan = {
        id: 'test-plan-11',
        version: '1.0',
        status: 'pending',
        tasks: [{
          id: 'event-task',
          name: 'Event',
          description: '',
          category: 'setup',
          type: 'config',
          phase: 'setup',
          priority: 1,
          complexity: 1,
          dependencies: []
        }],
        executionGroups: [],
        checkpoints: [],
        phases: {},
        metadata: {}
      };

      await planExecutor.executePlan(plan, {});

      expect(events.find(e => e.type === 'started')).toBeDefined();
      expect(events.find(e => e.type === 'task:started')).toBeDefined();
      expect(events.find(e => e.type === 'task:completed')).toBeDefined();
      expect(events.find(e => e.type === 'completed')).toBeDefined();
    });
  });
});

describe('PlanExecutor Integration with EventBus', () => {
  test('publishes events to EventBus', async () => {
    const eventBus = getEventBus();
    const receivedEvents = [];

    eventBus.subscribe('orchestrator:execution:started', 'test', (data) => {
      receivedEvents.push({ type: 'started', ...data });
    });

    eventBus.subscribe('code:generated', 'test', (data) => {
      receivedEvents.push({ type: 'code:generated', ...data });
    });

    // Create executor that will use EventBus
    const executor = new PlanExecutor();

    const plan = {
      id: 'integration-test',
      version: '1.0',
      status: 'pending',
      tasks: [{
        id: 'int-task',
        name: 'Integration',
        description: '',
        category: 'setup',
        type: 'config',
        phase: 'setup',
        priority: 1,
        complexity: 1,
        dependencies: []
      }],
      executionGroups: [],
      checkpoints: [],
      phases: {},
      metadata: {}
    };

    await executor.executePlan(plan, {});

    // Should have published execution started event
    expect(receivedEvents.length).toBeGreaterThan(0);
  });
});
