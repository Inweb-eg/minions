/**
 * Knowledge Brain - Collective Intelligence System
 *
 * This module provides self-learning knowledge management:
 *
 * - KnowledgeBrain: Distributed knowledge storage with vector similarity
 * - PatternRecognitionEngine: Automatic pattern discovery and learning
 */

// Import all components
import KnowledgeBrain, {
  getKnowledgeBrain,
  KNOWLEDGE_TYPES,
  QUALITY_LEVELS
} from './KnowledgeBrain.js';

import PatternRecognitionEngine, {
  getPatternRecognitionEngine,
  PATTERN_CATEGORIES,
  PATTERN_DETECTORS
} from './PatternRecognitionEngine.js';

// Export classes
export {
  KnowledgeBrain,
  PatternRecognitionEngine
};

// Export singleton getters
export {
  getKnowledgeBrain,
  getPatternRecognitionEngine
};

// Export constants
export {
  KNOWLEDGE_TYPES,
  QUALITY_LEVELS,
  PATTERN_CATEGORIES,
  PATTERN_DETECTORS
};

/**
 * Initialize the complete knowledge system
 * @param {Object} options Configuration options
 * @returns {Promise<Object>} Initialized components
 */
export async function initializeKnowledgeSystem(options = {}) {
  const {
    storageDir = '.knowledge',
    enablePersistence = true,
    enableGraphRelations = true,
    enableAutoLearn = true
  } = options;

  // Initialize components
  const knowledgeBrain = getKnowledgeBrain({
    storageDir,
    enablePersistence,
    enableGraphRelations
  });

  const patternEngine = getPatternRecognitionEngine({
    enableAutoLearn
  });

  await Promise.all([
    knowledgeBrain.initialize(),
    patternEngine.initialize()
  ]);

  return {
    knowledgeBrain,
    patternEngine
  };
}

/**
 * Quick helper to learn from experience
 * @param {Object} experience The experience to learn from
 * @returns {Promise<Object>} Stored knowledge item
 */
export async function learn(experience) {
  const brain = getKnowledgeBrain();
  await brain.initialize();
  return brain.learn(experience);
}

/**
 * Quick helper to recall knowledge
 * @param {string|Object} query The query
 * @returns {Promise<Array>} Matching knowledge items
 */
export async function recall(query) {
  const brain = getKnowledgeBrain();
  await brain.initialize();
  return brain.recall(query);
}

/**
 * Analyze code for patterns
 * @param {string} code The code to analyze
 * @returns {Promise<Object>} Detected patterns
 */
export async function analyzePatterns(code) {
  const engine = getPatternRecognitionEngine();
  await engine.initialize();
  return engine.detectPatterns(code);
}

/**
 * Get knowledge statistics
 * @returns {Object} Combined statistics
 */
export function getKnowledgeStats() {
  const brain = getKnowledgeBrain();
  const engine = getPatternRecognitionEngine();

  return {
    knowledge: brain.getStats(),
    patterns: engine.getStats()
  };
}

// Default export
export default {
  initializeKnowledgeSystem,
  learn,
  recall,
  analyzePatterns,
  getKnowledgeStats,
  getKnowledgeBrain,
  getPatternRecognitionEngine
};
