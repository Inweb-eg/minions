/**
 * Learning Module - Self-Learning System for Minions
 *
 * This module provides:
 * - ReinforcementLearner: Q-learning optimization for skill/action selection (Phase 1)
 * - DynamicSkillGenerator: Creates skills from detected patterns (Phase 2)
 * - SkillABTester: A/B testing framework for skills (Phase 3)
 * - CrossAgentTeacher: Agent-to-agent skill transfer (Phase 4)
 *
 * NOTE: This module extends existing components:
 * - DecisionLogger: Extended with experience/pattern methods
 * - KnowledgeBrain: Extended with learning-specific KNOWLEDGE_TYPES
 * - MetricsCollector: Used as-is for metrics
 *
 * @module foundation/learning
 */

// Core learning components
import ReinforcementLearner, {
  getReinforcementLearner,
  resetReinforcementLearner,
  REWARD_SIGNALS
} from './ReinforcementLearner.js';

import DynamicSkillGenerator, {
  getDynamicSkillGenerator,
  resetDynamicSkillGenerator,
  GENERATION_STATUS,
  SKILL_TEMPLATES
} from './DynamicSkillGenerator.js';

import SkillABTester, {
  getSkillABTester,
  resetSkillABTester,
  TEST_STATUS,
  VARIANT
} from './SkillABTester.js';

// Cross-Agent Teaching (Phase 4)
import CrossAgentTeacher, {
  getCrossAgentTeacher,
  resetCrossAgentTeacher,
  MASTERY_LEVEL,
  TEACHING_STATUS
} from '../teaching/CrossAgentTeacher.js';

// Re-export existing extended components for convenience
export { getDecisionLogger, DecisionType, DecisionOutcome } from '../memory-store/DecisionLogger.js';
export { getKnowledgeBrain, KNOWLEDGE_TYPES, QUALITY_LEVELS } from '../knowledge-brain/KnowledgeBrain.js';
export { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';
export { LearningEvents } from '../event-bus/eventTypes.js';

// Export classes
export {
  ReinforcementLearner,
  DynamicSkillGenerator,
  SkillABTester,
  CrossAgentTeacher
};

// Export singleton getters
export {
  getReinforcementLearner,
  getDynamicSkillGenerator,
  getSkillABTester,
  getCrossAgentTeacher
};

// Export reset functions (for testing)
export {
  resetReinforcementLearner,
  resetDynamicSkillGenerator,
  resetSkillABTester,
  resetCrossAgentTeacher
};

// Export constants
export {
  REWARD_SIGNALS,
  GENERATION_STATUS,
  SKILL_TEMPLATES,
  TEST_STATUS,
  VARIANT,
  MASTERY_LEVEL,
  TEACHING_STATUS
};

/**
 * Initialize the learning system (Phase 1-4)
 * @param {Object} options - Configuration options
 * @param {number} [options.learningRate=0.1] - Q-learning learning rate (alpha)
 * @param {number} [options.discountFactor=0.95] - Q-learning discount factor (gamma)
 * @param {number} [options.explorationRate=0.2] - Initial exploration rate (epsilon)
 * @param {boolean} [options.enableAutoGeneration=true] - Enable auto skill generation
 * @param {boolean} [options.enableCanaryDeployment=true] - Enable canary deployment
 * @param {number} [options.minPatternCount=3] - Min pattern count for generation
 * @param {number} [options.minSampleSize=30] - Min samples for A/B test significance
 * @param {number} [options.confidenceLevel=0.95] - Required confidence for A/B tests
 * @param {string} [options.minMasteryToTeach] - Min mastery level to teach skills
 * @returns {Promise<Object>} Initialized learning components
 */
export async function initializeLearningSystem(options = {}) {
  const {
    learningRate = 0.1,
    discountFactor = 0.95,
    explorationRate = 0.2,
    enableAutoSubscribe = true,
    enableAutoGeneration = true,
    enableCanaryDeployment = true,
    minPatternCount = 3,
    minSampleSize = 30,
    confidenceLevel = 0.95,
    minMasteryToTeach = MASTERY_LEVEL.ADVANCED
  } = options;

  // Get singleton instances
  const reinforcementLearner = getReinforcementLearner({
    learningRate,
    discountFactor,
    explorationRate,
    enableAutoSubscribe
  });

  const skillGenerator = getDynamicSkillGenerator({
    enableAutoGeneration,
    enableCanaryDeployment,
    minPatternCount
  });

  const abTester = getSkillABTester({
    minSampleSize,
    confidenceLevel
  });

  const teacher = getCrossAgentTeacher({
    minMasteryToTeach,
    enableAutoSubscribe
  });

  // Initialize all components
  await Promise.all([
    reinforcementLearner.initialize(),
    skillGenerator.initialize(),
    abTester.initialize(),
    teacher.initialize()
  ]);

  return {
    reinforcementLearner,
    skillGenerator,
    abTester,
    teacher
  };
}

/**
 * Get learning system statistics
 * @returns {Object} Statistics from all learning components
 */
export function getLearningStats() {
  const rl = getReinforcementLearner();
  const generator = getDynamicSkillGenerator();
  const abTester = getSkillABTester();
  const teacher = getCrossAgentTeacher();

  return {
    reinforcement: rl.getStats(),
    skillGeneration: generator.getStats(),
    abTesting: abTester.getStats(),
    teaching: teacher.getStats()
  };
}

/**
 * Quick helper to select optimal action with RL
 * @param {Object|string} state - Current state
 * @param {string[]} availableActions - Available actions to choose from
 * @returns {Promise<Object>} Selected action with metadata
 */
export async function selectOptimalAction(state, availableActions) {
  const learner = getReinforcementLearner();
  await learner.initialize();
  return learner.selectAction(state, availableActions);
}

// Default export
export default {
  initializeLearningSystem,
  getLearningStats,
  selectOptimalAction,
  getReinforcementLearner,
  resetReinforcementLearner,
  getDynamicSkillGenerator,
  resetDynamicSkillGenerator,
  getSkillABTester,
  resetSkillABTester,
  getCrossAgentTeacher,
  resetCrossAgentTeacher,
  REWARD_SIGNALS,
  GENERATION_STATUS,
  SKILL_TEMPLATES,
  TEST_STATUS,
  VARIANT,
  MASTERY_LEVEL,
  TEACHING_STATUS
};
