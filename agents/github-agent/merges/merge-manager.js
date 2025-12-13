/**
 * MergeManager - Manages PR Merging
 *
 * Phase 9.3: Merge & Issue Management
 * Handles PR merging with condition checking and auto-merge logic
 */

import { BaseManager, OPERATION_STATUS } from '../branches/base-manager.js';

/**
 * Merge method
 */
export const MERGE_METHOD = {
  MERGE: 'merge',           // Create merge commit
  SQUASH: 'squash',         // Squash and merge
  REBASE: 'rebase'          // Rebase and merge
};

/**
 * Merge status
 */
export const MERGE_STATUS = {
  READY: 'ready',
  BLOCKED: 'blocked',
  CONFLICTS: 'conflicts',
  PENDING_CHECKS: 'pending_checks',
  PENDING_REVIEWS: 'pending_reviews'
};

/**
 * MergeManager
 * Manages PR merging
 */
export class MergeManager extends BaseManager {
  constructor() {
    super('MergeManager', 'merge');
    this.autoMergeConfig = {
      enabled: false,
      requireReviews: 1,
      requireCIPass: true,
      allowConflicts: false,
      mergeMethod: MERGE_METHOD.SQUASH
    };
  }

  /**
   * Check if PR can be merged
   * @param {Object} options - Check options
   * @returns {Promise<Object>} Merge readiness result
   */
  async checkMergeConditions(options = {}) {
    this.ensureInitialized();

    const { prNumber } = options;

    this.logger.info(`Checking merge conditions for PR #${prNumber}`);

    try {
      const pr = await this.getPR(prNumber);
      const conditions = {
        mergeable: this.checkMergeable(pr),
        approvals: await this.checkApprovals(pr),
        ciChecks: await this.checkCIChecks(pr),
        conflicts: this.checkConflicts(pr),
        reviews: await this.checkReviews(pr)
      };

      const status = this.determineMergeStatus(conditions);
      const canMerge = status === MERGE_STATUS.READY;

      const result = this.createResult({
        success: true,
        data: {
          prNumber,
          canMerge,
          status,
          conditions,
          blockers: this.identifyBlockers(conditions)
        }
      });

      this.recordOperation(result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to check merge conditions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PR
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR data
   */
  async getPR(prNumber) {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return pr;
  }

  /**
   * Check if PR is mergeable
   * @param {Object} pr - PR data
   * @returns {Object} Mergeable check result
   */
  checkMergeable(pr) {
    return {
      passed: pr.mergeable !== false,
      value: pr.mergeable,
      message: pr.mergeable === false
        ? 'PR has merge conflicts'
        : 'PR is mergeable'
    };
  }

  /**
   * Check approvals
   * @param {Object} pr - PR data
   * @returns {Promise<Object>} Approvals check result
   */
  async checkApprovals(pr) {
    const { data: reviews } = await this.octokit.rest.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: pr.number
    });

    // Get latest review from each reviewer
    const latestReviews = new Map();
    reviews.forEach(review => {
      const existing = latestReviews.get(review.user.login);
      if (!existing || new Date(review.submitted_at) > new Date(existing.submitted_at)) {
        latestReviews.set(review.user.login, review);
      }
    });

    const approvals = Array.from(latestReviews.values()).filter(
      review => review.state === 'APPROVED'
    ).length;

    const changesRequested = Array.from(latestReviews.values()).filter(
      review => review.state === 'CHANGES_REQUESTED'
    ).length;

    const passed = approvals >= this.autoMergeConfig.requireReviews && changesRequested === 0;

    return {
      passed,
      approvals,
      changesRequested,
      required: this.autoMergeConfig.requireReviews,
      message: passed
        ? `${approvals} approval(s) received`
        : changesRequested > 0
          ? 'Changes requested by reviewers'
          : `Needs ${this.autoMergeConfig.requireReviews - approvals} more approval(s)`
    };
  }

  /**
   * Check CI checks
   * @param {Object} pr - PR data
   * @returns {Promise<Object>} CI checks result
   */
  async checkCIChecks(pr) {
    try {
      const { data: checks } = await this.octokit.rest.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: pr.head.sha
      });

      if (checks.total_count === 0) {
        return {
          passed: true,
          total: 0,
          message: 'No CI checks configured'
        };
      }

      const completed = checks.check_runs.filter(check => check.status === 'completed');
      const successful = completed.filter(check => check.conclusion === 'success');
      const failed = completed.filter(check => check.conclusion === 'failure');
      const pending = checks.check_runs.filter(check => check.status !== 'completed');

      const passed = this.autoMergeConfig.requireCIPass
        ? failed.length === 0 && pending.length === 0
        : true;

      return {
        passed,
        total: checks.total_count,
        successful: successful.length,
        failed: failed.length,
        pending: pending.length,
        message: passed
          ? 'All CI checks passed'
          : pending.length > 0
            ? `${pending.length} check(s) still running`
            : `${failed.length} check(s) failed`
      };
    } catch (error) {
      this.logger.warn(`Failed to check CI status: ${error.message}`);
      return {
        passed: !this.autoMergeConfig.requireCIPass,
        total: 0,
        message: 'Could not check CI status'
      };
    }
  }

  /**
   * Check conflicts
   * @param {Object} pr - PR data
   * @returns {Object} Conflicts check result
   */
  checkConflicts(pr) {
    const hasConflicts = pr.mergeable_state === 'dirty';

    return {
      passed: !hasConflicts || this.autoMergeConfig.allowConflicts,
      hasConflicts,
      message: hasConflicts
        ? 'PR has merge conflicts'
        : 'No merge conflicts'
    };
  }

  /**
   * Check reviews
   * @param {Object} pr - PR data
   * @returns {Promise<Object>} Reviews check result
   */
  async checkReviews(pr) {
    const { data: requestedReviewers } = await this.octokit.rest.pulls.listRequestedReviewers({
      owner: this.owner,
      repo: this.repo,
      pull_number: pr.number
    });

    const pendingReviewers = requestedReviewers.users.length + requestedReviewers.teams.length;

    return {
      passed: pendingReviewers === 0,
      pending: pendingReviewers,
      message: pendingReviewers > 0
        ? `Waiting for ${pendingReviewers} reviewer(s)`
        : 'No pending reviews'
    };
  }

  /**
   * Determine merge status
   * @param {Object} conditions - Merge conditions
   * @returns {string} Merge status
   */
  determineMergeStatus(conditions) {
    if (!conditions.conflicts.passed) {
      return MERGE_STATUS.CONFLICTS;
    }

    if (!conditions.ciChecks.passed) {
      return MERGE_STATUS.PENDING_CHECKS;
    }

    if (!conditions.approvals.passed) {
      return MERGE_STATUS.PENDING_REVIEWS;
    }

    if (!conditions.mergeable.passed) {
      return MERGE_STATUS.BLOCKED;
    }

    return MERGE_STATUS.READY;
  }

  /**
   * Identify blockers
   * @param {Object} conditions - Merge conditions
   * @returns {Array} Blocker messages
   */
  identifyBlockers(conditions) {
    const blockers = [];

    if (!conditions.mergeable.passed) {
      blockers.push(conditions.mergeable.message);
    }

    if (!conditions.conflicts.passed) {
      blockers.push(conditions.conflicts.message);
    }

    if (!conditions.approvals.passed) {
      blockers.push(conditions.approvals.message);
    }

    if (!conditions.ciChecks.passed) {
      blockers.push(conditions.ciChecks.message);
    }

    if (!conditions.reviews.passed) {
      blockers.push(conditions.reviews.message);
    }

    return blockers;
  }

  /**
   * Merge PR
   * @param {Object} options - Merge options
   * @returns {Promise<Object>} Merge result
   */
  async mergePR(options = {}) {
    this.ensureInitialized();

    const {
      prNumber,
      method = this.autoMergeConfig.mergeMethod,
      commitTitle = null,
      commitMessage = null,
      checkConditions = true
    } = options;

    this.logger.info(`Merging PR #${prNumber} using ${method}`);

    try {
      // Check merge conditions first
      if (checkConditions) {
        const conditionsCheck = await this.checkMergeConditions({ prNumber });
        if (!conditionsCheck.data.canMerge) {
          return this.createResult({
            success: false,
            error: 'PR cannot be merged yet',
            data: {
              status: conditionsCheck.data.status,
              blockers: conditionsCheck.data.blockers
            }
          });
        }
      }

      // Perform merge
      const { data: merge } = await this.octokit.rest.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: method
      });

      const result = this.createResult({
        success: true,
        data: {
          prNumber,
          merged: merge.merged,
          sha: merge.sha,
          message: merge.message
        }
      });

      this.recordOperation(result);
      this.logger.info(`PR #${prNumber} merged successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to merge PR: ${error.message}`);

      const result = this.createResult({
        success: false,
        error: error.message
      });

      this.recordOperation(result);
      throw error;
    }
  }

  /**
   * Auto-merge PR if conditions are met
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Merge result
   */
  async autoMerge(prNumber) {
    if (!this.autoMergeConfig.enabled) {
      return this.createResult({
        success: false,
        status: OPERATION_STATUS.SKIPPED,
        error: 'Auto-merge is not enabled'
      });
    }

    this.logger.info(`Attempting auto-merge for PR #${prNumber}`);

    return this.mergePR({
      prNumber,
      method: this.autoMergeConfig.mergeMethod,
      checkConditions: true
    });
  }

  /**
   * Enable auto-merge
   * @param {Object} config - Auto-merge configuration
   */
  enableAutoMerge(config = {}) {
    this.autoMergeConfig = {
      ...this.autoMergeConfig,
      ...config,
      enabled: true
    };

    this.logger.info('Auto-merge enabled');
  }

  /**
   * Disable auto-merge
   */
  disableAutoMerge() {
    this.autoMergeConfig.enabled = false;
    this.logger.info('Auto-merge disabled');
  }

  /**
   * Get auto-merge configuration
   * @returns {Object} Auto-merge config
   */
  getAutoMergeConfig() {
    return { ...this.autoMergeConfig };
  }
}

/**
 * Get singleton instance
 */
let managerInstance = null;

export function getMergeManager() {
  if (!managerInstance) {
    managerInstance = new MergeManager();
  }
  return managerInstance;
}
