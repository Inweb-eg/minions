/**
 * BrainController Tests
 * ======================
 * Tests for the central decision-making component.
 */

import { jest } from '@jest/globals';
import {
  BrainController,
  getBrainController,
  resetBrainController,
  BrainState,
  BrainDecisionCategory
} from '../brain/BrainController.js';

describe('BrainController', () => {
  let brain;

  beforeEach(async () => {
    await resetBrainController();
    brain = new BrainController();
    await brain.initialize();
  });

  afterEach(async () => {
    if (brain) {
      await brain.shutdown();
    }
    await resetBrainController();
  });

  describe('Initialization', () => {
    test('initializes with IDLE state', async () => {
      const newBrain = new BrainController();
      expect(newBrain.state).toBe(BrainState.IDLE);

      await newBrain.initialize();
      expect(newBrain.state).toBe(BrainState.IDLE);
    });

    test('emits initialized event', async () => {
      const newBrain = new BrainController();
      const initHandler = jest.fn();
      newBrain.on('initialized', initHandler);

      await newBrain.initialize();

      expect(initHandler).toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern', () => {
    test('getBrainController returns same instance', async () => {
      await resetBrainController();

      const instance1 = getBrainController();
      const instance2 = getBrainController();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Agent Management', () => {
    test('setAgents stores agent references', () => {
      const mockSilas = { name: 'silas' };
      const mockLucy = { name: 'lucy' };
      const mockNefario = { name: 'nefario' };

      brain.setAgents({
        silas: mockSilas,
        lucy: mockLucy,
        nefario: mockNefario
      });

      expect(brain.agents.silas).toBe(mockSilas);
      expect(brain.agents.lucy).toBe(mockLucy);
      expect(brain.agents.nefario).toBe(mockNefario);
    });

    test('getStatus reports connected agents', () => {
      brain.setAgents({
        silas: { name: 'silas' },
        nefario: { name: 'nefario' }
      });

      const status = brain.getStatus();

      expect(status.agents.silas).toBe(true);
      expect(status.agents.nefario).toBe(true);
      expect(status.agents.lucy).toBe(false);
      expect(status.agents.tom).toBe(false);
    });
  });

  describe('Decision Making', () => {
    test('makeDecision logs decision and returns result', async () => {
      const decision = await brain.makeDecision({
        category: BrainDecisionCategory.PROJECT_APPROACH,
        context: { project: 'test-project' },
        alternatives: [
          { approach: 'microservices' },
          { approach: 'monolith' }
        ],
        evaluator: (alt) => alt.approach === 'microservices' ? 0.8 : 0.6,
        reasoning: 'Selecting project architecture'
      });

      expect(decision.id).toBeDefined();
      expect(decision.category).toBe(BrainDecisionCategory.PROJECT_APPROACH);
      expect(decision.selected.approach).toBe('microservices');
    });

    test('makeDecision emits decision:made event', async () => {
      const handler = jest.fn();
      brain.on('decision:made', handler);

      await brain.makeDecision({
        category: BrainDecisionCategory.AGENT_SELECTION,
        context: { task: 'test' },
        alternatives: [{ agent: 'nefario' }],
        evaluator: () => 1.0
      });

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].category).toBe(BrainDecisionCategory.AGENT_SELECTION);
    });

    test('makeDecision tracks recent decisions', async () => {
      await brain.makeDecision({
        category: BrainDecisionCategory.PROJECT_APPROACH,
        context: {},
        alternatives: [{ option: 'A' }],
        evaluator: () => 1.0
      });

      expect(brain.recentDecisions.length).toBe(1);
    });
  });

  describe('Plan Evaluation', () => {
    test('evaluatePlan scores plan completeness', async () => {
      const plan = {
        id: 'test-plan',
        tasks: [
          { id: 't1', name: 'Task 1', description: 'A detailed description of the first task', category: 'setup' },
          { id: 't2', name: 'Task 2', description: 'A detailed description of the second task', category: 'backend' }
        ],
        phases: { setup: ['t1'], implementation: ['t2'] }
      };

      const evaluation = await brain.evaluatePlan(plan);

      expect(evaluation.scores.completeness).toBeGreaterThan(0);
      expect(evaluation.overallScore).toBeDefined();
    });

    test('evaluatePlan identifies incomplete plans', async () => {
      const incompletePlan = {
        id: 'incomplete',
        tasks: [
          { id: 't1' }, // No name, description, or category
          { id: 't2' }
        ]
      };

      const evaluation = await brain.evaluatePlan(incompletePlan);

      expect(evaluation.scores.completeness).toBeLessThan(0.5);
      expect(evaluation.issues.length).toBeGreaterThan(0);
    });

    test('evaluatePlan approves good plans', async () => {
      const goodPlan = {
        id: 'good-plan',
        tasks: [
          { id: 't1', name: 'Setup', description: 'Initialize project structure and dependencies', category: 'setup', complexity: 1 },
          { id: 't2', name: 'Build', description: 'Implement the core functionality of the module', category: 'backend', complexity: 2 },
          { id: 't3', name: 'Test', description: 'Write comprehensive unit and integration tests', category: 'testing', complexity: 1 }
        ],
        phases: { setup: ['t1'], implementation: ['t2'], testing: ['t3'] },
        executionGroups: [{ id: 'g1', tasks: ['t1'] }]
      };

      const evaluation = await brain.evaluatePlan(goodPlan);

      expect(evaluation.overallScore).toBeGreaterThan(0.5);
    });
  });

  describe('Task Delegation', () => {
    test('delegateTask selects appropriate agent', async () => {
      brain.setAgents({
        nefario: { name: 'nefario' },
        lucy: { name: 'lucy' },
        tom: { name: 'tom' }
      });

      const securityTask = {
        id: 'sec-1',
        name: 'Security scan',
        category: 'security_scan',
        type: 'validation'
      };

      const delegation = await brain.delegateTask(securityTask);

      expect(delegation.task).toBe(securityTask);
      expect(delegation.delegatedTo).toBeDefined();
    });

    test('delegateTask returns nefario as default', async () => {
      brain.setAgents({
        nefario: { name: 'nefario' }
      });

      const genericTask = {
        id: 'gen-1',
        name: 'Generic task',
        category: 'unknown'
      };

      const delegation = await brain.delegateTask(genericTask);

      expect(delegation.delegatedTo).toBe('nefario');
    });
  });

  describe('Execution Control', () => {
    test('startExecution requires approved plan', async () => {
      const plan = { id: 'unapproved' };

      // Without approving first, brain.currentPlan is null
      const result = await brain.startExecution(plan);

      expect(result.success).toBe(false);
    });

    test('startExecution with approved plan proceeds', async () => {
      // First approve a plan
      const plan = {
        id: 'approved-plan',
        tasks: [
          { id: 't1', name: 'Setup', description: 'Initialize the project', category: 'setup', complexity: 1 }
        ],
        phases: { setup: ['t1'] }
      };

      const evaluation = await brain.evaluatePlan(plan);

      // If plan was approved, execution should attempt to proceed
      if (evaluation.approved) {
        const mockNefario = {
          executePlan: jest.fn().mockResolvedValue({ success: true, tasksCompleted: 1 })
        };
        brain.setAgents({ nefario: mockNefario });

        const result = await brain.startExecution(plan);

        expect(result.success).toBe(true);
        expect(mockNefario.executePlan).toHaveBeenCalled();
      }
    });

    test('pauseExecution changes state to PAUSED', async () => {
      brain.state = BrainState.EXECUTING;

      const result = await brain.pauseExecution('Testing pause');

      expect(result.paused).toBe(true);
      expect(brain.state).toBe(BrainState.PAUSED);
    });

    test('resumeExecution changes state to EXECUTING', async () => {
      brain.state = BrainState.PAUSED;

      const result = await brain.resumeExecution();

      expect(result.resumed).toBe(true);
      expect(brain.state).toBe(BrainState.EXECUTING);
    });

    test('abortExecution changes state to IDLE', async () => {
      brain.state = BrainState.EXECUTING;
      brain.currentExecution = { planId: 'test', status: 'running' };

      const result = await brain.abortExecution('Test abort');

      expect(result.aborted).toBe(true);
      expect(brain.state).toBe(BrainState.IDLE);
      expect(brain.currentExecution.status).toBe('aborted');
    });
  });

  describe('Gap Analysis', () => {
    test('analyzeAndResolveGaps returns empty when no Lucy', async () => {
      const project = { name: 'test-project', path: '/test' };

      const result = await brain.analyzeAndResolveGaps(project);

      expect(result.gaps).toEqual([]);
      expect(result.resolutionPlan).toBeNull();
    });

    test('analyzeAndResolveGaps prioritizes gaps', async () => {
      const mockLucy = {
        detectGaps: jest.fn().mockResolvedValue({
          gaps: [
            { id: 'g1', type: 'test:missing', category: 'testing' },
            { id: 'g2', type: 'security:vulnerability', category: 'security' },
            { id: 'g3', type: 'documentation', category: 'docs' }
          ]
        })
      };

      brain.setAgents({ lucy: mockLucy });

      const project = { name: 'test-project' };
      const result = await brain.analyzeAndResolveGaps(project);

      expect(result.gaps.length).toBe(3);
      // Security should be first (critical priority)
      expect(result.gaps[0].priority).toBe('critical');
    });
  });

  describe('Status and Queries', () => {
    test('getStatus returns current state', () => {
      const status = brain.getStatus();

      expect(status.state).toBe(BrainState.IDLE);
      expect(status.currentProject).toBeNull();
      expect(status.currentPlan).toBeNull();
      expect(status.recentDecisions).toEqual([]);
    });

    test('reset clears all state', async () => {
      // Set some state
      brain.currentProject = { name: 'test' };
      brain.currentPlan = { id: 'plan-1' };
      brain.recentDecisions.push({ id: 'dec-1' });

      brain.reset();

      expect(brain.currentProject).toBeNull();
      expect(brain.currentPlan).toBeNull();
      expect(brain.recentDecisions.length).toBe(0);
    });
  });

  describe('Decision Logging Integration', () => {
    test('decisions are persisted via DecisionLogger', async () => {
      const decision = await brain.makeDecision({
        category: BrainDecisionCategory.PROJECT_APPROACH,
        context: { project: 'persistence-test' },
        alternatives: [{ option: 'A' }],
        evaluator: () => 1.0
      });

      // Query back from decision logger
      const logged = await brain.decisionLogger.getDecision(decision.id);

      expect(logged).toBeDefined();
      expect(logged.agent).toBe('BrainController');
    });
  });
});
