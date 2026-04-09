/**
 * StreamingExecutor
 * -----------------
 * Manages AbortController hierarchy and progress streaming for parallel agent execution.
 * Inspired by Claude Code's StreamingToolExecutor pattern.
 *
 * Hierarchy: System → Group → Agent
 * Cascading abort: group failure aborts all siblings in that group.
 * Progress: agents report progress, events flow through EventBus to Gru UI.
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

export const StreamingEvents = {
  PROGRESS_UPDATE: 'streaming:progress:update',
  GROUP_STARTED: 'streaming:group:started',
  GROUP_COMPLETED: 'streaming:group:completed',
  AGENT_PROGRESS: 'streaming:agent:progress',
  ABORT_INITIATED: 'streaming:abort:initiated',
  ABORT_COMPLETED: 'streaming:abort:completed',
  ABORT_CASCADED: 'streaming:abort:cascaded'
};

const logger = createLogger('StreamingExecutor');

/**
 * Abort reasons for telemetry and decision logging
 */
export const AbortReason = {
  CRITICAL_FAILURE: 'critical_failure',
  CIRCUIT_OPEN: 'circuit_open',
  USER_REQUESTED: 'user_requested',
  CASCADED: 'cascaded',
  TIMEOUT: 'timeout',
  SYSTEM_SHUTDOWN: 'system_shutdown'
};

/**
 * Progress status for agents
 */
export const ProgressStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted'
};

class StreamingExecutor {
  constructor() {
    this.eventBus = null;

    // AbortController hierarchy
    this.systemController = null;
    this.groupControllers = new Map();  // Map<groupId, AbortController>
    this.agentControllers = new Map();  // Map<agentName, { controller, groupId }>

    // Progress tracking
    this.progressMap = new Map(); // Map<agentName, ProgressEntry>

    // Group membership tracking
    this.groupMembers = new Map(); // Map<groupId, Set<agentName>>

    // Metrics
    this.metrics = {
      totalAborts: 0,
      cascadedAborts: 0,
      progressUpdates: 0,
      groupsStarted: 0,
      groupsCompleted: 0
    };
  }

  /**
   * Initialize
   */
  initialize() {
    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available for StreamingExecutor');
    }

