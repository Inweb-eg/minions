/**
 * Builders Module - Docker Build System
 *
 * Phase 8.2: Build System
 * Exports all Docker builders
 */

export {
  BaseBuilder,
  BUILD_STATUS,
  BUILD_STRATEGY
} from './base-builder.js';

// Builder registry for custom builders
const builderRegistry = new Map();

/**
 * Register a custom builder
 * @param {string} name - Builder name
 * @param {Object} builder - Builder instance
 */
export function registerBuilder(name, builder) {
  builderRegistry.set(name, builder);
}

/**
 * Get all builders
 * @returns {Object} All builder instances
 */
export function getAllBuilders() {
  const builders = {};
  for (const [name, builder] of builderRegistry) {
    builders[name] = builder;
  }
  return builders;
}

/**
 * Get a specific builder by name
 * @param {string} name - Builder name
 * @returns {Object|null} Builder instance or null
 */
export function getBuilder(name) {
  return builderRegistry.get(name) || null;
}

/**
 * Build all registered services
 * @param {Object} options - Build options
 * @returns {Promise<Object>} Build results
 */
export async function buildAllServices(options = {}) {
  const builders = getAllBuilders();
  const results = {};

  for (const [service, builder] of Object.entries(builders)) {
    try {
      results[service] = await builder.buildProduction(options);
    } catch (error) {
      results[service] = {
        success: false,
        error: error.message
      };
    }
  }

  const successful = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;

  return {
    success: successful === total,
    results,
    summary: {
      total,
      successful,
      failed: total - successful
    }
  };
}

/**
 * Clear all build histories
 */
export function clearAllHistories() {
  const builders = getAllBuilders();
  Object.values(builders).forEach(builder => builder.clearHistory?.());
}
