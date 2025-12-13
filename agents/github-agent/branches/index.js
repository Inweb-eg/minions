/**
 * Branches Module - Branch and PR Management
 *
 * Phase 9.1: Branch & PR Management
 * Exports all branch and PR management components
 */

export {
  BaseManager,
  OPERATION_STATUS
} from './base-manager.js';

export {
  BranchManager,
  getBranchManager,
  BRANCH_TYPE
} from './branch-manager.js';

export {
  PRManager,
  getPRManager,
  PR_STATE
} from './pr-manager.js';

import { getBranchManager as _getBranchManager } from './branch-manager.js';
import { getPRManager as _getPRManager } from './pr-manager.js';

/**
 * Get all managers
 * @returns {Object} All manager instances
 */
export function getAllBranchManagers() {
  return {
    branch: _getBranchManager(),
    pr: _getPRManager()
  };
}

/**
 * Initialize all managers
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialized managers
 */
export async function initializeBranchManagers(options = {}) {
  const managers = getAllBranchManagers();

  await Promise.all([
    managers.branch.initialize(options),
    managers.pr.initialize(options)
  ]);

  return managers;
}

/**
 * Clear all histories
 */
export function clearAllBranchHistories() {
  const managers = getAllBranchManagers();
  Object.values(managers).forEach(manager => manager.clearHistory());
}