    logger.info('StreamingExecutor initialized');
  }

  /**
   * Create a system-level AbortController (top of hierarchy)
   * @returns {AbortController}
   */
  createSystemAbort() {
    // Clean up previous system controller
    if (this.systemController) {
      this.reset();
    }

    this.systemController = new AbortController();
    logger.debug('System AbortController created');
    return this.systemController;
  }

  /**
   * Create a group-level AbortController (child of system)
   * @param {string} groupId
   * @returns {AbortController}
   */
  createGroupAbort(groupId) {
    const controller = new AbortController();
    this.groupControllers.set(groupId, controller);
    this.groupMembers.set(groupId, new Set());

    // If system is aborted, cascade to this group
    if (this.systemController) {
      this.systemController.signal.addEventListener('abort', () => {
        if (!controller.signal.aborted) {
          controller.abort(this.systemController.signal.reason || AbortReason.SYSTEM_SHUTDOWN);
        }
      }, { once: true });
    }

    this.metrics.groupsStarted++;

    if (this.eventBus) {
      this.eventBus.publish(StreamingEvents.GROUP_STARTED, {
        groupId, timestamp: Date.now()
      });
    }

    logger.debug(`Group AbortController created: ${groupId}`);
    return controller;
  }

  /**
   * Create an agent-level AbortController (child of group)
   * @param {string} agentName
   * @param {string} groupId
   * @returns {AbortController}
   */
  createAgentAbort(agentName, groupId) {
    const controller = new AbortController();
    this.agentControllers.set(agentName, { controller, groupId });

    // Track group membership
    const members = this.groupMembers.get(groupId);
    if (members) {
      members.add(agentName);
    }

    // If group is aborted, cascade to this agent
    const groupController = this.groupControllers.get(groupId);
    if (groupController) {
      groupController.signal.addEventListener('abort', () => {
        if (!controller.signal.aborted) {
          controller.abort(groupController.signal.reason || AbortReason.CASCADED);
        }
      }, { once: true });
    }

    // Initialize progress entry
    this.progressMap.set(agentName, {
      status: ProgressStatus.PENDING,
      percent: 0,
      message: '',
      startTime: null,
      endTime: null
    });

    logger.debug(`Agent AbortController created: ${agentName} in group ${groupId}`);
    return controller;
  }

  /**
   * Get the AbortSignal for an agent
   * @param {string} agentName
   * @returns {AbortSignal|null}
   */
  getAgentSignal(agentName) {
    const entry = this.agentControllers.get(agentName);
    return entry ? entry.controller.signal : null;
  }

  /**
   * Abort a single agent
   * @param {string} agentName
   * @param {string} reason
   */
  abortAgent(agentName, reason = AbortReason.CRITICAL_FAILURE) {
    const entry = this.agentControllers.get(agentName);
    if (!entry) {
      logger.warn(`No controller found for agent: ${agentName}`);
      return;
    }

    if (!entry.controller.signal.aborted) {
      entry.controller.abort(reason);
      this.metrics.totalAborts++;

      this._updateProgress(agentName, {
        status: ProgressStatus.ABORTED,
        message: `Aborted: ${reason}`,
        endTime: Date.now()
      });

      if (this.eventBus) {
        this.eventBus.publish(StreamingEvents.ABORT_INITIATED, {
          agentName, reason, groupId: entry.groupId, timestamp: Date.now()
        });
      }

      logger.info(`Agent aborted: ${agentName} (reason: ${reason})`);
    }
  }

  /**
   * Abort an entire group with cascading to all member agents
   * @param {string} groupId
   * @param {string} reason
   * @param {object} options - { cascade: true, sourceAgent: null }
   */
  abortGroup(groupId, reason = AbortReason.CRITICAL_FAILURE, options = {}) {
    const { cascade = true, sourceAgent = null } = options;
    const controller = this.groupControllers.get(groupId);

    if (!controller) {
      logger.warn(`No controller found for group: ${groupId}`);
      return;
    }

    if (controller.signal.aborted) return;

    // Abort the group controller - this cascades to all agents via signal listeners
    controller.abort(reason);
    this.metrics.totalAborts++;

    // Track cascaded aborts
    const members = this.groupMembers.get(groupId) || new Set();
    if (cascade && members.size > 0) {
      const cascadedAgents = [];
      for (const agentName of members) {
        if (agentName !== sourceAgent) {
          cascadedAgents.push(agentName);
          this.metrics.cascadedAborts++;

          this._updateProgress(agentName, {
            status: ProgressStatus.ABORTED,
            message: `Cascaded abort from ${sourceAgent || 'group'}`,
            endTime: Date.now()
          });
        }
      }

      if (this.eventBus && cascadedAgents.length > 0) {
        this.eventBus.publish(StreamingEvents.ABORT_CASCADED, {
          groupId,
          sourceAgent,
          cascadedAgents,
          reason,
          timestamp: Date.now()
        });
      }

      logger.info(`Group aborted: ${groupId} (cascaded to ${cascadedAgents.length} agents)`);
    }

    if (this.eventBus) {
      this.eventBus.publish(StreamingEvents.ABORT_INITIATED, {
        groupId, reason, sourceAgent, timestamp: Date.now()
      });
    }
  }

  /**
   * Abort the entire system
   * @param {string} reason
   */
  abortSystem(reason = AbortReason.SYSTEM_SHUTDOWN) {
    if (!this.systemController) {
      logger.warn('No system controller to abort');
      return;
    }

    if (!this.systemController.signal.aborted) {
      this.systemController.abort(reason);
      this.metrics.totalAborts++;

      if (this.eventBus) {
        this.eventBus.publish(StreamingEvents.ABORT_INITIATED, {
          level: 'system', reason, timestamp: Date.now()
        });
      }

      logger.warn(`System abort initiated: ${reason}`);
    }
  }

  /**
   * Report progress for an agent (called by agents during execution)
   * @param {string} agentName
   * @param {object} progress - { percent, message, status? }
   */
  reportProgress(agentName, progress) {
    this.metrics.progressUpdates++;

    const update = {
      status: progress.status || ProgressStatus.RUNNING,
      percent: Math.min(100, Math.max(0, progress.percent || 0)),
      message: progress.message || '',
      startTime: this.progressMap.get(agentName)?.startTime || Date.now()
    };

    if (update.status === ProgressStatus.RUNNING && !this.progressMap.get(agentName)?.startTime) {
      update.startTime = Date.now();
    }

    this._updateProgress(agentName, update);

    if (this.eventBus) {
      this.eventBus.publish(StreamingEvents.AGENT_PROGRESS, {
        agentName,
        ...update,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Mark an agent as started (called by Orchestrator)
   */
  markStarted(agentName) {
    this._updateProgress(agentName, {
      status: ProgressStatus.RUNNING,
      percent: 0,
      message: 'Starting...',
      startTime: Date.now()
    });
  }

  /**
   * Mark an agent as completed (called by Orchestrator)
   */
  markCompleted(agentName) {
    this._updateProgress(agentName, {
      status: ProgressStatus.COMPLETED,
      percent: 100,
      message: 'Completed',
      endTime: Date.now()
    });
  }

  /**
   * Mark an agent as failed (called by Orchestrator)
   */
  markFailed(agentName, error) {
    this._updateProgress(agentName, {
      status: ProgressStatus.FAILED,
      message: `Failed: ${error?.message || error || 'Unknown error'}`,
      endTime: Date.now()
    });
  }

  /**
   * Mark a group as completed
   */
  markGroupCompleted(groupId) {
    this.metrics.groupsCompleted++;

    if (this.eventBus) {
      const members = this.groupMembers.get(groupId) || new Set();
      this.eventBus.publish(StreamingEvents.GROUP_COMPLETED, {
        groupId,
        agents: Array.from(members),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check if an agent has been aborted
   * @param {string} agentName
   * @returns {boolean}
   */
  isAborted(agentName) {
    const entry = this.agentControllers.get(agentName);
    return entry ? entry.controller.signal.aborted : false;
  }

  /**
   * Check if the system has been aborted
   * @returns {boolean}
   */
  isSystemAborted() {
    return this.systemController ? this.systemController.signal.aborted : false;
  }

  /**
   * Get progress for a specific agent or all agents
   * @param {string} agentName - Optional
   * @returns {object}
   */
  getProgress(agentName) {
    if (agentName) {
      return this.progressMap.get(agentName) || null;
    }
    return Object.fromEntries(this.progressMap);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Update progress internally
   */
  _updateProgress(agentName, update) {
    const existing = this.progressMap.get(agentName) || {};
    this.progressMap.set(agentName, { ...existing, ...update });
  }

  /**
   * Clean up controllers and progress for a group
   */
  cleanupGroup(groupId) {
    const members = this.groupMembers.get(groupId) || new Set();
    for (const agentName of members) {
      this.agentControllers.delete(agentName);
    }
    this.groupControllers.delete(groupId);
    this.groupMembers.delete(groupId);
  }

  /**
   * Reset everything (for testing or between executions)
   */
  reset() {
    // Abort any active controllers
    if (this.systemController && !this.systemController.signal.aborted) {
      this.systemController.abort(AbortReason.SYSTEM_SHUTDOWN);
    }

    this.systemController = null;
    this.groupControllers.clear();
    this.agentControllers.clear();
    this.progressMap.clear();
    this.groupMembers.clear();

    this.metrics = {
      totalAborts: 0,
      cascadedAborts: 0,
      progressUpdates: 0,
      groupsStarted: 0,
      groupsCompleted: 0
    };
  }
}

// Singleton
let instance = null;

export function getStreamingExecutor() {
  if (!instance) {
    instance = new StreamingExecutor();
  }
  return instance;
}

export function resetStreamingExecutor() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default StreamingExecutor;
