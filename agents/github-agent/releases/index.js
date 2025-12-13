/**
 * Releases Module - Release and Analytics Management
 *
 * Phase 9.4: Release & Analytics
 * Exports all release and analytics components
 */

export {
  ReleaseManager,
  getReleaseManager,
  RELEASE_TYPE
} from './release-manager.js';

export {
  Analytics,
  getAnalytics,
  TIME_PERIOD
} from './analytics.js';

import { getReleaseManager as _getReleaseManager } from './release-manager.js';
import { getAnalytics as _getAnalytics } from './analytics.js';

/**
 * Get all release managers
 * @returns {Object} All manager instances
 */
export function getAllReleaseManagers() {
  return {
    release: _getReleaseManager(),
    analytics: _getAnalytics()
  };
}

/**
 * Initialize all release managers
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialized managers
 */
export async function initializeReleaseManagers(options = {}) {
  const managers = getAllReleaseManagers();

  await Promise.all([
    managers.release.initialize(options),
    managers.analytics.initialize(options)
  ]);

  return managers;
}

/**
 * Clear all release histories
 */
export function clearAllReleaseHistories() {
  const managers = getAllReleaseManagers();
  Object.values(managers).forEach(manager => manager.clearHistory());
}
