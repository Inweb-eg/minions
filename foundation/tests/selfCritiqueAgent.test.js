/**
 * SelfCritiqueAgent Tests
 * =======================
 * Tests for the quality assurance agent.
 */

import { jest } from '@jest/globals';
import {
  SelfCritiqueAgent,
  getSelfCritiqueAgent,
  AgentState,
  ReviewType,
  Severity,
  CritiqueEvents
} from '../../agents/self-critique-agent/index.js';

describe('SelfCritiqueAgent', () => {
  let agent;

  beforeEach(async () => {
    SelfCritiqueAgent.resetInstance();
    agent = new SelfCritiqueAgent({
      strictMode: false,
      autoReject: false,
      minCodeQuality: 0.5
    });
    await agent.initialize();
  });

  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
    SelfCritiqueAgent.resetInstance();
  });

  describe('Initialization', () => {
    test('creates with correct identity', () => {
      expect(agent.name).toBe('SelfCritiqueAgent');
      expect(agent.alias).toBe('Critic');
      expect(agent.version).toBe('1.0.0');
    });

    test('starts in IDLE state after init', () => {
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('emits initialized event', async () => {
      SelfCritiqueAgent.resetInstance();
      const newAgent = new SelfCritiqueAgent();
      const handler = jest.fn();
      newAgent.on('initialized', handler);

      await newAgent.initialize();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern', () => {
    test('getSelfCritiqueAgent returns same instance', () => {
      SelfCritiqueAgent.resetInstance();
      const instance1 = getSelfCritiqueAgent();
      const instance2 = getSelfCritiqueAgent();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Code Review', () => {
    test('reviewCode returns review result', async () => {
      const code = `
        function hello() {
          console.log("Hello");
        }
      `;

      const review = await agent.reviewCode(code);

      expect(review.type).toBe(ReviewType.CODE);
      expect(review.issues).toBeDefined();
      expect(review.suggestions).toBeDefined();
      expect(review.metrics).toBeDefined();
      expect(typeof review.approved).toBe('boolean');
    });

    test('reviewCode detects console statements', async () => {
      const code = `
        function test() {
          console.log("debug");
          console.debug("more debug");
        }
      `;

      const review = await agent.reviewCode(code);

      const consoleIssue = review.issues.find(i => i.name === 'Console statement');
      expect(consoleIssue).toBeDefined();
    });

    test('reviewCode detects empty catch blocks', async () => {
      const code = `
        try {
          doSomething();
        } catch (e) {}
      `;

      const review = await agent.reviewCode(code);

      const emptyBlockIssue = review.issues.find(i => i.name === 'Empty catch block');
      expect(emptyBlockIssue).toBeDefined();
      expect(emptyBlockIssue.severity).toBe(Severity.HIGH);
    });

    test('reviewCode calculates metrics', async () => {
      const code = `
        // Comment
        function one() { return 1; }
        function two() { return 2; }

        class MyClass {}
      `;

      const review = await agent.reviewCode(code);

      expect(review.metrics.functions).toBe(2);
      expect(review.metrics.classes).toBe(1);
      expect(review.metrics.commentLines).toBeGreaterThan(0);
    });

    test('reviewCode calculates complexity', async () => {
      const code = `
        function complex(x) {
          if (x > 0) {
            for (let i = 0; i < x; i++) {
              if (i % 2 === 0) {
                while (true) {
                  break;
                }
              }
            }
          } else {
            switch (x) {
              case -1: return 'a';
              case -2: return 'b';
            }
          }
        }
      `;

      const review = await agent.reviewCode(code);

      expect(review.metrics.complexity).toBeGreaterThan(5);
    });

    test('reviewCode emits events', async () => {
      const startHandler = jest.fn();
      const completeHandler = jest.fn();

      agent.on(CritiqueEvents.REVIEW_STARTED, startHandler);
      agent.on(CritiqueEvents.REVIEW_COMPLETED, completeHandler);

      await agent.reviewCode('const x = 1;');

      expect(startHandler).toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalled();
    });

    test('reviewCode increments metrics', async () => {
      const initialReviews = agent.metrics.reviewsCompleted;

      await agent.reviewCode('const x = 1;');

      expect(agent.metrics.reviewsCompleted).toBe(initialReviews + 1);
    });

    test('approves clean code', async () => {
      const cleanCode = `
        const calculateSum = (a, b) => a + b;
        export default calculateSum;
      `;

      const review = await agent.reviewCode(cleanCode);

      expect(review.approved).toBe(true);
      expect(review.qualityScore).toBeGreaterThan(0.5);
    });
  });

  describe('Plan Review', () => {
    test('reviewPlan returns review result', async () => {
      const plan = {
        id: 'test-plan',
        tasks: [
          { id: 't1', name: 'Task 1', description: 'First task description', category: 'setup' }
        ],
        phases: { setup: ['t1'] }
      };

      const review = await agent.reviewPlan(plan);

      expect(review.type).toBe(ReviewType.PLAN);
      expect(review.planId).toBe('test-plan');
      expect(review.scores).toBeDefined();
      expect(review.issues).toBeDefined();
    });

    test('reviewPlan scores completeness', async () => {
      const completePlan = {
        id: 'complete',
        tasks: [
          { id: 't1', name: 'Setup', description: 'Initialize the project structure', category: 'setup' },
          { id: 't2', name: 'Build', description: 'Build the main components', category: 'backend' }
        ],
        phases: { setup: ['t1'], implementation: ['t2'] },
        executionGroups: [{ id: 'g1', tasks: ['t1', 't2'] }]
      };

      const review = await agent.reviewPlan(completePlan);

      expect(review.scores.completeness).toBeGreaterThan(0.7);
    });

    test('reviewPlan identifies incomplete plans', async () => {
      const incompletePlan = {
        id: 'incomplete',
        tasks: [
          { id: 't1' }, // No name, description, or category
          { id: 't2' }
        ]
      };

      const review = await agent.reviewPlan(incompletePlan);

      expect(review.scores.completeness).toBeLessThan(0.5);
      expect(review.issues.length).toBeGreaterThan(0);
    });

    test('reviewPlan detects dependency issues', async () => {
      const planWithBadDeps = {
        id: 'bad-deps',
        tasks: [
          { id: 't1', name: 'Task 1', description: 'Desc', category: 'setup', dependencies: ['nonexistent'] },
          { id: 't2', name: 'Task 2', description: 'Desc', category: 'setup', dependencies: ['t2'] } // Self-dep
        ]
      };

      const review = await agent.reviewPlan(planWithBadDeps);

      expect(review.scores.dependencies).toBeLessThan(1.0);
    });

    test('reviewPlan emits approval event', async () => {
      const approvedHandler = jest.fn();
      agent.on(CritiqueEvents.PLAN_APPROVED, approvedHandler);

      const goodPlan = {
        id: 'good',
        tasks: [
          { id: 't1', name: 'Task', description: 'A well-described task', category: 'setup' }
        ],
        phases: { setup: ['t1'] },
        executionGroups: [{ id: 'g1', tasks: ['t1'] }]
      };

      await agent.reviewPlan(goodPlan);

      expect(approvedHandler).toHaveBeenCalled();
    });
  });

  describe('Test Coverage Review', () => {
    test('reviewTestCoverage analyzes coverage', async () => {
      const coverage = {
        lines: { pct: 85 },
        branches: { pct: 75 },
        functions: { pct: 90 },
        statements: { pct: 85 }
      };

      const review = await agent.reviewTestCoverage(coverage);

      expect(review.type).toBe(ReviewType.TEST);
      expect(review.metrics.lineCoverage).toBe(85);
      expect(review.metrics.branchCoverage).toBe(75);
    });

    test('reviewTestCoverage flags low coverage', async () => {
      const lowCoverage = {
        lines: { pct: 50 },
        branches: { pct: 40 },
        functions: { pct: 60 },
        statements: { pct: 50 }
      };

      const review = await agent.reviewTestCoverage(lowCoverage);

      expect(review.issues.length).toBeGreaterThan(0);
      expect(review.approved).toBe(false);
    });
  });

  describe('Output Validation', () => {
    test('validateOutput passes valid output', async () => {
      const output = { name: 'test', value: 123 };
      const schema = {
        type: 'object',
        required: ['name', 'value']
      };

      const result = await agent.validateOutput(output, schema);

      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('validateOutput fails on null', async () => {
      const result = await agent.validateOutput(null, {});

      expect(result.valid).toBe(false);
      expect(result.issues[0].severity).toBe(Severity.CRITICAL);
    });

    test('validateOutput fails on missing required fields', async () => {
      const output = { name: 'test' };
      const schema = {
        required: ['name', 'value', 'id']
      };

      const result = await agent.validateOutput(output, schema);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(2); // missing value and id
    });
  });

  describe('Status & Metrics', () => {
    test('getStatus returns current state', () => {
      const status = agent.getStatus();

      expect(status.name).toBe('SelfCritiqueAgent');
      expect(status.state).toBe(AgentState.IDLE);
      expect(status.metrics).toBeDefined();
    });

    test('getApprovalRate calculates correctly', async () => {
      // Do some reviews
      await agent.reviewCode('const x = 1;'); // Should approve

      const rate = agent.getApprovalRate();

      expect(rate).toBeGreaterThan(0);
    });

    test('getHistory returns review history', async () => {
      await agent.reviewCode('const x = 1;');
      await agent.reviewCode('const y = 2;');

      const history = agent.getHistory(5);

      expect(history.length).toBe(2);
    });

    test('resetMetrics clears all counts', async () => {
      await agent.reviewCode('const x = 1;');
      expect(agent.metrics.reviewsCompleted).toBeGreaterThan(0);

      agent.resetMetrics();

      expect(agent.metrics.reviewsCompleted).toBe(0);
    });
  });

  describe('Enums', () => {
    test('ReviewType has all types', () => {
      expect(ReviewType.CODE).toBe('code');
      expect(ReviewType.PLAN).toBe('plan');
      expect(ReviewType.OUTPUT).toBe('output');
      expect(ReviewType.TEST).toBe('test');
    });

    test('Severity has all levels', () => {
      expect(Severity.CRITICAL).toBe('critical');
      expect(Severity.HIGH).toBe('high');
      expect(Severity.MEDIUM).toBe('medium');
      expect(Severity.LOW).toBe('low');
      expect(Severity.INFO).toBe('info');
    });
  });
});
