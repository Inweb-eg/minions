import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ReinforcementLearner,
  getReinforcementLearner,
  resetReinforcementLearner,
  REWARD_SIGNALS
} from '../learning/ReinforcementLearner.js';
import { getKnowledgeBrain } from '../knowledge-brain/KnowledgeBrain.js';
import { getDecisionLogger, DecisionType } from '../memory-store/DecisionLogger.js';

describe('ReinforcementLearner', () => {
  let learner;

  beforeEach(async () => {
    // Reset singleton for fresh instance
    resetReinforcementLearner();

    // Create fresh instance with disabled auto-save to speed up tests
    learner = getReinforcementLearner({
      saveInterval: 0, // Disable auto-save in tests
      enableAutoSubscribe: false, // Disable auto-subscribe for controlled testing
      learningRate: 0.1,
      discountFactor: 0.95,
      explorationRate: 0.2
    });

    await learner.initialize();
  });

  afterEach(async () => {
    if (learner && learner.saveIntervalId) {
      clearInterval(learner.saveIntervalId);
    }
    resetReinforcementLearner();
  });

  describe('REWARD_SIGNALS', () => {
    test('should have all reward signal constants', () => {
      expect(REWARD_SIGNALS.SUCCESS).toBe(1.0);
      expect(REWARD_SIGNALS.PARTIAL_SUCCESS).toBe(0.5);
      expect(REWARD_SIGNALS.FAILURE).toBe(-0.5);
      expect(REWARD_SIGNALS.TIMEOUT).toBe(-0.3);
      expect(REWARD_SIGNALS.USER_POSITIVE).toBe(0.8);
      expect(REWARD_SIGNALS.USER_NEGATIVE).toBe(-0.8);
      expect(REWARD_SIGNALS.FAST_COMPLETION).toBe(0.2);
      expect(REWARD_SIGNALS.SLOW_COMPLETION).toBe(-0.1);
      expect(REWARD_SIGNALS.QUALITY_BONUS).toBe(0.3);
    });
  });

  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const instance1 = getReinforcementLearner();
      const instance2 = getReinforcementLearner();
      expect(instance1).toBe(instance2);
    });

    test('should reset singleton properly', () => {
      const instance1 = getReinforcementLearner();
      resetReinforcementLearner();
      const instance2 = getReinforcementLearner();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initialization', () => {
    test('should initialize with default config', async () => {
      resetReinforcementLearner();
      const newLearner = new ReinforcementLearner({
        saveInterval: 0,
        enableAutoSubscribe: false
      });
      // Set override to prevent policy loading from changing exploration rate
      newLearner.config._explorationRateOverridden = true;
      await newLearner.initialize();

      expect(newLearner.initialized).toBe(true);
      expect(newLearner.config.learningRate).toBe(0.1);
      expect(newLearner.config.discountFactor).toBe(0.95);
      expect(newLearner.config.explorationRate).toBe(0.2);

      // Cleanup
      if (newLearner.saveIntervalId) {
        clearInterval(newLearner.saveIntervalId);
      }
    });

    test('should initialize with custom config', async () => {
      resetReinforcementLearner();
      const newLearner = new ReinforcementLearner({
        learningRate: 0.05,
        discountFactor: 0.9,
        explorationRate: 0.3,
        saveInterval: 0,
        enableAutoSubscribe: false
      });
      // Set exploration rate override to prevent policy loading from changing it
      newLearner.config._explorationRateOverridden = true;
      await newLearner.initialize();

      expect(newLearner.config.learningRate).toBe(0.05);
      expect(newLearner.config.discountFactor).toBe(0.9);
      expect(newLearner.config.explorationRate).toBe(0.3);
    });

    test('should only initialize once', async () => {
      const initializedBefore = learner.initialized;
      await learner.initialize();
      expect(learner.initialized).toBe(initializedBefore);
    });
  });

  describe('selectAction', () => {
    test('should throw error if no actions available', () => {
      expect(() => learner.selectAction('state1', [])).toThrow('No available actions');
      expect(() => learner.selectAction('state1', null)).toThrow('No available actions');
    });

    test('should return action with metadata', () => {
      const result = learner.selectAction('state1', ['action1', 'action2']);

      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('isExploration');
      expect(result).toHaveProperty('stateKey');
      expect(['action1', 'action2']).toContain(result.action);
    });

    test('should explore with probability epsilon', () => {
      learner.setExplorationRate(1.0); // Always explore

      const explorationCounts = { action1: 0, action2: 0 };
      for (let i = 0; i < 100; i++) {
        const result = learner.selectAction('state1', ['action1', 'action2']);
        explorationCounts[result.action]++;
        expect(result.isExploration).toBe(true);
      }

      // Should have roughly 50/50 distribution (with some tolerance)
      expect(explorationCounts.action1).toBeGreaterThan(20);
      expect(explorationCounts.action2).toBeGreaterThan(20);
    });

    test('should exploit with probability 1-epsilon', async () => {
      // Reset learner to get fresh state
      learner.reset();
      learner.setExplorationRate(0); // Always exploit

      // Set up Q-values so action2 is better
      await learner.update('exploit_state1', 'action2', 1.0, 'exploit_state2');
      // Set exploration rate back to 0 after update (update decays it)
      learner.setExplorationRate(0);

      for (let i = 0; i < 10; i++) {
        const result = learner.selectAction('exploit_state1', ['action1', 'action2']);
        expect(result.action).toBe('action2');
        expect(result.isExploration).toBe(false);
      }
    });

    test('should handle object states', () => {
      const state = { agent: 'test', context: 'foo' };
      const result = learner.selectAction(state, ['a', 'b']);
      expect(result.stateKey).toBe(JSON.stringify(state));
    });

    test('should track exploration statistics', () => {
      const initialExploration = learner.stats.explorationActions;
      const initialExploitation = learner.stats.exploitationActions;

      learner.setExplorationRate(1.0);
      learner.selectAction('state1', ['action1']);
      expect(learner.stats.explorationActions).toBe(initialExploration + 1);

      learner.setExplorationRate(0);
      learner.selectAction('state1', ['action1']);
      expect(learner.stats.exploitationActions).toBe(initialExploitation + 1);
    });
  });

  describe('selectActionThompson', () => {
    test('should throw error if no actions available', () => {
      expect(() => learner.selectActionThompson('state1', [])).toThrow('No available actions');
    });

    test('should return action with samples', () => {
      const result = learner.selectActionThompson('state1', ['action1', 'action2']);

      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('sample');
      expect(result).toHaveProperty('allSamples');
      expect(['action1', 'action2']).toContain(result.action);
      expect(result.sample).toBeGreaterThanOrEqual(0);
      expect(result.sample).toBeLessThanOrEqual(1);
    });

    test('should prefer actions with higher success rates over time', async () => {
      // Simulate action1 being much better
      for (let i = 0; i < 20; i++) {
        learner._updateActionStats('action1', true);
        learner._updateActionStats('action2', false);
      }

      // Thompson sampling should prefer action1 most of the time
      let action1Count = 0;
      for (let i = 0; i < 50; i++) {
        const result = learner.selectActionThompson('state1', ['action1', 'action2']);
        if (result.action === 'action1') action1Count++;
      }

      // action1 should be selected most of the time
      expect(action1Count).toBeGreaterThan(35);
    });
  });

  describe('update (Q-learning)', () => {
    test('should update Q-value correctly', async () => {
      const newQ = await learner.update('state1', 'action1', 1.0, 'state2');

      expect(newQ).toBeGreaterThan(0);
      expect(learner.getQValues('state1').action1).toBe(newQ);
    });

    test('should follow Q-learning formula', async () => {
      // Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
      const alpha = learner.config.learningRate;
      const gamma = learner.config.discountFactor;
      const reward = 1.0;

      // First update: Q(s1, a1) starts at 0
      // Q(s1, a1) = 0 + 0.1 * (1.0 + 0.95 * 0 - 0) = 0.1
      const q1 = await learner.update('state1', 'action1', reward, 'state2');
      expect(q1).toBeCloseTo(alpha * reward, 4);

      // Second update with same values
      // Q(s1, a1) = 0.1 + 0.1 * (1.0 + 0.95 * 0 - 0.1) = 0.1 + 0.09 = 0.19
      const q2 = await learner.update('state1', 'action1', reward, 'state2');
      const expectedQ2 = q1 + alpha * (reward + gamma * 0 - q1);
      expect(q2).toBeCloseTo(expectedQ2, 4);
    });

    test('should consider max Q of next state', async () => {
      // Set up Q-value for next state
      await learner.update('state2', 'action2', 1.0, 'state3');
      const maxQ_state2 = learner._getMaxQ('state2');
      expect(maxQ_state2).toBeGreaterThan(0);

      // Now update state1 -> state2, should use maxQ_state2
      const q = await learner.update('state1', 'action1', 0.5, 'state2');

      const alpha = learner.config.learningRate;
      const gamma = learner.config.discountFactor;
      // Q(s1, a1) = 0 + 0.1 * (0.5 + 0.95 * maxQ_state2 - 0)
      const expected = alpha * (0.5 + gamma * maxQ_state2);
      expect(q).toBeCloseTo(expected, 4);
    });

    test('should decay exploration rate', async () => {
      const initialRate = learner.config.explorationRate;
      await learner.update('state1', 'action1', 1.0, 'state2');

      expect(learner.config.explorationRate).toBeLessThan(initialRate);
    });

    test('should not decay below minimum exploration', async () => {
      learner.config.explorationRate = learner.config.minExploration;

      for (let i = 0; i < 10; i++) {
        await learner.update('state1', 'action1', 1.0, 'state2');
      }

      expect(learner.config.explorationRate).toBe(learner.config.minExploration);
    });

    test('should update statistics', async () => {
      const initialUpdates = learner.stats.totalUpdates;
      await learner.update('state1', 'action1', 1.0, 'state2');

      expect(learner.stats.totalUpdates).toBe(initialUpdates + 1);
    });

    test('should track running average reward', async () => {
      // Reset to get fresh stats
      learner.reset();

      await learner.update('avg_state1', 'action1', 1.0, 'avg_state2');
      expect(learner.stats.averageReward).toBe(1.0);

      await learner.update('avg_state2', 'action2', 0.5, 'avg_state3');
      expect(learner.stats.averageReward).toBe(0.75); // (1.0 + 0.5) / 2
    });

    test('should add to current episode', async () => {
      expect(learner.currentEpisode.length).toBe(0);

      await learner.update('state1', 'action1', 1.0, 'state2');
      expect(learner.currentEpisode.length).toBe(1);

      await learner.update('state2', 'action2', 0.5, 'state3');
      expect(learner.currentEpisode.length).toBe(2);
    });

    test('should update action stats for Thompson sampling', async () => {
      await learner.update('state1', 'action1', 1.0, 'state2'); // positive reward = success
      const stats = learner.getActionStats('action1');
      expect(stats.successes).toBe(2); // 1 initial + 1

      await learner.update('state2', 'action1', -0.5, 'state3'); // negative reward = failure
      const stats2 = learner.getActionStats('action1');
      expect(stats2.failures).toBe(2); // 1 initial + 1
    });
  });

  describe('calculateReward', () => {
    test('should return SUCCESS reward for success', () => {
      const reward = learner.calculateReward({ success: true });
      expect(reward).toBe(REWARD_SIGNALS.SUCCESS);
    });

    test('should return FAILURE reward for failure', () => {
      const reward = learner.calculateReward({ success: false });
      expect(reward).toBe(REWARD_SIGNALS.FAILURE);
    });

    test('should return PARTIAL_SUCCESS reward for partial', () => {
      const reward = learner.calculateReward({ success: false, partial: true });
      expect(reward).toBe(REWARD_SIGNALS.PARTIAL_SUCCESS);
    });

    test('should add FAST_COMPLETION bonus', () => {
      const reward = learner.calculateReward({
        success: true,
        metrics: { duration: 500 }
      });
      expect(reward).toBe(REWARD_SIGNALS.SUCCESS + REWARD_SIGNALS.FAST_COMPLETION);
    });

    test('should add SLOW_COMPLETION penalty', () => {
      const reward = learner.calculateReward({
        success: true,
        metrics: { duration: 15000 }
      });
      expect(reward).toBe(REWARD_SIGNALS.SUCCESS + REWARD_SIGNALS.SLOW_COMPLETION);
    });

    test('should add QUALITY_BONUS', () => {
      const reward = learner.calculateReward({
        success: true,
        metrics: { quality: 0.9 }
      });
      expect(reward).toBe(REWARD_SIGNALS.SUCCESS + REWARD_SIGNALS.QUALITY_BONUS);
    });

    test('should add USER_POSITIVE for high rating', () => {
      const reward = learner.calculateReward({
        success: true,
        feedback: { rating: 5 }
      });
      expect(reward).toBe(REWARD_SIGNALS.SUCCESS + REWARD_SIGNALS.USER_POSITIVE);
    });

    test('should add USER_NEGATIVE for low rating', () => {
      const reward = learner.calculateReward({
        success: true,
        feedback: { rating: 1 }
      });
      expect(reward).toBe(REWARD_SIGNALS.SUCCESS + REWARD_SIGNALS.USER_NEGATIVE);
    });

    test('should add TIMEOUT penalty', () => {
      const reward = learner.calculateReward({
        success: false,
        timeout: true
      });
      expect(reward).toBe(REWARD_SIGNALS.FAILURE + REWARD_SIGNALS.TIMEOUT);
    });

    test('should combine multiple reward components', () => {
      const reward = learner.calculateReward({
        success: true,
        metrics: { duration: 500, quality: 0.9 },
        feedback: { rating: 5 }
      });

      const expected = REWARD_SIGNALS.SUCCESS +
                       REWARD_SIGNALS.FAST_COMPLETION +
                       REWARD_SIGNALS.QUALITY_BONUS +
                       REWARD_SIGNALS.USER_POSITIVE;
      expect(reward).toBe(expected);
    });
  });

  describe('episodes', () => {
    test('should end episode and store in history', async () => {
      await learner.update('s1', 'a1', 1.0, 's2');
      await learner.update('s2', 'a2', 0.5, 's3');

      const episode = learner.endEpisode();

      expect(episode).toBeDefined();
      expect(episode.stepCount).toBe(2);
      expect(episode.totalReward).toBe(1.5);
      expect(episode.steps.length).toBe(2);
      expect(learner.currentEpisode.length).toBe(0);
      expect(learner.episodeHistory.length).toBe(1);
    });

    test('should return null if no steps in episode', () => {
      const episode = learner.endEpisode();
      expect(episode).toBeNull();
    });

    test('should limit episode history to 100', async () => {
      for (let i = 0; i < 105; i++) {
        await learner.update(`s${i}`, `a${i}`, 1.0, `s${i + 1}`);
        learner.endEpisode();
      }

      expect(learner.episodeHistory.length).toBe(100);
    });

    test('should emit episode:ended event', async () => {
      const eventHandler = jest.fn();
      learner.on('episode:ended', eventHandler);

      await learner.update('s1', 'a1', 1.0, 's2');
      learner.endEpisode();

      expect(eventHandler).toHaveBeenCalled();
      expect(eventHandler.mock.calls[0][0]).toHaveProperty('totalReward', 1.0);
    });
  });

  describe('getQValues', () => {
    test('should return empty object for unknown state', () => {
      const qValues = learner.getQValues('unknown');
      expect(qValues).toEqual({});
    });

    test('should return Q-values for known state', async () => {
      await learner.update('state1', 'action1', 1.0, 'state2');
      await learner.update('state1', 'action2', 0.5, 'state2');

      const qValues = learner.getQValues('state1');
      expect(qValues).toHaveProperty('action1');
      expect(qValues).toHaveProperty('action2');
    });
  });

  describe('getAllQValues', () => {
    test('should return all Q-values', async () => {
      await learner.update('state1', 'action1', 1.0, 'state2');
      await learner.update('state2', 'action2', 0.5, 'state3');

      const allQ = learner.getAllQValues();
      expect(allQ).toHaveProperty('state1');
      expect(allQ).toHaveProperty('state2');
    });
  });

  describe('getActionStats', () => {
    test('should return zeros for unknown action', () => {
      const stats = learner.getActionStats('unknown');
      expect(stats).toEqual({ successes: 0, failures: 0 });
    });

    test('should return stats for known action', async () => {
      await learner.update('s1', 'action1', 1.0, 's2');
      await learner.update('s2', 'action1', 1.0, 's3');

      const stats = learner.getActionStats('action1');
      expect(stats.successes).toBeGreaterThan(0);
    });
  });

  describe('getAllActionStats', () => {
    test('should return all action statistics', async () => {
      await learner.update('s1', 'action1', 1.0, 's2');
      await learner.update('s2', 'action2', -0.5, 's3');

      const allStats = learner.getAllActionStats();
      expect(allStats).toHaveProperty('action1');
      expect(allStats).toHaveProperty('action2');
    });
  });

  describe('getStats', () => {
    test('should return comprehensive stats', async () => {
      await learner.update('s1', 'a1', 1.0, 's2');

      const stats = learner.getStats();

      expect(stats).toHaveProperty('totalUpdates');
      expect(stats).toHaveProperty('averageReward');
      expect(stats).toHaveProperty('explorationActions');
      expect(stats).toHaveProperty('exploitationActions');
      expect(stats).toHaveProperty('stateCount');
      expect(stats).toHaveProperty('actionCount');
      expect(stats).toHaveProperty('explorationRate');
      expect(stats).toHaveProperty('episodeCount');
      expect(stats).toHaveProperty('currentEpisodeSteps');
      expect(stats).toHaveProperty('config');
    });
  });

  describe('getEpisodeHistory', () => {
    test('should return all episodes', async () => {
      for (let i = 0; i < 3; i++) {
        await learner.update(`s${i}`, `a${i}`, 1.0, `s${i + 1}`);
        learner.endEpisode();
      }

      const history = learner.getEpisodeHistory();
      expect(history.length).toBe(3);
    });

    test('should return limited episodes', async () => {
      for (let i = 0; i < 5; i++) {
        await learner.update(`s${i}`, `a${i}`, 1.0, `s${i + 1}`);
        learner.endEpisode();
      }

      const history = learner.getEpisodeHistory(2);
      expect(history.length).toBe(2);
    });
  });

  describe('getCurrentEpisode', () => {
    test('should return current episode steps', async () => {
      await learner.update('s1', 'a1', 1.0, 's2');
      await learner.update('s2', 'a2', 0.5, 's3');

      const current = learner.getCurrentEpisode();
      expect(current.length).toBe(2);
    });
  });

  describe('setExplorationRate', () => {
    test('should set exploration rate', () => {
      learner.setExplorationRate(0.5);
      expect(learner.config.explorationRate).toBe(0.5);
    });

    test('should throw for invalid rates', () => {
      expect(() => learner.setExplorationRate(-0.1)).toThrow();
      expect(() => learner.setExplorationRate(1.5)).toThrow();
    });
  });

  describe('reset', () => {
    test('should clear Q-table and stats', async () => {
      await learner.update('s1', 'a1', 1.0, 's2');
      learner.endEpisode();

      learner.reset();

      expect(learner.qTable.size).toBe(0);
      expect(learner.actionSuccesses.size).toBe(0);
      expect(learner.currentEpisode.length).toBe(0);
      expect(learner.episodeHistory.length).toBe(0);
      expect(learner.stats.totalUpdates).toBe(0);
    });

    test('should optionally reset config', async () => {
      learner.config.explorationRate = 0.05;

      learner.reset(false); // Don't keep config

      expect(learner.config.explorationRate).toBe(0.2); // Default
    });
  });

  describe('policy persistence', () => {
    test('should save policy to KnowledgeBrain', async () => {
      await learner.update('s1', 'a1', 1.0, 's2');
      await learner.savePolicy();

      // Verify by loading
      const kb = getKnowledgeBrain();
      const policy = await kb.loadRLPolicy();
      expect(policy).toBeDefined();
      expect(policy.qTable).toBeDefined();
    });

    test('should load policy from KnowledgeBrain', async () => {
      // Store some Q-values
      await learner.update('s1', 'a1', 1.0, 's2');
      await learner.savePolicy();

      // Reset and reload
      const stateCount = learner.qTable.size;
      learner.qTable.clear();
      expect(learner.qTable.size).toBe(0);

      await learner._loadPolicy();
      expect(learner.qTable.size).toBe(stateCount);
    });
  });

  describe('shutdown', () => {
    test('should save policy and cleanup', async () => {
      await learner.update('s1', 'a1', 1.0, 's2');
      await learner.shutdown();

      expect(learner.initialized).toBe(false);
      expect(learner.saveIntervalId).toBeNull();
    });
  });

  describe('internal methods', () => {
    test('_stateToKey should handle different state types', () => {
      expect(learner._stateToKey('string')).toBe('string');
      expect(learner._stateToKey({ a: 1 })).toBe('{"a":1}');
      expect(learner._stateToKey(null)).toBe('null');
      expect(learner._stateToKey(undefined)).toBe('null');
    });

    test('_getQ should return 0 for unknown state-action', () => {
      expect(learner._getQ('unknown', 'action')).toBe(0);
    });

    test('_getMaxQ should return 0 for unknown state', () => {
      expect(learner._getMaxQ('unknown')).toBe(0);
    });

    test('_getBestAction should return first action if all Q-values are 0', () => {
      const best = learner._getBestAction('unknown', ['a', 'b', 'c']);
      expect(best).toBe('a');
    });

    test('_randomSelect should select from array', () => {
      const arr = ['a', 'b', 'c'];
      for (let i = 0; i < 10; i++) {
        expect(arr).toContain(learner._randomSelect(arr));
      }
    });

    test('_sampleBeta should return value between 0 and 1', () => {
      for (let i = 0; i < 10; i++) {
        const sample = learner._sampleBeta(2, 3);
        expect(sample).toBeGreaterThanOrEqual(0);
        expect(sample).toBeLessThanOrEqual(1);
      }
    });

    test('_normalRandom should generate standard normal samples', () => {
      const samples = [];
      for (let i = 0; i < 1000; i++) {
        samples.push(learner._normalRandom());
      }

      // Check mean is close to 0
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(Math.abs(mean)).toBeLessThan(0.2);

      // Check std is close to 1
      const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
      const std = Math.sqrt(variance);
      expect(Math.abs(std - 1)).toBeLessThan(0.2);
    });
  });

  describe('event emission', () => {
    test('should emit update event', async () => {
      const handler = jest.fn();
      learner.on('update', handler);

      await learner.update('s1', 'a1', 1.0, 's2');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          stateKey: 's1',
          action: 'a1',
          reward: 1.0
        })
      );
    });
  });
});
