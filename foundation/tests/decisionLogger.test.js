import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import DecisionLogger, {
  getDecisionLogger,
  resetDecisionLogger,
  DecisionType,
  DecisionOutcome
} from '../memory-store/DecisionLogger.js';
import MemoryStore, { resetMemoryStore } from '../memory-store/MemoryStore.js';

describe('DecisionLogger', () => {
  let decisionLogger;
  let memoryStore;
  let mockEventBus;

  beforeEach(async () => {
    // Reset singletons
    resetDecisionLogger();
    resetMemoryStore();

    // Create fresh in-memory store for each test (not singleton)
    memoryStore = new MemoryStore({ inMemory: true });
    await memoryStore.initialize();

    // Mock event bus
    mockEventBus = {
      publish: () => {},
      subscribe: () => () => {}
    };

    // Create decision logger with fresh instances
    decisionLogger = new DecisionLogger();
    decisionLogger.memoryStore = memoryStore;
    decisionLogger.eventBus = mockEventBus;
    decisionLogger.initialized = true;
  });

  afterEach(async () => {
    if (memoryStore) {
      await memoryStore.close();
    }
    resetDecisionLogger();
    resetMemoryStore();
  });

  describe('logging decisions', () => {
    test('should log a decision and return an ID', async () => {
      const decisionId = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: { file: 'test.js' },
        decision: { action: 'create file' },
        reasoning: 'File needed for feature'
      });

      expect(decisionId).toBeDefined();
      expect(decisionId).toMatch(/^dec_/);
    });

    test('should store decision with all fields', async () => {
      const decisionId = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.ARCHITECTURE,
        context: { project: 'test' },
        decision: { pattern: 'MVC' },
        reasoning: 'Standard pattern for web apps'
      });

      const decision = await decisionLogger.getDecision(decisionId);

      expect(decision.agent).toBe('test-agent');
      expect(decision.type).toBe(DecisionType.ARCHITECTURE);
      expect(decision.context).toEqual({ project: 'test' });
      expect(decision.decision).toEqual({ pattern: 'MVC' });
      expect(decision.reasoning).toBe('Standard pattern for web apps');
      expect(decision.outcome).toBe(DecisionOutcome.PENDING);
      expect(decision.timestamp).toBeDefined();
    });

    test('should track pending decisions', async () => {
      await decisionLogger.logDecision({
        agent: 'agent1',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      await decisionLogger.logDecision({
        agent: 'agent2',
        type: DecisionType.TEST_STRATEGY,
        context: {},
        decision: {}
      });

      const pending = decisionLogger.getPendingDecisions();
      expect(pending).toHaveLength(2);
    });
  });

  describe('updating outcomes', () => {
    test('should update decision outcome', async () => {
      const decisionId = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      await decisionLogger.updateOutcome(decisionId, DecisionOutcome.SUCCESS, {
        message: 'Completed successfully'
      });

      const decision = await decisionLogger.getDecision(decisionId);
      expect(decision.outcome).toBe(DecisionOutcome.SUCCESS);
      expect(decision.outcomeDetails.message).toBe('Completed successfully');
      expect(decision.completedAt).toBeDefined();
      expect(decision.duration).toBeDefined();
    });

    test('should remove from pending after outcome update', async () => {
      const decisionId = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      expect(decisionLogger.getPendingDecisions()).toHaveLength(1);

      await decisionLogger.updateOutcome(decisionId, DecisionOutcome.SUCCESS);

      expect(decisionLogger.getPendingDecisions()).toHaveLength(0);
    });
  });

  describe('querying decisions', () => {
    beforeEach(async () => {
      await decisionLogger.logDecision({
        agent: 'agent1',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      await decisionLogger.logDecision({
        agent: 'agent1',
        type: DecisionType.TEST_STRATEGY,
        context: {},
        decision: {}
      });

      await decisionLogger.logDecision({
        agent: 'agent2',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });
    });

    test('should query by agent', async () => {
      const decisions = await decisionLogger.queryDecisions({ agent: 'agent1' });
      expect(decisions).toHaveLength(2);
      expect(decisions.every(d => d.agent === 'agent1')).toBe(true);
    });

    test('should query by type', async () => {
      const decisions = await decisionLogger.queryDecisions({ type: DecisionType.CODE_GENERATION });
      expect(decisions).toHaveLength(2);
      expect(decisions.every(d => d.type === DecisionType.CODE_GENERATION)).toBe(true);
    });

    test('should limit results', async () => {
      const decisions = await decisionLogger.queryDecisions({ limit: 2 });
      expect(decisions).toHaveLength(2);
    });
  });

  describe('decision chain', () => {
    test('should track parent-child decisions', async () => {
      const parentId = await decisionLogger.logDecision({
        agent: 'orchestrator',
        type: DecisionType.TASK_BREAKDOWN,
        context: { task: 'build feature' },
        decision: { subtasks: ['design', 'implement', 'test'] }
      });

      await decisionLogger.logDecision({
        agent: 'architect',
        type: DecisionType.ARCHITECTURE,
        context: { subtask: 'design' },
        decision: { pattern: 'service' },
        parentDecisionId: parentId
      });

      const chain = await decisionLogger.getDecisionChain(parentId);
      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain[0].id).toBe(parentId);
    });
  });

  describe('reasoning trail', () => {
    test('should get reasoning trail for context', async () => {
      await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.ARCHITECTURE,
        context: { component: 'authentication' },
        decision: { method: 'JWT' },
        reasoning: 'Stateless authentication for API'
      });

      const trail = await decisionLogger.getReasoningTrail('authentication');

      expect(trail.query).toBe('authentication');
      expect(trail.directDecisions).toBeDefined();
      expect(trail.similarDecisions).toBeDefined();
    });
  });

  describe('agent decision history', () => {
    test('should get agent decision summary', async () => {
      const id1 = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      const id2 = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      await decisionLogger.updateOutcome(id1, DecisionOutcome.SUCCESS);
      await decisionLogger.updateOutcome(id2, DecisionOutcome.FAILED);

      const history = await decisionLogger.getAgentDecisionHistory('test-agent');

      expect(history.agent).toBe('test-agent');
      expect(history.totalDecisions).toBe(2);
      expect(history.byType[DecisionType.CODE_GENERATION]).toBe(2);
      expect(history.byOutcome[DecisionOutcome.SUCCESS]).toBe(1);
      expect(history.byOutcome[DecisionOutcome.FAILED]).toBe(1);
    });
  });

  describe('decision listeners', () => {
    test('should notify listeners on decision logged', async () => {
      const events = [];

      decisionLogger.onDecision((event, data) => {
        events.push({ event, data });
      });

      await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('decision_logged');
    });

    test('should unsubscribe listener', async () => {
      const events = [];

      const unsubscribe = decisionLogger.onDecision((event, data) => {
        events.push({ event, data });
      });

      await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      unsubscribe();

      await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      expect(events).toHaveLength(1);
    });
  });

  describe('statistics', () => {
    test('should return stats', async () => {
      const id = await decisionLogger.logDecision({
        agent: 'test-agent',
        type: DecisionType.CODE_GENERATION,
        context: {},
        decision: {}
      });

      await decisionLogger.updateOutcome(id, DecisionOutcome.SUCCESS);

      const stats = await decisionLogger.getStats();

      expect(stats.totalDecisions).toBeGreaterThanOrEqual(1);
      expect(stats.byAgent['test-agent']).toBeGreaterThanOrEqual(1);
      expect(stats.byType[DecisionType.CODE_GENERATION]).toBeGreaterThanOrEqual(1);
    });
  });

  describe('decision types', () => {
    test('should have all expected decision types', () => {
      expect(DecisionType.ARCHITECTURE).toBeDefined();
      expect(DecisionType.CODE_GENERATION).toBeDefined();
      expect(DecisionType.TEST_STRATEGY).toBeDefined();
      expect(DecisionType.TASK_BREAKDOWN).toBeDefined();
      expect(DecisionType.ERROR_HANDLING).toBeDefined();
      expect(DecisionType.AGENT_DELEGATION).toBeDefined();
    });
  });

  describe('decision outcomes', () => {
    test('should have all expected outcomes', () => {
      expect(DecisionOutcome.PENDING).toBeDefined();
      expect(DecisionOutcome.SUCCESS).toBeDefined();
      expect(DecisionOutcome.FAILED).toBeDefined();
      expect(DecisionOutcome.REVERTED).toBeDefined();
    });
  });
});
