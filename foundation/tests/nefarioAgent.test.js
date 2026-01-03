/**
 * NefarioAgent Tests
 * ===================
 * Tests for the planning and execution agent.
 */

import { jest } from '@jest/globals';

// Mock OllamaAdapter
const mockAiAdapter = {
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue(),
  chat: jest.fn().mockResolvedValue(JSON.stringify({
    name: 'Test Project',
    description: 'A test project',
    tasks: [
      {
        id: 'task-1',
        name: 'Setup project',
        description: 'Initialize the project structure',
        type: 'configuration',
        category: 'setup',
        phase: 'setup',
        priority: 5,
        complexity: 2,
        dependencies: []
      },
      {
        id: 'task-2',
        name: 'Implement API',
        description: 'Build the API endpoints',
        type: 'implementation',
        category: 'backend',
        phase: 'implementation',
        priority: 4,
        complexity: 4,
        dependencies: ['task-1']
      },
      {
        id: 'task-3',
        name: 'Write tests',
        description: 'Add unit tests',
        type: 'testing',
        category: 'testing',
        phase: 'testing',
        priority: 3,
        complexity: 3,
        dependencies: ['task-2']
      }
    ],
    technologies: {
      language: 'JavaScript',
      framework: 'Express',
      database: 'PostgreSQL'
    }
  }))
};

jest.unstable_mockModule('../../agents/gru-agent/OllamaAdapter.js', () => ({
  default: jest.fn(() => mockAiAdapter)
}));

// Mock PlanExecutor
const mockPlanExecutor = {
  setCodeGenerator: jest.fn(),
  executePlan: jest.fn().mockResolvedValue({
    success: true,
    tasksCompleted: 3,
    tasksFailed: 0,
    duration: 5000
  })
};

jest.unstable_mockModule('../../agents/nefario-agent/PlanExecutor.js', () => ({
  getPlanExecutor: jest.fn(() => mockPlanExecutor),
  PlanExecutor: jest.fn()
}));

// Mock DecisionLogger
const mockDecisionLogger = {
  initialize: jest.fn().mockResolvedValue(),
  logDecision: jest.fn().mockResolvedValue('decision-123'),
  updateOutcome: jest.fn().mockResolvedValue()
};

jest.unstable_mockModule('../memory-store/DecisionLogger.js', () => ({
  getDecisionLogger: jest.fn(() => mockDecisionLogger),
  DecisionType: {
    TASK_BREAKDOWN: 'TASK_BREAKDOWN',
    PRIORITIZATION: 'PRIORITIZATION',
    STRATEGY: 'STRATEGY'
  },
  DecisionOutcome: {
    SUCCESS: 'SUCCESS',
    PARTIAL_SUCCESS: 'PARTIAL_SUCCESS',
    FAILED: 'FAILED'
  }
}));

// Import after mocks
const { NefarioAgent, getNefarioAgent, NefarioState } = await import('../../agents/nefario-agent/index.js');

