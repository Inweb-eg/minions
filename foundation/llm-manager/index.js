/**
 * LLM Manager - Cost-Aware AI Model Management
 *
 * This module provides intelligent LLM routing and cost optimization:
 *
 * - CostAwareRouter: Routes requests to cheapest acceptable model (95% savings)
 * - BudgetManager: Tracks spending, allocates budget, prevents overruns
 * - ResponseCache: Caches responses for 100% free cache hits
 */

// Import all components
import CostAwareRouter, { getCostAwareRouter, MODEL_TIERS, COMPLEXITY_PATTERNS } from './CostAwareRouter.js';
import BudgetManager, { getBudgetManager, DEFAULT_ALLOCATION, ALERT_THRESHOLDS } from './BudgetManager.js';
import ResponseCache, { getResponseCache, DEFAULT_CONFIG as CACHE_CONFIG } from './ResponseCache.js';

// Export classes
export {
  CostAwareRouter,
  BudgetManager,
  ResponseCache
};

// Export singleton getters
export {
  getCostAwareRouter,
  getBudgetManager,
  getResponseCache
};

// Export constants
export {
  MODEL_TIERS,
  COMPLEXITY_PATTERNS,
  DEFAULT_ALLOCATION,
  ALERT_THRESHOLDS,
  CACHE_CONFIG
};

/**
 * Initialize the complete LLM management system
 * @param {Object} options Configuration options
 * @returns {Promise<Object>} Initialized components
 */
export async function initializeLLMManager(options = {}) {
  const {
    monthlyBudget = 200,
    enableLocalModels = true,
    enableCache = true,
    cacheDir = '.cache/llm-responses',
    cacheTTLMinutes = 15
  } = options;

  // Initialize components
  const cache = getResponseCache({
    enableFilePersistence: enableCache,
    cacheDir,
    ttlMinutes: cacheTTLMinutes
  });

  const budgetManager = getBudgetManager({
    monthlyBudget
  });

  const router = getCostAwareRouter({
    enableLocalModels,
    enableCache
  });

  // Wire components together
  router.setCache(cache);
  router.setBudgetManager(budgetManager);

  // Initialize all
  await Promise.all([
    cache.initialize(),
    budgetManager.initialize(),
    router.initialize()
  ]);

  return {
    router,
    budgetManager,
    cache
  };
}

/**
 * Quick helper to route a prompt with cost optimization
 * @param {string} prompt The prompt to send
 * @param {Object} options Routing options
 * @returns {Promise<Object>} Model response
 */
export async function routePrompt(prompt, options = {}) {
  const router = getCostAwareRouter();
  await router.initialize();

  return router.route({
    prompt,
    ...options
  });
}

/**
 * Get current cost statistics
 * @returns {Object} Cost and usage statistics
 */
export function getCostStats() {
  const router = getCostAwareRouter();
  const budget = getBudgetManager();
  const cache = getResponseCache();

  return {
    routing: router.getStats(),
    budget: budget.getStatus(),
    cache: cache.getStats()
  };
}

/**
 * Get cost optimization recommendations
 * @returns {Promise<Object>} Optimization recommendations
 */
export async function getOptimizationRecommendations() {
  const budget = getBudgetManager();
  return budget.optimizeSpending();
}

// Default export
export default {
  initializeLLMManager,
  routePrompt,
  getCostStats,
  getOptimizationRecommendations,
  getCostAwareRouter,
  getBudgetManager,
  getResponseCache
};
