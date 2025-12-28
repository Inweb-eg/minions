/**
 * Ecosystem Module - Plugin Marketplace & Self-Improvement
 *
 * This module provides the ecosystem layer for Minions:
 *
 * - PluginMarketplace: Community-driven agent ecosystem
 * - SelfImprovingEngine: Minions that can upgrade themselves
 */

// Import all components
import PluginMarketplace, {
  getPluginMarketplace,
  PLUGIN_CATEGORIES,
  PLUGIN_STATUS,
  SECURITY_LEVELS
} from './PluginMarketplace.js';

import SelfImprovingEngine, {
  getSelfImprovingEngine,
  IMPROVEMENT_CATEGORIES,
  ANALYSIS_TYPES,
  IMPROVEMENT_STATUS
} from './SelfImprovingEngine.js';

// Export classes
export {
  PluginMarketplace,
  SelfImprovingEngine
};

// Export singleton getters
export {
  getPluginMarketplace,
  getSelfImprovingEngine
};

// Export constants
export {
  PLUGIN_CATEGORIES,
  PLUGIN_STATUS,
  SECURITY_LEVELS,
  IMPROVEMENT_CATEGORIES,
  ANALYSIS_TYPES,
  IMPROVEMENT_STATUS
};

/**
 * Initialize the complete ecosystem
 * @param {Object} options Configuration options
 * @returns {Promise<Object>} Initialized components
 */
export async function initializeEcosystem(options = {}) {
  const {
    enableAutoImprove = false,
    requireApproval = true,
    enableSecurityScan = true,
    enableSandbox = true
  } = options;

  // Initialize components
  const marketplace = getPluginMarketplace({
    enableSecurityScan,
    enableSandbox
  });

  const selfImprover = getSelfImprovingEngine({
    enableAutoImprove,
    requireApproval
  });

  await Promise.all([
    marketplace.initialize(),
    selfImprover.initialize()
  ]);

  return {
    marketplace,
    selfImprover
  };
}

/**
 * Quick helper to search plugins
 * @param {string} query Search query
 * @param {Object} options Search options
 * @returns {Promise<Array>} Matching plugins
 */
export async function searchPlugins(query, options = {}) {
  const marketplace = getPluginMarketplace();
  await marketplace.initialize();
  return marketplace.searchPlugins(query, options);
}

/**
 * Quick helper to install a plugin
 * @param {string} pluginId Plugin ID
 * @returns {Promise<Object>} Installation result
 */
export async function installPlugin(pluginId) {
  const marketplace = getPluginMarketplace();
  await marketplace.initialize();
  return marketplace.installPlugin(pluginId);
}

/**
 * Quick helper to trigger self-improvement
 * @returns {Promise<Object>} Improvement result
 */
export async function triggerSelfImprovement() {
  const selfImprover = getSelfImprovingEngine();
  await selfImprover.initialize();
  return selfImprover.upgradeItself();
}

/**
 * Get system health and status
 * @returns {Promise<Object>} System health
 */
export async function getSystemHealth() {
  const selfImprover = getSelfImprovingEngine();
  await selfImprover.initialize();

  const analysis = selfImprover.getSelfAnalysis() || await selfImprover.analyzeSelf();

  return {
    version: selfImprover.getVersion(),
    healthScore: analysis.healthScore,
    weaknesses: analysis.weaknesses,
    pendingImprovements: selfImprover.getPendingImprovements().length,
    stats: selfImprover.getStats()
  };
}

/**
 * Get ecosystem statistics
 * @returns {Object} Combined statistics
 */
export function getEcosystemStats() {
  const marketplace = getPluginMarketplace();
  const selfImprover = getSelfImprovingEngine();

  return {
    marketplace: marketplace.getStats(),
    selfImprovement: selfImprover.getStats()
  };
}

/**
 * Get featured content
 * @returns {Promise<Object>} Featured plugins and improvements
 */
export async function getFeaturedContent() {
  const marketplace = getPluginMarketplace();
  await marketplace.initialize();

  return {
    featuredPlugins: marketplace.getFeaturedPlugins(),
    categories: marketplace.getCategories()
  };
}

// Default export
export default {
  initializeEcosystem,
  searchPlugins,
  installPlugin,
  triggerSelfImprovement,
  getSystemHealth,
  getEcosystemStats,
  getFeaturedContent,
  getPluginMarketplace,
  getSelfImprovingEngine
};
