/**
 * SkillABTester Tests
 *
 * Comprehensive unit tests for the Skill A/B Tester (Phase 3)
 * Tests test lifecycle, variant selection, statistical significance, and RL integration
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SkillABTester, {
  getSkillABTester,
  resetSkillABTester,
  TEST_STATUS,
  VARIANT
} from '../learning/SkillABTester.js';
import { resetReinforcementLearner } from '../learning/ReinforcementLearner.js';
import { resetDecisionLogger } from '../memory-store/DecisionLogger.js';

describe('SkillABTester', () => {
  let tester;
  let mockReinforcementLearner;
  let mockKnowledgeBrain;
  let controlSkill;
  let treatmentSkill;

  beforeEach(async () => {
    // Reset singletons
    resetSkillABTester();
    resetReinforcementLearner();
    resetDecisionLogger();

    // Get fresh instance
    tester = getSkillABTester({
      minSampleSize: 5, // Lower for testing
      confidenceLevel: 0.90, // Lower for testing
      maxTestDuration: 60000, // 1 minute for testing
      useRLAfterSamples: 3,
      enableAutoCompletion: true
    });

    // Create mock skills
    controlSkill = {
      id: 'skill-control-1',
      name: 'ControlSkill',
      version: '1.0.0'
    };

    treatmentSkill = {
      id: 'skill-treatment-1',
      name: 'TreatmentSkill',
      version: '1.0.0'
    };

    // Create mocks
    mockReinforcementLearner = {
      initialize: jest.fn().mockResolvedValue(undefined),
      selectAction: jest.fn().mockReturnValue({
        action: VARIANT.TREATMENT,
        isExploration: false
      }),
      calculateReward: jest.fn().mockReturnValue(1.0),
      update: jest.fn().mockResolvedValue(1.0)
    };

    mockKnowledgeBrain = {
      initialize: jest.fn().mockResolvedValue(undefined),
      storeTestResult: jest.fn().mockResolvedValue({ id: 'result-1' })
    };

    // Inject mocks
    tester.reinforcementLearner = mockReinforcementLearner;
    tester.knowledgeBrain = mockKnowledgeBrain;
    tester.initialized = true;
  });

  afterEach(async () => {
    if (tester) {
      await tester.shutdown();
    }
    resetSkillABTester();
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getSkillABTester();
      const instance2 = getSkillABTester();
      expect(instance1).toBe(instance2);
    });

    it('should reset the singleton', () => {
      const instance1 = getSkillABTester();
      resetSkillABTester();
      const instance2 = getSkillABTester();
      expect(instance1).not.toBe(instance2);
    });

    it('should apply configuration options', () => {
      resetSkillABTester();
      const customTester = getSkillABTester({
        minSampleSize: 100,
        confidenceLevel: 0.99
      });
      expect(customTester.config.minSampleSize).toBe(100);
      expect(customTester.config.confidenceLevel).toBe(0.99);
    });
  });

  describe('Constants', () => {
    it('should export TEST_STATUS constants', () => {
      expect(TEST_STATUS.RUNNING).toBe('running');
      expect(TEST_STATUS.COMPLETED).toBe('completed');
      expect(TEST_STATUS.CANCELLED).toBe('cancelled');
      expect(TEST_STATUS.EXPIRED).toBe('expired');
    });

    it('should export VARIANT constants', () => {
      expect(VARIANT.CONTROL).toBe('control');
      expect(VARIANT.TREATMENT).toBe('treatment');
    });
  });

  describe('Test Lifecycle', () => {
    it('should start a test', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      expect(testId).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(tester.activeTests.has(testId)).toBe(true);

      const test = tester.activeTests.get(testId);
      expect(test.status).toBe(TEST_STATUS.RUNNING);
      expect(test.controlSkill).toBe(controlSkill);
      expect(test.treatmentSkill).toBe(treatmentSkill);
    });

    it('should start test with custom options', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        trafficSplit: 0.3,
        minSampleSize: 50,
        hypothesis: 'Treatment is better'
      });

      const test = tester.activeTests.get(testId);
      expect(test.config.trafficSplit).toBe(0.3);
      expect(test.config.minSampleSize).toBe(50);
      expect(test.hypothesis).toBe('Treatment is better');
    });

    it('should update stats on test start', async () => {
      const initialStats = tester.stats.testsStarted;
      await tester.startTest(controlSkill, treatmentSkill);
      expect(tester.stats.testsStarted).toBe(initialStats + 1);
    });

    it('should cancel a test', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      const cancelled = tester.cancelTest(testId, 'Test reason');

      expect(cancelled).toBe(true);
      expect(tester.activeTests.has(testId)).toBe(false);
      expect(tester.testHistory.length).toBe(1);
      expect(tester.testHistory[0].status).toBe(TEST_STATUS.CANCELLED);
      expect(tester.testHistory[0].cancellationReason).toBe('Test reason');
    });

    it('should return false when cancelling non-existent test', () => {
      const cancelled = tester.cancelTest('nonexistent');
      expect(cancelled).toBe(false);
    });

    it('should emit events during test lifecycle', async () => {
      const events = [];
      tester.on('test:started', (data) => events.push({ type: 'started', data }));
      tester.on('test:cancelled', (data) => events.push({ type: 'cancelled', data }));

      const testId = await tester.startTest(controlSkill, treatmentSkill);
      tester.cancelTest(testId);

      expect(events.length).toBe(2);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('cancelled');
    });
  });

  describe('Variant Selection', () => {
    it('should select variant for running test', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      const result = tester.selectVariant(testId);

      expect(result).not.toBeNull();
      expect(result.testId).toBe(testId);
      expect([VARIANT.CONTROL, VARIANT.TREATMENT]).toContain(result.variant);
      expect(result.skill).toBeDefined();
    });

    it('should return null for non-existent test', () => {
      const result = tester.selectVariant('nonexistent');
      expect(result).toBeNull();
    });

    it('should use random selection initially', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        trafficSplit: 0.5
      });

      // Run multiple selections
      const selections = [];
      for (let i = 0; i < 20; i++) {
        const result = tester.selectVariant(testId);
        selections.push(result.variant);
      }

      // Both variants should appear (statistically)
      expect(selections).toContain(VARIANT.CONTROL);
      expect(selections).toContain(VARIANT.TREATMENT);
    });

    it('should use RL after enough samples', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      // Record enough samples to trigger RL
      for (let i = 0; i < 4; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, true, 100);
      }

      // Now selection should use RL
      const result = tester.selectVariant(testId);

      expect(mockReinforcementLearner.selectAction).toHaveBeenCalled();
    });

    it('should respect traffic split', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        trafficSplit: 0.9 // 90% to treatment
      });

      let treatmentCount = 0;
      for (let i = 0; i < 100; i++) {
        const result = tester.selectVariant(testId);
        if (result.variant === VARIANT.TREATMENT) treatmentCount++;
      }

      // Should be roughly 90%
      expect(treatmentCount).toBeGreaterThan(70);
      expect(treatmentCount).toBeLessThan(100);
    });
  });

  describe('Result Recording', () => {
    it('should record successful result', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      await tester.recordResult(testId, VARIANT.CONTROL, true, 100);

      const test = tester.activeTests.get(testId);
      expect(test.results.control.activations).toBe(1);
      expect(test.results.control.successes).toBe(1);
      expect(test.results.control.totalDuration).toBe(100);
    });

    it('should record failed result', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      await tester.recordResult(testId, VARIANT.TREATMENT, false, 200);

      const test = tester.activeTests.get(testId);
      expect(test.results.treatment.activations).toBe(1);
      expect(test.results.treatment.failures).toBe(1);
      expect(test.results.treatment.successes).toBe(0);
    });

    it('should update RL on result', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      await tester.recordResult(testId, VARIANT.CONTROL, true, 100);

      expect(mockReinforcementLearner.calculateReward).toHaveBeenCalled();
      expect(mockReinforcementLearner.update).toHaveBeenCalled();
    });

    it('should update total samples stat', async () => {
      const initialSamples = tester.stats.totalSamples;
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      await tester.recordResult(testId, VARIANT.CONTROL, true, 100);
      await tester.recordResult(testId, VARIANT.TREATMENT, true, 100);

      expect(tester.stats.totalSamples).toBe(initialSamples + 2);
    });

    it('should emit result recorded event', async () => {
      const events = [];
      tester.on('result:recorded', (data) => events.push(data));

      const testId = await tester.startTest(controlSkill, treatmentSkill);
      await tester.recordResult(testId, VARIANT.CONTROL, true, 100);

      expect(events.length).toBe(1);
      expect(events[0].variant).toBe(VARIANT.CONTROL);
      expect(events[0].success).toBe(true);
    });

    it('should not record for non-running test', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);
      tester.cancelTest(testId);

      await tester.recordResult(testId, VARIANT.CONTROL, true, 100);

      // Result should not be recorded
      const test = tester.testHistory[0];
      expect(test.results.control.activations).toBe(0);
    });
  });

  describe('Statistical Significance', () => {
    it('should calculate significance correctly', () => {
      // High difference should give high significance
      const sig1 = tester._calculateSignificance(0.3, 100, 0.7, 100);
      expect(sig1).toBeGreaterThan(0.99);

      // Similar rates should give low significance
      const sig2 = tester._calculateSignificance(0.5, 100, 0.52, 100);
      expect(sig2).toBeLessThan(0.9);
    });

    it('should handle edge case where se is 0', () => {
      // Both 100% success rate
      const sig = tester._calculateSignificance(1, 100, 1, 100);
      expect(sig).toBe(0);
    });

    it('should calculate effect size correctly', () => {
      // Large difference
      const effect1 = tester._calculateEffectSize(0.3, 0.7);
      expect(effect1).toBeGreaterThan(0.5); // Large effect

      // Small difference
      const effect2 = tester._calculateEffectSize(0.5, 0.55);
      expect(effect2).toBeLessThan(0.2); // Small effect
    });

    it('should calculate normal CDF correctly', () => {
      expect(tester._normalCDF(0)).toBeCloseTo(0.5, 2);
      expect(tester._normalCDF(1.96)).toBeCloseTo(0.975, 2);
      expect(tester._normalCDF(-1.96)).toBeCloseTo(0.025, 2);
    });
  });

  describe('Test Completion', () => {
    it('should complete test when significance reached', async () => {
      jest.useFakeTimers();

      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 5,
        confidenceLevel: 0.90
      });

      // Record results with clear difference
      for (let i = 0; i < 5; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, i < 2, 100); // 40% success
      }
      for (let i = 0; i < 5; i++) {
        await tester.recordResult(testId, VARIANT.TREATMENT, true, 100); // 100% success
      }

      // Test should be completed
      expect(tester.activeTests.has(testId)).toBe(false);
      expect(tester.testHistory.length).toBe(1);
      expect(tester.testHistory[0].status).toBe(TEST_STATUS.COMPLETED);
      expect(tester.testHistory[0].winner).toBe(VARIANT.TREATMENT);

      jest.useRealTimers();
    });

    it('should not complete without minimum samples', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 10
      });

      // Record fewer than minimum samples
      for (let i = 0; i < 5; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, true, 100);
        await tester.recordResult(testId, VARIANT.TREATMENT, false, 100);
      }

      // Test should still be running
      expect(tester.activeTests.has(testId)).toBe(true);
    });

    it('should update stats on completion', async () => {
      jest.useFakeTimers();

      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 3
      });

      // Record results that will complete the test
      for (let i = 0; i < 5; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, false, 100);
        await tester.recordResult(testId, VARIANT.TREATMENT, true, 100);
      }

      expect(tester.stats.testsCompleted).toBe(1);
      expect(tester.stats.treatmentWins).toBe(1);

      jest.useRealTimers();
    });

    it('should emit completion event', async () => {
      jest.useFakeTimers();

      const events = [];
      tester.on('test:completed', (data) => events.push(data));

      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 3
      });

      for (let i = 0; i < 5; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, false, 100);
        await tester.recordResult(testId, VARIANT.TREATMENT, true, 100);
      }

      expect(events.length).toBe(1);
      expect(events[0].winner).toBe(VARIANT.TREATMENT);

      jest.useRealTimers();
    });
  });

  describe('Test Expiration', () => {
    it('should handle test expiration', async () => {
      jest.useFakeTimers();

      const testId = await tester.startTest(controlSkill, treatmentSkill);

      // Fast forward past max duration
      jest.advanceTimersByTime(tester.config.maxTestDuration + 1000);

      // Allow async operations
      await Promise.resolve();

      expect(tester.activeTests.has(testId)).toBe(false);
      expect(tester.testHistory[0].status).toBe(TEST_STATUS.EXPIRED);
      expect(tester.stats.testsExpired).toBe(1);

      jest.useRealTimers();
    });

    it('should emit expiration event', async () => {
      jest.useFakeTimers();

      const events = [];
      tester.on('test:expired', (data) => events.push(data));

      await tester.startTest(controlSkill, treatmentSkill);

      jest.advanceTimersByTime(tester.config.maxTestDuration + 1000);
      await Promise.resolve();

      expect(events.length).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Test Retrieval', () => {
    it('should get test by ID', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);

      const test = tester.getTest(testId);

      expect(test).not.toBeNull();
      expect(test.id).toBe(testId);
    });

    it('should get test from history', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill);
      tester.cancelTest(testId);

      const test = tester.getTest(testId);

      expect(test).not.toBeNull();
      expect(test.status).toBe(TEST_STATUS.CANCELLED);
    });

    it('should return null for non-existent test', () => {
      const test = tester.getTest('nonexistent');
      expect(test).toBeNull();
    });

    it('should get all active tests', async () => {
      await tester.startTest(controlSkill, treatmentSkill);
      await tester.startTest(controlSkill, treatmentSkill);

      const activeTests = tester.getActiveTests();

      expect(activeTests.length).toBe(2);
    });

    it('should get test history with filter', async () => {
      const testId1 = await tester.startTest(controlSkill, treatmentSkill);
      const testId2 = await tester.startTest(controlSkill, treatmentSkill);

      tester.cancelTest(testId1);

      const history = tester.getTestHistory({ status: TEST_STATUS.CANCELLED });

      expect(history.length).toBe(1);
      expect(history[0].id).toBe(testId1);
    });

    it('should limit test history results', async () => {
      for (let i = 0; i < 5; i++) {
        const testId = await tester.startTest(controlSkill, treatmentSkill);
        tester.cancelTest(testId);
      }

      const history = tester.getTestHistory({ limit: 3 });

      expect(history.length).toBe(3);
    });
  });

  describe('Current Results', () => {
    it('should get current results for a test', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 10
      });

      await tester.recordResult(testId, VARIANT.CONTROL, true, 100);
      await tester.recordResult(testId, VARIANT.CONTROL, true, 200);
      await tester.recordResult(testId, VARIANT.TREATMENT, true, 150);

      const results = tester.getCurrentResults(testId);

      expect(results.control.activations).toBe(2);
      expect(results.control.successRate).toBe(1);
      expect(results.control.avgDuration).toBe(150);
      expect(results.treatment.activations).toBe(1);
      expect(results.samplesNeeded).toBe(9); // max(10-2, 10-1) = 9 for treatment
    });

    it('should return null for non-existent test', () => {
      const results = tester.getCurrentResults('nonexistent');
      expect(results).toBeNull();
    });

    it('should indicate significance status', async () => {
      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 5,
        confidenceLevel: 0.95
      });

      // Record with clear difference
      for (let i = 0; i < 4; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, false, 100);
        await tester.recordResult(testId, VARIANT.TREATMENT, true, 100);
      }

      const results = tester.getCurrentResults(testId);

      expect(results.currentSignificance).toBeGreaterThan(0);
      expect(typeof results.isSignificant).toBe('boolean');
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', async () => {
      const stats = tester.getStats();

      expect(stats.testsStarted).toBeDefined();
      expect(stats.testsCompleted).toBeDefined();
      expect(stats.testsCancelled).toBeDefined();
      expect(stats.activeTestCount).toBeDefined();
      expect(stats.winRate).toBeDefined();
    });

    it('should calculate win rates', async () => {
      jest.useFakeTimers();

      // Complete two tests with different winners
      for (let winner of [VARIANT.CONTROL, VARIANT.TREATMENT]) {
        const testId = await tester.startTest(controlSkill, treatmentSkill, {
          minSampleSize: 3
        });

        for (let i = 0; i < 5; i++) {
          await tester.recordResult(testId, VARIANT.CONTROL, winner === VARIANT.CONTROL, 100);
          await tester.recordResult(testId, VARIANT.TREATMENT, winner === VARIANT.TREATMENT, 100);
        }
      }

      const stats = tester.getStats();

      expect(stats.testsCompleted).toBe(2);
      expect(stats.controlWins).toBe(1);
      expect(stats.treatmentWins).toBe(1);
      expect(stats.winRate.control).toBe('50.0%');
      expect(stats.winRate.treatment).toBe('50.0%');

      jest.useRealTimers();
    });
  });

  describe('Reset', () => {
    it('should reset all state', async () => {
      await tester.startTest(controlSkill, treatmentSkill);
      const testId2 = await tester.startTest(controlSkill, treatmentSkill);
      tester.cancelTest(testId2);

      tester.reset();

      expect(tester.activeTests.size).toBe(0);
      expect(tester.testHistory.length).toBe(0);
      expect(tester.stats.testsStarted).toBe(0);
    });

    it('should clear timers on reset', async () => {
      jest.useFakeTimers();

      await tester.startTest(controlSkill, treatmentSkill);
      expect(tester.testTimers.size).toBe(1);

      tester.reset();

      expect(tester.testTimers.size).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Internal Methods', () => {
    it('should generate unique test IDs', () => {
      const id1 = tester._generateTestId();
      const id2 = tester._generateTestId();

      expect(id1).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should clear test timer', async () => {
      jest.useFakeTimers();

      const testId = await tester.startTest(controlSkill, treatmentSkill);
      expect(tester.testTimers.has(testId)).toBe(true);

      tester._clearTestTimer(testId);

      expect(tester.testTimers.has(testId)).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('KnowledgeBrain Integration', () => {
    it('should store test result on completion', async () => {
      jest.useFakeTimers();

      const testId = await tester.startTest(controlSkill, treatmentSkill, {
        minSampleSize: 3
      });

      for (let i = 0; i < 5; i++) {
        await tester.recordResult(testId, VARIANT.CONTROL, false, 100);
        await tester.recordResult(testId, VARIANT.TREATMENT, true, 100);
      }

      expect(mockKnowledgeBrain.storeTestResult).toHaveBeenCalled();
      const call = mockKnowledgeBrain.storeTestResult.mock.calls[0][0];
      expect(call.testId).toBe(testId);
      expect(call.type).toBe('ab_test');
      expect(call.winner).toBe(VARIANT.TREATMENT);

      jest.useRealTimers();
    });
  });
});
