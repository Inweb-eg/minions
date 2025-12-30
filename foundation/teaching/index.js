/**
 * Teaching Module - Cross-Agent Skill Transfer for Minions
 *
 * This module provides:
 * - CrossAgentTeacher: Agent-to-agent skill transfer and collaborative learning
 *
 * Features:
 * - Skill packaging for cross-agent transfer
 * - Skill reception and validation
 * - Mastery level tracking per agent/skill
 * - Curriculum generation for systematic learning
 *
 * @module foundation/teaching
 */

import CrossAgentTeacher, {
  getCrossAgentTeacher,
  resetCrossAgentTeacher,
  MASTERY_LEVEL,
  TEACHING_STATUS
} from './CrossAgentTeacher.js';

// Re-export from learning module for convenience
export { LearningEvents } from '../event-bus/eventTypes.js';
export { getKnowledgeBrain, KNOWLEDGE_TYPES } from '../knowledge-brain/KnowledgeBrain.js';

// Export class
export { CrossAgentTeacher };

// Export singleton getter
export { getCrossAgentTeacher };

// Export reset function (for testing)
export { resetCrossAgentTeacher };

// Export constants
export { MASTERY_LEVEL, TEACHING_STATUS };

/**
 * Initialize the teaching system
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Initialized teaching components
 */
export async function initializeTeachingSystem(options = {}) {
  const teacher = getCrossAgentTeacher(options);
  await teacher.initialize();

  return { teacher };
}

/**
 * Get teaching system statistics
 * @returns {Object} Statistics from teaching components
 */
export function getTeachingStats() {
  const teacher = getCrossAgentTeacher();
  return teacher.getStats();
}

// Default export
export default {
  CrossAgentTeacher,
  getCrossAgentTeacher,
  resetCrossAgentTeacher,
  initializeTeachingSystem,
  getTeachingStats,
  MASTERY_LEVEL,
  TEACHING_STATUS
};