describe('NefarioAgent', () => {
  let agent;

  beforeEach(async () => {
    jest.clearAllMocks();
    agent = new NefarioAgent();
  });

  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });

  describe('Initialization', () => {
    test('creates with default state', () => {
      expect(agent.state).toBe(NefarioState.IDLE);
      expect(agent.currentPlan).toBeNull();
      expect(agent.planHistory).toEqual([]);
      expect(agent.isInitialized).toBe(false);
    });

    test('accepts custom config', () => {
      const customAgent = new NefarioAgent({
        maxRetries: 5,
        ollamaConfig: { model: 'custom-model' }
      });

      expect(customAgent.config.maxRetries).toBe(5);
    });

    test('initialize sets up components', async () => {
      await agent.initialize();

      expect(mockAiAdapter.initialize).toHaveBeenCalled();
      expect(mockPlanExecutor.setCodeGenerator).toHaveBeenCalled();
      expect(mockDecisionLogger.initialize).toHaveBeenCalled();
      expect(agent.isInitialized).toBe(true);
      expect(agent.state).toBe(NefarioState.IDLE);
    });

    test('initialize emits event', async () => {
      const handler = jest.fn();
      agent.on('initialized', handler);

      await agent.initialize();

      expect(handler).toHaveBeenCalled();
    });

    test('initialize skips if already initialized', async () => {
      await agent.initialize();

      jest.clearAllMocks();

      const result = await agent.initialize();

      expect(result.success).toBe(true);
      expect(mockAiAdapter.initialize).not.toHaveBeenCalled();
    });

    test('initialize handles errors', async () => {
      mockAiAdapter.initialize.mockRejectedValueOnce(new Error('AI unavailable'));

      await expect(agent.initialize()).rejects.toThrow('AI unavailable');
      expect(agent.state).toBe(NefarioState.ERROR);
    });
  });

  describe('Singleton Pattern', () => {
    test('getInstance returns same instance', () => {
      const instance1 = NefarioAgent.getInstance();
      const instance2 = NefarioAgent.getInstance();

      expect(instance1).toBe(instance2);
    });

    test('getNefarioAgent returns singleton', () => {
      const instance1 = getNefarioAgent();
      const instance2 = getNefarioAgent();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Plan Generation', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('generatePlan creates plan from project info', async () => {
      const projectInfo = {
        name: 'My Project',
        type: 'web-app',
        description: 'A web application',
        features: ['user auth', 'dashboard']
      };

      const plan = await agent.generatePlan(projectInfo);

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^plan-\d+$/);
      expect(plan.tasks.length).toBe(3);
      expect(plan.metadata.projectName).toBe('Test Project');
      expect(agent.currentPlan).toBe(plan);
    });

    test('generatePlan emits events', async () => {
      const generatingHandler = jest.fn();
      const generatedHandler = jest.fn();

      agent.on('generating', generatingHandler);
      agent.on('plan:generated', generatedHandler);

      await agent.generatePlan({ name: 'Test' });

      expect(generatingHandler).toHaveBeenCalled();
      expect(generatedHandler).toHaveBeenCalled();
    });

    test('generatePlan logs decision', async () => {
      await agent.generatePlan({ name: 'Test' });

      expect(mockDecisionLogger.logDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'NefarioAgent'
        })
      );
    });

    test('generatePlan auto-initializes if needed', async () => {
      const freshAgent = new NefarioAgent();

      await freshAgent.generatePlan({ name: 'Test' });

      expect(freshAgent.isInitialized).toBe(true);
    });

    test('generatePlan handles AI errors', async () => {
      mockAiAdapter.chat.mockRejectedValueOnce(new Error('AI timeout'));

      await expect(agent.generatePlan({ name: 'Test' })).rejects.toThrow('AI timeout');
      expect(agent.state).toBe(NefarioState.ERROR);
    });
  });

  describe('Plan Execution', () => {
    beforeEach(async () => {
      await agent.initialize();
      await agent.generatePlan({ name: 'Test' });
    });

    test('executePlan runs the current plan', async () => {
      const result = await agent.executePlan();

      expect(mockPlanExecutor.executePlan).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.tasksCompleted).toBe(3);
    });

    test('executePlan accepts custom plan', async () => {
      const customPlan = {
        id: 'custom-plan',
        tasks: [{ id: 'task-1', name: 'Custom task' }],
        metadata: { projectName: 'Custom' }
      };

      await agent.executePlan(customPlan);

      expect(mockPlanExecutor.executePlan).toHaveBeenCalledWith(
        customPlan,
        expect.any(Object)
      );
    });

    test('executePlan throws without plan', async () => {
      agent.currentPlan = null;

      await expect(agent.executePlan()).rejects.toThrow('No plan to execute');
    });

    test('executePlan logs decision and outcome', async () => {
      await agent.executePlan();

      expect(mockDecisionLogger.logDecision).toHaveBeenCalled();
      expect(mockDecisionLogger.updateOutcome).toHaveBeenCalled();
    });

    test('executePlan emits events', async () => {
      const executingHandler = jest.fn();
      const executedHandler = jest.fn();

      agent.on('plan:executing', executingHandler);
      agent.on('plan:executed', executedHandler);

      await agent.executePlan();

      expect(executingHandler).toHaveBeenCalled();
      expect(executedHandler).toHaveBeenCalled();
    });

    test('executePlan handles execution errors', async () => {
      mockPlanExecutor.executePlan.mockRejectedValueOnce(new Error('Task failed'));

      await expect(agent.executePlan()).rejects.toThrow('Task failed');
      expect(mockDecisionLogger.updateOutcome).toHaveBeenCalled();
    });
  });

  describe('Generate and Execute', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('generateAndExecute combines both operations', async () => {
      const result = await agent.generateAndExecute({ name: 'Combined Test' });

      expect(result.plan).toBeDefined();
      expect(result.execution).toBeDefined();
      expect(result.execution.success).toBe(true);
    });
  });

  describe('Plan Refinement', () => {
    beforeEach(async () => {
      await agent.initialize();
      await agent.generatePlan({ name: 'Test' });
    });

    test('refinePlan updates existing plan', async () => {
      const originalPlan = agent.currentPlan;

      const refinedPlan = await agent.refinePlan('Add more tests');

      expect(refinedPlan).toBeDefined();
      expect(agent.planHistory).toContainEqual(expect.objectContaining({ id: originalPlan.id }));
    });

    test('refinePlan emits events', async () => {
      const refiningHandler = jest.fn();
      const refinedHandler = jest.fn();

      agent.on('refining', refiningHandler);
      agent.on('plan:refined', refinedHandler);

      await agent.refinePlan('More features');

      expect(refiningHandler).toHaveBeenCalled();
      expect(refinedHandler).toHaveBeenCalled();
    });

    test('refinePlan throws without current plan', async () => {
      agent.currentPlan = null;

      await expect(agent.refinePlan('Test')).rejects.toThrow('No plan to refine');
    });

    test('refinePlan increments version', async () => {
      agent.currentPlan.version = '1.0';

      const refined = await agent.refinePlan('Update');

      expect(refined.version).toBe('1.1');
    });
  });

  describe('Existing Project Plan', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('generatePlanForExisting handles detected structure', async () => {
      const projectInfo = {
        name: 'Existing Project',
        path: '/path/to/project',
        detectedStructure: {
          framework: ['Express', 'React'],
          language: ['JavaScript'],
          components: [{ name: 'api', type: 'backend', path: '/api' }]
        },
        goals: ['Add authentication'],
        gaps: ['Missing tests']
      };

      const plan = await agent.generatePlanForExisting(projectInfo);

      expect(plan).toBeDefined();
      expect(mockAiAdapter.chat).toHaveBeenCalled();
    });
  });

  describe('Task Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('normalizes task priorities to 1-5 range', async () => {
      mockAiAdapter.chat.mockResolvedValueOnce(JSON.stringify({
        name: 'Test',
        tasks: [
          { id: 'task-1', name: 'Test', priority: 10, complexity: 0 }
        ]
      }));

      const plan = await agent.generatePlan({ name: 'Test' });

      // Priority capped at 5, complexity min is 1
      expect(plan.tasks[0].priority).toBe(5);
      expect(plan.tasks[0].complexity).toBeGreaterThanOrEqual(1);
    });

    test('assigns agents based on category', async () => {
      mockAiAdapter.chat.mockResolvedValueOnce(JSON.stringify({
        name: 'Test',
        tasks: [
          { id: 'task-1', name: 'Test', category: 'testing' },
          { id: 'task-2', name: 'API', category: 'backend' }
        ]
      }));

      const plan = await agent.generatePlan({ name: 'Test' });

      expect(plan.tasks[0].agent).toBe('tester-agent');
      expect(plan.tasks[1].agent).toBe('backend-agent');
    });

    test('handles text response without JSON', async () => {
      mockAiAdapter.chat.mockResolvedValueOnce(`
        1. Setup the project
        2. Build the API
        3. Add tests
      `);

      const plan = await agent.generatePlan({ name: 'Test' });

      expect(plan.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Plan Structure', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('generates execution groups by phase', async () => {
      const plan = await agent.generatePlan({ name: 'Test' });

      expect(plan.executionGroups.length).toBeGreaterThan(0);
      expect(plan.executionGroups[0]).toHaveProperty('phase');
      expect(plan.executionGroups[0]).toHaveProperty('tasks');
    });

    test('builds dependency graph', async () => {
      const plan = await agent.generatePlan({ name: 'Test' });

      expect(plan.dependencyGraph).toBeDefined();
      expect(plan.dependencyGraph['task-2']).toHaveProperty('dependencies');
      expect(plan.dependencyGraph['task-2'].dependencies).toContain('task-1');
    });

    test('generates checkpoints', async () => {
      const plan = await agent.generatePlan({ name: 'Test' });

      expect(plan.checkpoints.length).toBeGreaterThan(0);
      expect(plan.checkpoints[plan.checkpoints.length - 1].type).toBe('final');
    });

    test('organizes tasks by phase', async () => {
      const plan = await agent.generatePlan({ name: 'Test' });

      expect(plan.phases).toHaveProperty('setup');
      expect(plan.phases).toHaveProperty('implementation');
      expect(plan.phases).toHaveProperty('testing');
      expect(plan.phases).toHaveProperty('deployment');
    });
  });

  describe('Category and Phase Inference', () => {
    test('infers category from task name', () => {
      expect(agent._inferCategory('Write unit tests')).toBe('testing');
      expect(agent._inferCategory('Setup dependencies')).toBe('setup');
      expect(agent._inferCategory('Build frontend component')).toBe('frontend');
      expect(agent._inferCategory('Create API endpoint')).toBe('backend');
      expect(agent._inferCategory('Design database schema')).toBe('database');
      expect(agent._inferCategory('Add documentation')).toBe('documentation');
      expect(agent._inferCategory('Deploy to production')).toBe('deployment');
      expect(agent._inferCategory('Implement authentication')).toBe('security');
    });

    test('infers phase from task name', () => {
      expect(agent._inferPhase('Setup project')).toBe('setup');
      expect(agent._inferPhase('Write tests')).toBe('testing');
      expect(agent._inferPhase('Deploy application')).toBe('deployment');
      // 'build' matches deployment pattern, so use different word for implementation
      expect(agent._inferPhase('Create feature')).toBe('implementation');
    });
  });

  describe('Readable Summary', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('creates human-readable summary', async () => {
      const plan = await agent.generatePlan({ name: 'Test Project' });

      const summary = agent.createReadableSummary(plan);

      expect(summary).toContain('Project:');
      expect(summary).toContain('Tasks:');
    });

    test('handles null plan', () => {
      const summary = agent.createReadableSummary(null);

      expect(summary).toBe('No plan available.');
    });

    test('includes technology info', async () => {
      const plan = await agent.generatePlan({ name: 'Test' });

      const summary = agent.createReadableSummary(plan);

      expect(summary).toContain('Technologies:');
    });
  });

  describe('State Management', () => {
    test('getState returns current state', () => {
      expect(agent.getState()).toBe(NefarioState.IDLE);
    });

    test('getCurrentPlan returns current plan', async () => {
      await agent.initialize();
      await agent.generatePlan({ name: 'Test' });

      expect(agent.getCurrentPlan()).toBe(agent.currentPlan);
    });

    test('getPlanHistory returns history', async () => {
      await agent.initialize();
      await agent.generatePlan({ name: 'Test' });
      await agent.refinePlan('Update');

      const history = agent.getPlanHistory();

      expect(history.length).toBe(1);
    });

    test('reset clears state', async () => {
      await agent.initialize();
      await agent.generatePlan({ name: 'Test' });

      agent.reset();

      expect(agent.state).toBe(NefarioState.IDLE);
      expect(agent.currentPlan).toBeNull();
    });

    test('reset emits event', () => {
      const handler = jest.fn();
      agent.on('reset', handler);

      agent.reset();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('PlanExecutor Access', () => {
    test('getPlanExecutor returns executor instance', async () => {
      await agent.initialize();

      const executor = agent.getPlanExecutor();

      expect(executor).toBe(mockPlanExecutor);
    });
  });

  describe('Shutdown', () => {
    test('shutdown cleans up resources', async () => {
      await agent.initialize();
      await agent.generatePlan({ name: 'Test' });

      await agent.shutdown();

      expect(mockAiAdapter.shutdown).toHaveBeenCalled();
      expect(agent.isInitialized).toBe(false);
      expect(agent.currentPlan).toBeNull();
    });
  });

  describe('States', () => {
    test('NefarioState has all states', () => {
      expect(NefarioState.IDLE).toBe('idle');
      expect(NefarioState.INITIALIZING).toBe('initializing');
      expect(NefarioState.GENERATING).toBe('generating');
      expect(NefarioState.REFINING).toBe('refining');
      expect(NefarioState.COMPLETE).toBe('complete');
      expect(NefarioState.ERROR).toBe('error');
    });
  });
});
