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

  // ============================================================================
  // LEARNING SYSTEM EXTENSION TESTS (Phase 0.1)
  // ============================================================================

  describe('learning decision types', () => {
    test('should have all learning-specific decision types', () => {
      expect(DecisionType.SKILL_EXECUTION).toBe('skill_execution');
      expect(DecisionType.PATTERN_DETECTED).toBe('pattern_detected');
      expect(DecisionType.LEARNING_UPDATE).toBe('learning_update');
      expect(DecisionType.REWARD_SIGNAL).toBe('reward_signal');
    });
  });

  describe('logSkillExecution', () => {
    test('should log successful skill execution', async () => {
      const decisionId = await decisionLogger.logSkillExecution({
        agent: 'test-agent',
        skill: 'code-reviewer',
        input: { file: 'test.js' },
        output: { issues: [] },
        success: true,
        duration: 150
      });

      expect(decisionId).toBeDefined();
      expect(decisionId).toMatch(/^dec_/);

      const decision = await decisionLogger.getDecision(decisionId);
      expect(decision.type).toBe(DecisionType.SKILL_EXECUTION);
      expect(decision.metadata.skillName).toBe('code-reviewer');
      expect(decision.metadata.success).toBe(true);
      expect(decision.metadata.executionTime).toBe(150);
      expect(decision.outcome).toBe(DecisionOutcome.SUCCESS);
    });

    test('should log failed skill execution', async () => {
      const decisionId = await decisionLogger.logSkillExecution({
        agent: 'test-agent',
        skill: 'code-reviewer',
        input: { file: 'test.js' },
        output: null,
        success: false,
        duration: 50,
        error: 'File not found'
      });

      const decision = await decisionLogger.getDecision(decisionId);
      expect(decision.outcome).toBe(DecisionOutcome.FAILED);
      expect(decision.metadata.error).toBe('File not found');
      expect(decision.reasoning).toContain('Failed');
    });

    test('should track pattern on skill execution', async () => {
      decisionLogger.resetPatternCounts();

      await decisionLogger.logSkillExecution({
        agent: 'test-agent',
        skill: 'test-skill',
        input: {},
        output: {},
        success: true,
        duration: 100
      });

      const patterns = decisionLogger.getPatternCounts();
      expect(patterns.get('skill:test-skill:success')).toBe(1);
      expect(patterns.get('skill:test-skill')).toBe(1);
    });
  });

  describe('incrementPattern', () => {
    beforeEach(() => {
      decisionLogger.resetPatternCounts();
    });

    test('should increment pattern count', () => {
      const count1 = decisionLogger.incrementPattern('test:pattern');
      expect(count1).toBe(1);

      const count2 = decisionLogger.incrementPattern('test:pattern');
      expect(count2).toBe(2);

      const count3 = decisionLogger.incrementPattern('test:pattern');
      expect(count3).toBe(3);
    });

    test('should emit event at threshold counts', () => {
      const publishedEvents = [];
      decisionLogger.eventBus = {
        publish: (event, data) => publishedEvents.push({ event, data })
      };

      // Increment to threshold of 3
      decisionLogger.incrementPattern('test:pattern');
      decisionLogger.incrementPattern('test:pattern');
      decisionLogger.incrementPattern('test:pattern');

      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].event).toBe('LEARNING_PATTERN_DETECTED');
      expect(publishedEvents[0].data.pattern).toBe('test:pattern');
      expect(publishedEvents[0].data.count).toBe(3);
    });

    test('should emit events at multiple thresholds', () => {
      const publishedEvents = [];
      decisionLogger.eventBus = {
        publish: (event, data) => publishedEvents.push({ event, data })
      };

      // Increment to threshold of 5
      for (let i = 0; i < 5; i++) {
        decisionLogger.incrementPattern('test:pattern');
      }

      // Should have events at 3 and 5
      expect(publishedEvents).toHaveLength(2);
      expect(publishedEvents[0].data.count).toBe(3);
      expect(publishedEvents[1].data.count).toBe(5);
    });
  });

  describe('getFrequentPatterns', () => {
    beforeEach(() => {
      decisionLogger.resetPatternCounts();
    });

    test('should return patterns above minimum count', () => {
      // Add patterns with varying counts
      for (let i = 0; i < 5; i++) decisionLogger.incrementPattern('high:pattern');
      for (let i = 0; i < 3; i++) decisionLogger.incrementPattern('medium:pattern');
      for (let i = 0; i < 1; i++) decisionLogger.incrementPattern('low:pattern');

      const frequent = decisionLogger.getFrequentPatterns(3);

      expect(frequent).toHaveLength(2);
      expect(frequent[0].pattern).toBe('high:pattern');
      expect(frequent[0].count).toBe(5);
      expect(frequent[1].pattern).toBe('medium:pattern');
      expect(frequent[1].count).toBe(3);
    });

    test('should sort by count descending', () => {
      for (let i = 0; i < 3; i++) decisionLogger.incrementPattern('pattern:a');
      for (let i = 0; i < 10; i++) decisionLogger.incrementPattern('pattern:b');
      for (let i = 0; i < 5; i++) decisionLogger.incrementPattern('pattern:c');

      const frequent = decisionLogger.getFrequentPatterns(3);

      expect(frequent[0].pattern).toBe('pattern:b');
      expect(frequent[1].pattern).toBe('pattern:c');
      expect(frequent[2].pattern).toBe('pattern:a');
    });

    test('should return empty array when no patterns meet threshold', () => {
      decisionLogger.incrementPattern('low:pattern');

      const frequent = decisionLogger.getFrequentPatterns(5);
      expect(frequent).toHaveLength(0);
    });
  });

  describe('getExperiencesForPattern', () => {
    beforeEach(async () => {
      decisionLogger.resetPatternCounts();

      // Log several skill executions
      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'code-reviewer',
        input: { file: 'a.js' },
        output: { issues: [] },
        success: true,
        duration: 100
      });

      await decisionLogger.logSkillExecution({
        agent: 'agent2',
        skill: 'code-reviewer',
        input: { file: 'b.js' },
        output: null,
        success: false,
        duration: 50,
        error: 'Parse error'
      });

      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'test-runner',
        input: { suite: 'unit' },
        output: { passed: 10 },
        success: true,
        duration: 200
      });
    });

    test('should get experiences matching pattern with skill name', async () => {
      const experiences = await decisionLogger.getExperiencesForPattern('skill:code-reviewer');

      expect(experiences).toHaveLength(2);
      expect(experiences.every(e => e.metadata.skillName === 'code-reviewer')).toBe(true);
    });

    test('should filter by success outcome in pattern', async () => {
      const experiences = await decisionLogger.getExperiencesForPattern('skill:code-reviewer:success');

      expect(experiences).toHaveLength(1);
      expect(experiences[0].outcome).toBe(DecisionOutcome.SUCCESS);
    });

    test('should filter by failure outcome in pattern', async () => {
      const experiences = await decisionLogger.getExperiencesForPattern('skill:code-reviewer:failure');

      expect(experiences).toHaveLength(1);
      expect(experiences[0].outcome).toBe(DecisionOutcome.FAILED);
    });

    test('should respect limit parameter', async () => {
      const experiences = await decisionLogger.getExperiencesForPattern('skill:code-reviewer', 1);

      expect(experiences).toHaveLength(1);
    });
  });

  describe('getSkillSuccessRate', () => {
    beforeEach(async () => {
      // Log mixed success/failure executions
      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'test-skill',
        input: {},
        output: {},
        success: true,
        duration: 100
      });

      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'test-skill',
        input: {},
        output: {},
        success: true,
        duration: 100
      });

      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'test-skill',
        input: {},
        output: null,
        success: false,
        duration: 50,
        error: 'Error'
      });
    });

    test('should calculate correct success rate', async () => {
      const rate = await decisionLogger.getSkillSuccessRate('test-skill');

      // 2 successes out of 3 = 0.666...
      expect(rate).toBeCloseTo(0.667, 2);
    });

    test('should return 0 for unknown skill', async () => {
      const rate = await decisionLogger.getSkillSuccessRate('unknown-skill');

      expect(rate).toBe(0);
    });
  });

  describe('getSkillStats', () => {
    beforeEach(async () => {
      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'stats-skill',
        input: {},
        output: {},
        success: true,
        duration: 100
      });

      await decisionLogger.logSkillExecution({
        agent: 'agent2',
        skill: 'stats-skill',
        input: {},
        output: {},
        success: true,
        duration: 200
      });

      await decisionLogger.logSkillExecution({
        agent: 'agent1',
        skill: 'stats-skill',
        input: {},
        output: null,
        success: false,
        duration: 50,
        error: 'Error'
      });
    });

    test('should return comprehensive skill statistics', async () => {
      const stats = await decisionLogger.getSkillStats('stats-skill');

      expect(stats.skillName).toBe('stats-skill');
      expect(stats.executions).toBe(3);
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(1);
      expect(stats.successRate).toBeCloseTo(0.667, 2);
      expect(stats.averageDuration).toBeCloseTo(116.67, 0);
      expect(stats.agents).toContain('agent1');
      expect(stats.agents).toContain('agent2');
    });

    test('should return empty stats for unknown skill', async () => {
      const stats = await decisionLogger.getSkillStats('unknown-skill');

      expect(stats.skillName).toBe('unknown-skill');
      expect(stats.executions).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.agents).toHaveLength(0);
    });
  });

  describe('pattern count management', () => {
    test('should reset pattern counts', () => {
      decisionLogger.incrementPattern('test:pattern');
      decisionLogger.incrementPattern('test:pattern');

      expect(decisionLogger.getPatternCounts().get('test:pattern')).toBe(2);

      decisionLogger.resetPatternCounts();

      expect(decisionLogger.getPatternCounts().size).toBe(0);
    });

    test('should return copy of pattern counts', () => {
      decisionLogger.incrementPattern('test:pattern');

      const counts = decisionLogger.getPatternCounts();
      counts.set('test:pattern', 999);

      // Original should be unchanged
      expect(decisionLogger.getPatternCounts().get('test:pattern')).toBe(1);
    });
  });
});
