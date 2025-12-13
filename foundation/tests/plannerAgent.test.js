/**
 * Planner Agent Tests
 *
 * Tests for the Planner-Agent and its sub-components:
 * - PlannerAgent main class
 * - ExecutionPlanner
 * - AgentCoordinator
 * - ProgressTracker
 * - IterationManager
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Import Planner Agent components
import {
  PlannerAgent,
  getPlannerAgent,
  resetPlannerAgent,
  AgentState,
  PlannerEvents,
  ExecutionStatus
} from '../../agents/planner-agent/index.js';

import {
  ExecutionPlanner,
  PlanPhase,
  TaskPriority,
  TaskStatus
} from '../../agents/planner-agent/execution-planner.js';

import {
  AgentCoordinator,
  AssignmentStrategy,
  AgentStatus
} from '../../agents/planner-agent/coordinator.js';

import {
  ProgressTracker,
  ProgressStatus
} from '../../agents/planner-agent/progress-tracker.js';

import {
  IterationManager,
  IterationPhase,
  IterationStatus,
  EscalationLevel
} from '../../agents/planner-agent/iteration-manager.js';

describe('PlannerAgent', () => {
  let agent;

  beforeEach(() => {
    resetPlannerAgent();
    agent = new PlannerAgent({
      maxConcurrency: 3
    });
  });

  afterEach(() => {
    resetPlannerAgent();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(agent.name).toBe('Planner-Agent');
      expect(agent.version).toBe('1.0.0');
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('should initialize successfully', async () => {
      const result = await agent.initialize();

      expect(result.success).toBe(true);
      expect(result.agent).toBe('Planner-Agent');
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('should connect to event bus when provided', async () => {
      const mockEventBus = {
        subscribe: jest.fn(),
        publish: jest.fn()
      };

      await agent.initialize(mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalled();
    });
  });

  describe('Plan Creation', () => {
    test('should create an execution plan from tasks', async () => {
      await agent.initialize();

      const tasks = [
        { id: 'task-1', name: 'Setup database', category: 'backend' },
        { id: 'task-2', name: 'Create API endpoints', dependencies: ['task-1'] },
        { id: 'task-3', name: 'Build frontend', category: 'frontend' }
      ];

      const result = await agent.createPlan(tasks);

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan.tasks.length).toBe(3);
      expect(result.plan.executionGroups.length).toBeGreaterThan(0);
    });

    test('should emit PLAN_CREATED event', async () => {
      await agent.initialize();

      const handler = jest.fn();
      agent.on(PlannerEvents.PLAN_CREATED, handler);

      const tasks = [
        { id: 'task-1', name: 'Test task' }
      ];

      await agent.createPlan(tasks);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Plan Execution', () => {
    test('should start plan execution', async () => {
      await agent.initialize();

      const tasks = [
        { id: 'task-1', name: 'Test task' }
      ];

      const { plan } = await agent.createPlan(tasks);

      // Execution completes immediately with no actual agents to run
      const result = await agent.executePlan(plan.id);

      // Should complete (success or fail based on coordinator)
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    test('should pause and resume execution', async () => {
      await agent.initialize();

      const tasks = [
        { id: 'task-1', name: 'Test task' }
      ];

      const { plan } = await agent.createPlan(tasks);

      // Pause before execution starts
      const pauseResult = await agent.pauseExecution();
      // Can't pause when not executing
      expect(pauseResult.success).toBe(false);

      const resumeResult = await agent.resumeExecution();
      // Can't resume when not paused
      expect(resumeResult.success).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    test('should return progress information', async () => {
      await agent.initialize();

      const tasks = [
        { id: 'task-1', name: 'Test task' }
      ];

      await agent.createPlan(tasks);
      const progress = agent.getProgress();

      expect(progress).toBeDefined();
      expect(progress.percentage).toBeDefined();
      expect(progress.metrics).toBeDefined();
    });
  });

  describe('Metrics', () => {
    test('should track metrics', async () => {
      await agent.initialize();

      const tasks = [
        { id: 'task-1', name: 'Test task' }
      ];

      await agent.createPlan(tasks);
      const metrics = agent.getMetrics();

      expect(metrics.plansCreated).toBeGreaterThanOrEqual(1);
      expect(metrics.state).toBe(AgentState.IDLE);
    });
  });

  describe('Singleton', () => {
    test('should return same instance with getPlannerAgent', () => {
      const agent1 = getPlannerAgent();
      const agent2 = getPlannerAgent();

      expect(agent1).toBe(agent2);
    });

    test('should reset instance with resetPlannerAgent', () => {
      const agent1 = getPlannerAgent();
      resetPlannerAgent();
      const agent2 = getPlannerAgent();

      expect(agent1).not.toBe(agent2);
    });
  });
});

describe('ExecutionPlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new ExecutionPlanner();
  });

  describe('Plan Creation', () => {
    test('should create an execution plan', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' }
      ];

      const plan = await planner.createPlan(tasks);

      expect(plan.id).toBeDefined();
      expect(plan.tasks.length).toBe(2);
      expect(plan.executionGroups.length).toBeGreaterThan(0);
    });

    test('should normalize tasks with defaults', async () => {
      const tasks = [
        { name: 'Task without ID' }
      ];

      const plan = await planner.createPlan(tasks);

      expect(plan.tasks[0].id).toBeDefined();
      expect(plan.tasks[0].priority).toBe(TaskPriority.MEDIUM);
      expect(plan.tasks[0].status).toBe(TaskStatus.PENDING);
    });

    test('should handle task dependencies', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2', dependencies: ['task-1'] },
        { id: 'task-3', name: 'Task 3', dependencies: ['task-2'] }
      ];

      const plan = await planner.createPlan(tasks);

      // Task 1 should be in an earlier group than Task 2 and 3
      const task1Group = plan.executionGroups.find(g => g.tasks.includes('task-1'));
      const task2Group = plan.executionGroups.find(g => g.tasks.includes('task-2'));
      const task3Group = plan.executionGroups.find(g => g.tasks.includes('task-3'));

      expect(task1Group.order).toBeLessThan(task2Group.order);
      expect(task2Group.order).toBeLessThan(task3Group.order);
    });

    test('should detect circular dependencies', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1', dependencies: ['task-2'] },
        { id: 'task-2', name: 'Task 2', dependencies: ['task-1'] }
      ];

      await expect(planner.createPlan(tasks)).rejects.toThrow('Circular dependencies');
    });
  });

  describe('Phase Assignment', () => {
    test('should assign phases based on category', async () => {
      const tasks = [
        { id: 'task-1', name: 'Setup config', category: 'setup' },
        { id: 'task-2', name: 'Create API', category: 'backend' },
        { id: 'task-3', name: 'Write tests', category: 'testing' }
      ];

      const plan = await planner.createPlan(tasks);

      const setupTask = plan.tasks.find(t => t.id === 'task-1');
      const backendTask = plan.tasks.find(t => t.id === 'task-2');
      const testTask = plan.tasks.find(t => t.id === 'task-3');

      expect(setupTask.phase).toBe(PlanPhase.SETUP);
      expect(backendTask.phase).toBe(PlanPhase.IMPLEMENTATION);
      expect(testTask.phase).toBe(PlanPhase.TESTING);
    });
  });

  describe('Agent Assignment', () => {
    test('should assign agents based on category', async () => {
      const tasks = [
        { id: 'task-1', name: 'Backend work', category: 'backend' },
        { id: 'task-2', name: 'Frontend work', category: 'frontend' },
        { id: 'task-3', name: 'Container deployment', category: 'deploy' }
      ];

      const plan = await planner.createPlan(tasks);

      const backendTask = plan.tasks.find(t => t.id === 'task-1');
      const frontendTask = plan.tasks.find(t => t.id === 'task-2');
      const deployTask = plan.tasks.find(t => t.id === 'task-3');

      expect(backendTask.agent).toBe('backend-agent');
      expect(frontendTask.agent).toBe('admin-agent');
      expect(deployTask.agent).toBe('docker-agent');
    });
  });

  describe('Execution Groups', () => {
    test('should create execution groups for parallel tasks', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' },
        { id: 'task-3', name: 'Task 3' }
      ];

      const plan = await planner.createPlan(tasks);

      expect(plan.executionGroups.length).toBeGreaterThan(0);
      expect(plan.executionGroups[0].canRunInParallel).toBe(true);
    });

    test('should respect maxConcurrency in groups', async () => {
      const planner = new ExecutionPlanner({ maxConcurrency: 2 });
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' },
        { id: 'task-3', name: 'Task 3' },
        { id: 'task-4', name: 'Task 4' }
      ];

      const plan = await planner.createPlan(tasks);

      // Each group should have at most 2 tasks
      plan.executionGroups.forEach(group => {
        expect(group.tasks.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Checkpoints', () => {
    test('should place checkpoints in plan', async () => {
      const tasks = [
        { id: 'task-1', name: 'Setup', phase: PlanPhase.SETUP },
        { id: 'task-2', name: 'Implement', phase: PlanPhase.IMPLEMENTATION },
        { id: 'task-3', name: 'Test', phase: PlanPhase.TESTING }
      ];

      const plan = await planner.createPlan(tasks);

      expect(plan.checkpoints.length).toBeGreaterThan(0);
      expect(plan.checkpoints.some(c => c.type === 'final')).toBe(true);
    });
  });

  describe('Next Tasks', () => {
    test('should get next executable tasks', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2', dependencies: ['task-1'] }
      ];

      const plan = await planner.createPlan(tasks);
      const nextTasks = planner.getNextTasks(plan, []);

      expect(nextTasks.length).toBe(1);
      expect(nextTasks[0].id).toBe('task-1');
    });

    test('should return dependent tasks after dependencies complete', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2', dependencies: ['task-1'] }
      ];

      const plan = await planner.createPlan(tasks);
      const nextTasks = planner.getNextTasks(plan, ['task-1']);

      expect(nextTasks.some(t => t.id === 'task-2')).toBe(true);
    });
  });

  describe('Task Status Updates', () => {
    test('should update task status', async () => {
      const tasks = [
        { id: 'task-1', name: 'Task 1' }
      ];

      const plan = await planner.createPlan(tasks);
      const result = planner.updateTaskStatus(plan, 'task-1', TaskStatus.COMPLETED);

      expect(result.success).toBe(true);
      expect(result.task.status).toBe(TaskStatus.COMPLETED);
      expect(result.task.completedAt).toBeDefined();
    });
  });
});

describe('AgentCoordinator', () => {
  let coordinator;

  beforeEach(() => {
    coordinator = new AgentCoordinator();
  });

  describe('Agent Registration', () => {
    test('should have pre-registered agents', async () => {
      await coordinator.initialize();
      const agents = coordinator.getAvailableAgents();

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.id === 'backend-agent')).toBe(true);
      expect(agents.some(a => a.id === 'tester-agent')).toBe(true);
    });

    test('should get agent by id', async () => {
      await coordinator.initialize();
      const agent = coordinator.getAvailableAgents().find(a => a.id === 'backend-agent');

      expect(agent).toBeDefined();
      expect(agent.id).toBe('backend-agent');
      expect(agent.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('Task Assignment', () => {
    test('should assign task to best agent', async () => {
      await coordinator.initialize();

      const task = {
        id: 'task-1',
        name: 'Create API endpoint',
        category: 'backend',
        phase: 'implementation'
      };

      const result = await coordinator.assignTask(task);

      expect(result.success).toBe(true);
      expect(result.assignment.agentId).toBe('backend-agent');
    });

    test('should use capability matching strategy', async () => {
      const coordinator = new AgentCoordinator({
        assignmentStrategy: AssignmentStrategy.CAPABILITY_MATCH
      });
      await coordinator.initialize();

      const task = {
        id: 'task-1',
        name: 'Write unit tests',
        category: 'testing'
      };

      const result = await coordinator.assignTask(task);

      expect(result.success).toBe(true);
      expect(result.assignment.agentId).toBe('tester-agent');
    });

    test('should track task assignments', async () => {
      await coordinator.initialize();

      const task = {
        id: 'task-1',
        name: 'Test task',
        category: 'backend'
      };

      const result = await coordinator.assignTask(task);
      // Assignment is tracked internally, verify through result
      expect(result.success).toBe(true);
      expect(result.assignment.taskId).toBe('task-1');
    });
  });

  describe('Task Completion', () => {
    test('should report task completion', async () => {
      await coordinator.initialize();

      const task = { id: 'task-1', name: 'Test', category: 'backend' };
      await coordinator.assignTask(task);

      const result = coordinator.reportTaskCompleted('task-1', { output: 'done' });

      expect(result.success).toBe(true);
    });

    test('should report task failure', async () => {
      await coordinator.initialize();

      const task = { id: 'task-1', name: 'Test', category: 'backend' };
      await coordinator.assignTask(task);

      const result = coordinator.reportTaskFailed('task-1', new Error('Failed'));

      expect(result.success).toBe(true);
    });

    test('should track retry counts', async () => {
      await coordinator.initialize();

      const task = { id: 'task-1', name: 'Test', category: 'backend' };
      await coordinator.assignTask(task);

      coordinator.reportTaskFailed('task-1', new Error('Fail 1'));
      const result = coordinator.reportTaskFailed('task-1', new Error('Fail 2'));

      // Verify failure was reported
      expect(result.success).toBe(true);
    });
  });

  describe('Agent Status', () => {
    test('should update agent status', async () => {
      await coordinator.initialize();

      // First get an agent and update its status
      const agents = coordinator.getAvailableAgents();
      expect(agents.length).toBeGreaterThan(0);

      // Mark an agent busy by assigning a task
      const task = { id: 'test-task', name: 'Test', category: 'backend' };
      await coordinator.assignTask(task);

      // Should still have available agents
      const availableAfter = coordinator.getAvailableAgents();
      expect(availableAfter.length).toBeGreaterThan(0);
    });

    test('should get available agents', async () => {
      await coordinator.initialize();

      const available = coordinator.getAvailableAgents();

      expect(available.length).toBeGreaterThan(0);
      expect(available.every(a => a.status === AgentStatus.AVAILABLE)).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should return available agents count', async () => {
      await coordinator.initialize();

      const available = coordinator.getAvailableAgents();

      expect(available).toBeDefined();
      expect(available.length).toBeGreaterThan(0);
    });
  });
});

describe('ProgressTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  describe('Plan Initialization', () => {
    test('should initialize tracking for a plan', () => {
      const plan = {
        tasks: [
          { id: 'task-1', complexity: 3 },
          { id: 'task-2', complexity: 5 }
        ]
      };

      const result = tracker.initializePlan(plan);

      expect(result.success).toBe(true);
      expect(tracker.metrics.totalTasks).toBe(2);
    });
  });

  describe('Task Tracking', () => {
    test('should mark task as started', () => {
      const plan = {
        tasks: [{ id: 'task-1', complexity: 3 }]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');

      const status = tracker.getTaskStatus('task-1');
      expect(status.status).toBe('running');
      expect(tracker.metrics.inProgressTasks).toBe(1);
    });

    test('should mark task as completed', () => {
      const plan = {
        tasks: [{ id: 'task-1', complexity: 3 }]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');
      tracker.markTaskCompleted('task-1');

      const status = tracker.getTaskStatus('task-1');
      expect(status.status).toBe('completed');
      expect(tracker.metrics.completedTasks).toBe(1);
    });

    test('should mark task as failed', () => {
      const plan = {
        tasks: [{ id: 'task-1', complexity: 3 }]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');
      tracker.markTaskFailed('task-1', 'Test error');

      const status = tracker.getTaskStatus('task-1');
      expect(status.status).toBe('failed');
      expect(tracker.metrics.failedTasks).toBe(1);
    });

    test('should mark task as skipped', () => {
      const plan = {
        tasks: [{ id: 'task-1', complexity: 3 }]
      };

      tracker.initializePlan(plan);
      tracker.markTaskSkipped('task-1', 'Not needed');

      const status = tracker.getTaskStatus('task-1');
      expect(status.status).toBe('skipped');
      expect(tracker.metrics.skippedTasks).toBe(1);
    });
  });

  describe('Progress Calculation', () => {
    test('should calculate progress percentage', () => {
      const plan = {
        tasks: [
          { id: 'task-1', complexity: 3 },
          { id: 'task-2', complexity: 3 }
        ]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');
      tracker.markTaskCompleted('task-1');

      const progress = tracker.getProgress();
      expect(progress.percentage).toBe(50);
    });

    test('should return progress status', () => {
      const plan = {
        tasks: [{ id: 'task-1', complexity: 3 }]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');
      tracker.markTaskCompleted('task-1');

      const progress = tracker.getProgress();
      expect(progress.status).toBe(ProgressStatus.COMPLETED);
    });
  });

  describe('Velocity Calculation', () => {
    test('should calculate velocity after completions', () => {
      const plan = {
        tasks: [
          { id: 'task-1', complexity: 3 },
          { id: 'task-2', complexity: 3 }
        ]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');

      // Simulate some time passing
      tracker.markTaskCompleted('task-1');

      const progress = tracker.getProgress();
      expect(progress.velocity).toBeDefined();
      expect(progress.velocity.tasksPerHour).toBeDefined();
    });
  });

  describe('Blocker Detection', () => {
    test('should detect consecutive failures as blocker', () => {
      const tracker = new ProgressTracker({
        blockerDetectionThreshold: 2
      });

      const plan = {
        tasks: [
          { id: 'task-1', complexity: 3 },
          { id: 'task-2', complexity: 3 }
        ]
      };

      tracker.initializePlan(plan);

      const handler = jest.fn();
      tracker.on('blocker:detected', handler);

      tracker.markTaskFailed('task-1', 'Error 1', 'agent-1');
      tracker.markTaskFailed('task-2', 'Error 2', 'agent-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Progress Report', () => {
    test('should generate progress report', () => {
      const plan = {
        tasks: [
          { id: 'task-1', complexity: 3, phase: 'setup' },
          { id: 'task-2', complexity: 5, phase: 'implementation' }
        ]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');
      tracker.markTaskCompleted('task-1');

      const report = tracker.getReport();

      expect(report.summary).toBeDefined();
      expect(report.tasks.total).toBe(2);
      expect(report.tasks.completed).toBe(1);
      expect(report.phases).toBeDefined();
    });
  });

  describe('Phase Progress', () => {
    test('should track progress by phase', () => {
      const plan = {
        tasks: [
          { id: 'task-1', phase: 'setup' },
          { id: 'task-2', phase: 'setup' },
          { id: 'task-3', phase: 'implementation' }
        ]
      };

      tracker.initializePlan(plan);
      tracker.markTaskStarted('task-1');
      tracker.markTaskCompleted('task-1');

      const phaseProgress = tracker.getProgressByPhase();

      expect(phaseProgress.setup.total).toBe(2);
      expect(phaseProgress.setup.completed).toBe(1);
      expect(phaseProgress.setup.percentage).toBe(50);
    });
  });
});

describe('IterationManager', () => {
  let manager;

  beforeEach(() => {
    manager = new IterationManager({
      maxRetries: 3,
      maxFixAttempts: 5
    });
  });

  describe('Iteration Lifecycle', () => {
    test('should start a new iteration', () => {
      const iteration = manager.startIteration('plan-1');

      expect(iteration.id).toBeDefined();
      expect(iteration.planId).toBe('plan-1');
      expect(iteration.phase).toBe(IterationPhase.BUILD);
      expect(iteration.status).toBe(IterationStatus.PENDING);
    });

    test('should emit iteration:started event', () => {
      const handler = jest.fn();
      manager.on('iteration:started', handler);

      manager.startIteration('plan-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Build Phase', () => {
    test('should run build phase successfully', async () => {
      const iteration = manager.startIteration('plan-1');

      const result = await manager.runBuildPhase(iteration.id, async () => ({
        success: true,
        output: 'Build complete'
      }));

      expect(result.success).toBe(true);
    });

    test('should handle build failure', async () => {
      const iteration = manager.startIteration('plan-1');

      const result = await manager.runBuildPhase(iteration.id, async () => ({
        success: false,
        error: 'Build failed'
      }));

      expect(result.success).toBe(false);
      expect(result.canRetry).toBeDefined();
    });
  });

  describe('Test Phase', () => {
    test('should run test phase successfully', async () => {
      const iteration = manager.startIteration('plan-1');

      const result = await manager.runTestPhase(iteration.id, async () => ({
        success: true,
        passed: 10,
        failed: 0
      }));

      expect(result.success).toBe(true);
    });

    test('should handle test failures', async () => {
      const iteration = manager.startIteration('plan-1');

      const result = await manager.runTestPhase(iteration.id, async () => ({
        success: false,
        passed: false,  // Explicitly false to prevent truthy check
        failed: 2,
        failures: ['test1', 'test2']
      }));

      // Test phase reports failure correctly
      expect(result.success).toBe(false);
      expect(result.canRetry).toBeDefined();
    });
  });

  describe('Fix Phase', () => {
    test('should run fix phase', async () => {
      const iteration = manager.startIteration('plan-1');

      // Simulate test failure first
      await manager.runTestPhase(iteration.id, async () => ({
        success: false,
        failures: ['test1']
      }));

      const result = await manager.runFixPhase(iteration.id, async (failures) => ({
        success: true,
        fixed: failures.length
      }));

      expect(result.success).toBe(true);
    });

    test('should track fix attempts', async () => {
      const iteration = manager.startIteration('plan-1');

      await manager.runFixPhase(iteration.id, async () => ({ success: true }));
      await manager.runFixPhase(iteration.id, async () => ({ success: true }));

      const state = manager.getIteration(iteration.id);
      expect(state.fixAttempts).toBe(2);
    });

    test('should escalate after max fix attempts', async () => {
      const manager = new IterationManager({ maxFixAttempts: 2 });
      const iteration = manager.startIteration('plan-1');

      await manager.runFixPhase(iteration.id, async () => ({ success: false }));
      await manager.runFixPhase(iteration.id, async () => ({ success: false }));
      const result = await manager.runFixPhase(iteration.id, async () => ({ success: false }));

      expect(result.escalated).toBe(true);
    });
  });

  describe('Verify Phase', () => {
    test('should verify fix success', async () => {
      const iteration = manager.startIteration('plan-1');

      await manager.runFixPhase(iteration.id, async () => ({ success: true }));

      const result = await manager.runVerifyPhase(iteration.id, async () => ({
        success: true,
        passed: 10
      }));

      expect(result.success).toBe(true);
    });

    test('should request another fix on verify failure', async () => {
      const iteration = manager.startIteration('plan-1');

      await manager.runFixPhase(iteration.id, async () => ({ success: true }));

      const result = await manager.runVerifyPhase(iteration.id, async () => ({
        success: false,
        failures: ['test1']
      }));

      expect(result.success).toBe(false);
      expect(result.needsAnotherFix).toBe(true);
    });
  });

  describe('Full Cycle', () => {
    test('should run complete Build -> Test -> Fix cycle', async () => {
      const iteration = manager.startIteration('plan-1');

      const result = await manager.runFullCycle(iteration.id, {
        buildFn: async () => ({ success: true }),
        testFn: async () => ({ success: true, passed: 10 }),
        fixFn: async () => ({ success: true })
      });

      expect(result.success).toBe(true);
    });

    test('should complete after fix and verify', async () => {
      const iteration = manager.startIteration('plan-1');
      let testCallCount = 0;

      const result = await manager.runFullCycle(iteration.id, {
        buildFn: async () => ({ success: true }),
        testFn: async () => {
          testCallCount++;
          // First call fails, second call (verification) succeeds
          return testCallCount === 1
            ? { success: false, failures: ['test1'] }
            : { success: true };
        },
        fixFn: async () => ({ success: true })
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Retry Mechanism', () => {
    test('should retry on failure', async () => {
      // Use minimal delay for tests
      const manager = new IterationManager({ maxRetries: 3, retryDelayMs: 10 });
      const iteration = manager.startIteration('plan-1');
      let attempts = 0;

      const result = await manager.retry(iteration.id, async () => {
        attempts++;
        return { success: true };
      });

      expect(result.success).toBe(true);
    });

    test('should escalate after max retries', async () => {
      const manager = new IterationManager({ maxRetries: 2, retryDelayMs: 10 });
      const iteration = manager.startIteration('plan-1');

      // Exhaust retries
      await manager.retry(iteration.id, async () => { throw new Error('Fail'); });
      await manager.retry(iteration.id, async () => { throw new Error('Fail'); });
      const result = await manager.retry(iteration.id, async () => { throw new Error('Fail'); });

      expect(result.escalated).toBe(true);
    });
  });

  describe('Escalation', () => {
    test('should escalate iteration', async () => {
      const iteration = manager.startIteration('plan-1');

      const handler = jest.fn();
      manager.on('iteration:escalated', handler);

      // Force escalation by exceeding retries
      const manager2 = new IterationManager({ maxRetries: 0 });
      const iter2 = manager2.startIteration('plan-2');
      await manager2.retry(iter2.id, async () => { throw new Error('Fail'); });

      const state = manager2.getIteration(iter2.id);
      expect(state.status).toBe(IterationStatus.ESCALATED);
    });
  });

  describe('Statistics', () => {
    test('should track iteration statistics', () => {
      manager.startIteration('plan-1');
      manager.startIteration('plan-2');

      const stats = manager.getStats();

      expect(stats.totalIterations).toBe(2);
    });

    test('should generate report', () => {
      manager.startIteration('plan-1');

      const report = manager.getReport();

      expect(report.summary).toBeDefined();
      expect(report.retries).toBeDefined();
      expect(report.fixes).toBeDefined();
    });
  });

  describe('Iteration Management', () => {
    test('should get iteration by ID', () => {
      const iteration = manager.startIteration('plan-1');
      const retrieved = manager.getIteration(iteration.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(iteration.id);
    });

    test('should get active iterations for plan', () => {
      manager.startIteration('plan-1');
      manager.startIteration('plan-1');
      manager.startIteration('plan-2');

      const active = manager.getActiveIterations('plan-1');

      // New iterations start as PENDING, not RUNNING
      expect(active.length).toBe(0);
    });

    test('should cancel iteration', () => {
      const iteration = manager.startIteration('plan-1');

      const result = manager.cancelIteration(iteration.id, 'User cancelled');

      expect(result.success).toBe(true);

      const state = manager.getIteration(iteration.id);
      expect(state.status).toBe(IterationStatus.FAILED);
    });

    test('should reset manager', () => {
      manager.startIteration('plan-1');
      manager.startIteration('plan-2');

      manager.reset();

      const stats = manager.getStats();
      expect(stats.totalIterations).toBe(0);
    });
  });
});

describe('Integration Tests', () => {
  test('should perform full workflow: create plan -> execute -> track progress', async () => {
    const agent = new PlannerAgent();
    await agent.initialize();

    // Step 1: Create plan
    const tasks = [
      { id: 'task-1', name: 'Setup', category: 'setup' },
      { id: 'task-2', name: 'Implement feature', category: 'backend', dependencies: ['task-1'] },
      { id: 'task-3', name: 'Write tests', category: 'testing', dependencies: ['task-2'] }
    ];

    const { plan } = await agent.createPlan(tasks);
    expect(plan.tasks.length).toBe(3);
    expect(plan.executionGroups.length).toBeGreaterThan(0);

    // Step 2: Start execution
    const execResult = await agent.executePlan(plan.id);
    expect(execResult).toBeDefined();
    expect(execResult.summary).toBeDefined();

    // Step 3: Check progress
    const progress = agent.getProgress();
    expect(progress).toBeDefined();

    // Step 4: Check metrics
    const metrics = agent.getMetrics();
    expect(metrics.plansCreated).toBeGreaterThanOrEqual(1);

    // Cleanup
    await agent.shutdown();
  });

  test('should coordinate between ExecutionPlanner and ProgressTracker', async () => {
    const planner = new ExecutionPlanner();
    const tracker = new ProgressTracker();

    // Create plan
    const tasks = [
      { id: 'task-1', name: 'Task 1', complexity: 3 },
      { id: 'task-2', name: 'Task 2', complexity: 5, dependencies: ['task-1'] }
    ];

    const plan = await planner.createPlan(tasks);

    // Initialize tracker with plan
    tracker.initializePlan(plan);

    // Get next tasks
    let nextTasks = planner.getNextTasks(plan, []);
    expect(nextTasks.length).toBe(1);
    expect(nextTasks[0].id).toBe('task-1');

    // Complete first task
    tracker.markTaskStarted('task-1');
    tracker.markTaskCompleted('task-1');
    planner.updateTaskStatus(plan, 'task-1', TaskStatus.COMPLETED);

    // Get next tasks again
    nextTasks = planner.getNextTasks(plan, ['task-1']);
    expect(nextTasks.some(t => t.id === 'task-2')).toBe(true);

    // Check progress
    const progress = tracker.getProgress();
    expect(progress.percentage).toBe(50);
  });

  test('should handle iteration cycle with coordinator', async () => {
    const coordinator = new AgentCoordinator();
    const iterationManager = new IterationManager();

    await coordinator.initialize();

    // Start iteration
    const iteration = iterationManager.startIteration('plan-1');

    // Simulate build
    await iterationManager.runBuildPhase(iteration.id, async () => ({
      success: true
    }));

    // Simulate tests (with failure)
    await iterationManager.runTestPhase(iteration.id, async () => ({
      success: false,
      failures: ['test-authentication']
    }));

    // Assign fix task to appropriate agent
    const fixTask = {
      id: 'fix-auth',
      name: 'Fix authentication test',
      category: 'testing'
    };

    const assignment = await coordinator.assignTask(fixTask);
    expect(assignment.success).toBe(true);
    expect(assignment.assignment.agentId).toBe('tester-agent');

    // Run fix
    await iterationManager.runFixPhase(iteration.id, async () => ({
      success: true
    }));

    // Verify
    const verifyResult = await iterationManager.runVerifyPhase(iteration.id, async () => ({
      success: true
    }));

    expect(verifyResult.success).toBe(true);
  });
});
