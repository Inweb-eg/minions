import { describe, test, expect } from '@jest/globals';
import {
  LearningEvents,
  EventTypes
} from '../event-bus/eventTypes.js';

describe('LearningEvents', () => {
  describe('pattern detection events', () => {
    test('should have pattern detection events', () => {
      expect(LearningEvents.PATTERN_DETECTED).toBe('learning:pattern:detected');
      expect(LearningEvents.PATTERN_THRESHOLD).toBe('learning:pattern:threshold');
    });
  });

  describe('skill generation events', () => {
    test('should have skill generation events', () => {
      expect(LearningEvents.SKILL_GENERATING).toBe('learning:skill:generating');
      expect(LearningEvents.SKILL_GENERATED).toBe('learning:skill:generated');
      expect(LearningEvents.SKILL_VALIDATED).toBe('learning:skill:validated');
      expect(LearningEvents.SKILL_DEPLOYED).toBe('learning:skill:deployed');
      expect(LearningEvents.SKILL_FAILED).toBe('learning:skill:failed');
    });
  });

  describe('reinforcement learning events', () => {
    test('should have RL events', () => {
      expect(LearningEvents.REWARD_CALCULATED).toBe('learning:reward:calculated');
      expect(LearningEvents.POLICY_UPDATED).toBe('learning:policy:updated');
      expect(LearningEvents.ACTION_SELECTED).toBe('learning:action:selected');
      expect(LearningEvents.EPISODE_ENDED).toBe('learning:episode:ended');
    });
  });

  describe('A/B testing events', () => {
    test('should have A/B testing events', () => {
      expect(LearningEvents.ABTEST_STARTED).toBe('learning:abtest:started');
      expect(LearningEvents.ABTEST_COMPLETED).toBe('learning:abtest:completed');
      expect(LearningEvents.ABTEST_WINNER).toBe('learning:abtest:winner');
    });
  });

  describe('teaching events', () => {
    test('should have teaching events', () => {
      expect(LearningEvents.SKILL_SHARED).toBe('teaching:skill:shared');
      expect(LearningEvents.SKILL_RECEIVED).toBe('teaching:skill:received');
      expect(LearningEvents.MASTERY_ACHIEVED).toBe('teaching:mastery:achieved');
      expect(LearningEvents.CURRICULUM_CREATED).toBe('teaching:curriculum:created');
    });
  });

  describe('error events', () => {
    test('should have learning error event', () => {
      expect(LearningEvents.LEARNING_ERROR).toBe('learning:error');
    });
  });

  describe('EventTypes aggregate', () => {
    test('should include all learning events in EventTypes', () => {
      // Pattern detection
      expect(EventTypes.PATTERN_DETECTED).toBe('learning:pattern:detected');
      expect(EventTypes.PATTERN_THRESHOLD).toBe('learning:pattern:threshold');

      // Skill generation
      expect(EventTypes.SKILL_GENERATING).toBe('learning:skill:generating');
      expect(EventTypes.SKILL_GENERATED).toBe('learning:skill:generated');
      expect(EventTypes.SKILL_VALIDATED).toBe('learning:skill:validated');
      expect(EventTypes.SKILL_DEPLOYED).toBe('learning:skill:deployed');
      expect(EventTypes.SKILL_FAILED).toBe('learning:skill:failed');

      // Reinforcement learning
      expect(EventTypes.REWARD_CALCULATED).toBe('learning:reward:calculated');
      expect(EventTypes.POLICY_UPDATED).toBe('learning:policy:updated');
      expect(EventTypes.ACTION_SELECTED).toBe('learning:action:selected');
      expect(EventTypes.EPISODE_ENDED).toBe('learning:episode:ended');

      // A/B testing
      expect(EventTypes.ABTEST_STARTED).toBe('learning:abtest:started');
      expect(EventTypes.ABTEST_COMPLETED).toBe('learning:abtest:completed');
      expect(EventTypes.ABTEST_WINNER).toBe('learning:abtest:winner');

      // Teaching
      expect(EventTypes.SKILL_SHARED).toBe('teaching:skill:shared');
      expect(EventTypes.SKILL_RECEIVED).toBe('teaching:skill:received');
      expect(EventTypes.MASTERY_ACHIEVED).toBe('teaching:mastery:achieved');
      expect(EventTypes.CURRICULUM_CREATED).toBe('teaching:curriculum:created');

      // Error
      expect(EventTypes.LEARNING_ERROR).toBe('learning:error');
    });

    test('should still include original events', () => {
      // Agent events
      expect(EventTypes.AGENT_STARTED).toBe('agent:started');
      expect(EventTypes.AGENT_COMPLETED).toBe('agent:completed');
      expect(EventTypes.AGENT_FAILED).toBe('agent:failed');

      // Test events
      expect(EventTypes.TESTS_STARTED).toBe('tests:started');
      expect(EventTypes.TESTS_COMPLETED).toBe('tests:completed');

      // Code events
      expect(EventTypes.CODE_GENERATED).toBe('code:generated');
      expect(EventTypes.FIX_COMPLETED).toBe('code:fix:completed');
    });

    test('should have correct number of learning events', () => {
      const learningEventCount = Object.keys(LearningEvents).length;
      expect(learningEventCount).toBe(19);
    });
  });

  describe('event naming convention', () => {
    test('all learning events should follow namespace:segment pattern', () => {
      Object.values(LearningEvents).forEach(event => {
        // Pattern: namespace:segment or namespace:segment:segment
        expect(event).toMatch(/^(learning|teaching)(:[a-z]+)+$/);
      });
    });
  });
});
