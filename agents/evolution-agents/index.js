/**
 * Evolution Agents - Self-Improving Code and Predictive Debugging
 *
 * This module provides revolutionary code evolution capabilities:
 *
 * - CodeEvolutionAgent: Genetic algorithm-based code improvement
 * - PredictiveDebugger: Time-travel debugging and bug prediction
 */

// Import all components
import CodeEvolutionAgent, {
  getCodeEvolutionAgent,
  EVOLUTION_STRATEGIES,
  MUTATION_TYPES,
  FITNESS_METRICS
} from './CodeEvolutionAgent.js';

import PredictiveDebugger, {
  getPredictiveDebugger,
  BUG_CATEGORIES,
  DEBUG_MODES,
  SNAPSHOT_TYPES
} from './PredictiveDebugger.js';

// Export classes
export {
  CodeEvolutionAgent,
  PredictiveDebugger
};

// Export singleton getters
export {
  getCodeEvolutionAgent,
  getPredictiveDebugger
};

// Export constants
export {
  EVOLUTION_STRATEGIES,
  MUTATION_TYPES,
  FITNESS_METRICS,
  BUG_CATEGORIES,
  DEBUG_MODES,
  SNAPSHOT_TYPES
};

/**
 * Initialize the complete evolution system
 * @param {Object} options Configuration options
 * @returns {Promise<Object>} Initialized components
 */
export async function initializeEvolutionSystem(options = {}) {
  const {
    populationSize = 5,
    generations = 5,
    mutationRate = 0.1,
    enableTimeTravelDebugging = true,
    enableAutoFix = false,
    learnFromBugs = true,
    debugMode = DEBUG_MODES.PROACTIVE
  } = options;

  // Initialize components
  const evolutionAgent = getCodeEvolutionAgent({
    populationSize,
    generations,
    mutationRate
  });

  const debugger_ = getPredictiveDebugger({
    mode: debugMode,
    enableTimeTravelDebugging,
    enableAutoFix,
    learnFromBugs
  });

  await Promise.all([
    evolutionAgent.initialize(),
    debugger_.initialize()
  ]);

  return {
    evolutionAgent,
    debugger: debugger_
  };
}

/**
 * Evolve code with automatic debugging analysis
 * @param {string} code The code to evolve
 * @param {Object} options Evolution options
 * @returns {Promise<Object>} Evolved code with debugging analysis
 */
export async function evolveAndAnalyze(code, options = {}) {
  const evolutionAgent = getCodeEvolutionAgent();
  const debugger_ = getPredictiveDebugger();

  await Promise.all([
    evolutionAgent.initialize(),
    debugger_.initialize()
  ]);

  // First analyze original code
  const originalAnalysis = await debugger_.analyzeCode(code, {
    filename: options.filename || 'unknown'
  });

  // Evolve the code
  const evolutionResult = await evolutionAgent.evolveCode(code, options);

  // Analyze evolved code
  let evolvedAnalysis = null;
  if (evolutionResult.success) {
    evolvedAnalysis = await debugger_.analyzeCode(evolutionResult.evolvedCode, {
      filename: options.filename || 'unknown'
    });
  }

  return {
    evolution: evolutionResult,
    originalAnalysis,
    evolvedAnalysis,
    improvement: {
      fitnessGain: evolutionResult.success ?
        evolutionResult.finalFitness.total - evolutionResult.originalFitness.total : 0,
      bugReduction: evolvedAnalysis ?
        originalAnalysis.predictions.length - evolvedAnalysis.predictions.length : 0,
      riskReduction: evolvedAnalysis ?
        originalAnalysis.riskScore - evolvedAnalysis.riskScore : 0
    }
  };
}

/**
 * Get combined statistics
 * @returns {Object} Combined evolution and debugging statistics
 */
export function getEvolutionStats() {
  const evolutionAgent = getCodeEvolutionAgent();
  const debugger_ = getPredictiveDebugger();

  return {
    evolution: evolutionAgent.getStats(),
    debugging: debugger_.getStats()
  };
}

/**
 * Quick helper to predict bugs in code
 * @param {string} code The code to analyze
 * @returns {Promise<Object>} Bug predictions
 */
export async function predictBugs(code, options = {}) {
  const debugger_ = getPredictiveDebugger();
  await debugger_.initialize();
  return debugger_.analyzeCode(code, options);
}

/**
 * Quick helper to evolve code
 * @param {string} code The code to evolve
 * @returns {Promise<Object>} Evolution result
 */
export async function evolveCode(code, options = {}) {
  const evolutionAgent = getCodeEvolutionAgent();
  await evolutionAgent.initialize();
  return evolutionAgent.evolveCode(code, options);
}

// Default export
export default {
  initializeEvolutionSystem,
  evolveAndAnalyze,
  getEvolutionStats,
  predictBugs,
  evolveCode,
  getCodeEvolutionAgent,
  getPredictiveDebugger
};
