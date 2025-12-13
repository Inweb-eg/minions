/**
 * BranchManager - Manages Git Branches
 *
 * Phase 9.1: Branch & PR Management
 * Creates, manages, and resolves conflicts in Git branches
 */

import { BaseManager, OPERATION_STATUS } from './base-manager.js';
import simpleGit from 'simple-git';

/**
 * Branch types
 */
export const BRANCH_TYPE = {
  FEATURE: 'feature',
  BUGFIX: 'bugfix',
  HOTFIX: 'hotfix',
  RELEASE: 'release',
  CHORE: 'chore'
};

/**
 * BranchManager
 * Manages Git branches
 */
export class BranchManager extends BaseManager {
  constructor() {
    super('BranchManager', 'branch');
    this.git = null;
  }

  /**
   * Initialize
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    await super.initialize(options);

    const { workingDir = process.cwd() } = options;
    this.git = simpleGit(workingDir);
    this.workingDir = workingDir;

    this.logger.info(`Git initialized in ${workingDir}`);
  }

  /**
   * Create branch
   * @param {Object} options - Branch options
   * @returns {Promise<Object>} Result
   */
  async createBranch(options = {}) {
    this.ensureInitialized();

    const {
      name,
      type = BRANCH_TYPE.FEATURE,
      baseBranch = null,
      push = true,
      checkout = true
    } = options;

    try {
      // Get base branch
      const base = baseBranch || await this.getDefaultBranch();

      // Generate branch name if not provided
      const branchName = name || this.generateBranchName(type);

      this.logger.info(`Creating branch: ${branchName} from ${base}`);

      // Fetch latest changes
      await this.git.fetch();

      // Checkout base branch and pull
      await this.git.checkout(base);
      await this.git.pull('origin', base);

      // Create and optionally checkout new branch
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }

      // Push to remote if requested
      if (push) {
        await this.git.push('origin', branchName, ['--set-upstream']);
      }

      const result = this.createResult({
        success: true,
        data: {
          branchName,
          baseBranch: base,
          pushed: push,
          checkedOut: checkout
        }
      });

      this.recordOperation(result);
      this.logger.info(`Branch created successfully: ${branchName}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to create branch: ${error.message}`);

      const result = this.createResult({
        success: false,
        error: error.message
      });

      this.recordOperation(result);
      throw error;
    }
  }

  /**
   * Delete branch
   * @param {Object} options - Delete options
   * @returns {Promise<Object>} Result
   */
  async deleteBranch(options = {}) {
    this.ensureInitialized();

    const {
      branchName,
      deleteRemote = true,
      force = false
    } = options;

    try {
      this.logger.info(`Deleting branch: ${branchName}`);

      // Delete local branch
      await this.git.deleteLocalBranch(branchName, force);

      // Delete remote branch if requested
      if (deleteRemote) {
        await this.git.push('origin', branchName, ['--delete']);
      }

      const result = this.createResult({
        success: true,
        data: {
          branchName,
          deletedRemote: deleteRemote
        }
      });

      this.recordOperation(result);
      this.logger.info(`Branch deleted successfully: ${branchName}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to delete branch: ${error.message}`);

      const result = this.createResult({
        success: false,
        error: error.message
      });

      this.recordOperation(result);
      throw error;
    }
  }

  /**
   * Check for conflicts
   * @param {Object} options - Check options
   * @returns {Promise<Object>} Conflict check result
   */
  async checkConflicts(options = {}) {
    this.ensureInitialized();

    const {
      branchName,
      targetBranch = null
    } = options;

    try {
      const target = targetBranch || await this.getDefaultBranch();

      this.logger.info(`Checking conflicts: ${branchName} → ${target}`);

      // Fetch latest changes
      await this.git.fetch();

      // Try merge dry-run
      const currentBranch = await this.getCurrentBranch();
      await this.git.checkout(branchName);

      try {
        await this.git.merge([`origin/${target}`, '--no-commit', '--no-ff']);

        // No conflicts
        await this.git.merge(['--abort']);
        await this.git.checkout(currentBranch);

        return this.createResult({
          success: true,
          data: {
            hasConflicts: false,
            branchName,
            targetBranch: target
          }
        });
      } catch (error) {
        // Conflicts detected
        await this.git.merge(['--abort']);
        await this.git.checkout(currentBranch);

        const conflictFiles = await this.getConflictFiles();

        return this.createResult({
          success: true,
          data: {
            hasConflicts: true,
            branchName,
            targetBranch: target,
            conflicts: conflictFiles
          }
        });
      }
    } catch (error) {
      this.logger.error(`Failed to check conflicts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve simple conflicts
   * @param {Object} options - Resolve options
   * @returns {Promise<Object>} Resolution result
   */
  async resolveConflicts(options = {}) {
    this.ensureInitialized();

    const {
      branchName,
      targetBranch = null,
      strategy = 'ours' // 'ours', 'theirs', or 'manual'
    } = options;

    try {
      const target = targetBranch || await this.getDefaultBranch();

      this.logger.info(`Resolving conflicts in ${branchName} using strategy: ${strategy}`);

      await this.git.checkout(branchName);
      await this.git.pull('origin', branchName);

      // Try merge with strategy
      try {
        if (strategy === 'ours') {
          await this.git.merge([`origin/${target}`, '-X', 'ours']);
        } else if (strategy === 'theirs') {
          await this.git.merge([`origin/${target}`, '-X', 'theirs']);
        } else {
          return this.createResult({
            success: false,
            error: 'Manual conflict resolution required'
          });
        }

        return this.createResult({
          success: true,
          data: {
            branchName,
            targetBranch: target,
            strategy,
            resolved: true
          }
        });
      } catch (error) {
        const conflictFiles = await this.getConflictFiles();

        return this.createResult({
          success: false,
          data: {
            branchName,
            targetBranch: target,
            strategy,
            resolved: false,
            conflicts: conflictFiles
          },
          error: 'Conflicts could not be auto-resolved'
        });
      }
    } catch (error) {
      this.logger.error(`Failed to resolve conflicts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get conflict files
   * @returns {Promise<Array>} Conflict files
   */
  async getConflictFiles() {
    const status = await this.git.status();
    return status.conflicted;
  }

  /**
   * Get current branch
   * @returns {Promise<string>} Current branch name
   */
  async getCurrentBranch() {
    const status = await this.git.status();
    return status.current;
  }

  /**
   * List branches
   * @param {Object} options - List options
   * @returns {Promise<Object>} Branch list
   */
  async listBranches(options = {}) {
    this.ensureInitialized();

    const { remote = false } = options;

    try {
      const summary = await this.git.branch(remote ? ['-r'] : []);

      return this.createResult({
        success: true,
        data: {
          branches: summary.all,
          current: summary.current,
          count: summary.all.length
        }
      });
    } catch (error) {
      this.logger.error(`Failed to list branches: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate branch name
   * @param {string} type - Branch type
   * @param {string} description - Description
   * @returns {string} Branch name
   */
  generateBranchName(type = BRANCH_TYPE.FEATURE, description = null) {
    const timestamp = Date.now();
    const desc = description
      ? description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      : timestamp;

    return `${type}/${desc}`;
  }

  /**
   * Checkout branch
   * @param {string} branchName - Branch name
   * @returns {Promise<Object>} Result
   */
  async checkoutBranch(branchName) {
    this.ensureInitialized();

    try {
      await this.git.checkout(branchName);

      return this.createResult({
        success: true,
        data: { branchName }
      });
    } catch (error) {
      this.logger.error(`Failed to checkout branch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync branch with remote
   * @param {string} branchName - Branch name
   * @returns {Promise<Object>} Result
   */
  async syncBranch(branchName = null) {
    this.ensureInitialized();

    try {
      const branch = branchName || await this.getCurrentBranch();

      await this.git.pull('origin', branch);

      return this.createResult({
        success: true,
        data: { branchName: branch, synced: true }
      });
    } catch (error) {
      this.logger.error(`Failed to sync branch: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Get singleton instance
 */
let managerInstance = null;

export function getBranchManager() {
  if (!managerInstance) {
    managerInstance = new BranchManager();
  }
  return managerInstance;
}
