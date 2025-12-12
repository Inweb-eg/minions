import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import { createLogger } from '../common/logger.js';

const execAsync = promisify(exec);
const logger = createLogger('RollbackManager');

/**
 * Manages checkpoints and rollbacks for agent operations
 * Ensures system can recover from failures
 */
class RollbackManager {
  constructor(checkpointsDir = './checkpoints') {
    this.checkpointsDir = checkpointsDir;
    this.eventBus = getEventBus();
    this.checkpoints = new Map(); // checkpoint ID -> checkpoint data
  }

  /**
   * Initialize rollback manager
   */
  async initialize() {
    // Create checkpoints directory
    await fs.mkdir(this.checkpointsDir, { recursive: true });
    logger.info(`Rollback manager initialized: ${this.checkpointsDir}`);
  }

  /**
   * Create a checkpoint before a risky operation
   */
  async createCheckpoint(operation, metadata = {}) {
    const checkpointId = this.generateCheckpointId(operation);
    const timestamp = Date.now();

    const checkpoint = {
      id: checkpointId,
      operation,
      timestamp,
      metadata,
      git: await this.captureGitState(),
      files: [],
      status: 'active'
    };

    // Store checkpoint
    this.checkpoints.set(checkpointId, checkpoint);
    await this.saveCheckpoint(checkpoint);

    logger.info(`Checkpoint created: ${checkpointId} for ${operation}`);
    return checkpointId;
  }

  /**
   * Capture current Git state
   */
  async captureGitState() {
    try {
      const [branch, commit, status] = await Promise.all([
        execAsync('git branch --show-current').then(r => r.stdout.trim()),
        execAsync('git rev-parse HEAD').then(r => r.stdout.trim()),
        execAsync('git status --porcelain').then(r => r.stdout.trim())
      ]);

      // Create a temporary stash if there are uncommitted changes
      let stashRef = null;
      if (status) {
        const stashResult = await execAsync('git stash push -m "Rollback checkpoint"');
        if (stashResult.stdout.includes('Saved working directory')) {
          stashRef = await execAsync('git rev-parse stash@{0}').then(r => r.stdout.trim());
        }
      }

      return {
        branch,
        commit,
        hasUncommittedChanges: !!status,
        stashRef
      };
    } catch (error) {
      logger.error('Failed to capture Git state:', error);
      return null;
    }
  }

  /**
   * Rollback to a checkpoint
   */
  async rollback(checkpointId, reason = 'Manual rollback') {
    const startTime = Date.now();

    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    logger.info(`Starting rollback to checkpoint: ${checkpointId}`);

    try {
      // Rollback Git state
      if (checkpoint.git) {
        await this.rollbackGit(checkpoint.git);
      }

      // Mark as rolled back
      checkpoint.status = 'rolled_back';
      checkpoint.rollback_time = Date.now();
      checkpoint.rollback_reason = reason;
      await this.saveCheckpoint(checkpoint);

      const duration = Date.now() - startTime;

      // Publish rollback event
      this.eventBus.publish(EventTypes.ROLLBACK_COMPLETED, {
        agent: 'rollback-manager',
        checkpoint_id: checkpointId,
        duration_ms: duration,
        reason
      });

      logger.info(`Rollback completed in ${duration}ms`);
      return { success: true, duration_ms: duration };

    } catch (error) {
      logger.error(`Rollback failed for ${checkpointId}:`, error);
      throw error;
    }
  }

  /**
   * Rollback Git to previous state
   */
  async rollbackGit(gitState) {
    try {
      // Reset to the commit
      await execAsync(`git reset --hard ${gitState.commit}`);
      logger.info(`Git reset to commit: ${gitState.commit}`);

      // Restore stash if exists
      if (gitState.stashRef) {
        await execAsync(`git stash pop`);
        logger.info('Restored uncommitted changes from stash');
      }

      // Checkout original branch if changed
      const currentBranch = await execAsync('git branch --show-current')
        .then(r => r.stdout.trim());

      if (currentBranch !== gitState.branch) {
        await execAsync(`git checkout ${gitState.branch}`);
        logger.info(`Checked out branch: ${gitState.branch}`);
      }

    } catch (error) {
      logger.error('Git rollback failed:', error);
      throw error;
    }
  }

  /**
   * Save checkpoint to disk
   */
  async saveCheckpoint(checkpoint) {
    const filePath = path.join(this.checkpointsDir, `${checkpoint.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Commit checkpoint (mark as successful, no rollback needed)
   */
  async commitCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return;

    checkpoint.status = 'committed';
    checkpoint.commit_time = Date.now();
    await this.saveCheckpoint(checkpoint);

    logger.info(`Checkpoint committed: ${checkpointId}`);
  }

  /**
   * Generate unique checkpoint ID
   */
  generateCheckpointId(operation) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${operation.replace(/[^a-z0-9]/gi, '-')}-${timestamp}-${random}`;
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId) {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(filter = {}) {
    let checkpoints = Array.from(this.checkpoints.values());

    if (filter.operation) {
      checkpoints = checkpoints.filter(c => c.operation === filter.operation);
    }

    if (filter.status) {
      checkpoints = checkpoints.filter(c => c.status === filter.status);
    }

    return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clean up old checkpoints
   */
  async cleanup(maxAge = 86400000) { // Default: 24 hours
    const now = Date.now();
    const toDelete = [];

    for (const [id, checkpoint] of this.checkpoints.entries()) {
      if (checkpoint.status === 'committed' && now - checkpoint.timestamp > maxAge) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.checkpoints.delete(id);
      const filePath = path.join(this.checkpointsDir, `${id}.json`);
      await fs.unlink(filePath).catch(() => {});
    }

    logger.info(`Cleaned up ${toDelete.length} old checkpoints`);
    return toDelete.length;
  }
}

// Singleton instance
let instance = null;

export function getRollbackManager() {
  if (!instance) {
    instance = new RollbackManager();
  }
  return instance;
}

export default RollbackManager;
