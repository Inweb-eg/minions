/**
 * Merges Module - Merge and Issue Management
 *
 * Phase 9.3: Merge & Issue Management
 * Exports all merge and issue management components
 */

export {
  MergeManager,
  getMergeManager,
  MERGE_METHOD,
  MERGE_STATUS
} from './merge-manager.js';

export {
  IssueManager,
  getIssueManager,
  ISSUE_PRIORITY,
  ISSUE_TYPE
} from './issue-manager.js';

import { getMergeManager as _getMergeManager } from './merge-manager.js';
import { getIssueManager as _getIssueManager } from './issue-manager.js';

/**
 * Get all merge managers
 * @returns {Object} All manager instances
 */
export function getAllMergeManagers() {
  return {
    merge: _getMergeManager(),
    issue: _getIssueManager()
  };
}

/**
 * Initialize all merge managers
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialized managers
 */
export async function initializeMergeManagers(options = {}) {
  const managers = getAllMergeManagers();

  await Promise.all([
    managers.merge.initialize(options),
    managers.issue.initialize(options)
  ]);

  return managers;
}

/**
 * Clear all merge histories
 */
export function clearAllMergeHistories() {
  const managers = getAllMergeManagers();
  Object.values(managers).forEach(manager => manager.clearHistory());
}
